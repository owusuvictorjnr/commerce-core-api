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
	const forwardedFor = req.header("x-forwarded-for");
	if (forwardedFor) {
		const firstIp = forwardedFor.split(",")[0]?.trim();
		if (firstIp) {
			return firstIp;
		}
	}

	return req.ip || req.socket.remoteAddress || "unknown";
};

export const createRateLimiteMiddleware = (options: RateLimitOptions) => {
	const store = new Map<string, RateState>();

	return (req: Request, _res: Response, next: NextFunction): void => {
		const now = Date.now();
		const key = getClientKey(req);
		const entry = store.get(key);

		if (!entry || now >= entry.resetAt) {
			store.set(key, { count: 1, resetAt: now + options.windowMs });
			next();
			return;
		}

		if (entry.count >= options.maxRequests) {
			next(new HttpError(429, "RATE_LIMITED", "Too many requests"));
			return;
		}

		entry.count += 1;
		store.set(key, entry);
		next();
	};
};

const windowMs = parsePositiveInt(process.env["RATE_LIMIT_WINDOW_MS"], DEFAULT_WINDOW_MS);
const maxRequests = parsePositiveInt(process.env["RATE_LIMIT_MAX"], DEFAULT_MAX_REQUESTS);

export const rateLimiteMiddleware = createRateLimiteMiddleware({
	windowMs,
	maxRequests,
});

