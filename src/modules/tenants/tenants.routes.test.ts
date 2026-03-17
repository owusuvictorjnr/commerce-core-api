import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";
import { createTenantsRouter } from "./tenants.routes.js";
import { errorMiddleware } from "../../middleware/error.middleware.js";
import type {
  createTenant,
  getTenants,
  getTenantById,
  updateTenant,
  deleteTenant,
} from "./tenants.service.js";

const AUTH_HEADER = "Authorization";

const makeDeps = () => ({
  createTenant: jest.fn() as jest.MockedFunction<typeof createTenant>,
  getTenants: jest.fn() as jest.MockedFunction<typeof getTenants>,
  getTenantById: jest.fn() as jest.MockedFunction<typeof getTenantById>,
  updateTenant: jest.fn() as jest.MockedFunction<typeof updateTenant>,
  deleteTenant: jest.fn() as jest.MockedFunction<typeof deleteTenant>,
});

const makeTenant = (overrides: Record<string, unknown> = {}) => ({
  id: "tenant-1",
  name: "Acme",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("tenantsRouter", () => {
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

  it("returns 401 when auth header is missing", async () => {
    const deps = makeDeps();
    const app = createTestApp(createTenantsRouter(deps));
    const response = await request(app).get("/");
    expect(response.status).toBe(401);
  });

  it("POST / creates a tenant", async () => {
    const deps = makeDeps();
    deps.createTenant.mockResolvedValue(makeTenant() as never);
    const app = createTestApp(createTenantsRouter(deps));
    const response = await request(app)
      .post("/")
      .set(AUTH_HEADER, "Bearer any-token")
      .send({ name: "Acme" });
    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe("Acme");
    expect(deps.createTenant).toHaveBeenCalledWith({ name: "Acme" });
  });

  it("POST / returns 400 when tenant name is missing", async () => {
    const deps = makeDeps();
    const app = createTestApp(createTenantsRouter(deps));
    const response = await request(app)
      .post("/")
      .set(AUTH_HEADER, "Bearer any-token")
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST / returns 400 when body is not an object", async () => {
    const deps = makeDeps();
    const app = createTestApp(createTenantsRouter(deps));
    const response = await request(app)
      .post("/")
      .set(AUTH_HEADER, "Bearer any-token")
      .send([{ name: "Acme" }]);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET / returns paginated tenants", async () => {
    const deps = makeDeps();
    deps.getTenants.mockResolvedValue({ items: [makeTenant() as never], nextCursor: null });
    const app = createTestApp(createTenantsRouter(deps));
    const response = await request(app).get("/").set(AUTH_HEADER, "Bearer any-token");
    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.nextCursor).toBeNull();
  });

  it("GET /:id returns tenant by id", async () => {
    const deps = makeDeps();
    deps.getTenantById.mockResolvedValue(makeTenant({ id: "tenant-1" }) as never);
    const app = createTestApp(createTenantsRouter(deps));
    const response = await request(app).get("/tenant-1").set(AUTH_HEADER, "Bearer any-token");
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe("tenant-1");
  });

  it("GET /:id returns 404 when tenant not found", async () => {
    const deps = makeDeps();
    deps.getTenantById.mockResolvedValue(null);
    const app = createTestApp(createTenantsRouter(deps));
    const response = await request(app).get("/missing").set(AUTH_HEADER, "Bearer any-token");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("PATCH /:id updates a tenant", async () => {
    const deps = makeDeps();
    deps.updateTenant.mockResolvedValue(makeTenant({ name: "Updated" }) as never);
    const app = createTestApp(createTenantsRouter(deps));
    const response = await request(app)
      .patch("/tenant-1")
      .set(AUTH_HEADER, "Bearer any-token")
      .send({ name: "Updated" });
    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe("Updated");
    expect(deps.updateTenant).toHaveBeenCalledWith("tenant-1", { name: "Updated" });
  });

  it("PATCH /:id returns 400 for empty name", async () => {
    const deps = makeDeps();
    const app = createTestApp(createTenantsRouter(deps));
    const response = await request(app)
      .patch("/tenant-1")
      .set(AUTH_HEADER, "Bearer any-token")
      .send({ name: "  " });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("DELETE /:id deletes a tenant and returns 204", async () => {
    const deps = makeDeps();
    deps.deleteTenant.mockResolvedValue(undefined as never);
    const app = createTestApp(createTenantsRouter(deps));
    const response = await request(app)
      .delete("/tenant-1")
      .set(AUTH_HEADER, "Bearer any-token");
    expect(response.status).toBe(204);
    expect(deps.deleteTenant).toHaveBeenCalledWith("tenant-1");
  });
});
