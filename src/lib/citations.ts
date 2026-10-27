import type { BreakingChange, Note } from "./types";

export function isBreakingCandidate(item: BreakingChange): boolean {
  const evidence = `${item.change}\n${item.quote}`;
  // A deprecation alone does not break an upgrade. Removed deprecated APIs still qualify.
  return (
    !/deprecat/i.test(evidence) ||
    /remov|no longer|not supported|unsupported|breaking|\bthrows?\b|\bcannot\b/i.test(
      evidence,
    )
  );
}

export function checkCitations(items: BreakingChange[], notes: Note[]) {
  const accepted: { item: BreakingChange; noteIndex: number }[] = [];
  let dropped = 0;
  const seen = new Set<string>();
  for (const item of items) {
    const noteIndex = notes.findIndex(
      (note) =>
        note.version === item.sourceVersion &&
        item.quote.length >= 16 &&
        note.text.includes(item.quote),
    );
    const key = `${item.api}:${item.sourceVersion}:${item.quote}`;
    if (noteIndex < 0) {
      dropped++;
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    accepted.push({ item, noteIndex });
  }
  return { accepted, dropped };
}
