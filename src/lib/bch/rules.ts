import { evidence } from "./sources";
import type { Compilation, DoctorFinding, Severity } from "./types";

// Preserve columns and newlines while masking comments and literals. No claim
// is triggered by an identifier mentioned only in a comment or string.
export function maskNonCode(source: string): string {
  return source.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
    (value) => value.replace(/[^\n]/g, " "),
  );
}

const definitions = [
  {
    id: "layla-p2s",
    severity: "opportunity",
    title: "Review P2SH output construction",
    source: "p2s",
    quote:
      "This reduces the overhead of most covenant systems by at least 34 bytes per output.",
    pattern: /\bLockingBytecodeP2SH(?:20|32)\b/,
    fix: "Review replacing the matched P2SH construction with a direct script output. Compare fully instantiated bytecode and spending paths before changing the covenant; this heuristic does not calculate your savings.",
  },
  {
    id: "layla-nft-commitment",
    severity: "opportunity",
    title: "Review NFT commitment bounds",
    source: "p2s",
    quote:
      "The limit on maximum length of token commitments is raised from `40` bytes to `128` bytes.",
    pattern: /\.(?:tokenCategory|nftCommitment)\b/,
    fix: "Review commitment length checks, serialization and wallet compatibility at the matched token fields. Keep any application-specific bounds intentional; tokenCategory alone does not prove this contract uses an NFT.",
  },
  {
    id: "layla-loops",
    severity: "opportunity",
    title: "Review unrolled repetition",
    source: "loops",
    quote:
      "This proposal adds two new BCH virtual machine (VM) operations, `OP_BEGIN` and `OP_UNTIL`, enabling a variety of loop constructions in BCH contracts without increasing the processing or memory requirements of the VM.",
    fix: "Try a bounded CashScript for loop around the repeated checks. cashc 0.14.0 loop support is compile-tested. Compare compiled size and execution cost; fewer source lines alone do not prove a saving.",
  },
  {
    id: "layla-functions",
    severity: "opportunity",
    title: "Review reusable checks",
    source: "functions",
    quote:
      "This proposal introduces the `OP_DEFINE` and `OP_INVOKE` opcodes, enabling Bitcoin Cash contract bytecode to be factored into reusable functions.",
    fix: "Consider a top-level reusable function for the repeated checks. cashc 0.14.0 function syntax is compile-tested; its optimizer may inline a small function. Inspect bytecode before claiming an OP_DEFINE/OP_INVOKE saving.",
  },
  {
    id: "layla-unlocking-size",
    severity: "watch",
    title: "Review unlocking bytecode assumptions",
    source: "p2s",
    quote:
      "The limit on maximum standard input bytecode length (A.K.A. `MAX_TX_IN_SCRIPT_SIG_SIZE` – 1,650 bytes) is removed such that the maximum unlocking bytecode length is equal for both standard and consensus validation: 10,000 bytes (A.K.A. `MAX_SCRIPT_SIZE`).",
    pattern: /\.unlockingBytecode\b/,
    fix: "Measure the complete unlocking script, including arguments and any redeem script. Review local size checks against the cited specification. The compiled template size is not the unlocking size.",
  },
  {
    id: "faster-blocks-timelocks",
    severity: "watch",
    title: "2027 watch · timelock assumptions",
    source: "faster",
    quote:
      "Height-mode `nLocktime` and `nSequence` are normalized to the 10-minute scale: values are compared against ticks, not raw height.",
    pattern:
      /\b(?:tx|this)\.(?:age|time)\b|\btx\.locktime\b|\.sequenceNumber\b|\b(?:blockHeight|blockheight|block_height)\b/,
    fix: "Review the matched lock fields and the app code that constructs them against this proposed specification. Do not shorten existing delays based on a faster-block assumption. Recheck proposal status before deployment.",
  },
] as const;

function repeatedLines(code: string): number[] {
  const groups = new Map<string, number[]>();
  const occurrences = new Map<string, number>();
  for (const match of code.matchAll(/\brequire\s*\([\s\S]*?\)\s*;/g)) {
    const key = match[0].replace(/\s+/g, "").replace(/\[\d+\]/g, "[#]");
    if (key.length < 25) continue;
    const startLine = code.slice(0, match.index).split("\n").length - 1;
    const indices = Array.from(
      { length: match[0].split("\n").length },
      (_, i) => startLine + i,
    );
    // Each entry is one whole require statement, even across source lines.
    const previous = groups.get(key) ?? [];
    groups.set(key, [...previous, ...indices]);
    occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
  }
  return [
    ...new Set(
      [...groups.entries()]
        .filter(([key]) => occurrences.get(key)! >= 2)
        .flatMap(([, lines]) => lines),
    ),
  ].sort((a, b) => a - b);
}

export function analyzeRules(
  source: string,
  file: string,
  compilation?: Compilation,
): DoctorFinding[] {
  const code = maskNonCode(source);
  const lines = code.split("\n"),
    original = source.split("\n");
  const repeated = repeatedLines(code);
  return definitions
    .flatMap((rule): DoctorFinding[] => {
      const indices =
        "pattern" in rule
          ? lines.flatMap((line, i) => (rule.pattern.test(line) ? [i] : []))
          : repeated;
      if (
        rule.id === "layla-unlocking-size" &&
        compilation &&
        compilation.bytecodeBytes > 1650 &&
        !indices.length
      ) {
        const index = lines.findIndex((line) => /\bcontract\b/.test(line));
        if (index >= 0) indices.push(index);
      }
      if (!indices.length) return [];
      const receipt = evidence(rule.source, rule.quote);
      if (!receipt) return [];
      return [
        {
          id: rule.id,
          severity: rule.severity,
          title: rule.title,
          matches: indices
            .slice(0, 30)
            .map((i) => ({
              file,
              line: i + 1,
              snippet: original[i].trim().slice(0, 300),
            })),
          evidence: receipt,
          status:
            rule.source === "faster"
              ? "Proposed · not locked in"
              : "May 2026 specification",
          fix: rule.fix,
        },
      ];
    })
    .sort((a, b) => {
      const rank: Record<Severity, number> = {
        risk: 0,
        watch: 1,
        opportunity: 2,
      };
      return (
        rank[a.severity] - rank[b.severity] || a.id.localeCompare(b.id, "en")
      );
    });
}
