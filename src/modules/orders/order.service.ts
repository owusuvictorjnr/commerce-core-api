import { hookManager } from "../../hooks/hooks-manager.js";
import getPrismaClient from "../../database/prisma-client.js";
import { Prisma } from "@prisma/client";

export const createdOrder = async (
  tenantId: string,
  data: Omit<Prisma.OrderCreateInput, "tenantId">,
) => {
  const prisma = getPrismaClient();
  const payload: Prisma.OrderCreateInput = { ...data, tenantId };

  // Before Hooks
  await hookManager.run("order.beforeCreated", payload);

  // Create Order
  const order = await prisma.order.create({ data: payload });

  // After Hooks
  await hookManager.run("order.afterCreated", order);

  return order;
};

export const getOrders = async (tenantId: string) => {
  const prisma = getPrismaClient();
  return prisma.order.findMany({ where: { tenantId } });
};
