import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";
import { createOrdersRouter } from "./order.routes.js";
import { errorMiddleware } from "../../middleware/error.middleware.js";
import type { createOrder, getOrders, getOrderById, updateOrderStatus } from "./order.service.js";

const makeDeps = () => ({
  createOrder: jest.fn() as jest.MockedFunction<typeof createOrder>,
  getOrders: jest.fn() as jest.MockedFunction<typeof getOrders>,
  getOrderById: jest.fn() as jest.MockedFunction<typeof getOrderById>,
  updateOrderStatus: jest.fn() as jest.MockedFunction<typeof updateOrderStatus>,
});

describe("ordersRouter", () => {
  const createTestApp = (router: express.Router) => {
    const app = express();
    app.use(express.json());
    app.use(router);
    app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
      errorMiddleware(err, req, res, next);
    });
    return app;
  };


  it("returns 401 when authorization header is missing", async () => {
    const deps = makeDeps();
    const router = express.Router();
    router.use("/orders", createOrdersRouter(deps));
    const app = createTestApp(router);
    const response = await request(app).get("/orders");
    expect(response.status).toBe(401);
  });


  it("returns 400 when tenant header is missing", async () => {
    const deps = makeDeps();
    const router = express.Router();
    router.use("/orders", createOrdersRouter(deps));
    const app = createTestApp(router);
    const response = await request(app)
      .get("/orders")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(400);
  });


  it("returns paginated tenant orders", async () => {
    const deps = makeDeps();
    deps.getOrders.mockResolvedValue({
      items: [
        {
          id: "1",
          tenantId: "tenant-1",
          userId: "user-1",
          totalAmount: 100,
          paidAmount: 0,
          remainingAmount: 100,
          status: "PENDING",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      nextCursor: "1",
    });
    const router = express.Router();
    router.use("/orders", createOrdersRouter(deps));
    const app = createTestApp(router);
    const response = await request(app)
      .get("/orders?limit=1")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-1");

    expect(response.status).toBe(200);
    expect(response.body.pagination.nextCursor).toBe("1");
    expect(deps.getOrders).toHaveBeenCalledWith("tenant-1", { limit: 1 });
  });

  it("creates order for tenant", async () => {
    const deps = makeDeps();
    deps.createOrder.mockResolvedValue({
      id: "3",
      tenantId: "tenant-9",
      userId: "user-9",
      totalAmount: 100,
      paidAmount: 0,
      remainingAmount: 100,
      status: "PENDING",
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const router = express.Router();
    router.use("/orders", createOrdersRouter(deps));
    const app = createTestApp(router);
    const response = await request(app)
      .post("/orders")
      .set("Authorization", "Bearer test-token")
      .set("x-user-id", "user-9")
      .set("x-tenant-id", "tenant-9")
      .send({ items: [{ productId: "prod-1", quantity: 2, price: 50 }] });

    expect(response.status).toBe(201);
    expect(deps.createOrder).toHaveBeenCalledWith("tenant-9", "user-9", {
      items: [{ productId: "prod-1", quantity: 2, price: 50 }],
    });
  });


  it("returns 400 when limit query param is invalid", async () => {
    const deps = makeDeps();
    const router = express.Router();
    router.use("/orders", createOrdersRouter(deps));
    const app = createTestApp(router);
    const response = await request(app)
      .get("/orders?limit=0")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-1");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });


  it("returns 400 when cursor query param is invalid", async () => {
    const deps = makeDeps();
    const router = express.Router();
    router.use("/orders", createOrdersRouter(deps));
    const app = createTestApp(router);
    const response = await request(app)
      .get("/orders?cursor=")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-1");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });


  it("returns 400 when request body is missing items array", async () => {
    const deps = makeDeps();
    const router = express.Router();
    router.use("/orders", createOrdersRouter(deps));
    const app = createTestApp(router);
    const response = await request(app)
      .post("/orders")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-1")
      .send({ name: "invalid" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });


  it("returns 400 when items is not an array", async () => {
    const deps = makeDeps();
    const router = express.Router();
    router.use("/orders", createOrdersRouter(deps));
    const app = createTestApp(router);
    const response = await request(app)
      .post("/orders")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-1")
      .send({ items: "not-an-array" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when items array contains invalid item (missing productId)", async () => {
    const deps = makeDeps();
    const router = express.Router();
    router.use("/orders", createOrdersRouter(deps));
    const app = createTestApp(router);
    const response = await request(app)
      .post("/orders")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-1")
      .send({ items: [{ quantity: 2, price: 50 }] });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /:id returns 200 with order", async () => {
    const deps = makeDeps();
    deps.getOrderById.mockResolvedValue({
      id: "order-1",
      tenantId: "tenant-1",
      userId: "user-1",
      totalAmount: 100,
      paidAmount: 0,
      remainingAmount: 100,
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const router = express.Router();
    router.use("/orders", createOrdersRouter(deps));
    const app = createTestApp(router);
    const response = await request(app)
      .get("/orders/order-1")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-1");
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe("order-1");
    expect(deps.getOrderById).toHaveBeenCalledWith("tenant-1", "order-1");
  });

  it("GET /:id returns 404 when order not found", async () => {
    const deps = makeDeps();
    deps.getOrderById.mockResolvedValue(null);
    const router = express.Router();
    router.use("/orders", createOrdersRouter(deps));
    const app = createTestApp(router);
    const response = await request(app)
      .get("/orders/missing")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-1");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("PATCH /:id updates order status", async () => {
    const deps = makeDeps();
    deps.updateOrderStatus.mockResolvedValue({
      id: "order-1",
      tenantId: "tenant-1",
      userId: "user-1",
      totalAmount: 100,
      paidAmount: 0,
      remainingAmount: 100,
      status: "CANCELLED",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const router = express.Router();
    router.use("/orders", createOrdersRouter(deps));
    const app = createTestApp(router);
    const response = await request(app)
      .patch("/orders/order-1")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-1")
      .send({ status: "CANCELLED" });
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("CANCELLED");
    expect(deps.updateOrderStatus).toHaveBeenCalledWith("tenant-1", "order-1", "CANCELLED");
  });

  it("PATCH /:id returns 400 for invalid status", async () => {
    const deps = makeDeps();
    const router = express.Router();
    router.use("/orders", createOrdersRouter(deps));
    const app = createTestApp(router);
    const response = await request(app)
      .patch("/orders/order-1")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-1")
      .send({ status: "UNKNOWN" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

});
