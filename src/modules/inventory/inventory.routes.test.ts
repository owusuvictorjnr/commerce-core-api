import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";
import { createInventoryRouter } from "./inventory.routes.js";
import { errorMiddleware } from "../../middleware/error.middleware.js";
import type {
  getInventoryByProduct,
  upsertInventory,
  adjustInventory,
} from "./inventory.service.js";

const makeDeps = () => ({
  getInventoryByProduct: jest.fn() as jest.MockedFunction<typeof getInventoryByProduct>,
  upsertInventory: jest.fn() as jest.MockedFunction<typeof upsertInventory>,
  adjustInventory: jest.fn() as jest.MockedFunction<typeof adjustInventory>,
});

const makeAuthHeaders = () => ({
  Authorization: "Bearer any-token",
  "x-user-id": "user-1",
  "x-tenant-id": "tenant-1",
});

const makeInventory = (overrides: Record<string, unknown> = {}) => ({
  id: "inv-1",
  productId: "prod-1",
  quantity: 50,
  reservedQuantity: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("inventoryRouter", () => {
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
    const app = createTestApp(createInventoryRouter(deps));
    const response = await request(app).get("/prod-1");
    expect(response.status).toBe(401);
  });

  it("returns 400 without tenant header", async () => {
    const deps = makeDeps();
    const app = createTestApp(createInventoryRouter(deps));
    const response = await request(app).get("/prod-1").set("Authorization", "Bearer any-token");
    expect(response.status).toBe(400);
  });

  it("GET /:productId returns inventory", async () => {
    const deps = makeDeps();
    deps.getInventoryByProduct.mockResolvedValue(makeInventory() as never);
    const app = createTestApp(createInventoryRouter(deps));
    const response = await request(app).get("/prod-1").set(makeAuthHeaders());
    expect(response.status).toBe(200);
    expect(response.body.data.quantity).toBe(50);
    expect(deps.getInventoryByProduct).toHaveBeenCalledWith("tenant-1", "prod-1");
  });

  it("PUT /:productId sets inventory quantity", async () => {
    const deps = makeDeps();
    deps.upsertInventory.mockResolvedValue(makeInventory({ quantity: 100 }) as never);
    const app = createTestApp(createInventoryRouter(deps));
    const response = await request(app)
      .put("/prod-1")
      .set(makeAuthHeaders())
      .send({ quantity: 100 });
    expect(response.status).toBe(200);
    expect(response.body.data.quantity).toBe(100);
    expect(deps.upsertInventory).toHaveBeenCalledWith("tenant-1", "prod-1", { quantity: 100 });
  });

  it("PUT /:productId returns 400 for negative quantity", async () => {
    const deps = makeDeps();
    const app = createTestApp(createInventoryRouter(deps));
    const response = await request(app)
      .put("/prod-1")
      .set(makeAuthHeaders())
      .send({ quantity: -5 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("PUT /:productId returns 400 for non-integer quantity", async () => {
    const deps = makeDeps();
    const app = createTestApp(createInventoryRouter(deps));
    const response = await request(app)
      .put("/prod-1")
      .set(makeAuthHeaders())
      .send({ quantity: 1.5 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /:productId/adjust adjusts inventory", async () => {
    const deps = makeDeps();
    deps.adjustInventory.mockResolvedValue(makeInventory({ quantity: 55 }) as never);
    const app = createTestApp(createInventoryRouter(deps));
    const response = await request(app)
      .post("/prod-1/adjust")
      .set(makeAuthHeaders())
      .send({ adjustment: 5 });
    expect(response.status).toBe(200);
    expect(response.body.data.quantity).toBe(55);
    expect(deps.adjustInventory).toHaveBeenCalledWith("tenant-1", "prod-1", { adjustment: 5 });
  });

  it("POST /:productId/adjust returns 400 for non-integer adjustment", async () => {
    const deps = makeDeps();
    const app = createTestApp(createInventoryRouter(deps));
    const response = await request(app)
      .post("/prod-1/adjust")
      .set(makeAuthHeaders())
      .send({ adjustment: 1.5 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
