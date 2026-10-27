import { valid } from "semver";
import type { Note } from "./types";

export function versionFromTag(tag: string): string | null {
  const match = tag.match(
    /(?:^|[@/\s-])v?(\d+\.\d+\.\d+(?:-[\w.-]+)?)(?:$|\s)/,
  );
  return match && valid(match[1]) ? match[1] : null;
}

export function extractMarkdownSections(
  markdown: string,
  url: string,
  versions: string[],
): Note[] {
  const headings = [
    ...markdown.matchAll(
      /^#{1,4}\s+.*?(?:\[|\b|v)(\d+\.\d+\.\d+(?:-[\w.-]+)?)(?:\]|\b).*$/gm,
    ),
  ];
  const wanted = new Set(versions);
  return headings.flatMap((heading, index) => {
    if (!wanted.has(heading[1])) return [];
    const start = heading.index!;
    const end = headings[index + 1]?.index ?? markdown.length;
    return [
      { version: heading[1], url, text: markdown.slice(start, end).trim() },
    ];
  });
}

export function extractGithubReleases(
  releases: unknown,
  versions: string[],
): Note[] {
  if (!Array.isArray(releases)) return [];
  const wanted = new Set(versions);
  return releases.flatMap((release) => {
    if (
      !release ||
      typeof release !== "object" ||
      release.draft ||
      release.prerelease ||
      typeof release.tag_name !== "string" ||
      typeof release.body !== "string" ||
      typeof release.html_url !== "string"
    )
      return [];
    const version = versionFromTag(release.tag_name);
    if (
      !version ||
      !wanted.has(version) ||
      !release.body.trim() ||
      !/^https:\/\/github\.com\//.test(release.html_url)
    )
      return [];
    return [{ version, url: release.html_url, text: release.body }];
  });
}
