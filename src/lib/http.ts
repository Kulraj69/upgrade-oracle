// Request streaming, safe errors, limiter injection and no-store behavior adapted from qloo.
import { runLiveAgent } from "./agent";
import { replayDemo } from "./demo";
import { InputError, UpstreamError } from "./errors";
import { Fetcher } from "./fetcher";
import { MAX_BODY_BYTES, validateInput } from "./input";
import { clientIp, type AnalyzeLimiter } from "./rate-limit";
import { takeLimit } from "./shared-limit";
import type { AgentEnv, AnalyzeInput, Report } from "./types";

export async function readJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES)
    throw new InputError("The request exceeds the 240 KB upload limit.", 413);
  const reader = request.body?.getReader();
  if (!reader)
    throw new InputError("Send dependency bumps and source files as JSON.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0,
    body = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new InputError(
          "The request exceeds the 240 KB upload limit.",
          413,
        );
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    return JSON.parse(body);
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError("That request was not valid UTF-8 JSON.");
  } finally {
    reader.releaseLock();
  }
}

export async function handleAnalyzeRequest(
  request: Request,
  options: {
    limiter?: AnalyzeLimiter;
    now?: () => number;
    analyze?: (input: AnalyzeInput) => Promise<Report>;
    env?: AgentEnv;
  } = {},
): Promise<Response> {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    return Response.json(
      { error: "Please send application/json." },
      { status: 415, headers },
    );
  const env: AgentEnv = options.env ?? {
    GLM_API_KEY: process.env.ENABLE_LLM === "true" && !process.env.VERCEL ? process.env.GLM_API_KEY : undefined,
    GLM_BASE_URL: process.env.GLM_BASE_URL,
    GLM_MODEL: process.env.GLM_MODEL,
  };
  const deadline = AbortSignal.any([
    request.signal,
    AbortSignal.timeout(270_000),
  ]);
  const fetcher = new Fetcher(deadline);
  try {
    const input = validateInput(await readJson(request));
    const now = (options.now ?? Date.now)();
    const limit = options.limiter
      ? options.limiter.take(clientIp(request), now)
      : await takeLimit(clientIp(request), now);
    if (!limit.ok)
      return Response.json(
        { error: limit.note, retryAfter: limit.retryAfter },
        {
          status: 429,
          headers: { ...headers, "Retry-After": String(limit.retryAfter) },
        },
      );
    headers["X-RateLimit-Remaining"] = String(limit.remaining);
    const report = options.analyze
      ? await options.analyze(input)
      : env.GLM_API_KEY
        ? await runLiveAgent(input, { env, fetcher, signal: deadline })
        : await replayDemo(input);
    return Response.json(report, { headers });
  } catch (error) {
    const expected =
      error instanceof InputError || error instanceof UpstreamError;
    return Response.json(
      {
        error: expected
          ? error.message
          : "The analysis could not finish. Please try again.",
        trace: fetcher.trace,
      },
      {
        status: expected ? error.status : deadline.aborted ? 504 : 500,
        headers,
      },
    );
  }
}
