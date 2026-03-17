import getPrismaClient from "../../database/prisma-client.js";
import { HttpError } from "../../core/errors/http-error.js";
import { Prisma } from "@prisma/client";
import type { PreorderStatus } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const VALID_STATUSES: PreorderStatus[] = ["RESERVED", "READY_FOR_PICKUP", "COMPLETED", "EXPIRED"];

type ListSubscriptionsOptions = {
  limit?: number;
  cursor?: string;
};

type CreateSubscriptionInput = {
  orderId: string;
  pickupDeadline: Date;
};

type UpdateSubscriptionInput = {
  preorderStatus?: PreorderStatus;
  pickupDeadline?: Date;
};

export const createSubscription = async (
  tenantId: string,
  data: CreateSubscriptionInput,
) => {
  const prisma = getPrismaClient();
  const order = await prisma.order.findFirst({ where: { id: data.orderId, tenantId } });
  if (!order) {
    throw new HttpError(404, "NOT_FOUND", "Order not found");
  }

  try {
    return await prisma.preorder.create({
      data: {
        tenantId,
        orderId: data.orderId,
        pickupDeadline: data.pickupDeadline,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "CONFLICT", "A subscription already exists for this order");
    }
    throw error;
  }
};

export const listSubscriptions = async (
  tenantId: string,
  options: ListSubscriptionsOptions = {},
) => {
  const prisma = getPrismaClient();
  const pageSize = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  if (options.cursor) {
    const cursorRecord = await prisma.preorder.findFirst({
      where: { id: options.cursor, tenantId },
    });
    if (!cursorRecord) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid cursor");
    }
  }

  const records = await prisma.preorder.findMany({
    where: { tenantId },
    orderBy: { id: "asc" },
    take: pageSize + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  const hasMore = records.length > pageSize;
  const items = hasMore ? records.slice(0, pageSize) : records;
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

  return { items, nextCursor };
};

export const getSubscriptionById = async (tenantId: string, id: string) => {
  const prisma = getPrismaClient();
  return prisma.preorder.findFirst({
    where: { id, tenantId },
  });
};

export const updateSubscription = async (
  tenantId: string,
  id: string,
  data: UpdateSubscriptionInput,
) => {
  if (data.preorderStatus !== undefined && !VALID_STATUSES.includes(data.preorderStatus)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `preorderStatus must be one of: ${VALID_STATUSES.join(", ")}`,
    );
  }

  const prisma = getPrismaClient();
  const existing = await prisma.preorder.findFirst({
    where: { id, tenantId },
  });
  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "Subscription not found");
  }

  const updateData: Prisma.PreorderUpdateInput = {
    ...(data.preorderStatus !== undefined ? { preorderStatus: data.preorderStatus } : {}),
    ...(data.pickupDeadline !== undefined ? { pickupDeadline: data.pickupDeadline } : {}),
  };
  if (Object.keys(updateData).length === 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "At least one field must be provided to update");
  }

  return prisma.preorder.update({
    where: { id },
    data: updateData,
  });
};
