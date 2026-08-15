/**
 * Best-effort in-memory rate limiter for proxy.ts. Proxy defaults to the
 * Node.js runtime in this Next.js version (not Edge), so module-level state
 * here persists across requests within one warm instance — good enough to
 * blunt casual scraping/brute-force on Vercel's free tier without adding an
 * external dependency (e.g. Upstash Redis) for a v1. It is NOT shared across
 * concurrently warm instances/regions, so a distributed attacker spreading
 * requests across many cold starts could still get through; upgrade to a
 * shared store (Upstash free tier is a drop-in option) if that risk profile
 * changes.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  cleanup(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Vercel sets x-forwarded-for to the real client IP (first entry); falls back to "unknown" so an unrecognized proxy chain shares one bucket instead of throwing. */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}
