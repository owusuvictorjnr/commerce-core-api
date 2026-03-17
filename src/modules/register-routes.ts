import { Router } from "express";
import { authRouter } from "./auth/auth.routes.js";
import { ordersRouter } from "./orders/order.routes.js";
import { usersRouter } from "./users/users.routes.js";
import { productsRouter } from "./products/products.routes.js";

export const RegisterRouter = Router();

RegisterRouter.use("/auth", authRouter);
RegisterRouter.use("/orders", ordersRouter);
RegisterRouter.use("/users", usersRouter);
RegisterRouter.use("/products", productsRouter);
