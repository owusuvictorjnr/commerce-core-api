import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { HttpError } from "../core/errors/http-error.js";

type AuthContext = {
	token: string;
	userId: string;
	email: string;
};

const AUTH_HEADER = "authorization";
const USER_ID_HEADER = "x-user-id";
const USER_EMAIL_HEADER = "x-user-email";

const isBypassEnabled = (): boolean => {
	const bypass = process.env["AUTH_BYPASS"] === "true";
	const nodeEnv = process.env["NODE_ENV"];
	return nodeEnv === "test" || (bypass && nodeEnv !== "production");
};

const getTokenFromHeader = (req: Request): string => {
	const authHeader = req.header(AUTH_HEADER);

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		throw new HttpError(401, "UNAUTHORIZED", "Missing or invalid authorization header");
	}

	const token = authHeader.slice("Bearer ".length).trim();
	if (!token) {
		throw new HttpError(401, "UNAUTHORIZED", "Missing bearer token");
	}

	return token;
};

const decodeJwtPayload = (token: string, jwtSecret: string): JwtPayload => {
	const decoded = jwt.verify(token, jwtSecret);
	if (!decoded || typeof decoded === "string") {
		throw new HttpError(401, "UNAUTHORIZED", "Invalid authentication token");
	}

	return decoded as JwtPayload;
};

const readRequiredStringClaim = (value: unknown, message: string): string => {
	if (typeof value !== "string" || value.trim() === "") {
		throw new HttpError(401, "UNAUTHORIZED", message);
	}

	return value.trim();
};

const verifyAndExtractAuthClaims = (token: string): { userId: string; email: string } => {
	const jwtSecret = process.env["JWT_SECRET"];
	if (!jwtSecret) {
		throw new HttpError(500, "INTERNAL_SERVER_ERROR", "Authentication is misconfigured on the server");
	}

	try {
		const payload = decodeJwtPayload(token, jwtSecret);
		const userId = readRequiredStringClaim(
			payload.sub ?? payload["userId"],
			"Authentication token missing required subject",
		);
		const email = readRequiredStringClaim(payload["email"], "Authentication token missing required email");

		return { userId, email };
	} catch (error) {
		if (error instanceof HttpError) {
			throw error;
		}
		throw new HttpError(401, "UNAUTHORIZED", "Invalid or expired authentication token");
	}
};

const extractBypassClaims = (req: Request): { userId: string; email: string } => {
	const rawUserId = req.header(USER_ID_HEADER);
	const rawEmail = req.header(USER_EMAIL_HEADER);
	const userId = (rawUserId ?? "anonymous").trim() || "anonymous";
	const trimmedEmail = (rawEmail ?? "").trim();
	const email = trimmedEmail || `${userId}@example.test`;

	return { userId, email };
};

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
	try {
		const token = getTokenFromHeader(req);
		const bypassEnabled = isBypassEnabled();

		const claims = bypassEnabled ? extractBypassClaims(req) : verifyAndExtractAuthClaims(token);

		const auth: AuthContext = {
			token,
			userId: claims.userId,
			email: claims.email,
		};

		res.locals["auth"] = auth;
		next();
	} catch (error) {
		next(error);
	}
};
