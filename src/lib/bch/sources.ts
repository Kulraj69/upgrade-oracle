import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import manifest from "@/sources/bch/manifest.json";
import { checkCitations } from "@/lib/citations";
import type { Evidence } from "./types";

const cache = new Map<string, string>();
export function sourceText(id: string): string {
  if (cache.has(id)) return cache.get(id)!;
  const source = manifest.find((item) => item.id === id);
  if (!source) throw new Error("Unknown pinned source.");
  const bytes = readFileSync(join(process.cwd(), "src/sources/bch", source.file));
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256)
    throw new Error("Pinned source integrity check failed.");
  const text = bytes.toString("utf8");
  cache.set(id, text);
  return text;
}

// The dependency analyzer and BCH rules use the same verbatim quote gate.
// Missing, changed, or unverified evidence suppresses the rule.
export function evidence(id: string, quote: string): Evidence | null {
  const source = manifest.find((item) => item.id === id);
  if (!source) return null;
  try {
    const result = checkCitations(
      [{ api: id, sourceVersion: source.sha256, quote, change: "", migration: "" }],
      [{ version: source.sha256, url: source.url, text: sourceText(id) }],
    );
    if (!result.accepted.length) return null;
    return { sourceId: id, quote, url: source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 };
  } catch { return null; }
}

export const pinnedSources = manifest.map(({ id, url, fetchedAt, sha256 }) => ({ id, url, fetchedAt, sha256 }));
