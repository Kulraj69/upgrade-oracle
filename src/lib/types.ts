export type Bump = { name: string; from: string; to: string };
export type SourceFile = { path: string; content: string };
export type AnalyzeInput = {
  bumps?: Bump[];
  packageJson?: string;
  targetPackageJson?: string;
  repoUrl?: string;
  files: SourceFile[];
  exampleId?: string;
};
export type ResolvedBump = Bump & {
  versions: string[];
  repository: string | null;
};
export type Note = {
  version: string;
  url: string;
  text: string;
  kind?: "migration" | "release" | "changelog";
};
export type BreakingChange = {
  api: string;
  change: string;
  migration: string;
  sourceVersion: string;
  quote: string;
};
export type CodeHit = {
  file: string;
  line: number;
  snippet: string;
  match: "exact" | "fuzzy";
};
export type Verdict = "will-break" | "might-break" | "safe";
export type Finding = BreakingChange & {
  id: string;
  dependency: string;
  from: string;
  to: string;
  verdict: Verdict;
  hits: CodeHit[];
  fix: string | null;
  receipt: { url: string; quote: string; version: string; noteIndex: number };
};
export type TraceStep = {
  id: string;
  label: string;
  url: string;
  method: "GET" | "POST" | "LOCAL";
  ms: number;
  bytes: number;
  status: "ok" | "error" | "cached";
  detail?: string;
};
export type Report = {
  id: string;
  mode: "live" | "demo";
  createdAt: string;
  model: string;
  durationMs: number;
  dependencies: ResolvedBump[];
  findings: Finding[];
  notes: Note[];
  trace: TraceStep[];
  warnings: string[];
  files: { path: string; lines: number }[];
  droppedCitations: number;
  coverage: {
    dependency: string;
    versionsResolved: number;
    versionsWithNotes: number;
    complete: boolean;
  }[];
  recording?: { exampleId: string; recordedAt: string; input: AnalyzeInput };
};
export type Recording = {
  schemaVersion: 1;
  exampleId: string;
  input: AnalyzeInput;
  report: Report;
};
export type AgentEnv = {
  GLM_BASE_URL?: string;
  GLM_API_KEY?: string;
  GLM_MODEL?: string;
};
