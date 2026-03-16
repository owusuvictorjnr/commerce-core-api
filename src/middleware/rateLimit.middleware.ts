import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../core/errors/http-error.js";
import { redisClient } from "./redis.client.js";

type RateLimitOptions = {
	windowMs: number;
	maxRequests: number;
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
	};

	return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const now = Date.now();
			const clientKey = getClientKey(req);
			const redisKey = `ratelimit:${clientKey}`;
			// Note: We use Redis with TTL (pExpire) to avoid the unbounded memory growth
			// that occurs with a standard in-memory Map store.

			// Fetch existing rate state from Redis
			const data = await redisClient.hGetAll(redisKey);
			let entry: RateState | undefined;

			if (data && Object.keys(data).length > 0) {
				const count = Number(data["count"]);
				const resetAt = Number(data["resetAt"]);
				if (Number.isFinite(count) && Number.isFinite(resetAt)) {
					entry = { count, resetAt };
				}
			}

			if (!entry || now >= entry.resetAt) {
				// Start a new window
				entry = { count: 1, resetAt: now + normalizedOptions.windowMs };
				await redisClient.hSet(redisKey, {
					count: String(entry.count),
					resetAt: String(entry.resetAt),
				});
				// Ensure the key expires after the window
				await redisClient.pExpire(redisKey, normalizedOptions.windowMs);

				applyHeaders(res, buildHeaders(normalizedOptions, entry, now, false));
				next();
				return;
			}

			if (entry.count >= normalizedOptions.maxRequests) {
				applyHeaders(res, buildHeaders(normalizedOptions, entry, now, true));
				next(new HttpError(429, "RATE_LIMITED", "Too many requests"));
				return;
			}

			// Increment within the current window
			entry.count += 1;
			await redisClient.hSet(redisKey, {
				count: String(entry.count),
				resetAt: String(entry.resetAt),
			});

			// TTL should already be set, but ensure it's at least the remaining window
			const remainingMs = Math.max(entry.resetAt - now, 0);
			if (remainingMs > 0) {
				await redisClient.pExpire(redisKey, remainingMs);
			}

			applyHeaders(res, buildHeaders(normalizedOptions, entry, now, false));
			next();
		} catch (err) {
			// Surface Redis or other unexpected errors
			next(err);
		}
	};
};

const windowMs = parsePositiveInt(process.env["RATE_LIMIT_WINDOW_MS"], DEFAULT_WINDOW_MS);
const maxRequests = parsePositiveInt(process.env["RATE_LIMIT_MAX"], DEFAULT_MAX_REQUESTS);

export const rateLimitMiddleware = createRateLimitMiddleware({
	windowMs,
	maxRequests,
});

// Backwards compatibility: keep misspelled exports as aliases
export const createRateLimiteMiddleware = createRateLimitMiddleware;
export const rateLimiteMiddleware = rateLimitMiddleware;
