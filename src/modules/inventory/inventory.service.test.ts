import { jest } from "@jest/globals";
import type { Inventory, Product } from "@prisma/client";

const productFindFirstMock = jest.fn<(...args: unknown[]) => Promise<Product | null>>();
const inventoryFindUniqueMock = jest.fn<(...args: unknown[]) => Promise<Inventory | null>>();
const inventoryUpsertMock = jest.fn<(...args: unknown[]) => Promise<Inventory>>();
const inventoryUpdateMock = jest.fn<(...args: unknown[]) => Promise<Inventory>>();

jest.unstable_mockModule("../../database/prisma-client.js", () => ({
  default: () => ({
    product: { findFirst: productFindFirstMock },
    inventory: {
      findUnique: inventoryFindUniqueMock,
      upsert: inventoryUpsertMock,
      update: inventoryUpdateMock,
    },
  }),
}));

const { getInventoryByProduct, upsertInventory, adjustInventory } =
  await import("./inventory.service.js");

const makeProduct = (): Product => ({
  id: "prod-1",
  tenantId: "tenant-1",
  name: "Widget",
  description: null,
  price: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeInventory = (overrides: Partial<Inventory> = {}): Inventory => ({
  id: "inv-1",
  productId: "prod-1",
  quantity: 50,
  reservedQuantity: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("getInventoryByProduct", () => {
  beforeEach(() => {
    productFindFirstMock.mockReset();
    inventoryFindUniqueMock.mockReset();
  });

  it("throws 404 when product not found", async () => {
    productFindFirstMock.mockResolvedValue(null);
    await expect(getInventoryByProduct("tenant-1", "prod-1")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });

  it("throws 404 when inventory record not found", async () => {
    productFindFirstMock.mockResolvedValue(makeProduct());
    inventoryFindUniqueMock.mockResolvedValue(null);
    await expect(getInventoryByProduct("tenant-1", "prod-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("returns inventory when found", async () => {
    productFindFirstMock.mockResolvedValue(makeProduct());
    inventoryFindUniqueMock.mockResolvedValue(makeInventory());
    const result = await getInventoryByProduct("tenant-1", "prod-1");
    expect(result.quantity).toBe(50);
  });
});

describe("upsertInventory", () => {
  beforeEach(() => {
    productFindFirstMock.mockReset();
    inventoryUpsertMock.mockReset();
  });

  it("throws 400 for negative quantity", async () => {
    await expect(upsertInventory("tenant-1", "prod-1", { quantity: -1 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 400 for non-integer quantity", async () => {
    await expect(upsertInventory("tenant-1", "prod-1", { quantity: 1.5 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 404 when product not found", async () => {
    productFindFirstMock.mockResolvedValue(null);
    await expect(upsertInventory("tenant-1", "prod-1", { quantity: 10 })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("upserts inventory with zero quantity is valid", async () => {
    productFindFirstMock.mockResolvedValue(makeProduct());
    inventoryUpsertMock.mockResolvedValue(makeInventory({ quantity: 0 }));
    const result = await upsertInventory("tenant-1", "prod-1", { quantity: 0 });
    expect(result.quantity).toBe(0);
  });

  it("upserts inventory", async () => {
    productFindFirstMock.mockResolvedValue(makeProduct());
    inventoryUpsertMock.mockResolvedValue(makeInventory({ quantity: 10 }));
    const result = await upsertInventory("tenant-1", "prod-1", { quantity: 10 });
    expect(result.quantity).toBe(10);
  });
});

describe("adjustInventory", () => {
  beforeEach(() => {
    productFindFirstMock.mockReset();
    inventoryFindUniqueMock.mockReset();
    inventoryUpdateMock.mockReset();
  });

  it("throws 400 for non-integer adjustment", async () => {
    await expect(
      adjustInventory("tenant-1", "prod-1", { adjustment: 1.5 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when product not found", async () => {
    productFindFirstMock.mockResolvedValue(null);
    await expect(adjustInventory("tenant-1", "prod-1", { adjustment: 5 })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("throws 404 when inventory not found", async () => {
    productFindFirstMock.mockResolvedValue(makeProduct());
    inventoryFindUniqueMock.mockResolvedValue(null);
    await expect(adjustInventory("tenant-1", "prod-1", { adjustment: 5 })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("throws 400 when resulting quantity would be negative", async () => {
    productFindFirstMock.mockResolvedValue(makeProduct());
    inventoryFindUniqueMock.mockResolvedValue(makeInventory({ quantity: 3 }));
    await expect(adjustInventory("tenant-1", "prod-1", { adjustment: -5 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("adjusts inventory quantity", async () => {
    productFindFirstMock.mockResolvedValue(makeProduct());
    inventoryFindUniqueMock.mockResolvedValue(makeInventory({ quantity: 10 }));
    inventoryUpdateMock.mockResolvedValue(makeInventory({ quantity: 15 }));
    const result = await adjustInventory("tenant-1", "prod-1", { adjustment: 5 });
    expect(result.quantity).toBe(15);
    expect(inventoryUpdateMock).toHaveBeenCalledWith({
      where: { productId: "prod-1" },
      data: { quantity: 15 },
    });
  });
});
