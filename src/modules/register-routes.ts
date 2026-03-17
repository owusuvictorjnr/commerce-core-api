import { Router } from "express";
import { authRouter } from "./auth/auth.routes.js";
import { ordersRouter } from "./orders/order.routes.js";
import { usersRouter } from "./users/users.routes.js";
import { productsRouter } from "./products/products.routes.js";
import { tenantsRouter } from "./tenants/tenants.routes.js";
import { inventoryRouter } from "./inventory/inventory.routes.js";
import { paymentsRouter } from "./payments/payments.routes.js";
import { subscriptionsRouter } from "./subscriptions/subscriptions.routes.js";

export const RegisterRouter = Router();

RegisterRouter.use("/auth", authRouter);
RegisterRouter.use("/orders", ordersRouter);
RegisterRouter.use("/users", usersRouter);
RegisterRouter.use("/products", productsRouter);
RegisterRouter.use("/tenants", tenantsRouter);
RegisterRouter.use("/inventory", inventoryRouter);
RegisterRouter.use("/payments", paymentsRouter);
RegisterRouter.use("/subscriptions", subscriptionsRouter);
