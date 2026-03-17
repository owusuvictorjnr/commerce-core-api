import { hookManager } from "../../hooks/hooks-manager.js";
import getPrismaClient from "../../database/prisma-client.js";
import { Prisma } from "@prisma/client";
import { eventBus } from "../../events/event-bus.js";
import { EVENTS } from "../../events/event.types.js";
import { HttpError } from "../../core/errors/http-error.js";
import type { OrderStatus } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const VALID_ORDER_STATUSES: OrderStatus[] = ["PENDING", "PARTIAL_PAID", "FULLY_PAID", "CANCELLED"];

type OrderItemInput = {
  productId: string;
  quantity: number;
  price: number;
};

type GetOrdersOptions = {
  limit?: number;
  cursor?: string;
};

type OrderRow = Prisma.OrderGetPayload<Record<string, never>>;

type OrderWithItemsAndPayments = Prisma.OrderGetPayload<{
  include: {
    items: true;
    payments: true;
  };
}>;

type GetOrdersResult = {
  items: OrderRow[];
  nextCursor: string | null;
};

const mapCursorQueryError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid cursor: cursor record not found");
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid cursor: cursor record not found");
  }

  throw error;
};

const buildFindManyArgs = (
  tenantId: string,
  pageSize: number,
  options: GetOrdersOptions,
): Prisma.OrderFindManyArgs => ({
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

const findOrdersWithCursorHandling = async (
  prisma: ReturnType<typeof getPrismaClient>,
  args: Prisma.OrderFindManyArgs,
) => {
  try {
    return await prisma.order.findMany(args);
  } catch (error) {
    return mapCursorQueryError(error);
  }
};

export const createOrder = async (
  tenantId: string,
  userId: string,
  data: { items: OrderItemInput[] },
) => {
  const prisma = getPrismaClient();

  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) {
    throw new HttpError(404, "NOT_FOUND", "User not found for this tenant");
  }

  if (!data.items.length) {
    throw new HttpError(400, "VALIDATION_ERROR", "Order must have at least one item");
  }

  const totalAmount = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const payload: Prisma.OrderCreateInput = {
    tenant: { connect: { id: tenantId } },
    user: { connect: { id: userId } },
    totalAmount,
    remainingAmount: totalAmount,
    items: {
      create: data.items.map((item) => ({
        tenantId,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
    },
  };

  // Before Hooks
  await hookManager.run("order.beforeCreated", payload);

  // Create Order
  const order = await prisma.order.create({ data: payload, include: { items: true } });

  // After Hooks
  await hookManager.run("order.afterCreated", order as OrderRow);

  try {
    eventBus.emit(EVENTS.ORDER_CREATED, {
      orderId: order.id,
      tenantId,
    });
  } catch {
    // Intentionally ignore: EventBus already logs handler failures.
  }

  return order;
};

export const getOrders = async (
  tenantId: string,
  options: GetOrdersOptions = {},
): Promise<GetOrdersResult> => {
  const prisma = getPrismaClient();
  const pageSize = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const findManyArgs = buildFindManyArgs(tenantId, pageSize, options);
  const orders = await findOrdersWithCursorHandling(prisma, findManyArgs);

  const hasMore = orders.length > pageSize;
  const items = hasMore ? orders.slice(0, pageSize) : orders;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return {
    items,
    nextCursor,

  };
};

export const getOrderById = async (
  tenantId: string,
  id: string,
): Promise<OrderWithItemsAndPayments | null> => {
  const prisma = getPrismaClient();
  return prisma.order.findFirst({
    where: { id, tenantId },
    include: { items: true, payments: true },
  });
};

export const updateOrderStatus = async (
  tenantId: string,
  id: string,
  status: OrderStatus,
): Promise<OrderRow> => {
  if (!VALID_ORDER_STATUSES.includes(status)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `status must be one of: ${VALID_ORDER_STATUSES.join(", ")}`,
    );
  }
  const prisma = getPrismaClient();
  const existing = await prisma.order.findFirst({ where: { id, tenantId } });
  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "Order not found");
  }
  return prisma.order.update({ where: { id }, data: { status } });
};
