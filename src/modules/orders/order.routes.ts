import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import type { OrderStatus } from "@prisma/client";
import { createOrder, getOrders, getOrderById, updateOrderStatus } from "./order.service.js";
import { tenantMiddleware } from "../../middleware/tenant.middleware.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { HttpError } from "../../core/errors/http-error.js";

type OrderItemInput = {
  productId: string;
  quantity: number;
  price: number;
};

type OrdersRouteDependencies = {
  createOrder: typeof createOrder;
  getOrders: typeof getOrders;
  getOrderById: typeof getOrderById;
  updateOrderStatus: typeof updateOrderStatus;
};

const VALID_STATUSES: OrderStatus[] = ["PENDING", "PARTIAL_PAID", "FULLY_PAID", "CANCELLED"];

const isValidOrderItem = (value: unknown): value is OrderItemInput => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item["productId"] === "string" &&
    item["productId"].trim() !== "" &&
    Number.isInteger(item["quantity"]) &&
    (item["quantity"] as number) > 0 &&
    typeof item["price"] === "number" &&
    Number.isFinite(item["price"]) &&
    (item["price"] as number) >= 0
  );
};

const parseOrderBody = (body: unknown): { items: OrderItemInput[] } => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
  }
  const items = (body as Record<string, unknown>)["items"];
  if (!Array.isArray(items)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Request body must include an items array");
  }
  if (items.length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Order must have at least one item");
  }
  if (!items.every(isValidOrderItem)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "Each item must have productId (string), quantity (positive integer), and price (non-negative number)",
    );
  }
  return { items };
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

const parseCursor = (value: unknown): string | null => {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return value.trim();
};

export const createOrdersRouter = (
  deps: OrdersRouteDependencies = {
    createOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
  },
) => {
  const ordersRouter = Router();

  ordersRouter.use(authMiddleware);
  ordersRouter.use(tenantMiddleware);

  ordersRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
    const limit = parsePositiveInt(req.query["limit"]);
    const cursor = parseCursor(req.query["cursor"]);

    if ((req.query["limit"] !== undefined && limit === null) ||
        (req.query["cursor"] !== undefined && cursor === null)) {
      next(new HttpError(400, "VALIDATION_ERROR", "Query parameter 'limit' must be a positive integer and 'cursor' must be a non-empty string"));
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

  ordersRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = parseOrderBody(req.body);
      const tenantId = res.locals["tenantId"] as string;
      const auth = res.locals["auth"] as { userId: string };
      const order = await deps.createOrder(tenantId, auth.userId, parsed);
      res.status(201).json({ data: order });
    } catch (error) {
      next(error);
    }
  });

  ordersRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals["tenantId"] as string;
      const id = (req.params["id"] as string) ?? "";
      const order = await deps.getOrderById(tenantId, id);
      if (!order) {
        next(new HttpError(404, "NOT_FOUND", "Order not found"));
        return;
      }
      res.status(200).json({ data: order });
    } catch (error) {
      next(error);
    }
  });

  ordersRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals["tenantId"] as string;
      const id = (req.params["id"] as string) ?? "";
      const body = req.body;
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        throw new HttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
      }
      const status = (body as Record<string, unknown>)["status"];
      if (!VALID_STATUSES.includes(status as OrderStatus)) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          `status must be one of: ${VALID_STATUSES.join(", ")}`,
        );
      }
      const order = await deps.updateOrderStatus(tenantId, id, status as OrderStatus);
      res.status(200).json({ data: order });
    } catch (error) {
      next(error);
    }
  });

  return ordersRouter;
};

export const ordersRouter = createOrdersRouter();
