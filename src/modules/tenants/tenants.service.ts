import getPrismaClient from "../../database/prisma-client.js";
import { HttpError } from "../../core/errors/http-error.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type GetTenantsOptions = {
  limit?: number;
  cursor?: string;
};

export const createTenant = async (data: { name: string }) => {
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    throw new HttpError(400, "VALIDATION_ERROR", "Tenant name is required");
  }
  const prisma = getPrismaClient();
  return prisma.tenant.create({ data: { name: trimmedName } });
};

export const getTenants = async (options: GetTenantsOptions = {}) => {
  const prisma = getPrismaClient();
  const pageSize = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const items = await prisma.tenant.findMany({
    orderBy: { id: "asc" },
    take: pageSize + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });
  const hasMore = items.length > pageSize;
  const page = hasMore ? items.slice(0, pageSize) : items;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;
  return { items: page, nextCursor };
};

export const getTenantById = async (id: string) => {
  const prisma = getPrismaClient();
  return prisma.tenant.findUnique({ where: { id } });
};

export const updateTenant = async (id: string, data: { name?: string }) => {
  if (data.name !== undefined && !data.name.trim()) {
    throw new HttpError(400, "VALIDATION_ERROR", "Tenant name cannot be empty");
  }
  const prisma = getPrismaClient();
  const existing = await prisma.tenant.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "Tenant not found");
  }
  return prisma.tenant.update({
    where: { id },
    data: { ...(data.name !== undefined ? { name: data.name.trim() } : {}) },
  });
};

export const deleteTenant = async (id: string) => {
  const prisma = getPrismaClient();
  const existing = await prisma.tenant.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "Tenant not found");
  }
  await prisma.tenant.delete({ where: { id } });
};
