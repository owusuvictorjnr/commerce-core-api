import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { HttpError } from "../../core/errors/http-error.js";
import { loginUser, registerUser } from "./auth.service.js";

type AuthRouteDependencies = {
  registerUser: typeof registerUser;
  loginUser: typeof loginUser;
};

type AuthBody = {
  email?: unknown;
  password?: unknown;
};

const parseCredentials = (body: AuthBody): { email: string; password: string } => {
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (!email || !password) {
    throw new HttpError(400, "VALIDATION_ERROR", "Both email and password are required");
  }

  return { email, password };
};

export const createAuthRouter = (
  deps: AuthRouteDependencies = { registerUser, loginUser },
) => {
  const authRouter = Router();

  authRouter.post("/register", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = parseCredentials(req.body as AuthBody);
      const result = await deps.registerUser(email, password);

      res.status(201).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  authRouter.post("/login", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = parseCredentials(req.body as AuthBody);
      const result = await deps.loginUser(email, password);

      res.status(200).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  authRouter.get("/me", authMiddleware, (req: Request, res: Response) => {
    void req;
    const auth = res.locals["auth"] as { userId: string; token: string };

    res.status(200).json({
      data: {
        userId: auth.userId,
        token: auth.token,
      },
    });
  });

  return authRouter;
};

export const authRouter = createAuthRouter();
