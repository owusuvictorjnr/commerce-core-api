import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

const store = new Map<string, number>();
const ttls = new Map<string, number>();

jest.unstable_mockModule("./redis.client.js", () => ({
  redisClient: {
    incr: jest.fn(async (key: unknown) => {
      const k = String(key);
      const current = store.get(k) || 0;
      const next = current + 1;
      store.set(k, next);
      if (next === 1) {
        ttls.set(k, Date.now() + 60000);
      }
      return next;
    }),
    pExpire: jest.fn(async (key: unknown, ms: number) => {
      const k = String(key);
      ttls.set(k, Date.now() + ms);
      return 1;
    }),
    pTTL: jest.fn(async (key: unknown) => {
      const k = String(key);
      const expiry = ttls.get(k);
      if (!expiry) return -2;
      const remaining = expiry - Date.now();
      return remaining > 0 ? remaining : -2;
    }),
    flushAll: jest.fn(async () => {
      store.clear();
      ttls.clear();
      return "OK";
    }),
    connect: jest.fn(async () => {
      // Return a basic mock; avoid referencing redisClient in this factory to prevent evaluation errors
      return {} as unknown;
    }),
    on: jest.fn(),
  },
  initRedis: jest.fn(async () => {}),
}));

const { createRateLimitMiddleware } = await import("./rateLimit.middleware.js");
const { errorMiddleware } = await import("./error.middleware.js");
const { redisClient } = await import("./redis.client.js");
const { logger } = await import("../core/logger/index.js");

describe("rateLimitMiddleware", () => {
  beforeEach(() => {
    store.clear();
    ttls.clear();
    jest.clearAllMocks();

    // Mock logger
    jest.spyOn(logger, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const createTestApp = (maxRequests: number, failOpen?: boolean) => {
    const app = express();
    app.use(createRateLimitMiddleware({ windowMs: 60_000, maxRequests, failOpen }));
    app.get("/ping", (_req, res) => {
      void _req;
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

    await request(app).get("/ping");
    const second = await request(app).get("/ping");

    expect(second.status).toBe(429);
  });

  describe("fail-open behavior", () => {
    it("allows request to proceed if Redis fails and fail-open is enabled", async () => {
      const incrMock = redisClient.incr as jest.MockedFunction<typeof redisClient.incr>;
      incrMock.mockRejectedValueOnce(new Error("Redis connection lost"));
      
      const app = createTestApp(10, true);
      const res = await request(app).get("/ping");

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });

    it("returns 500 error if Redis fails and fail-open is disabled", async () => {
      const incrMock = redisClient.incr as jest.MockedFunction<typeof redisClient.incr>;
      incrMock.mockRejectedValueOnce(new Error("Redis connection lost"));
      
      const app = createTestApp(10, false);
      const res = await request(app).get("/ping");

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    });
  });

  describe("configuration validation", () => {
    it("throws error if windowMs is not a positive integer", () => {
      expect(() =>
        createRateLimitMiddleware({ windowMs: 0, maxRequests: 10 }),
      ).toThrow("windowMs must be a positive integer");
    });

    it("throws error if maxRequests is not a positive integer", () => {
      expect(() =>
        createRateLimitMiddleware({ windowMs: 1000, maxRequests: 0 }),
      ).toThrow("maxRequests must be a positive integer");
    });
  });
});
