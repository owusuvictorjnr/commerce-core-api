import getPrismaClient from "../../database/prisma-client.js";
import { HttpError } from "../../core/errors/http-error.js";
import type { PaymentType } from "@prisma/client";
import { eventBus } from "../../events/event-bus.js";
import { EVENTS } from "../../events/event.types.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const VALID_PAYMENT_TYPES: PaymentType[] = ["DEPOSIT", "BALANCE"];

type CreatePaymentInput = {
  amount: number;
  paymentType: PaymentType;
  transactionReference?: string;
};

type GetPaymentsOptions = {
  limit?: number;
  cursor?: string;
};

export const createPayment = async (
  tenantId: string,
  orderId: string,
  data: CreatePaymentInput,
) => {
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Payment amount must be a positive number");
  }
  if (!VALID_PAYMENT_TYPES.includes(data.paymentType)) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      `paymentType must be one of: ${VALID_PAYMENT_TYPES.join(", ")}`,
    );
  }

  const prisma = getPrismaClient();
  const payment = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, tenantId } });
    if (!order) {
      throw new HttpError(404, "NOT_FOUND", "Order not found");
    }
    if (order.status === "CANCELLED") {
      throw new HttpError(400, "VALIDATION_ERROR", "Cannot process payment for a cancelled order");
    }
    const remainingAmount =
      order.remainingAmount ?? Math.max(order.totalAmount - order.paidAmount, 0);
    if (order.status === "FULLY_PAID" || remainingAmount <= 0) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "Cannot process payment for an order that is already fully paid",
      );
    }
    if (data.amount > remainingAmount) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "Payment amount exceeds the remaining balance for this order",
      );
    }

    const createdPayment = await tx.payment.create({
      data: {
        tenantId,
        orderId,
        amount: data.amount,
        paymentType: data.paymentType,
        status: "SUCCESS",
        ...(data.transactionReference ? { transactionReference: data.transactionReference } : {}),
      },
    });

    const newRemainingAmount = Math.max(remainingAmount - data.amount, 0);
    const newStatus = newRemainingAmount <= 0 ? ("FULLY_PAID" as const) : ("PARTIAL_PAID" as const);

    await tx.order.update({
      where: { id: orderId },
      data: {
        paidAmount: { increment: data.amount },
        remainingAmount: newRemainingAmount,
        status: newStatus,
      },
    });

    return createdPayment;
  });

  try {
    eventBus.emit(EVENTS.PAYMENT_SUCCESS, { paymentId: payment.id, orderId, tenantId });
  } catch {
    // Intentionally ignore: EventBus already logs handler failures.
  }

  return payment;
};

export const getPayments = async (
  tenantId: string,
  orderId: string,
  options: GetPaymentsOptions = {},
) => {
  const prisma = getPrismaClient();
  const order = await prisma.order.findFirst({ where: { id: orderId, tenantId } });
  if (!order) {
    throw new HttpError(404, "NOT_FOUND", "Order not found");
  }

  const pageSize = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const items = await prisma.payment.findMany({
    where: { tenantId, orderId },
    orderBy: { id: "asc" },
    take: pageSize + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });
  const hasMore = items.length > pageSize;
  const page = hasMore ? items.slice(0, pageSize) : items;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;
  return { items: page, nextCursor };
};

export const getPaymentById = async (tenantId: string, paymentId: string) => {
  const prisma = getPrismaClient();
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenantId },
  });
  if (!payment) {
    throw new HttpError(404, "NOT_FOUND", "Payment not found");
  }
  return payment;
};
