import { TtlCache } from "./cache";
import { UpstreamError } from "./errors";
import type { TraceStep } from "./types";

const publicCache = new TtlCache<string>(60 * 60 * 1000, 48);
const HOSTS = new Set([
  "registry.npmjs.org",
  "api.github.com",
  "raw.githubusercontent.com",
]);

export async function readLimited(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; bytes: number }> {
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body?.cancel();
    throw new UpstreamError("An upstream response exceeded the size limit.");
  }
  const reader = response.body?.getReader();
  if (!reader) return { text: "", bytes: 0 };
  let bytes = 0;
  let text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new UpstreamError(
          "An upstream response exceeded the size limit.",
        );
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return { text, bytes };
  } finally {
    reader.releaseLock();
  }
}

export class Fetcher {
  trace: TraceStep[] = [];
  constructor(
    private signal?: AbortSignal,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  local(label: string, detail: string, start = performance.now(), bytes = 0) {
    this.trace.push({
      id: `t${this.trace.length + 1}`,
      label,
      url: "local://" + label.toLowerCase().replace(/\W+/g, "-"),
      method: "LOCAL",
      ms: Math.round(performance.now() - start),
      bytes,
      status: "ok",
      detail,
    });
  }

  async get(
    url: string,
    label: string,
    options: { maxBytes?: number; accept?: string; cache?: boolean } = {},
    redirects = 0,
  ): Promise<string> {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      !HOSTS.has(parsed.hostname) ||
      parsed.port ||
      parsed.username ||
      parsed.password
    )
      throw new UpstreamError("External URL is not on the source allowlist.");
    const start = performance.now();
    const key = `${options.accept ?? ""}:${url}`;
    const cached = options.cache === false ? undefined : publicCache.get(key);
    const step: TraceStep = {
      id: `t${this.trace.length + 1}`,
      label,
      url,
      method: "GET",
      ms: 0,
      bytes: 0,
      status: "ok",
    };
    this.trace.push(step);
    try {
      if (cached !== undefined) {
        step.status = "cached";
        step.bytes = new TextEncoder().encode(cached).byteLength;
        return cached;
      }
      const response = await this.fetchImpl(url, {
        signal: this.signal
          ? AbortSignal.any([this.signal, AbortSignal.timeout(10_000)])
          : AbortSignal.timeout(10_000),
        redirect: "manual",
        cache: "no-store",
        headers: {
          Accept: options.accept ?? "application/vnd.github+json",
          "User-Agent": "upgrade-oracle/1.0",
        },
      });
      if (
        [301, 302, 307, 308].includes(response.status) &&
        redirects < 2 &&
        response.headers.get("location")
      ) {
        const target = new URL(response.headers.get("location")!, url).href;
        await response.body?.cancel();
        step.detail = `HTTP ${response.status}; redirect traced separately`;
        return await this.get(target, label, options, redirects + 1);
      }
      const data = await readLimited(
        response,
        options.maxBytes ?? 2 * 1024 * 1024,
      );
      step.bytes = data.bytes;
      if (!response.ok) {
        step.detail = `HTTP ${response.status}`;
        throw new UpstreamError(
          response.status === 403 || response.status === 429
            ? "Public source rate limit reached. Try again later."
            : `Source request returned HTTP ${response.status}.`,
        );
      }
      if (options.cache !== false && data.bytes <= 2 * 1024 * 1024)
        publicCache.set(key, data.text);
      return data.text;
    } catch (error) {
      step.status = "error";
      step.detail ??=
        error instanceof UpstreamError
          ? error.message
          : "Request timed out or source was unreachable.";
      throw error instanceof UpstreamError
        ? error
        : new UpstreamError(
            "A public source timed out or could not be reached.",
          );
    } finally {
      step.ms = Math.round(performance.now() - start);
    }
  }

  async json<T>(
    url: string,
    label: string,
    options?: Parameters<Fetcher["get"]>[2],
  ): Promise<T> {
    const text = await this.get(url, label, options);
    try {
      return JSON.parse(text) as T;
    } catch {
      const step = this.trace.at(-1);
      if (step) {
        step.status = "error";
        step.detail = "Source returned invalid JSON.";
      }
      throw new UpstreamError("A public source returned invalid JSON.");
    }
  }
}
