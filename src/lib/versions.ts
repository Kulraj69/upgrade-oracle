import { gt, lte, maxSatisfying, valid, validRange, compare } from "semver";
import { InputError } from "./errors";
import { MAX_DEPS, parseManifest, validateBumps } from "./input";
import type { Bump } from "./types";

export function diffManifests(before: string, after?: string): Bump[] {
  const current = parseManifest(before);
  const target = after ? parseManifest(after) : null;
  const bumps = Object.entries(current).flatMap(([name, from]) => {
    const to = target ? target[name] : "latest";
    return !to || to === from ? [] : [{ name, from, to }];
  });
  if (!bumps.length)
    throw new InputError(
      "No existing dependencies changed between these manifests.",
    );
  if (bumps.length > MAX_DEPS)
    throw new InputError(
      "This manifest has more than 6 candidates. Supply explicit bumps to select up to 6 dependencies.",
    );
  return validateBumps(bumps);
}

export function selectVersion(
  range: string,
  available: string[],
  latest?: string,
): string {
  if (
    range === "latest" &&
    latest &&
    valid(latest) &&
    available.includes(latest)
  )
    return latest;
  if (!validRange(range))
    throw new InputError(`Cannot resolve version range “${range}”.`);
  const selected = maxSatisfying(
    available.filter((v) => valid(v)),
    range,
  );
  if (!selected)
    throw new InputError(`No published version matches “${range}”.`);
  return selected;
}

export function versionsInRange(
  available: string[],
  from: string,
  to: string,
): string[] {
  return available
    .filter(
      (version) =>
        valid(version) &&
        !version.includes("-") &&
        gt(version, from) &&
        lte(version, to),
    )
    .sort(compare);
}

export function resolveRange(bump: Bump, available: string[], latest?: string) {
  const from = selectVersion(bump.from, available, latest);
  const to = selectVersion(bump.to, available, latest);
  if (!gt(to, from))
    throw new InputError(
      `${bump.name}: target ${to} must be newer than ${from}.`,
    );
  const versions = versionsInRange(available, from, to);
  if (to.includes("-") && !versions.includes(to)) versions.push(to);
  return { ...bump, from, to, versions };
}

export function githubRepository(value: unknown): string | null {
  const raw =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && "url" in value
        ? String(value.url)
        : "";
  const match = raw.match(/(?:github\.com[:/])([\w.-]+)\/([\w.-]+)/);
  return match ? `${match[1]}/${match[2].replace(/\.git$/, "")}` : null;
}
