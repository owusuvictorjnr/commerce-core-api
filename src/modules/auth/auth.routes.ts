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

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const parseCredentials = (body: unknown): { email: string; password: string } => {
  if (!isPlainObject(body)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
  }

  const { email, password } = body as AuthBody;
  const parsedEmail = typeof email === "string" ? email.trim() : "";
  const parsedPassword = typeof password === "string" ? password.trim() : "";

  if (!parsedEmail || !parsedPassword) {
    throw new HttpError(400, "VALIDATION_ERROR", "Both email and password are required");
  }

  return { email: parsedEmail, password: parsedPassword };
};

export const createAuthRouter = (
  deps: AuthRouteDependencies = { registerUser, loginUser },
) => {
  const authRouter = Router();

  authRouter.post("/register", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = parseCredentials(req.body);
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
      const { email, password } = parseCredentials(req.body);
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
