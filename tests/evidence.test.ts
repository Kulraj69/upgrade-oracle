import { describe, expect, it } from "vitest";
import {
  extractGithubReleases,
  extractMarkdownSections,
  versionFromTag,
} from "@/lib/changelog";
import { checkCitations, isBreakingCandidate } from "@/lib/citations";
import { grepApi, rankFindings, verdictFor } from "@/lib/matcher";
import { parseChanges, parseModelJson } from "@/lib/glm";
import type { BreakingChange, Finding, Note } from "@/lib/types";

describe("release note section extraction", () => {
  const markdown =
    "# Changelog\n## [3.0.0] - 2026-01-01\nRemoved oldApi.\n### Breaking\nUse newApi.\n## 2.0.0\nRemove secondApi.\n## 1.0.0\nInitial.\n";
  it("keeps nested markdown headings within a version section", () => {
    const result = extractMarkdownSections(markdown, "https://github.com/a/b", [
      "3.0.0",
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toContain("### Breaking\nUse newApi.");
    expect(result[0].text).not.toContain("Remove secondApi");
  });
  it("only extracts selected versions", () =>
    expect(
      extractMarkdownSections(markdown, "url", ["2.0.0"]).map((n) => n.version),
    ).toEqual(["2.0.0"]));
  it("handles package-scoped release tags", () => {
    expect(versionFromTag("react-router@6.22.0")).toBe("6.22.0");
    expect(versionFromTag("v16.0.0")).toBe("16.0.0");
  });
  it("filters GitHub drafts, prereleases and out-of-range notes", () => {
    const release = {
      tag_name: "v2.0.0",
      body: "Removed oldApi.",
      html_url: "https://github.com/a/b/releases/tag/v2.0.0",
    };
    expect(
      extractGithubReleases(
        [
          release,
          { ...release, draft: true },
          { ...release, prerelease: true },
          { ...release, tag_name: "v1.0.0" },
        ],
        ["2.0.0"],
      ),
    ).toEqual([
      { version: "2.0.0", text: release.body, url: release.html_url },
    ]);
  });
  it("does not admit unsafe receipt URLs", () =>
    expect(
      extractGithubReleases(
        [
          {
            tag_name: "v2.0.0",
            body: "some text",
            html_url: "javascript:alert(1)",
          },
        ],
        ["2.0.0"],
      ),
    ).toEqual([]));
});

describe("deterministic citation checker", () => {
  const note: Note = {
    version: "2.0.0",
    url: "https://github.com/a/b/releases/tag/v2.0.0",
    text: "The oldApi method has been removed. Use newApi instead.\nExact spacing matters.",
  };
  const item: BreakingChange = {
    api: "oldApi",
    change: "Removed method",
    migration: "Use newApi",
    sourceVersion: "2.0.0",
    quote: "The oldApi method has been removed.",
  };
  it("accepts verbatim quotes", () =>
    expect(checkCitations([item], [note]).accepted).toHaveLength(1));
  it("drops invented quotes", () =>
    expect(
      checkCitations(
        [{ ...item, quote: "The oldApi method now behaves differently." }],
        [note],
      ).dropped,
    ).toBe(1));
  it("drops a quote assigned to the wrong version", () =>
    expect(
      checkCitations([{ ...item, sourceVersion: "3.0.0" }], [note]).dropped,
    ).toBe(1));
  it("does not normalize whitespace to make a fake quote fit", () =>
    expect(
      checkCitations(
        [{ ...item, quote: "instead. Exact spacing matters." }],
        [note],
      ).dropped,
    ).toBe(1));
  it("rejects vacuous short quotes", () =>
    expect(checkCitations([{ ...item, quote: "oldApi" }], [note]).dropped).toBe(
      1,
    ));
  it("deduplicates identical claims", () =>
    expect(checkCitations([item, item], [note]).accepted).toHaveLength(1));
  it("excludes deprecations without a removal", () =>
    expect(
      isBreakingCandidate({
        ...item,
        change: "oldApi is deprecated",
        quote: "The oldApi method is deprecated.",
      }),
    ).toBe(false));
  it("retains removal of previously deprecated APIs", () =>
    expect(
      isBreakingCandidate({
        ...item,
        change: "The deprecated oldApi was removed",
      }),
    ).toBe(true));
});

describe("code matching and verdicts", () => {
  it("returns exact filenames and one-based line numbers", () =>
    expect(
      grepApi("cookies", [
        {
          path: "app.ts",
          content: "// intro\nconst value = cookies().get('a');",
        },
      ])[0],
    ).toMatchObject({ file: "app.ts", line: 2, match: "exact" }));
  it("does not call a substring an exact match", () =>
    expect(
      grepApi("Switch", [{ path: "a.ts", content: "const MySwitch = 1;" }])[0]
        .match,
    ).toBe("fuzzy"));
  it("classifies comments and ordinary string literals as fuzzy", () =>
    expect(
      grepApi("oldApi", [
        {
          path: "a.ts",
          content:
            "// oldApi()\nconst str = 'oldApi';\n/* oldApi\nstill oldApi */",
        },
      ]).every((h) => h.match === "fuzzy"),
    ).toBe(true));
  it("recognizes JSON config keys", () =>
    expect(
      grepApi("valid-jsdoc", [
        {
          path: ".eslintrc.json",
          content: '{"rules":{"valid-jsdoc":"error"}}',
        },
      ])[0].match,
    ).toBe("exact"));
  it("escapes regex metacharacters in APIs", () =>
    expect(
      grepApi("context.getScope", [
        {
          path: "rule.js",
          content: "contextXgetScope();\ncontext.getScope();",
        },
      ]).filter((h) => h.match === "exact")[0].line,
    ).toBe(2));
  it("supports method tokens ending in parentheses", () =>
    expect(
      grepApi("cookies()", [{ path: "a.js", content: "cookies();" }])[0].match,
    ).toBe("exact"));
  it("flags nested three-character config members as fuzzy", () =>
    expect(
      grepApi("experimental.ppr", [
        { path: "next.config.js", content: "experimental: { ppr: true }" },
      ])[0].match,
    ).toBe("fuzzy"));
  it("produces will-break, might-break, and safe verdicts deterministically", () => {
    expect(
      verdictFor([{ file: "a", line: 1, snippet: "", match: "exact" }]),
    ).toBe("will-break");
    expect(
      verdictFor([{ file: "a", line: 1, snippet: "", match: "fuzzy" }]),
    ).toBe("might-break");
    expect(verdictFor([])).toBe("safe");
  });
  it("ranks breaking matches before fuzzy and absent ones", () => {
    const findings: Finding[] = (
      ["safe", "will-break", "might-break"] as const
    ).map((verdict, i) => ({
      id: String(i),
      verdict,
      hits: [],
      dependency: "a",
      api: "x",
      change: "Removed",
      migration: "Review",
      quote: "A removed api",
      sourceVersion: "2.0.0",
      from: "1.0.0",
      to: "2.0.0",
      fix: null,
      receipt: {
        url: "https://github.com/a/b",
        quote: "A removed api",
        version: "2.0.0",
        noteIndex: 0,
      },
    }));
    expect(rankFindings(findings).map((f) => f.verdict)).toEqual([
      "will-break",
      "might-break",
      "safe",
    ]);
  });
});

describe("robust model JSON parsing", () => {
  it("accepts fenced JSON", () =>
    expect(parseModelJson('```json\n{"changes":[]}\n```')).toEqual({
      changes: [],
    }));
  it("extracts a JSON object after prose with braces in strings", () =>
    expect(
      parseModelJson('Result: {"text":"an escaped \\" and } brace"} tail'),
    ).toEqual({ text: 'an escaped " and } brace' }));
  it("rejects truncated model output", () =>
    expect(() => parseModelJson('{"changes":[')).toThrow("invalid JSON"));
  it("drops malformed extracted items", () =>
    expect(parseChanges({ changes: [{ api: "x" }, null] })).toEqual([]));
});
