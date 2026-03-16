import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../core/errors/http-error.js";
import { logger } from "../core/logger/index.js";
import { redisClient } from "./redis.client.js";

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  failOpen?: boolean | undefined;
};

type RateState = {
  count: number;
  resetAt: number;
};

type RateLimitHeaders = {
  limit: string;
  remaining: string;
  reset: string;
  retryAfter?: string;
};

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 100;

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getClientKey = (req: Request): string => {
  return req.ip || req.socket.remoteAddress || "unknown";
};

const buildHeaders = (
  options: RateLimitOptions,
  entry: RateState,
  now: number,
  isLimited: boolean,
): RateLimitHeaders => {
  const remaining = isLimited ? 0 : Math.max(options.maxRequests - entry.count, 0);
  const resetSeconds = Math.max(Math.ceil((entry.resetAt - now) / 1000), 0);

  return {
    limit: String(options.maxRequests),
    remaining: String(remaining),
    reset: String(resetSeconds),
    ...(isLimited ? { retryAfter: String(resetSeconds) } : {}),
  };
};

const applyHeaders = (res: Response, headers: RateLimitHeaders): void => {
  res.setHeader("X-RateLimit-Limit", headers.limit);
  res.setHeader("X-RateLimit-Remaining", headers.remaining);
  res.setHeader("X-RateLimit-Reset", headers.reset);
  res.setHeader("RateLimit-Limit", headers.limit);
  res.setHeader("RateLimit-Remaining", headers.remaining);
  res.setHeader("RateLimit-Reset", headers.reset);
  if (headers.retryAfter !== undefined) {
    res.setHeader("Retry-After", headers.retryAfter);
  }
};

export const createRateLimitMiddleware = (options: RateLimitOptions) => {
  const windowMs = Math.floor(options.windowMs);
  const maxRequests = Math.floor(options.maxRequests);
  const failOpen = options.failOpen ?? rateLimitFailOpen;

  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error(
      "Invalid rate limit configuration: windowMs must be a positive integer",
    );
  }

  if (!Number.isFinite(maxRequests) || maxRequests <= 0) {
    throw new Error(
      "Invalid rate limit configuration: maxRequests must be a positive integer",
    );
  }

  const normalizedOptions: RateLimitOptions = {
    windowMs,
    maxRequests,
    failOpen,
  };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const now = Date.now();
      const clientKey = getClientKey(req);
      const redisKey = `ratelimit:${clientKey}`;

      /**
       * Atomic Increment Pattern:
       * 1. INCR key (atomically increments or starts at 1)
       * 2. If result is 1, set PEXPIRE
       * 3. Get PTTL to determine the window reset time
       */
      const count = await redisClient.incr(redisKey);

      if (count === 1) {
        await redisClient.pExpire(redisKey, normalizedOptions.windowMs);
      }

      const pttl = await redisClient.pTTL(redisKey);
      // Determine resetAt. If pttl is negative (key expired or no TTL), fallback to estimated window
      const resetAt = now + (pttl > 0 ? pttl : normalizedOptions.windowMs);

      const entry: RateState = { count, resetAt };

      if (count > normalizedOptions.maxRequests) {
        applyHeaders(res, buildHeaders(normalizedOptions, entry, now, true));
        next(new HttpError(429, "RATE_LIMITED", "Too many requests"));
        return;
      }

      applyHeaders(res, buildHeaders(normalizedOptions, entry, now, false));
      next();
    } catch (err) {
      if (normalizedOptions.failOpen) {
        logger.error("Rate limit middleware error, allowing request to proceed:", {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
        next();
      } else {
        next(err);
      }
    }
  };
};

const windowMs = parsePositiveInt(process.env["RATE_LIMIT_WINDOW_MS"], DEFAULT_WINDOW_MS);
const maxRequests = parsePositiveInt(process.env["RATE_LIMIT_MAX"], DEFAULT_MAX_REQUESTS);

// When true (default), Redis or internal errors cause rate limiting to fail open (log + allow request).
// Set RATE_LIMIT_FAIL_OPEN="false" to preserve strict fail-closed behavior.
export const rateLimitFailOpen =
  (process.env["RATE_LIMIT_FAIL_OPEN"] ?? "true").toLowerCase() !== "false";

export const rateLimitMiddleware = createRateLimitMiddleware({
  windowMs,
  maxRequests,
});

// Backwards compatibility aliases
export const createRateLimiteMiddleware = createRateLimitMiddleware;
export const rateLimiteMiddleware = rateLimitMiddleware;
