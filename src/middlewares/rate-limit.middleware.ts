// Very lightweight in-memory rate limiter for Workers runtime (per instance).
// NOTE: For production multi-instance consistency, replace with KV/Durable Object.
import { MiddlewareHandler } from "hono";

interface Bucket { count: number; expires: number; }
const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  windowMs: number; // window size in ms
  max: number; // allowed requests per window
  key?: (c: any) => string; // custom key extractor
}

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  const windowMs = opts.windowMs;
  const max = opts.max;
  return async (c, next) => {
    const now = Date.now();
    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
    const customKey = opts.key ? opts.key(c) : "";
    const key = customKey ? `${ip}:${customKey}` : ip;
    let bucket = buckets.get(key);
    if (!bucket || bucket.expires < now) {
      bucket = { count: 0, expires: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > max) {
      const retryAfterSec = Math.ceil((bucket.expires - now) / 1000);
      c.header("Retry-After", retryAfterSec.toString());
      return c.json({ error: "Too many requests. Please wait before retrying." }, 429);
    }
    await next();
  };
}

// Preconfigured helpers
export const emailMagicLinkLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, key: (c) => {
  try {
    if (c.req.method === 'POST') {
      // attempt to parse body for email; will be parsed in handler anyway
      // Avoid consuming the body twice: rely on handler parsing; fallback to query
      return c.req.query('email') || 'no-email';
    }
  } catch (_) { /* ignore */ }
  return 'no-email';
} });
