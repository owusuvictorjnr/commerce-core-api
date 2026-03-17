import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
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

const validateUpdateUserBody = (body: unknown): { name?: string } => {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Request body must be an object");
  }

  const typedBody = body as UpdateUserBody;
  if (Object.prototype.hasOwnProperty.call(typedBody, "name") && typeof typedBody.name !== "string") {
    throw new HttpError(400, "VALIDATION_ERROR", "Name must be a string");
  }

  const name = typeof typedBody.name === "string" ? typedBody.name.trim() : undefined;
  if (name !== undefined && name.length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Name cannot be empty");
  }

  return name !== undefined ? { name } : {};
};

export const createUsersRouter = (
  deps: UserRouteDependencies = { getUserById, updateUser, getOrCreateProfile },
) => {
  const usersRouter = Router();

  usersRouter.use(authMiddleware);

  usersRouter.get("/me", async (req: Request, res: Response, next: NextFunction) => {
    void req;
    try {
      const auth = res.locals["auth"] as { userId: string; email: string };

      let profile = await deps.getUserById(auth.userId);
      if (!profile) {
        profile = deps.getOrCreateProfile(auth.userId, auth.email);
      }

      res.status(200).json({ data: profile });
    } catch (error) {
      next(error);
    }
  });

  usersRouter.patch("/me", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = res.locals["auth"] as { userId: string; email: string };
      const { name } = validateUpdateUserBody(req.body);

      // Lazily create profile if this is the first interaction
      if (!(await deps.getUserById(auth.userId))) {
        deps.getOrCreateProfile(auth.userId, auth.email);
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
