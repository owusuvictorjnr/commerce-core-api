import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";
import { createOrdersRouter } from "./order.routes.js";
import { errorMiddleware } from "../../middleware/error.middleware.js";
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
      items: [{ id: 1, tenantId: "tenant-1", items: [], createdAt: new Date(), updatedAt: new Date() }],
      nextCursor: 1,
    });
    const router = express.Router();
    router.use("/orders", createOrdersRouter(deps));
    const app = createTestApp(router);
    const response = await request(app)
      .get("/orders?limit=1")
      .set("Authorization", "Bearer test-token")
      .set("x-tenant-id", "tenant-1");

    expect(response.status).toBe(200);
    expect(response.body.pagination.nextCursor).toBe(1);
    expect(deps.getOrders).toHaveBeenCalledWith("tenant-1", { limit: 1 });
  });

  it("creates order for tenant", async () => {
    const deps = makeDeps();
    deps.createOrder.mockResolvedValue({
      id: 3,
      tenantId: "tenant-9",
      items: [{ sku: "A-01", qty: 2 }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const router = express.Router();
    router.use("/orders", createOrdersRouter(deps));
    const app = createTestApp(router);
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
      .get("/orders?cursor=abc")
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

});
