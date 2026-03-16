import { Router } from "express";
import { authRouter } from "./auth/auth.routes.js";
import { ordersRouter } from "./orders/order.routes.js";

export const RegisterRouter = Router();

RegisterRouter.use("/auth", authRouter);
RegisterRouter.use("/orders", ordersRouter);
