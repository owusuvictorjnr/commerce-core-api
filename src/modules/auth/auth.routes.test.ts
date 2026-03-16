import express from "express";
import request from "supertest";
import { jest } from "@jest/globals";
import { createAuthRouter } from "./auth.routes.js";
import { errorMiddleware } from "../../middleware/error.middleware.js";
import type { loginUser, registerUser } from "./auth.service.js";

const makeDeps = () => {
  const registerUserMock = jest.fn() as jest.MockedFunction<typeof registerUser>;
  const loginUserMock = jest.fn() as jest.MockedFunction<typeof loginUser>;

  return {
    registerUser: registerUserMock,
    loginUser: loginUserMock,
  };
};

describe("authRouter", () => {
  const createTestApp = (router: express.Router) => {
    const app = express();
    app.use(express.json());
    app.use(router);
    app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
      errorMiddleware(err, req, res, next);
    });
    return app;
  };

  it("returns 400 when register payload is missing email/password", async () => {
    const deps = makeDeps();
    const app = createTestApp(createAuthRouter(deps));

    const response = await request(app).post("/register").send({ email: "" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("registers a user and returns token", async () => {
    const deps = makeDeps();
    deps.registerUser.mockResolvedValue({
      user: { id: "u1", email: "user@example.com" },
      token: "jwt-token",
    });
    const app = createTestApp(createAuthRouter(deps));

    const response = await request(app)
      .post("/register")
      .send({ email: "user@example.com", password: "password123" });

    expect(response.status).toBe(201);
    expect(response.body.data.token).toBe("jwt-token");
    expect(deps.registerUser).toHaveBeenCalledWith("user@example.com", "password123");
  });

  it("logs in a user and returns token", async () => {
    const deps = makeDeps();
    deps.loginUser.mockResolvedValue({
      user: { id: "u1", email: "user@example.com" },
      token: "jwt-token",
    });
    const app = createTestApp(createAuthRouter(deps));

    const response = await request(app)
      .post("/login")
      .send({ email: "user@example.com", password: "password123" });

    expect(response.status).toBe(200);
    expect(response.body.data.token).toBe("jwt-token");
    expect(deps.loginUser).toHaveBeenCalledWith("user@example.com", "password123");
  });

  it("returns 401 for /me without auth header", async () => {
    const deps = makeDeps();
    const app = createTestApp(createAuthRouter(deps));

    const response = await request(app).get("/me");

    expect(response.status).toBe(401);
  });
});
