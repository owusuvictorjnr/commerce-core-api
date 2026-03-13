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
    expect(first.headers["x-ratelimit-limit"]).toBe("2");
    expect(first.headers["x-ratelimit-remaining"]).toBe("1");
    expect(first.headers["ratelimit-limit"]).toBe("2");
    expect(first.headers["ratelimit-remaining"]).toBe("1");
    expect(second.headers["x-ratelimit-remaining"]).toBe("0");
    expect(second.headers["ratelimit-remaining"]).toBe("0");
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
    expect(second.headers["x-ratelimit-limit"]).toBe("1");
    expect(second.headers["x-ratelimit-remaining"]).toBe("0");
    expect(second.headers["ratelimit-limit"]).toBe("1");
    expect(second.headers["ratelimit-remaining"]).toBe("0");
    expect(second.headers["retry-after"]).toBeDefined();
  });
});
