import { Router } from "express";
import { Prisma } from "@prisma/client";
import { createOrder, getOrders } from "./order.service.js";
import { tenantMiddleware } from "../../middleware/tenant.middleware.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";

type OrdersRouteDependencies = {
  createOrder: typeof createOrder;
  getOrders: typeof getOrders;
};

const isJsonValue = (value: unknown): value is Prisma.InputJsonValue => {
  if (value === null) {
    return true;
  }

  if (["string", "number", "boolean"].includes(typeof value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item));
  }

  if (typeof value !== "object") {
    return false;
  }

  return Object.values(value).every((item) => isJsonValue(item));
};

const hasItemsArray = (value: unknown): value is { items: Prisma.InputJsonArray } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (!("items" in record)) {
    return false;
  }

  const items = record["items"];
  if (!Array.isArray(items)) {
    return false;
  }

  return items.every((item) => isJsonValue(item));
};

const parsePositiveInt = (value: unknown): number | null => {
  if (value === undefined) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

export const createOrdersRouter = (
  deps: OrdersRouteDependencies = { createOrder, getOrders },
) => {
  const ordersRouter = Router();

  ordersRouter.use(authMiddleware);
  ordersRouter.use(tenantMiddleware);

  ordersRouter.get("/", async (req, res) => {
    const limit = parsePositiveInt(req.query["limit"]);
    const cursor = parsePositiveInt(req.query["cursor"]);

    if ((req.query["limit"] !== undefined && limit === null) ||
        (req.query["cursor"] !== undefined && cursor === null)) {
      res.status(400).json({
        error: "Query parameters 'limit' and 'cursor' must be positive integers",
      });
      return;
    }

    const tenantId = res.locals["tenantId"] as string;
    const result = await deps.getOrders(tenantId, {
      ...(limit !== null ? { limit } : {}),
      ...(cursor !== null ? { cursor } : {}),
    });

    res.status(200).json({
      data: result.items,
      pagination: {
        nextCursor: result.nextCursor,
      },
    });
  });

  ordersRouter.post("/", async (req, res) => {
    if (!hasItemsArray(req.body)) {
      res.status(400).json({ error: "Request body must include an items array" });
      return;
    }

    const tenantId = res.locals["tenantId"] as string;
    const order = await deps.createOrder(tenantId, { items: req.body.items });

    res.status(201).json({ data: order });
  });

  return ordersRouter;
};

export const ordersRouter = createOrdersRouter();
