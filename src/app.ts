import express from "express";
import cors from "cors";
import helmet from "helmet";
import { registerListeners } from "./events/register-listeners.js";
import "./hooks/index.js";
import { RegisterRouter } from "./modules/register-routes.js";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware.js";

export const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use(cors());
  app.use(helmet());

  // Load routes dynamically
  app.use(RegisterRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  // Register event listeners once during startup
  registerListeners();

  return app;
};
