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
   const trustProxyEnv = process.env["TRUST_PROXY"];
   const trustProxy = trustProxyEnv === undefined ? 1 : parseTrustProxy(trustProxyEnv);
   app.set("trust proxy", trustProxy);

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
