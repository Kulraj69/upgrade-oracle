import { createHash } from "node:crypto";
import { UpstreamError } from "./errors";
import {
  analyzeLimiter,
  DAY_NOTE,
  IP_NOTE,
  type LimitResult,
} from "./rate-limit";

// Atomic sliding IP window + UTC daily total. Redis credentials never reach the browser.
const SCRIPT = `
local now = tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - 3600000)
local daily = tonumber(redis.call('GET', KEYS[2]) or '0')
if daily >= 100 then return {0, 2, tonumber(ARGV[2])} end
local count = redis.call('ZCARD', KEYS[1])
if count >= 5 then
  local first = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return {0, 1, math.max(1, math.ceil((tonumber(first[2]) + 3600000 - now) / 1000))}
end
redis.call('ZADD', KEYS[1], now, ARGV[3])
redis.call('PEXPIRE', KEYS[1], 3600000)
redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[2]))
return {1, 5 - count - 1, 0}
`;

export async function takeLimit(
  ip: string,
  now = Date.now(),
): Promise<LimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url && !token) return analyzeLimiter.take(ip, now);
  if (!url || !token || !url.startsWith("https://"))
    throw new UpstreamError("The shared rate limiter is misconfigured.", 503);
  const day = new Date(now).toISOString().slice(0, 10);
  const seconds = Math.max(
    1,
    Math.ceil((Date.parse(`${day}T00:00:00Z`) + 86400000 - now) / 1000),
  );
  const hash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        SCRIPT,
        "2",
        `oracle:{limits}:ip:${hash}`,
        `oracle:{limits}:day:${day}`,
        String(now),
        String(seconds),
        `${now}:${crypto.randomUUID()}`,
      ]),
    });
    const result = (await response.json()) as { result?: number[] };
    if (
      !response.ok ||
      !Array.isArray(result.result) ||
      result.result.length !== 3
    )
      throw new Error();
    const [ok, kind, retryAfter] = result.result;
    return ok === 1
      ? { ok: true, remaining: kind }
      : { ok: false, note: kind === 2 ? DAY_NOTE : IP_NOTE, retryAfter };
  } catch {
    throw new UpstreamError(
      "The shared rate limiter is unavailable. Please try again shortly.",
      503,
    );
  }
}
