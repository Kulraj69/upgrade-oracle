import { describe, expect, it } from "vitest";
import {
  diffManifests,
  githubRepository,
  resolveRange,
  selectVersion,
  versionsInRange,
} from "@/lib/versions";
import {
  parseBumpText,
  parseManifest,
  parseRepoUrl,
  validateInput,
} from "@/lib/input";

describe("version diffing and semver selection", () => {
  it("finds changed existing production and development dependencies", () => {
    const before = JSON.stringify({
      dependencies: { next: "14.2.0", react: "18.2.0" },
      devDependencies: { eslint: "8.57.1" },
    });
    const after = JSON.stringify({
      dependencies: { next: "16.0.0", react: "18.2.0", fresh: "1.0.0" },
      devDependencies: { eslint: "9.0.0" },
    });
    expect(diffManifests(before, after)).toEqual([
      { name: "eslint", from: "8.57.1", to: "9.0.0" },
      { name: "next", from: "14.2.0", to: "16.0.0" },
    ]);
  });
  it("targets latest when only the current manifest is supplied", () =>
    expect(diffManifests('{"dependencies":{"next":"14.2.0"}}')[0].to).toBe(
      "latest",
    ));
  it("selects the highest published version in a semver range", () =>
    expect(selectVersion("^8.0.0", ["8.0.0", "8.57.1", "9.0.0"])).toBe(
      "8.57.1",
    ));
  it("handles major-only ranges", () =>
    expect(selectVersion("9", ["9.0.0", "9.3.1", "10.0.0"])).toBe("9.3.1"));
  it("uses npm's latest tag instead of a prerelease", () =>
    expect(selectVersion("latest", ["1.0.0", "2.0.0-rc.1"], "1.0.0")).toBe(
      "1.0.0",
    ));
  it("selects versions in the exclusive-from, inclusive-to interval", () =>
    expect(
      versionsInRange(
        ["1.0.0", "1.1.0", "2.0.0-beta.1", "2.0.0", "3.0.0"],
        "1.0.0",
        "2.0.0",
      ),
    ).toEqual(["1.1.0", "2.0.0"]));
  it("rejects downgrades", () =>
    expect(() =>
      resolveRange({ name: "x", from: "2.0.0", to: "1.0.0" }, [
        "1.0.0",
        "2.0.0",
      ]),
    ).toThrow("must be newer"));
  it("rejects unpublished versions", () =>
    expect(() => selectVersion("8", ["7.0.0"])).toThrow(
      "No published version",
    ));
  it("ignores removed and added dependencies when diffing", () =>
    expect(() =>
      diffManifests(
        '{"dependencies":{"a":"1.0.0"}}',
        '{"dependencies":{"b":"2.0.0"}}',
      ),
    ).toThrow("No existing dependencies"));
  it("supports scoped bump lines and unicode arrows", () =>
    expect(
      parseBumpText("@scope/pkg 1.0.0 -> 2.0.0\nnext 14 → 16"),
    ).toHaveLength(2));
  it("recognizes common npm repository URL formats", () => {
    expect(
      githubRepository({ url: "git+https://github.com/vercel/next.js.git" }),
    ).toBe("vercel/next.js");
    expect(githubRepository("git@github.com:org/repo.git")).toBe("org/repo");
  });
});

describe("input boundaries", () => {
  const valid = { bumps: [{ name: "next", from: "14", to: "16" }], files: [] };
  it("accepts a complete bump request", () =>
    expect(validateInput(valid).bumps).toEqual(valid.bumps));
  it("rejects more than six deps", () =>
    expect(() =>
      validateInput({
        ...valid,
        bumps: Array.from({ length: 7 }, (_, i) => ({
          name: `pkg${i}`,
          from: "1",
          to: "2",
        })),
      }),
    ).toThrow("at most 6"));
  it("rejects more than five pasted files", () =>
    expect(() =>
      validateInput({
        ...valid,
        files: Array.from({ length: 6 }, (_, i) => ({
          path: `${i}.js`,
          content: "",
        })),
      }),
    ).toThrow("at most 5"));
  it("measures bytes, not characters, for file caps", () =>
    expect(() =>
      validateInput({
        ...valid,
        files: [{ path: "a.js", content: "🙂".repeat(6000) }],
      }),
    ).toThrow("20 KB"));
  it("rejects oversized manifests", () =>
    expect(() => parseManifest(" ".repeat(51 * 1024))).toThrow("50 KB"));
  it("rejects non-object manifests", () =>
    expect(() => parseManifest("[]")).toThrow("JSON object"));
  it("rejects duplicate filenames", () =>
    expect(() =>
      validateInput({
        ...valid,
        files: [
          { path: "a.js", content: "" },
          { path: "a.js", content: "" },
        ],
      }),
    ).toThrow("unique"));
  it("rejects package names that could inject paths", () =>
    expect(() =>
      validateInput({ bumps: [{ name: "../../evil", from: "1", to: "2" }] }),
    ).toThrow("valid package"));
  it("rejects repo credential and private-host tricks", () => {
    for (const url of [
      "http://github.com/a/b",
      "https://github.com@localhost/a/b",
      "https://github.com/a/b?x=1",
      "https://github.com/a/b/tree/main",
      "https://127.0.0.1/a/b",
    ])
      expect(() => parseRepoUrl(url)).toThrow();
  });
  it("rejects ambiguous repo plus manual source files", () =>
    expect(() =>
      validateInput({
        repoUrl: "https://github.com/a/b",
        files: [{ path: "x.js", content: "x" }],
      }),
    ).toThrow("own source files"));
});
