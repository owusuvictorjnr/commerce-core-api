import { randomUUID } from "node:crypto";
import { HttpError } from "../../core/errors/http-error.js";

export type Product = {
  id: string;
  tenantId: string;
  name: string;
  price: number;
  description: string;
  createdAt: Date;
};

type CreateProductInput = {
  name: string;
  price: number;
  description?: string;
};

type GetProductsOptions = {
  limit?: number;
  cursor?: string;
};

type GetProductsResult = {
  items: Product[];
  nextCursor: string | null;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_MAX_TENANTS = 1000;
const DEFAULT_MAX_PRODUCTS_PER_TENANT = 10000;

let maxTenants = DEFAULT_MAX_TENANTS;
let maxProductsPerTenant = DEFAULT_MAX_PRODUCTS_PER_TENANT;

// In-memory, non-durable product storage.
// NOTE: This is suitable only for tests/development and is explicitly bounded.
// For production, use a persistent store (e.g., the database via Prisma).
const productsByTenant = new Map<string, Product[]>();

const getAllForTenant = (tenantId: string): Product[] =>
  productsByTenant.get(tenantId) ?? [];

const validateStoreCapacity = (tenantId: string, existingProductsCount: number): void => {
  const isNewTenant = existingProductsCount === 0 && !productsByTenant.has(tenantId);
  if (isNewTenant && productsByTenant.size >= maxTenants) {
    throw new HttpError(
      503,
      "RESOURCE_LIMIT_EXCEEDED",
      "In-memory product store tenant limit reached. This storage is non-production and bounded.",
    );
  }

  if (existingProductsCount >= maxProductsPerTenant) {
    throw new HttpError(
      503,
      "RESOURCE_LIMIT_EXCEEDED",
      "Per-tenant in-memory product limit reached. This storage is non-production and bounded.",
    );
  }
};

export const createProduct = async (
  tenantId: string,
  input: CreateProductInput,
): Promise<Product> => {
  if (!input.name.trim()) {
    throw new HttpError(400, "VALIDATION_ERROR", "Product name is required");
  }
  if (!Number.isFinite(input.price)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Product price must be a finite number");
  }
  if (input.price < 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Product price must be non-negative");
  }

  const product: Product = {
    id: randomUUID(),
    tenantId,
    name: input.name.trim(),
    price: input.price,
    description: input.description?.trim() ?? "",
    createdAt: new Date(),
  };

  const existing = getAllForTenant(tenantId);
  validateStoreCapacity(tenantId, existing.length);
  productsByTenant.set(tenantId, [...existing, product]);

  return product;
};

export const getProducts = async (
  tenantId: string,
  options: GetProductsOptions = {},
): Promise<GetProductsResult> => {
  const pageSize = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const allProducts = getAllForTenant(tenantId);

  let startIndex = 0;
  if (options.cursor) {
    const cursorIndex = allProducts.findIndex((p) => p.id === options.cursor);
    if (cursorIndex === -1) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid cursor: product not found");
    }
    startIndex = cursorIndex + 1;
  }

  const slice = allProducts.slice(startIndex, startIndex + pageSize + 1);
  const hasMore = slice.length > pageSize;
  const items = hasMore ? slice.slice(0, pageSize) : slice;
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

  return { items, nextCursor };
};

export const getProductById = async (
  tenantId: string,
  id: string,
): Promise<Product | null> => {
  return getAllForTenant(tenantId).find((p) => p.id === id) ?? null;
};

/** Reset in-memory store — tests only */
export const __resetProductsForTests = (): void => {
  productsByTenant.clear();
  maxTenants = DEFAULT_MAX_TENANTS;
  maxProductsPerTenant = DEFAULT_MAX_PRODUCTS_PER_TENANT;
};

export const __setProductStoreLimitsForTests = (limits: {
  maxTenants?: number;
  maxProductsPerTenant?: number;
}): void => {
  if (limits.maxTenants !== undefined) {
    maxTenants = limits.maxTenants;
  }
  if (limits.maxProductsPerTenant !== undefined) {
    maxProductsPerTenant = limits.maxProductsPerTenant;
  }
};
