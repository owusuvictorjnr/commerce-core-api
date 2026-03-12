import { hookManager } from "../../hooks/hooks-manager.js";
import prisma from "../../database/prisma-client.js";
import { Prisma } from "@prisma/client";

export const createdOrder = async (data: Prisma.OrderCreateInput) => {
  // Before Hooks
  await hookManager.run("order.beforeCreated", data);

  // Create Order
  const order = await prisma.order.create({ data });

  // After Hooks
  await hookManager.run("order.afterCreated", order);

  return order;
};
