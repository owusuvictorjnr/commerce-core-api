import express from "express";
import cors from "cors";
import helmet from "helmet";
import { registerListeners } from "./events/register-listeners.js";
import "./hooks/index.js";
import { RegisterRouter } from "./modules/register-routes.js";

export const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use(cors());
  app.use(helmet());

  // Load routes dynamically
  app.use(RegisterRouter);

  // Register event listeners once during startup
  registerListeners();

  return app;
};
