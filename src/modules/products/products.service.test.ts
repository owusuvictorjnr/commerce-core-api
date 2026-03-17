import { HttpError } from "../../core/errors/http-error.js";
import { __resetProductsForTests, createProduct } from "./products.service.js";

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
});
