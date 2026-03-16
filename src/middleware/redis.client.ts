import { createClient } from "redis";

const redisUrl = process.env["REDIS_URL"] || "redis://localhost:6379";

export const redisClient = createClient({
  url: redisUrl,
});

redisClient.on("error", (err) => {
  console.error("Redis client error in rate limiter:", err);
});

// Start connecting immediately
void redisClient.connect();
