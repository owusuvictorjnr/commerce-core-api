import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";
import { createProductsRouter } from "./products.routes.js";
import { errorMiddleware } from "../../middleware/error.middleware.js";
import type { createProduct, getProducts, getProductById } from "./products.service.js";

const AUTH_HEADER = "Authorization";
const USER_ID_HEADER = "x-user-id";
const TENANT_HEADER = "x-tenant-id";

const makeDeps = () => {
  const createProductMock = jest.fn() as jest.MockedFunction<typeof createProduct>;
  const getProductsMock = jest.fn() as jest.MockedFunction<typeof getProducts>;
  const getProductByIdMock = jest.fn() as jest.MockedFunction<typeof getProductById>;

  return {
    createProduct: createProductMock,
    getProducts: getProductsMock,
    getProductById: getProductByIdMock,
  };
};

const makeAuthHeaders = () => ({
  [AUTH_HEADER]: "Bearer any-token",
  [USER_ID_HEADER]: "user-1",
  [TENANT_HEADER]: "tenant-1",
});

describe("productsRouter", () => {
  const createTestApp = (router: express.Router) => {
    const app = express();
    app.use(express.json());
    app.use(router);
    app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
      errorMiddleware(err, req, res, next);
    });
    return app;
  };

  it("returns 401 for GET /products without auth header", async () => {
    const deps = makeDeps();
    const app = createTestApp(createProductsRouter(deps));

    const response = await request(app).get("/");

    expect(response.status).toBe(401);
  });

  it("returns 400 for GET /products without tenant header", async () => {
    const deps = makeDeps();
    const app = createTestApp(createProductsRouter(deps));

    const response = await request(app)
      .get("/")
      .set(AUTH_HEADER, "Bearer any-token")
      .set(USER_ID_HEADER, "user-1");

    expect(response.status).toBe(400);
  });

  it("returns paginated products for GET /products", async () => {
    const deps = makeDeps();
    deps.getProducts.mockResolvedValue({
      items: [
        {
          id: "prod-1",
          tenantId: "tenant-1",
          name: "Widget",
          price: 999,
          description: "",
          createdAt: new Date("2025-01-01"),
        },
      ],
      nextCursor: null,
    });
    const app = createTestApp(createProductsRouter(deps));

    const response = await request(app)
      .get("/")
      .set(makeAuthHeaders());

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].name).toBe("Widget");
    expect(deps.getProducts).toHaveBeenCalledWith("tenant-1", expect.objectContaining({}));
  });

  it("returns 400 for GET /products when cursor query is not a string", async () => {
    const deps = makeDeps();
    const app = createTestApp(createProductsRouter(deps));

    const response = await request(app)
      .get("/?cursor=abc&cursor=def")
      .set(makeAuthHeaders());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.message).toBe("Query parameter 'cursor' must be a string");
  });

  it("returns 400 for POST /products with missing name", async () => {
    const deps = makeDeps();
    const app = createTestApp(createProductsRouter(deps));

    const response = await request(app)
      .post("/")
      .set(makeAuthHeaders())
      .send({ price: 100 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("creates a product for POST /products", async () => {
    const deps = makeDeps();
    deps.createProduct.mockResolvedValue({
      id: "prod-2",
      tenantId: "tenant-1",
      name: "Gadget",
      price: 4999,
      description: "A cool gadget",
      createdAt: new Date("2025-01-01"),
    });
    const app = createTestApp(createProductsRouter(deps));

    const response = await request(app)
      .post("/")
      .set(makeAuthHeaders())
      .send({ name: "Gadget", price: 4999, description: "A cool gadget" });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe("Gadget");
    expect(deps.createProduct).toHaveBeenCalledWith("tenant-1", {
      name: "Gadget",
      price: 4999,
      description: "A cool gadget",
    });
  });

  it("returns 404 for GET /products/:id when not found", async () => {
    const deps = makeDeps();
    deps.getProductById.mockResolvedValue(null);
    const app = createTestApp(createProductsRouter(deps));

    const response = await request(app)
      .get("/unknown-id")
      .set(makeAuthHeaders());

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("returns a product for GET /products/:id", async () => {
    const deps = makeDeps();
    deps.getProductById.mockResolvedValue({
      id: "prod-3",
      tenantId: "tenant-1",
      name: "Widget",
      price: 999,
      description: "",
      createdAt: new Date("2025-01-01"),
    });
    const app = createTestApp(createProductsRouter(deps));

    const response = await request(app)
      .get("/prod-3")
      .set(makeAuthHeaders());

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe("prod-3");
    expect(deps.getProductById).toHaveBeenCalledWith("tenant-1", "prod-3");
  });
});
