import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { HttpError } from "../../core/errors/http-error.js";
import { getUserById, updateUser, getOrCreateProfile } from "./users.service.js";

type UserRouteDependencies = {
  getUserById: typeof getUserById;
  updateUser: typeof updateUser;
  getOrCreateProfile: typeof getOrCreateProfile;
};

type UpdateUserBody = {
  name?: unknown;
};

const extractEmailFromToken = (token: string): string => {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === "string") return "";
  const payload = decoded as JwtPayload;
  return typeof payload["email"] === "string" ? payload["email"] : "";
};

export const createUsersRouter = (
  deps: UserRouteDependencies = { getUserById, updateUser, getOrCreateProfile },
) => {
  const usersRouter = Router();

  usersRouter.use(authMiddleware);

  usersRouter.get("/me", async (req: Request, res: Response, next: NextFunction) => {
    void req;
    try {
      const auth = res.locals["auth"] as { userId: string; token: string };

      let profile = await deps.getUserById(auth.userId);
      if (!profile) {
        const email = extractEmailFromToken(auth.token);
        profile = deps.getOrCreateProfile(auth.userId, email);
      }

      res.status(200).json({ data: profile });
    } catch (error) {
      next(error);
    }
  });

  usersRouter.patch("/me", async (req: Request, res: Response, next: NextFunction) => {
    void req;
    try {
      const auth = res.locals["auth"] as { userId: string; token: string };
      const body = req.body as UpdateUserBody;

      const name = typeof body.name === "string" ? body.name.trim() : undefined;
      if (name !== undefined && name.length === 0) {
        throw new HttpError(400, "VALIDATION_ERROR", "Name cannot be empty");
      }

      // Lazily create profile if this is the first interaction
      if (!(await deps.getUserById(auth.userId))) {
        const email = extractEmailFromToken(auth.token);
        deps.getOrCreateProfile(auth.userId, email);
      }

        const updated = await deps.updateUser(auth.userId, {
          ...(name !== undefined ? { name } : {}),
        });
      res.status(200).json({ data: updated });
    } catch (error) {
      next(error);
    }
  });

  return usersRouter;
};

export const usersRouter = createUsersRouter();
