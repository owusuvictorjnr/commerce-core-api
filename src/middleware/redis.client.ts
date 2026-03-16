import { createClient } from "redis";
import { logger } from "../core/logger/index.js";

const redisUrl = process.env["REDIS_URL"] || "redis://localhost:6379";

export const redisClient = createClient({
  url: redisUrl,
});

redisClient.on("error", (err) => {
  logger.error("Redis client error in rate limiter:", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
});

// Start connecting immediately, but handle connection errors to prevent unhandled rejections
void redisClient.connect().catch((err) => {
  logger.error("Failed to connect to Redis on startup:", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
});

/**
 * Controlled initialization of the Redis client.
 * Returns the existing connection if already open.
 */
export const initRedis = async (): Promise<void> => {
  if (redisClient.isOpen) {
    return;
  }
  await redisClient.connect();
};
