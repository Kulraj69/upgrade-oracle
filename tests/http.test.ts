import { afterEach, describe, expect, it, vi } from "vitest";
import { TtlCache } from "@/lib/cache";
import { AnalyzeLimiter } from "@/lib/rate-limit";
import { handleAnalyzeRequest } from "@/lib/http";
import { examples } from "@/lib/examples";
import { replayDemo } from "@/lib/demo";
import { Fetcher, readLimited } from "@/lib/fetcher";
import { fetchRepository } from "@/lib/sources";
import { takeLimit } from "@/lib/shared-limit";
import type { AnalyzeInput, Recording } from "@/lib/types";
import nextRecording from "@/recordings/next.json";
import routerRecording from "@/recordings/router.json";
import eslintRecording from "@/recordings/eslint.json";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("5 per IP per hour / 100 per UTC day rate limits", () => {
  const start = Date.parse("2026-10-27T00:00:00Z");
  it("allows five analyses and rejects the sixth", () => {
    const l = new AnalyzeLimiter();
    for (let i = 0; i < 5; i++) expect(l.take("a", start).ok).toBe(true);
    expect(l.take("a", start)).toMatchObject({ ok: false, retryAfter: 3600 });
  });
  it("uses a rolling one-hour IP window", () => {
    const l = new AnalyzeLimiter(1);
    expect(l.take("a", start).ok).toBe(true);
    expect(l.take("a", start + 3599999).ok).toBe(false);
    expect(l.take("a", start + 3600000).ok).toBe(true);
  });
  it("separates IPs but caps the global total", () => {
    const l = new AnalyzeLimiter();
    for (let i = 0; i < 100; i++)
      expect(l.take(`ip-${i}`, start).ok).toBe(true);
    expect(l.take("fresh", start)).toMatchObject({
      ok: false,
      retryAfter: 86400,
    });
  });
  it("resets the global allowance at UTC midnight", () => {
    const l = new AnalyzeLimiter(5, 3600000, 1);
    l.take("a", start);
    expect(l.take("b", start + 86400000).ok).toBe(true);
  });
  it("does not count denied requests toward the next window", () => {
    const l = new AnalyzeLimiter(1, 100, 2);
    l.take("a", start);
    l.take("a", start + 1);
    expect(l.take("a", start + 100).ok).toBe(true);
  });
  it("uses the shared atomic Redis limiter when configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-only");
    const mock = vi
      .fn()
      .mockResolvedValue(Response.json({ result: [0, 2, 1500] }));
    vi.stubGlobal("fetch", mock);
    expect(await takeLimit("ip", start)).toMatchObject({
      ok: false,
      retryAfter: 1500,
    });
    const payload = JSON.parse(mock.mock.calls[0][1].body);
    expect(payload[0]).toBe("EVAL");
    expect(payload[3]).not.toContain(":ip:ip");
  });
  it("fails closed when the shared limiter fails", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-only");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("secret internal failure")),
    );
    await expect(takeLimit("ip")).rejects.toThrow(
      "shared rate limiter is unavailable",
    );
  });
});

describe("public source cache and HTTP bounds", () => {
  it("expires cache entries and returns independent clones", () => {
    const c = new TtlCache<{ a: number }>(100, 1);
    c.set("x", { a: 1 }, 0);
    const got = c.get("x", 5)!;
    got.a = 7;
    expect(c.get("x", 6)?.a).toBe(1);
    expect(c.get("x", 100)).toBeUndefined();
  });
  it("bounds cache size", () => {
    const c = new TtlCache<number>(100, 1);
    c.set("a", 1, 0);
    c.set("b", 2, 0);
    expect(c.get("a", 1)).toBeUndefined();
    expect(c.get("b", 1)).toBe(2);
  });
  it("rejects oversized upstream streams without content-length", async () => {
    await expect(
      readLimited(new Response("x".repeat(300)), 200),
    ).rejects.toThrow("size limit");
  });
  it("rejects redirects to hosts outside the allowlist", async () => {
    const mock = vi
      .fn()
      .mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { Location: "http://127.0.0.1/admin" },
        }),
      );
    const f = new Fetcher(undefined, mock);
    await expect(
      f.get("https://api.github.com/repos/a/b", "test", { cache: false }),
    ).rejects.toThrow("allowlist");
    expect(mock).toHaveBeenCalledTimes(1);
    expect(f.trace[0].status).toBe("error");
  });
  it("records both cached and fresh calls", async () => {
    const mock = vi.fn().mockResolvedValue(new Response("hello"));
    const f = new Fetcher(undefined, mock);
    await f.get(
      "https://raw.githubusercontent.com/test/unique/main/test.txt",
      "test",
    );
    await f.get(
      "https://raw.githubusercontent.com/test/unique/main/test.txt",
      "test",
    );
    expect(mock).toHaveBeenCalledTimes(1);
    expect(f.trace.map((t) => t.status)).toEqual(["ok", "cached"]);
    expect(f.trace[0].bytes).toBe(5);
  });
  it("pins GitHub raw reads to a commit SHA and limits repository files to 30", async () => {
    const commit = "a".repeat(40),
      tree = "b".repeat(40);
    const calls: string[] = [];
    const fakeFetch = vi.fn(async (url: string | URL | Request) => {
      const text = String(url);
      calls.push(text);
      if (text.endsWith("/repos/test/oracle"))
        return Response.json({ default_branch: "main" });
      if (text.includes("/commits/")) return Response.json({ sha: commit });
      if (text.includes("/git/trees/"))
        return Response.json({
          sha: tree,
          tree: [
            ...Array.from({ length: 40 }, (_, i) => ({
              path: `src/${i}.ts`,
              type: "blob",
              size: 15,
            })),
            { path: "src/big.ts", type: "blob", size: 99999 },
            { path: "node_modules/a.js", type: "blob", size: 1 },
          ],
        });
      if (text.endsWith("package.json"))
        return new Response('{"dependencies":{"x":"1"}}');
      return new Response("export const x = 1;");
    });
    const result = await fetchRepository(
      "https://github.com/test/oracle",
      new Fetcher(undefined, fakeFetch as typeof fetch),
    );
    expect(result.files).toHaveLength(30);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(
      calls
        .filter((u) => u.startsWith("https://raw"))
        .every((u) => u.includes(commit)),
    ).toBe(true);
    expect(calls.some((u) => u.includes(tree))).toBe(false);
  });
});

