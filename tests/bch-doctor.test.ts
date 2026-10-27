import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileString } from "cashc";
import { analyzeRules, maskNonCode } from "@/lib/bch/rules";
import { sourceText, evidence } from "@/lib/bch/sources";
import { createDoctorReport, summarizeCompilation, validateContractInput } from "@/lib/bch/doctor";
import { compileContract } from "@/lib/bch/compiler";
import manifest from "@/sources/bch/manifest.json";

const compile = (source: string) => summarizeCompilation(compileString(source, { warningListener: () => {} }), []);
const ids = (source: string) => analyzeRules(source, "test.cash").map((f) => f.id);
const cases = [
  ["layla-p2s", "new LockingBytecodeP2SH32(hash);", "new LockingBytecodeP2PKH(hash);"],
  ["layla-nft-commitment", "tx.outputs[0].nftCommitment", "tx.outputs[0].value"],
  ["layla-loops", "require(tx.outputs[0].value >= 1000);\nrequire(tx.outputs[1].value >= 1000);", "require(tx.outputs[0].value >= 1000);"],
  ["layla-functions", "require(tx.outputs[0].lockingBytecode == target);\nrequire(tx.outputs[1].lockingBytecode == target);", "require(tx.outputs[0].lockingBytecode == target);"],
  ["layla-unlocking-size", "tx.inputs[0].unlockingBytecode.length", "tx.inputs[0].lockingBytecode.length"],
  ["faster-blocks-timelocks", "require(this.age >= 10);", "require(tx.outputs[0].value >= 10);"],
];

describe("BCH source-backed rules", () => {
  for (const [id, positive, negative] of cases) {
    it(`${id}: positive, negative and comments`, () => {
      expect(ids(positive)).toContain(id);
      expect(ids(negative)).not.toContain(id);
      expect(ids(`// ${positive.replaceAll("\n", "\n// ")}`)).not.toContain(id);
      expect(ids(`/* ${positive} */`)).not.toContain(id);
      expect(ids(JSON.stringify(positive))).not.toContain(id);
    });
  }
  it("masks comments without changing line numbers", () => {
    expect(maskNonCode('/* hi\nthere */\nrequire(this.age >= 1);').split("\n")).toHaveLength(3);
    expect(analyzeRules('// comment\nrequire(this.age >= 1);', "age.cash")[0].matches[0]).toMatchObject({ file: "age.cash", line: 2 });
  });
  it("includes P2SH20 and tokenCategory, without matching identifier substrings", () => {
    expect(ids("new LockingBytecodeP2SH20(h)")).toContain("layla-p2s");
    expect(ids("tx.inputs[0].tokenCategory")).toContain("layla-nft-commitment");
    expect(ids("new LockingBytecodeP2SH320(h)")).not.toContain("layla-p2s");
  });
  it("keeps proposals explicitly proposed and ranks watches first", () => {
    const findings = analyzeRules("require(tx.time >= 1);\nnew LockingBytecodeP2SH32(h);", "test.cash");
    expect(findings[0]).toMatchObject({ id: "faster-blocks-timelocks", severity: "watch", status: "Proposed · not locked in" });
    expect(findings[0].evidence.fetchedAt).toBeTruthy();
  });
  it("checks all snapshot digests and rejects invented quotes", () => {
    for (const source of manifest) expect(sourceText(source.id).length).toBeGreaterThan(100);
    expect(evidence("p2s", "Invented: BCH supports unlimited NFT metadata.")).toBeNull();
    expect(evidence("missing", "A sufficiently long but invented quote.")).toBeNull();
  });
});

describe("cashc 0.14 capabilities and isolation", () => {
  it("compiles native loops into BEGIN/UNTIL", () => {
    const a = compileString("pragma cashscript ^0.14.0; contract Loop() { function spend(int minimum) { for (int i = 0; i < 3; i++) { require(tx.outputs[i].value >= minimum); } } }");
    expect(a.bytecode).toContain("OP_BEGIN"); expect(a.bytecode).toContain("OP_UNTIL");
  });
  it("compiles reusable function syntax; small functions may be inlined", () => {
    const a = compileString("pragma cashscript ^0.14.0; function enough(int x, int y) returns (bool) { return x >= y; } contract Functions() { function spend(int minimum) { require(enough(tx.outputs[0].value, minimum)); require(enough(tx.outputs[1].value, minimum)); } }");
    expect(a.compiler.version).toBe("0.14.0"); expect(a.debug?.bytecode).toBeTruthy();
  });
  it("rejects bad syntax and cannot resolve disk imports", async () => {
    await expect(compileContract("contract Bad(")).rejects.toThrow();
    await expect(compileContract('import "/etc/passwd"; contract Bad() { function spend() { require(true); } }')).rejects.toThrow();
  });
  it("limits input and filename", () => {
    expect(() => validateContractInput({ source: "x".repeat(21 * 1024) })).toThrow();
    expect(() => validateContractInput({ source: "contract", file: "../secret.cash" })).toThrow();
  });
});

describe("recorded deterministic contract reports", () => {
  for (const name of ["recurring-payment", "p2sh-covenant", "token-vault"]) {
    it(`${name}: reproduces the full expected report`, async () => {
      const source = readFileSync(join(process.cwd(), "src/lib/bch/examples", `${name}.cash`), "utf8");
      const expected = JSON.parse(readFileSync(join(process.cwd(), "src/lib/bch/examples", `${name}.report.json`), "utf8"));
      const report = createDoctorReport(source, `${name}.cash`, compile(source));
      expect(report).toEqual(expected);
      expect(await compileContract(source)).toEqual(report.contract && compile(source));
      for (const finding of report.findings) expect(sourceText(finding.evidence.sourceId)).toContain(finding.evidence.quote);
    });
  }
});
