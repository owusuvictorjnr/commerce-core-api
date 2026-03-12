import { hookManager } from "../../hooks/hooks-manager.js";
import getPrismaClient from "../../database/prisma-client.js";
import { Prisma } from "@prisma/client";
import { eventBus } from "../../events/event-bus.js";
import { EVENTS } from "../../events/event.types.js";
import { logger } from "../../core/logger/index.js";
import { HttpError } from "../../core/errors/http-error.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type GetOrdersOptions = {
  limit?: number;
  cursor?: number;
};

type GetOrdersResult = {
  items: Awaited<ReturnType<typeof createOrder>>[];
  nextCursor: number | null;
};

export const createOrder = async (
  tenantId: string,
  data: Omit<Prisma.OrderCreateInput, "tenantId">,
) => {
  const prisma = getPrismaClient();
  const payload: Prisma.OrderCreateInput = { ...data, tenantId };

  // Before Hooks
  await hookManager.run("order.beforeCreated", payload);

  // Create Order
  const order = await prisma.order.create({ data: payload });

  // After Hooks
  await hookManager.run("order.afterCreated", order);

  try {
    eventBus.emit(EVENTS.ORDER_CREATED, {
      orderId: order.id,
      tenantId,
    });
  } catch (error) {
    if (error instanceof Error) {
      logger.error("Failed to emit ORDER_CREATED event", {
        errorMessage: error.message,
        errorStack: error.stack,
        orderId: order.id,
        tenantId,
      });
    } else {
      logger.error("Failed to emit ORDER_CREATED event", {
        error,
        orderId: order.id,
        tenantId,
      });
    }
  }

  return order;
};

export const getOrders = async (
  tenantId: string,
  options: GetOrdersOptions = {},
): Promise<GetOrdersResult> => {
  const prisma = getPrismaClient();
  const pageSize = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  let orders: Awaited<ReturnType<typeof prisma.order.findMany>>;
  try {
    orders = await prisma.order.findMany({
      where: { tenantId },
      orderBy: { id: "asc" },
      take: pageSize + 1,
      ...(options.cursor !== undefined
        ? {
            cursor: { id: options.cursor },
            skip: 1,
          }
        : {}),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientValidationError) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid cursor: cursor record not found");
    }
    throw error;
  }

  const hasMore = orders.length > pageSize;
  const items = hasMore ? orders.slice(0, pageSize) : orders;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return {
    items,
    nextCursor,
  };
};
