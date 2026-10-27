import { checkCitations, isBreakingCandidate } from "./citations";
import { InputError, UpstreamError } from "./errors";
import { Fetcher } from "./fetcher";
import { GlmClient } from "./glm";
import { byteLength, validateInput } from "./input";
import { grepApi, rankFindings, verdictFor } from "./matcher";
import { fetchNotes, fetchRepository, resolveDependency } from "./sources";
import { diffManifests } from "./versions";
import type { AgentEnv, AnalyzeInput, Finding, Note, Report } from "./types";

export async function runLiveAgent(
  rawInput: AnalyzeInput,
  options: { env?: AgentEnv; fetcher?: Fetcher; signal?: AbortSignal } = {},
): Promise<Report> {
  const started = performance.now();
  const input = validateInput(rawInput);
  const env: AgentEnv = options.env ?? {
    GLM_API_KEY: process.env.GLM_API_KEY,
    GLM_BASE_URL: process.env.GLM_BASE_URL,
    GLM_MODEL: process.env.GLM_MODEL,
  };
  if (!env.GLM_API_KEY)
    throw new UpstreamError("Live analysis requires GLM_API_KEY.", 503);
  const fetcher = options.fetcher ?? new Fetcher(options.signal);
  const glm = new GlmClient(env, fetcher.trace, options.signal);
  const warnings: string[] = [];
  let files = input.files;
  let packageJson = input.packageJson;
  if (input.repoUrl) {
    const repo = await fetchRepository(input.repoUrl, fetcher);
    files = repo.files;
    packageJson = repo.packageJson;
    warnings.push(...repo.warnings);
  }
  const bumps = input.bumps?.length
    ? input.bumps
    : packageJson
      ? diffManifests(packageJson, input.targetPackageJson)
      : [];
  if (!bumps.length)
    throw new InputError("Choose at least one dependency to upgrade.");
  if (!files.length)
    warnings.push(
      "No source files supplied. “Safe” means no usage was found in an empty sample; it is not a compatibility guarantee.",
    );
  const dependencies: Report["dependencies"] = [];
  const notes: Note[] = [];
  const findings: Finding[] = [];
  const coverage: Report["coverage"] = [];
  let droppedCitations = 0;
  for (const bump of bumps) {
    options.signal?.throwIfAborted();
    const dep = await resolveDependency(bump, fetcher);
    dependencies.push(dep);
    const fetched = await fetchNotes(dep, fetcher);
    const notesOffset = notes.length;
    // Bound the context. Prioritize major release notes, then latest releases.
    let chars = 0;
    const selected = fetched
      .sort(
        (a, b) =>
          Number(b.kind === "migration") - Number(a.kind === "migration") ||
          Number(b.version.endsWith(".0.0")) -
            Number(a.version.endsWith(".0.0")),
      )
      .flatMap((note) => {
        const remaining = 96_000 - chars;
        if (remaining <= 0) return [];
        const text = note.text.slice(
          0,
          Math.min(note.kind === "migration" ? 50_000 : 8000, remaining),
        );
        chars += text.length;
        return [{ ...note, text }];
      });
    // Receipts keep the fetched originals, including text outside the model context.
    notes.push(...fetched);
    const coveredVersions = new Set(selected.map((n) => n.version));
    const complete =
      dep.versions.every((v) => coveredVersions.has(v)) &&
      selected.every(
        (n) =>
          fetched.find((f) => f.url === n.url && f.version === n.version)?.text
            .length === n.text.length,
      );
    coverage.push({
      dependency: dep.name,
      versionsResolved: dep.versions.length,
      versionsWithNotes: coveredVersions.size,
      complete,
    });
    if (!complete)
      warnings.push(
        `${dep.name}: bounded note coverage (${coveredVersions.size}/${dep.versions.length} versions; long notes may be excerpted). Unreviewed changes may exist.`,
      );
    if (!selected.length) {
      warnings.push(
        `${dep.name}: no release notes found. No compatibility verdict was inferred.`,
      );
      continue;
    }
    const identifiers = [
      ...new Set(
        files.flatMap((file) =>
          (
            file.content.match(/[A-Za-z_$][\w$]*(?:[.-][A-Za-z_$][\w$]*)*/g) ??
            []
          ).filter((token) => token.length > 2),
        ),
      ),
    ].slice(0, 180);
    const extracted = await glm.extract(dep.name, selected, identifiers);
    const startCheck = performance.now();
    const breaking = extracted.filter(isBreakingCandidate);
    if (breaking.length < extracted.length)
      warnings.push(
        `${dep.name}: excluded ${extracted.length - breaking.length} deprecation-only item(s); deprecation alone is not a breaking change.`,
      );
    const checked = checkCitations(breaking, selected);
    droppedCitations += checked.dropped;
    fetcher.local(
      "Verify citations",
      `${dep.name}: ${checked.accepted.length} verbatim quotes accepted; ${checked.dropped} rejected`,
      startCheck,
      byteLength(JSON.stringify(extracted)),
    );
    if (!checked.accepted.length)
      warnings.push(
        `${dep.name}: no cited breaking changes were extracted. This is not evidence that the upgrade is safe.`,
      );
    for (const { item, noteIndex } of checked.accepted) {
      const note = selected[noteIndex];
      const sourceIndex = fetched.findIndex(
        (n) => n.url === note.url && n.version === note.version,
      );
      const startMatch = performance.now();
      const hits = grepApi(item.api, files);
      fetcher.local(
        `Grep ${item.api}`,
        `${hits.length} hits in ${files.length} files`,
        startMatch,
        files.reduce((sum, file) => sum + byteLength(file.content), 0),
      );
      findings.push({
        ...item,
        id: `f${findings.length + 1}`,
        dependency: dep.name,
        from: dep.from,
        to: dep.to,
        hits,
        verdict: verdictFor(hits),
        fix: null,
        receipt: {
          url: note.url,
          quote: item.quote,
          version: note.version,
          noteIndex: notesOffset + sourceIndex,
        },
      });
    }
  }
  const needsFix = findings.filter((f) => f.verdict === "will-break");
  if (needsFix.length) {
    // Small batches keep completion budgets predictable for multi-dependency inputs.
    for (let offset = 0; offset < needsFix.length; offset += 8) {
      const batch = needsFix.slice(offset, offset + 8);
      try {
        const fixes = await glm.fixes(batch);
        for (const finding of batch) {
          finding.fix = fixes.get(finding.id) ?? finding.migration;
          if (!fixes.has(finding.id))
            warnings.push(
              `${finding.api}: generated fix failed grounding validation; showing the extracted migration.`,
            );
        }
      } catch {
        for (const finding of batch) finding.fix = finding.migration;
        warnings.push(
          "GLM fix generation was unavailable. Showing cited migration guidance instead.",
        );
      }
    }
  }
  if (droppedCitations)
    warnings.push(
      `${droppedCitations} unsupported quote${droppedCitations === 1 ? " was" : "s were"} discarded by the citation checker.`,
    );
  return {
    id: crypto.randomUUID(),
    mode: "live",
    createdAt: new Date().toISOString(),
    model: glm.model,
    durationMs: Math.round(performance.now() - started),
    dependencies,
    findings: rankFindings(findings),
    notes,
    trace: fetcher.trace,
    warnings,
    files: files.map((f) => ({
      path: f.path,
      lines: f.content.split(/\r?\n/).length,
    })),
    droppedCitations,
    coverage,
  };
}
