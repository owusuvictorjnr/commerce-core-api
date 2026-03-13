import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../core/errors/http-error.js";

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
	const store = new Map<string, RateState>();

	return (req: Request, res: Response, next: NextFunction): void => {
		const now = Date.now();
		const key = getClientKey(req);
		let entry = store.get(key);

		if (!entry || now >= entry.resetAt) {
			entry = { count: 1, resetAt: now + options.windowMs };
			store.set(key, entry);
			applyHeaders(res, buildHeaders(options, entry, now, false));
			next();
			return;
		}

		if (entry.count >= options.maxRequests) {
			applyHeaders(res, buildHeaders(options, entry, now, true));
			next(new HttpError(429, "RATE_LIMITED", "Too many requests"));
			return;
		}

		entry.count += 1;
		store.set(key, entry);
		applyHeaders(res, buildHeaders(options, entry, now, false));
		next();
	};
};

const windowMs = parsePositiveInt(process.env["RATE_LIMIT_WINDOW_MS"], DEFAULT_WINDOW_MS);
const maxRequests = parsePositiveInt(process.env["RATE_LIMIT_MAX"], DEFAULT_MAX_REQUESTS);

export const rateLimitMiddleware = createRateLimitMiddleware({
	windowMs,
	maxRequests,
});

