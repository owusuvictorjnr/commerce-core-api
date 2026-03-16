import express from "express";
import cors from "cors";
import helmet from "helmet";
import { registerListeners } from "./events/register-listeners.js";
import "./hooks/index.js";
import { RegisterRouter } from "./modules/register-routes.js";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.middleware.js";

const parseTrustProxy = (value: string | undefined): boolean | number => {
  if (!value || value === "false") {
    return false;
  }

  if (value === "true") {
    return 1;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : false;
};

export const createApp = () => {
   const app = express();
   // Ensure correct client IP when behind a reverse proxy/load balancer
   app.set("trust proxy", parseTrustProxy(process.env["TRUST_PROXY"]) || 1);

  app.use(express.json());
  app.use(cors());
  app.use(helmet());
  app.use(rateLimitMiddleware);

  // Load routes dynamically
  app.use(RegisterRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  // Register event listeners once during startup
  registerListeners();

  return app;
};
