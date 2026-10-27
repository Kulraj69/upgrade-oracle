export type Severity = "opportunity" | "watch" | "risk";
export type Evidence = {
  sourceId: string;
  quote: string;
  url: string;
  fetchedAt: string;
  sha256: string;
};
export type DoctorFinding = {
  id: string;
  severity: Severity;
  title: string;
  matches: { file: string; line: number; snippet: string }[];
  evidence: Evidence;
  status: "May 2026 specification" | "Proposed · not locked in";
  fix: string;
};
export type Compilation = {
  name: string;
  compiler: string;
  bytecode: string;
  bytecodeBytes: number;
  opcount: number;
  instructionCount: number;
  constructorInputs: { name: string; type: string }[];
  warnings: string[];
};
export type DoctorReport = {
  schema: "upgrade-oracle/bch-report-v1";
  rulesetVersion: 1;
  contract: { file: string; source: string } & Compilation;
  findings: DoctorFinding[];
  sources: { id: string; url: string; fetchedAt: string; sha256: string }[];
};
export type BchNetwork = "chipnet" | "mainnet";
