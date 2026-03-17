import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";
import { createPaymentsRouter } from "./payments.routes.js";
import { errorMiddleware } from "../../middleware/error.middleware.js";
import type { createPayment, getPayments, getPaymentById } from "./payments.service.js";

const makeDeps = () => ({
  createPayment: jest.fn() as jest.MockedFunction<typeof createPayment>,
  getPayments: jest.fn() as jest.MockedFunction<typeof getPayments>,
  getPaymentById: jest.fn() as jest.MockedFunction<typeof getPaymentById>,
});

const makeAuthHeaders = () => ({
  Authorization: "Bearer any-token",
  "x-user-id": "user-1",
  "x-tenant-id": "tenant-1",
});

const makePayment = (overrides: Record<string, unknown> = {}) => ({
  id: "pay-1",
  tenantId: "tenant-1",
  orderId: "order-1",
  amount: 100,
  paymentType: "DEPOSIT",
  status: "SUCCESS",
  transactionReference: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("paymentsRouter", () => {
  const createTestApp = (router: express.Router) => {
    const app = express();
    app.use(express.json());
    app.use(router);
    app.use(
      (
        err: unknown,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        errorMiddleware(err, req, res, next);
      },
    );
    return app;
  };

  it("returns 401 without auth header", async () => {
    const deps = makeDeps();
    const app = createTestApp(createPaymentsRouter(deps));
    const response = await request(app).get("/");
    expect(response.status).toBe(401);
  });

  it("returns 400 without tenant header", async () => {
    const deps = makeDeps();
    const app = createTestApp(createPaymentsRouter(deps));
    const response = await request(app).get("/").set("Authorization", "Bearer any-token");
    expect(response.status).toBe(400);
  });

  it("POST / creates a payment", async () => {
    const deps = makeDeps();
    deps.createPayment.mockResolvedValue(makePayment() as never);
    const app = createTestApp(createPaymentsRouter(deps));
    const response = await request(app)
      .post("/")
      .set(makeAuthHeaders())
      .send({ orderId: "order-1", amount: 100, paymentType: "DEPOSIT" });
    expect(response.status).toBe(201);
    expect(response.body.data.amount).toBe(100);
    expect(deps.createPayment).toHaveBeenCalledWith("tenant-1", "order-1", {
      amount: 100,
      paymentType: "DEPOSIT",
    });
  });

  it("POST / returns 400 for missing orderId", async () => {
    const deps = makeDeps();
    const app = createTestApp(createPaymentsRouter(deps));
    const response = await request(app)
      .post("/")
      .set(makeAuthHeaders())
      .send({ amount: 100, paymentType: "DEPOSIT" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST / returns 400 for invalid paymentType", async () => {
    const deps = makeDeps();
    const app = createTestApp(createPaymentsRouter(deps));
    const response = await request(app)
      .post("/")
      .set(makeAuthHeaders())
      .send({ orderId: "order-1", amount: 100, paymentType: "INVALID" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST / returns 400 for non-positive amount", async () => {
    const deps = makeDeps();
    const app = createTestApp(createPaymentsRouter(deps));
    const response = await request(app)
      .post("/")
      .set(makeAuthHeaders())
      .send({ orderId: "order-1", amount: 0, paymentType: "DEPOSIT" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET / returns 400 when orderId query param is missing", async () => {
    const deps = makeDeps();
    const app = createTestApp(createPaymentsRouter(deps));
    const response = await request(app).get("/").set(makeAuthHeaders());
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET / returns payments for an order", async () => {
    const deps = makeDeps();
    deps.getPayments.mockResolvedValue({ items: [makePayment() as never], nextCursor: null });
    const app = createTestApp(createPaymentsRouter(deps));
    const response = await request(app)
      .get("/?orderId=order-1")
      .set(makeAuthHeaders());
    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(deps.getPayments).toHaveBeenCalledWith("tenant-1", "order-1", {});
  });

  it("GET /:id returns a payment by id", async () => {
    const deps = makeDeps();
    deps.getPaymentById.mockResolvedValue(makePayment({ id: "pay-1" }) as never);
    const app = createTestApp(createPaymentsRouter(deps));
    const response = await request(app).get("/pay-1").set(makeAuthHeaders());
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe("pay-1");
    expect(deps.getPaymentById).toHaveBeenCalledWith("tenant-1", "pay-1");
  });
});
