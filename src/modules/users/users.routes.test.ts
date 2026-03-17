import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";
import { createUsersRouter } from "./users.routes.js";
import { errorMiddleware } from "../../middleware/error.middleware.js";
import type { getUserById, updateUser, getOrCreateProfile } from "./users.service.js";

const AUTH_HEADER = "Authorization";
const USER_ID_HEADER = "x-user-id";

const makeDeps = () => {
  const getUserByIdMock = jest.fn() as jest.MockedFunction<typeof getUserById>;
  const updateUserMock = jest.fn() as jest.MockedFunction<typeof updateUser>;
  const getOrCreateProfileMock = jest.fn() as jest.MockedFunction<typeof getOrCreateProfile>;

  return {
    getUserById: getUserByIdMock,
    updateUser: updateUserMock,
    getOrCreateProfile: getOrCreateProfileMock,
  };
};

describe("usersRouter", () => {
  const createTestApp = (router: express.Router) => {
    const app = express();
    app.use(express.json());
    app.use(router);
    app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
      errorMiddleware(err, req, res, next);
    });
    return app;
  };

  it("returns 401 for /me without auth header", async () => {
    const deps = makeDeps();
    const app = createTestApp(createUsersRouter(deps));

    const response = await request(app).get("/me");

    expect(response.status).toBe(401);
  });

  it("returns existing user profile for GET /me", async () => {
    const deps = makeDeps();
    deps.getUserById.mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice",
    });
    const app = createTestApp(createUsersRouter(deps));

    const response = await request(app)
      .get("/me")
      .set(AUTH_HEADER, "Bearer any-token")
      .set(USER_ID_HEADER, "user-1");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: "user-1", email: "alice@example.com", name: "Alice" });
    expect(deps.getUserById).toHaveBeenCalledWith("user-1");
  });

  it("lazily creates profile when none exists for GET /me", async () => {
    const deps = makeDeps();
    deps.getUserById.mockResolvedValue(null);
    deps.getOrCreateProfile.mockReturnValue({ id: "user-2", email: "", name: "" });
    const app = createTestApp(createUsersRouter(deps));

    const response = await request(app)
      .get("/me")
      .set(AUTH_HEADER, "Bearer any-token")
      .set(USER_ID_HEADER, "user-2");

    expect(response.status).toBe(200);
    expect(deps.getOrCreateProfile).toHaveBeenCalledWith("user-2", expect.any(String));
  });

  it("returns 400 for PATCH /me with empty name", async () => {
    const deps = makeDeps();
    const app = createTestApp(createUsersRouter(deps));

    const response = await request(app)
      .patch("/me")
      .set(AUTH_HEADER, "Bearer any-token")
      .set(USER_ID_HEADER, "user-1")
      .send({ name: "  " });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("updates and returns user profile for PATCH /me", async () => {
    const deps = makeDeps();
    deps.getUserById.mockResolvedValue({ id: "user-1", email: "alice@example.com", name: "" });
    deps.updateUser.mockResolvedValue({ id: "user-1", email: "alice@example.com", name: "Alice" });
    const app = createTestApp(createUsersRouter(deps));

    const response = await request(app)
      .patch("/me")
      .set(AUTH_HEADER, "Bearer any-token")
      .set(USER_ID_HEADER, "user-1")
      .send({ name: "Alice" });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe("Alice");
    expect(deps.updateUser).toHaveBeenCalledWith("user-1", { name: "Alice" });
  });
});
