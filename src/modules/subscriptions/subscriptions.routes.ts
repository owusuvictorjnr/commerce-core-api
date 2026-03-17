import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import type { PreorderStatus } from "@prisma/client";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { tenantMiddleware } from "../../middleware/tenant.middleware.js";
import { HttpError } from "../../core/errors/http-error.js";
import {
  createSubscription,
  listSubscriptions,
  getSubscriptionById,
  updateSubscription,
} from "./subscriptions.service.js";

const VALID_STATUSES: PreorderStatus[] = ["RESERVED", "READY_FOR_PICKUP", "COMPLETED", "EXPIRED"];

type SubscriptionsRouteDependencies = {
  createSubscription: typeof createSubscription;
  listSubscriptions: typeof listSubscriptions;
  getSubscriptionById: typeof getSubscriptionById;
  updateSubscription: typeof updateSubscription;
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

export const createSubscriptionsRouter = (
  deps: SubscriptionsRouteDependencies = {
    createSubscription,
    listSubscriptions,
    getSubscriptionById,
    updateSubscription,
  },
) => {
  const subscriptionsRouter = Router();
  subscriptionsRouter.use(authMiddleware);
  subscriptionsRouter.use(tenantMiddleware);

  subscriptionsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals["tenantId"] as string;
      const body = req.body;
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        throw new HttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
      }
      const record = body as Record<string, unknown>;
      const orderId = record["orderId"];
      const pickupDeadline = record["pickupDeadline"];
      if (typeof orderId !== "string" || !orderId.trim()) {
        throw new HttpError(400, "VALIDATION_ERROR", "orderId is required");
      }
      if (typeof pickupDeadline !== "string" || !pickupDeadline.trim()) {
        throw new HttpError(400, "VALIDATION_ERROR", "pickupDeadline is required and must be an ISO datetime string");
      }
      const parsedDate = new Date(pickupDeadline);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new HttpError(400, "VALIDATION_ERROR", "pickupDeadline must be a valid ISO datetime string");
      }
      const created = await deps.createSubscription(tenantId, {
        orderId: orderId.trim(),
        pickupDeadline: parsedDate,
      });
      res.status(201).json({ data: created });
    } catch (error) {
      next(error);
    }
  });

  subscriptionsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals["tenantId"] as string;
      const limit = parsePositiveInt(req.query["limit"]);
      const cursor = parseCursor(req.query["cursor"]);
      if (req.query["limit"] !== undefined && limit === null) {
        throw new HttpError(400, "VALIDATION_ERROR", "Query parameter 'limit' must be a positive integer");
      }
      if (req.query["cursor"] !== undefined && cursor === null) {
        throw new HttpError(400, "VALIDATION_ERROR", "Query parameter 'cursor' must be a non-empty string");
      }
      const result = await deps.listSubscriptions(tenantId, {
        ...(limit !== null ? { limit } : {}),
        ...(cursor !== null ? { cursor } : {}),
      });
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  subscriptionsRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals["tenantId"] as string;
      const id = (req.params["id"] as string) ?? "";
      const subscription = await deps.getSubscriptionById(tenantId, id);
      if (!subscription) {
        throw new HttpError(404, "NOT_FOUND", "Subscription not found");
      }
      res.status(200).json({ data: subscription });
    } catch (error) {
      next(error);
    }
  });

  subscriptionsRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals["tenantId"] as string;
      const id = (req.params["id"] as string) ?? "";
      const body = req.body;
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        throw new HttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
      }

      const record = body as Record<string, unknown>;
      const preorderStatus = record["preorderStatus"];
      const pickupDeadline = record["pickupDeadline"];

      if (preorderStatus !== undefined && !VALID_STATUSES.includes(preorderStatus as PreorderStatus)) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          `preorderStatus must be one of: ${VALID_STATUSES.join(", ")}`,
        );
      }

      let parsedDate: Date | undefined;
      if (pickupDeadline !== undefined) {
        if (typeof pickupDeadline !== "string" || !pickupDeadline.trim()) {
          throw new HttpError(400, "VALIDATION_ERROR", "pickupDeadline must be an ISO datetime string");
        }
        parsedDate = new Date(pickupDeadline);
        if (Number.isNaN(parsedDate.getTime())) {
          throw new HttpError(400, "VALIDATION_ERROR", "pickupDeadline must be a valid ISO datetime string");
        }
      }

      const updated = await deps.updateSubscription(tenantId, id, {
        ...(preorderStatus !== undefined ? { preorderStatus: preorderStatus as PreorderStatus } : {}),
        ...(parsedDate !== undefined ? { pickupDeadline: parsedDate } : {}),
      });
      res.status(200).json({ data: updated });
    } catch (error) {
      next(error);
    }
  });

  return subscriptionsRouter;
};

export const subscriptionsRouter = createSubscriptionsRouter();
