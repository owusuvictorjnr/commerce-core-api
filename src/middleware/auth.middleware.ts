import type { NextFunction, Request, Response } from "express";

type AuthContext = {
	token: string;
	userId: string;
};

const AUTH_HEADER = "authorization";

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
	const authHeader = req.header(AUTH_HEADER);

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		res.status(401).json({ error: "Missing or invalid authorization header" });
		return;
	}

	const token = authHeader.slice("Bearer ".length).trim();
	if (!token) {
		res.status(401).json({ error: "Missing bearer token" });
		return;
	}

	const auth: AuthContext = {
		token,
		userId: req.header("x-user-id") ?? "anonymous",
	};

	res.locals["auth"] = auth;
	next();
};
