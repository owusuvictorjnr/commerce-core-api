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

const readBodyRecord = (body: unknown): Record<string, unknown> => {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
};

const parseIsoDate = (value: unknown, missingMessage: string, invalidMessage: string): Date => {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, "VALIDATION_ERROR", missingMessage);
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new HttpError(400, "VALIDATION_ERROR", invalidMessage);
  }

  return parsedDate;
};

const parseCreateSubscriptionBody = (
  body: unknown,
): { orderId: string; pickupDeadline: Date } => {
  const record = readBodyRecord(body);
  const orderId = record["orderId"];
  if (typeof orderId !== "string" || !orderId.trim()) {
    throw new HttpError(400, "VALIDATION_ERROR", "orderId is required");
  }

  const pickupDeadline = parseIsoDate(
    record["pickupDeadline"],
    "pickupDeadline is required and must be an ISO datetime string",
    "pickupDeadline must be a valid ISO datetime string",
  );

  return {
    orderId: orderId.trim(),
    pickupDeadline,
  };
};

const parseUpdateSubscriptionBody = (
  body: unknown,
): { preorderStatus?: PreorderStatus; pickupDeadline?: Date } => {
  const record = readBodyRecord(body);
  const preorderStatusRaw = record["preorderStatus"];
  const pickupDeadlineRaw = record["pickupDeadline"];

  if (
    preorderStatusRaw !== undefined
    && !VALID_STATUSES.includes(preorderStatusRaw as PreorderStatus)
  ) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `preorderStatus must be one of: ${VALID_STATUSES.join(", ")}`,
    );
  }

  return {
    ...(preorderStatusRaw !== undefined ? { preorderStatus: preorderStatusRaw as PreorderStatus } : {}),
    ...(pickupDeadlineRaw !== undefined
      ? {
          pickupDeadline: parseIsoDate(
            pickupDeadlineRaw,
            "pickupDeadline must be an ISO datetime string",
            "pickupDeadline must be a valid ISO datetime string",
          ),
        }
      : {}),
  };
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
      const parsed = parseCreateSubscriptionBody(req.body);
      const created = await deps.createSubscription(tenantId, parsed);
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
      const parsed = parseUpdateSubscriptionBody(req.body);
      const updated = await deps.updateSubscription(tenantId, id, parsed);
      res.status(200).json({ data: updated });
    } catch (error) {
      next(error);
    }
  });

  return subscriptionsRouter;
};

export const subscriptionsRouter = createSubscriptionsRouter();