describe("demo API end to end", () => {
  const request = (input: unknown, headers: Record<string, string> = {}) =>
    new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(input),
    });
  it.each(examples)(
    "replays the real $id recording without a network call",
    async (example) => {
      const network = vi
        .fn()
        .mockRejectedValue(new Error("Demo must not call a network"));
      vi.stubGlobal("fetch", network);
      const response = await handleAnalyzeRequest(request(example.input), {
        limiter: new AnalyzeLimiter(),
        env: {},
      });
      expect(response.status).toBe(200);
      const report = await response.json();
      expect(report.mode).toBe("demo");
      expect(report.recording.exampleId).toBe(example.id);
      expect(report.findings.length).toBeGreaterThan(0);
      expect(
        report.trace.some((t: { method: string }) => t.method === "POST"),
      ).toBe(true);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(network).not.toHaveBeenCalled();
    },
  );
  it("never presents edited code as a fresh recorded analysis", async () => {
    const input = structuredClone(examples[0].input);
    input.files[0].content = "new code";
    const response = await handleAnalyzeRequest(request(input), {
      limiter: new AnalyzeLimiter(),
      env: {},
    });
    expect(response.status).toBe(422);
  });
  it("requires a real sample identity", async () => {
    const input = { ...examples[0].input, exampleId: undefined };
    await expect(replayDemo(input)).rejects.toThrow("Choose a sample");
  });
  it("returns 429 and Retry-After for the sixth valid request", async () => {
    const limiter = new AnalyzeLimiter();
    for (let i = 0; i < 5; i++)
      await handleAnalyzeRequest(request(examples[0].input), {
        limiter,
        env: {},
      });
    const response = await handleAnalyzeRequest(request(examples[0].input), {
      limiter,
      env: {},
    });
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
  it("rejects oversized request bodies before invoking the agent", async () => {
    const analyze = vi.fn();
    const response = await handleAnalyzeRequest(
      request(examples[0].input, { "content-length": String(300 * 1024) }),
      { analyze },
    );
    expect(response.status).toBe(413);
    expect(analyze).not.toHaveBeenCalled();
  });
  it("rejects oversized chunked requests too", async () => {
    const response = await handleAnalyzeRequest(
      request({ data: "x".repeat(300 * 1024) }),
    );
    expect(response.status).toBe(413);
  });
  it("rejects invalid content types", async () =>
    expect(
      (
        await handleAnalyzeRequest(
          new Request("http://localhost", { method: "POST", body: "x" }),
        )
      ).status,
    ).toBe(415));
  it("hides internal errors", async () => {
    const response = await handleAnalyzeRequest(request(examples[0].input), {
      limiter: new AnalyzeLimiter(),
      analyze: async () => {
        throw new Error("sensitive provider detail");
      },
    });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("sensitive");
  });
  it("validates every stored receipt against original fetched notes", () => {
    for (const recording of [
      nextRecording,
      routerRecording,
      eslintRecording,
    ] as Recording[]) {
      expect(recording.report.mode).toBe("live");
      expect(
        recording.report.trace.some(
          (t) => t.method === "POST" && t.status === "ok",
        ),
      ).toBe(true);
      for (const finding of recording.report.findings) {
        const note = recording.report.notes[finding.receipt.noteIndex];
        expect(note.version).toBe(finding.sourceVersion);
        expect(note.url).toBe(finding.receipt.url);
        expect(note.text).toContain(finding.quote);
      }
    }
  });
  it("replays independent copies without corrupting stored data", async () => {
    const input: AnalyzeInput = structuredClone(examples[0].input);
    const first = await replayDemo(input);
    first.findings[0].quote = "changed";
    const second = await replayDemo(input);
    expect(second.findings[0].quote).not.toBe("changed");
  });
});
