import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { HttpError } from "../../core/errors/http-error.js";
import {
  createTenant,
  getTenants,
  getTenantById,
  updateTenant,
  deleteTenant,
} from "./tenants.service.js";

type TenantsRouteDependencies = {
  createTenant: typeof createTenant;
  getTenants: typeof getTenants;
  getTenantById: typeof getTenantById;
  updateTenant: typeof updateTenant;
  deleteTenant: typeof deleteTenant;
};

const parsePositiveInt = (value: unknown): number | null => {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseCursor = (value: unknown): string | null => {
  if (value === undefined) return null;
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
};

const parseTenantUpdateBody = (body: unknown): { name?: string } => {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
  }

  const record = body as Record<string, unknown>;
  const name = record["name"];
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    throw new HttpError(400, "VALIDATION_ERROR", "Tenant name must be a non-empty string");
  }

  const updates: { name?: string } = {};
  if (name !== undefined) {
    updates.name = name as string;
  }
  if (Object.keys(updates).length === 0) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "At least one updatable field must be provided",
    );
  }

  return updates;
};

export const createTenantsRouter = (
  deps: TenantsRouteDependencies = {
    createTenant,
    getTenants,
    getTenantById,
    updateTenant,
    deleteTenant,
  },
) => {
  const tenantsRouter = Router();
  tenantsRouter.use(authMiddleware);

  tenantsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body;
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        throw new HttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
      }
      const name = (body as Record<string, unknown>)["name"];
      if (typeof name !== "string" || !name.trim()) {
        throw new HttpError(400, "VALIDATION_ERROR", "Tenant name is required");
      }
      const tenant = await deps.createTenant({ name });
      res.status(201).json({ data: tenant });
    } catch (error) {
      next(error);
    }
  });

  tenantsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parsePositiveInt(req.query["limit"]);
      const cursor = parseCursor(req.query["cursor"]);
      if (req.query["limit"] !== undefined && limit === null) {
        throw new HttpError(400, "VALIDATION_ERROR", "Query parameter 'limit' must be a positive integer");
      }
      if (req.query["cursor"] !== undefined && cursor === null) {
        throw new HttpError(400, "VALIDATION_ERROR", "Query parameter 'cursor' must be a non-empty string");
      }
      const result = await deps.getTenants({
        ...(limit !== null ? { limit } : {}),
        ...(cursor !== null ? { cursor } : {}),
      });
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  tenantsRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = (req.params["id"] as string) ?? "";
      const tenant = await deps.getTenantById(id);
      if (!tenant) {
        throw new HttpError(404, "NOT_FOUND", "Tenant not found");
      }
      res.status(200).json({ data: tenant });
    } catch (error) {
      next(error);
    }
  });

  tenantsRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = (req.params["id"] as string) ?? "";
      const updates = parseTenantUpdateBody(req.body);
      const tenant = await deps.updateTenant(id, updates);
      res.status(200).json({ data: tenant });
    } catch (error) {
      next(error);
    }
  });

  tenantsRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = (req.params["id"] as string) ?? "";
      await deps.deleteTenant(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return tenantsRouter;
};

export const tenantsRouter = createTenantsRouter();
