import type { CodeHit, Finding, SourceFile, Verdict } from "./types";

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Conservative lexical search. Comments, strings, and case-only matches are fuzzy.
// This is evidence of API usage, not a parser or a proof that code will execute.
export function grepApi(api: string, files: SourceFile[]): CodeHit[] {
  const token = api.trim().replace(/\(\)$/, "");
  if (!token || token.length > 100) return [];
  const exact = new RegExp(`(?<![\\w$])${escapeRegex(token)}(?![\\w$])`);
  const fuzzy = new RegExp(escapeRegex(token), "i");
  const lastPart = token.includes(".") ? token.split(".").at(-1)! : "";
  const partial =
    lastPart.length >= 3
      ? new RegExp(`\\b${escapeRegex(lastPart)}\\b`, "i")
      : null;
  const hits: CodeHit[] = [];
  for (const file of files) {
    let inBlock = false;
    file.content.split(/\r?\n/).forEach((snippet, index) => {
      // Preserve quotes for JSON configuration keys; remove comments and ordinary strings.
      let code = "";
      let quote = "";
      const isJson = /(?:\.json|\.eslintrc)$/.test(file.path);
      for (let pos = 0; pos < snippet.length; pos++) {
        const char = snippet[pos],
          next = snippet[pos + 1];
        if (inBlock) {
          if (char === "*" && next === "/") {
            inBlock = false;
            pos++;
          }
          continue;
        }
        if (quote) {
          if (char === "\\") {
            if (isJson) code += char + (next ?? "");
            pos++;
            continue;
          }
          if (char === quote) quote = "";
          if (isJson) code += char;
          continue;
        }
        if (char === "/" && next === "/") break;
        if (char === "/" && next === "*") {
          inBlock = true;
          pos++;
          continue;
        }
        if (char === '"' || char === "'" || char === "`") {
          quote = char;
          code += isJson ? char : " ";
          continue;
        }
        code += char;
      }
      const match = exact.test(code)
        ? "exact"
        : fuzzy.test(snippet) || partial?.test(snippet)
          ? "fuzzy"
          : null;
      if (match) {
        const offset = snippet.toLowerCase().indexOf(token.toLowerCase());
        const start = Math.max(0, offset - 100);
        hits.push({
          file: file.path,
          line: index + 1,
          snippet: snippet.slice(start, start + 350).trim(),
          match,
        });
      }
    });
  }
  return hits.slice(0, 100);
}

export function verdictFor(hits: CodeHit[]): Verdict {
  return hits.some((hit) => hit.match === "exact")
    ? "will-break"
    : hits.length
      ? "might-break"
      : "safe";
}
export function rankFindings(findings: Finding[]): Finding[] {
  const order: Record<Verdict, number> = {
    "will-break": 0,
    "might-break": 1,
    safe: 2,
  };
  return [...findings].sort(
    (a, b) =>
      order[a.verdict] - order[b.verdict] ||
      b.hits.length - a.hits.length ||
      a.dependency.localeCompare(b.dependency) ||
      a.api.localeCompare(b.api),
  );
}
