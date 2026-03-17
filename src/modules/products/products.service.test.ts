import { HttpError } from "../../core/errors/http-error.js";
import {
  __resetProductsForTests,
  __setProductStoreLimitsForTests,
  createProduct,
  getProducts,
} from "./products.service.js";

describe("products.service", () => {
  beforeEach(() => {
    __resetProductsForTests();
  });

  it("creates a product with valid finite non-negative price", async () => {
    const result = await createProduct("tenant-1", {
      name: "Widget",
      price: 100,
      description: "A widget",
    });

    expect(result.tenantId).toBe("tenant-1");
    expect(result.name).toBe("Widget");
    expect(result.price).toBe(100);
  });

  it("rejects NaN price", async () => {
    await expect(
      createProduct("tenant-1", {
        name: "Widget",
        price: Number.NaN,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Product price must be a finite number",
    } satisfies Partial<HttpError>);
  });

  it("rejects Infinity price", async () => {
    await expect(
      createProduct("tenant-1", {
        name: "Widget",
        price: Number.POSITIVE_INFINITY,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Product price must be a finite number",
    } satisfies Partial<HttpError>);
  });

  it("rejects negative price", async () => {
    await expect(
      createProduct("tenant-1", {
        name: "Widget",
        price: -1,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Product price must be non-negative",
    } satisfies Partial<HttpError>);
  });

  it("rejects creating a new tenant when tenant capacity is reached", async () => {
    __setProductStoreLimitsForTests({ maxTenants: 2 });

    await createProduct("tenant-1", { name: "Widget 1", price: 1 });
    await createProduct("tenant-2", { name: "Widget 2", price: 2 });

    await expect(
      createProduct("tenant-3", {
        name: "Widget 3",
        price: 3,
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "RESOURCE_LIMIT_EXCEEDED",
    } satisfies Partial<HttpError>);
  });

  it("rejects creating a product when per-tenant capacity is reached", async () => {
    __setProductStoreLimitsForTests({ maxProductsPerTenant: 2 });

    await createProduct("tenant-1", { name: "Widget 1", price: 1 });
    await createProduct("tenant-1", { name: "Widget 2", price: 2 });

    await expect(
      createProduct("tenant-1", {
        name: "Widget 3",
        price: 3,
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "RESOURCE_LIMIT_EXCEEDED",
    } satisfies Partial<HttpError>);
  });

  describe("getProducts", () => {
    it("returns empty array for tenant with no products", async () => {
      const result = await getProducts("tenant-1");

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });

    it("clamps limit 0 to minimum of 1", async () => {
      await createProduct("tenant-1", { name: "Product 1", price: 100 });
      await createProduct("tenant-1", { name: "Product 2", price: 200 });

      const result = await getProducts("tenant-1", { limit: 0 });

      expect(result.items.length).toBe(1);
      expect(result.nextCursor).not.toBeNull();
    });

    it("clamps negative limit to minimum of 1", async () => {
      await createProduct("tenant-1", { name: "Product 1", price: 100 });
      await createProduct("tenant-1", { name: "Product 2", price: 200 });

      const result = await getProducts("tenant-1", { limit: -5 });

      expect(result.items.length).toBe(1);
      expect(result.nextCursor).not.toBeNull();
    });

    it("clamps limit exceeding MAX_PAGE_SIZE to max", async () => {
      // Create more than MAX_PAGE_SIZE products
      for (let i = 1; i <= 150; i++) {
        await createProduct("tenant-1", { name: `Product ${i}`, price: i });
      }

      const result = await getProducts("tenant-1", { limit: 200 });

      expect(result.items.length).toBe(100);
      expect(result.nextCursor).not.toBeNull();
    });

    it("respects valid limit within bounds", async () => {
      for (let i = 1; i <= 50; i++) {
        await createProduct("tenant-1", { name: `Product ${i}`, price: i });
      }

      const result = await getProducts("tenant-1", { limit: 25 });

      expect(result.items.length).toBe(25);
      expect(result.nextCursor).not.toBeNull();
    });
  });
});
