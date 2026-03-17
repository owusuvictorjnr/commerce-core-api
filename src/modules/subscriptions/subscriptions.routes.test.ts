import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";
import { createSubscriptionsRouter } from "./subscriptions.routes.js";
import { errorMiddleware } from "../../middleware/error.middleware.js";
import type {
  createSubscription,
  listSubscriptions,
  getSubscriptionById,
  updateSubscription,
} from "./subscriptions.service.js";

const makeDeps = () => ({
  createSubscription: jest.fn() as jest.MockedFunction<typeof createSubscription>,
  listSubscriptions: jest.fn() as jest.MockedFunction<typeof listSubscriptions>,
  getSubscriptionById: jest.fn() as jest.MockedFunction<typeof getSubscriptionById>,
  updateSubscription: jest.fn() as jest.MockedFunction<typeof updateSubscription>,
});

const makeAuthHeaders = () => ({
  Authorization: "Bearer any-token",
  "x-user-id": "user-1",
  "x-tenant-id": "tenant-1",
});

const makeSubscription = (overrides: Record<string, unknown> = {}) => ({
  id: "sub-1",
  orderId: "order-1",
  preorderStatus: "RESERVED",
  pickupDeadline: new Date("2026-12-31T00:00:00.000Z"),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("subscriptionsRouter", () => {
  const createTestApp = (router: express.Router) => {
    const app = express();
    app.use(express.json());
    app.use(router);
    app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
      errorMiddleware(err, req, res, next);
    });
    return app;
  };

  it("returns 401 without auth header", async () => {
    const deps = makeDeps();
    const app = createTestApp(createSubscriptionsRouter(deps));
    const response = await request(app).get("/");
    expect(response.status).toBe(401);
  });

  it("returns 400 without tenant header", async () => {
    const deps = makeDeps();
    const app = createTestApp(createSubscriptionsRouter(deps));
    const response = await request(app).get("/").set("Authorization", "Bearer any-token");
    expect(response.status).toBe(400);
  });

  it("POST / creates a subscription", async () => {
    const deps = makeDeps();
    deps.createSubscription.mockResolvedValue(makeSubscription() as never);
    const app = createTestApp(createSubscriptionsRouter(deps));
    const response = await request(app)
      .post("/")
      .set(makeAuthHeaders())
      .send({ orderId: "order-1", pickupDeadline: "2026-12-31T00:00:00.000Z" });
    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe("sub-1");
  });

  it("POST / returns 400 for invalid pickupDeadline", async () => {
    const deps = makeDeps();
    const app = createTestApp(createSubscriptionsRouter(deps));
    const response = await request(app)
      .post("/")
      .set(makeAuthHeaders())
      .send({ orderId: "order-1", pickupDeadline: "invalid" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET / lists subscriptions", async () => {
    const deps = makeDeps();
    deps.listSubscriptions.mockResolvedValue({ items: [makeSubscription() as never], nextCursor: null });
    const app = createTestApp(createSubscriptionsRouter(deps));
    const response = await request(app).get("/").set(makeAuthHeaders());
    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
  });

  it("GET /:id returns subscription", async () => {
    const deps = makeDeps();
    deps.getSubscriptionById.mockResolvedValue(makeSubscription({ id: "sub-1" }) as never);
    const app = createTestApp(createSubscriptionsRouter(deps));
    const response = await request(app).get("/sub-1").set(makeAuthHeaders());
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe("sub-1");
  });

  it("GET /:id returns 404 when missing", async () => {
    const deps = makeDeps();
    deps.getSubscriptionById.mockResolvedValue(null);
    const app = createTestApp(createSubscriptionsRouter(deps));
    const response = await request(app).get("/missing").set(makeAuthHeaders());
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("PATCH /:id updates subscription", async () => {
    const deps = makeDeps();
    deps.updateSubscription.mockResolvedValue(
      makeSubscription({ preorderStatus: "READY_FOR_PICKUP" }) as never,
    );
    const app = createTestApp(createSubscriptionsRouter(deps));
    const response = await request(app)
      .patch("/sub-1")
      .set(makeAuthHeaders())
      .send({ preorderStatus: "READY_FOR_PICKUP" });
    expect(response.status).toBe(200);
    expect(response.body.data.preorderStatus).toBe("READY_FOR_PICKUP");
  });

  it("PATCH /:id returns 400 for invalid status", async () => {
    const deps = makeDeps();
    const app = createTestApp(createSubscriptionsRouter(deps));
    const response = await request(app)
      .patch("/sub-1")
      .set(makeAuthHeaders())
      .send({ preorderStatus: "UNKNOWN" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
