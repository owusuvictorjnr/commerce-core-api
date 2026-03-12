import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../core/errors/http-error.js";

type AuthContext = {
	token: string;
	userId: string;
};

const AUTH_HEADER = "authorization";

// TODO: Implement real token verification (e.g., JWT signature/claims validation).
// Currently this middleware only validates the Authorization header format/presence,
// not the token content. Any non-empty Bearer token is accepted.
// For production, verify JWT signature, expiration, and scopes before allowing requests.
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
	const authHeader = req.header(AUTH_HEADER);

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		next(new HttpError(401, "UNAUTHORIZED", "Missing or invalid authorization header"));
		return;
	}

	const token = authHeader.slice("Bearer ".length).trim();
	if (!token) {
		next(new HttpError(401, "UNAUTHORIZED", "Missing bearer token"));
		return;
	}

	const auth: AuthContext = {
		token,
		userId: req.header("x-user-id") ?? "anonymous",
	};

	res.locals["auth"] = auth;
	next();
};
