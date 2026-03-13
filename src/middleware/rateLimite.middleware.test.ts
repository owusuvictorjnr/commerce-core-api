import express from "express";
import request from "supertest";
import { createRateLimiteMiddleware } from "./rateLimite.middleware.js";
import { errorMiddleware } from "./error.middleware.js";

describe("rateLimiteMiddleware", () => {
  const createTestApp = (maxRequests: number) => {
    const app = express();
    app.use(createRateLimiteMiddleware({ windowMs: 60_000, maxRequests }));
    app.get("/ping", (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.use(errorMiddleware);
    return app;
  };

  it("allows requests within the limit", async () => {
    const app = createTestApp(2);

    const first = await request(app).get("/ping");
    const second = await request(app).get("/ping");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it("returns 429 after the request limit is exceeded", async () => {
    const app = createTestApp(1);

    const first = await request(app).get("/ping");
    const second = await request(app).get("/ping");

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.body.error).toEqual({
      code: "RATE_LIMITED",
      message: "Too many requests",
    });
  });
});
