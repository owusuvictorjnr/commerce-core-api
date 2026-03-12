import { Router } from "express";
import { ordersRouter } from "./orders/order.routes.js";

export const RegisterRouter = Router();

RegisterRouter.use("/orders", ordersRouter);
