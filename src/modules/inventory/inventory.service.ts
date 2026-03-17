import getPrismaClient from "../../database/prisma-client.js";
import { HttpError } from "../../core/errors/http-error.js";

export const getInventoryByProduct = async (tenantId: string, productId: string) => {
  const prisma = getPrismaClient();
  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) {
    throw new HttpError(404, "NOT_FOUND", "Product not found");
  }
  const inventory = await prisma.inventory.findUnique({
    where: { tenantId_productId: { tenantId, productId } },
  });
  if (!inventory) {
    throw new HttpError(404, "NOT_FOUND", "Inventory record not found for this product");
  }
  return inventory;
};

export const upsertInventory = async (
  tenantId: string,
  productId: string,
  data: { quantity: number },
) => {
  if (!Number.isInteger(data.quantity) || data.quantity < 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Quantity must be a non-negative integer");
  }
  const prisma = getPrismaClient();
  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) {
    throw new HttpError(404, "NOT_FOUND", "Product not found");
  }
  return prisma.inventory.upsert({
    where: { tenantId_productId: { tenantId, productId } },
    create: { tenantId, productId, quantity: data.quantity },
    update: { quantity: data.quantity },
  });
};

export const adjustInventory = async (
  tenantId: string,
  productId: string,
  data: { adjustment: number },
) => {
  if (!Number.isInteger(data.adjustment)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Adjustment must be an integer");
  }
  const prisma = getPrismaClient();
  const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
  if (!product) {
    throw new HttpError(404, "NOT_FOUND", "Product not found");
  }
  const inventory = await prisma.inventory.findUnique({
    where: { tenantId_productId: { tenantId, productId } },
  });
  if (!inventory) {
    throw new HttpError(404, "NOT_FOUND", "Inventory record not found. Set inventory first.");
  }
  const newQuantity = inventory.quantity + data.adjustment;
  if (newQuantity < 0) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "Insufficient stock: resulting quantity cannot be negative",
    );
  }
  const reservedQuantity = inventory.reservedQuantity ?? 0;
  if (newQuantity < reservedQuantity) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "Insufficient stock: resulting quantity cannot be less than reserved quantity",
    );
  }
  return prisma.inventory.update({
    where: { tenantId_productId: { tenantId, productId } },
    data: { quantity: newQuantity },
  });
};
