import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import type { PaymentType } from "@prisma/client";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { tenantMiddleware } from "../../middleware/tenant.middleware.js";
import { HttpError } from "../../core/errors/http-error.js";
import { createPayment, getPayments, getPaymentById } from "./payments.service.js";

type PaymentsRouteDependencies = {
  createPayment: typeof createPayment;
  getPayments: typeof getPayments;
  getPaymentById: typeof getPaymentById;
};

const VALID_PAYMENT_TYPES: PaymentType[] = ["DEPOSIT", "BALANCE"];

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

export const createPaymentsRouter = (
  deps: PaymentsRouteDependencies = { createPayment, getPayments, getPaymentById },
) => {
  const paymentsRouter = Router();
  paymentsRouter.use(authMiddleware);
  paymentsRouter.use(tenantMiddleware);

  // POST /payments — record a payment for an order
  paymentsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals["tenantId"] as string;
      const body = req.body;
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        throw new HttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
      }
      const record = body as Record<string, unknown>;
      const { orderId, amount, paymentType, transactionReference } = record;

      if (typeof orderId !== "string" || !orderId.trim()) {
        throw new HttpError(400, "VALIDATION_ERROR", "orderId is required");
      }
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
        throw new HttpError(400, "VALIDATION_ERROR", "amount must be a positive number");
      }
      if (!VALID_PAYMENT_TYPES.includes(paymentType as PaymentType)) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          `paymentType must be one of: ${VALID_PAYMENT_TYPES.join(", ")}`,
        );
      }
      if (transactionReference !== undefined && typeof transactionReference !== "string") {
        throw new HttpError(400, "VALIDATION_ERROR", "transactionReference must be a string");
      }

      const payment = await deps.createPayment(tenantId, orderId.trim(), {
        amount,
        paymentType: paymentType as PaymentType,
        ...(transactionReference
          ? { transactionReference: transactionReference as string }
          : {}),
      });
      res.status(201).json({ data: payment });
    } catch (error) {
      next(error);
    }
  });

  // GET /payments?orderId=xxx — list payments for an order
  paymentsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals["tenantId"] as string;
      const orderId = req.query["orderId"];
      if (typeof orderId !== "string" || !orderId.trim()) {
        throw new HttpError(400, "VALIDATION_ERROR", "Query parameter 'orderId' is required");
      }
      const limit = parsePositiveInt(req.query["limit"]);
      const cursor = parseCursor(req.query["cursor"]);
      if (req.query["limit"] !== undefined && limit === null) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "Query parameter 'limit' must be a positive integer",
        );
      }
      const result = await deps.getPayments(tenantId, orderId.trim(), {
        ...(limit !== null ? { limit } : {}),
        ...(cursor !== null ? { cursor } : {}),
      });
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  // GET /payments/:id — get a specific payment
  paymentsRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals["tenantId"] as string;
      const id = (req.params["id"] as string) ?? "";
      const payment = await deps.getPaymentById(tenantId, id);
      res.status(200).json({ data: payment });
    } catch (error) {
      next(error);
    }
  });

  return paymentsRouter;
};

export const paymentsRouter = createPaymentsRouter();
