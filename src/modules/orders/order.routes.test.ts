import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";
import { createOrdersRouter } from "./order.routes.js";
import type { createOrder, getOrders } from "./order.service.js";

const makeDeps = () => {
  const createOrderMock = jest.fn() as jest.MockedFunction<typeof createOrder>;
  const getOrdersMock = jest.fn() as jest.MockedFunction<typeof getOrders>;

  return {
    createOrder: createOrderMock,
    getOrders: getOrdersMock,
  };
};

describe("ordersRouter", () => {
  const createTestApp = () => {
    const app = express();
    app.use(express.json());
    return app;
  };

  it("returns 401 when authorization header is missing", async () => {
    const app = createTestApp();
    const deps = makeDeps();

    app.use("/orders", createOrdersRouter(deps));

    const response = await request(app).get("/orders");
    expect(response.status).toBe(401);
  });

  it("returns 400 when tenant header is missing", async () => {
    const app = createTestApp();
    const deps = makeDeps();

    app.use("/orders", createOrdersRouter(deps));

    const response = await request(app)
      .get("/orders")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(400);
  });

  it("returns paginated tenant orders", async () => {
    const app = createTestApp();
    const deps = makeDeps();
    deps.getOrders.mockResolvedValue({
      items: [{ id: 1, tenantId: "tenant-1", items: [], createdAt: new Date(), updatedAt: new Date() }],
      nextCursor: 1,
    });

    app.use("/orders", createOrdersRouter(deps));

    const response = await request(app)
      .get("/orders?limit=1")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-1");

    expect(response.status).toBe(200);
    expect(response.body.pagination.nextCursor).toBe(1);
    expect(deps.getOrders).toHaveBeenCalledWith("tenant-1", { limit: 1 });
  });

  it("creates order for tenant", async () => {
    const app = createTestApp();
    const deps = makeDeps();
    deps.createOrder.mockResolvedValue({
      id: 3,
      tenantId: "tenant-9",
      items: [{ sku: "A-01", qty: 2 }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    app.use("/orders", createOrdersRouter(deps));

    const response = await request(app)
      .post("/orders")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-9")
      .send({ items: [{ sku: "A-01", qty: 2 }] });

    expect(response.status).toBe(201);
    expect(deps.createOrder).toHaveBeenCalledWith("tenant-9", {
      items: [{ sku: "A-01", qty: 2 }],
    });
  });
});
