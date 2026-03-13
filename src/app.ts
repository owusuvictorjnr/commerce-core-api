import express from "express";
import cors from "cors";
import helmet from "helmet";
import { registerListeners } from "./events/register-listeners.js";
import "./hooks/index.js";
import { RegisterRouter } from "./modules/register-routes.js";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware.js";
import { rateLimiteMiddleware } from "./middleware/rateLimite.middleware.js";

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
  app.set("trust proxy", parseTrustProxy(process.env["TRUST_PROXY"]));

  app.use(express.json());
  app.use(cors());
  app.use(helmet());
  app.use(rateLimiteMiddleware);

  // Load routes dynamically
  app.use(RegisterRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  // Register event listeners once during startup
  registerListeners();

  return app;
};
