import { jest } from "@jest/globals";
import { Prisma } from "@prisma/client";
import type { Order } from "@prisma/client";
import { HttpError } from "../../core/errors/http-error.js";

const findManyMock = jest.fn<(...args: unknown[]) => Promise<Order[]>>();
const createMock = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findFirstMock = jest.fn<(...args: unknown[]) => Promise<Order | null>>();
const updateMock = jest.fn<(...args: unknown[]) => Promise<Order>>();

jest.unstable_mockModule("../../database/prisma-client.js", () => ({
  default: () => ({
    order: {
      findMany: findManyMock,
      create: createMock,
      findFirst: findFirstMock,
      update: updateMock,
    },
  }),
}));

jest.unstable_mockModule("../../hooks/hooks-manager.js", () => ({
  hookManager: {
    run: jest.fn(),
  },
}));

jest.unstable_mockModule("../../events/event-bus.js", () => ({
  eventBus: {
    emit: jest.fn(),
  },
}));

const { getOrders, createOrder, getOrderById, updateOrderStatus } =
  await import("./order.service.js");

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: "1",
  tenantId: "tenant-1",
  userId: "user-1",
  totalAmount: 100,
  paidAmount: 0,
  remainingAmount: 100,
  status: "PENDING",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("createOrder", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("throws 400 when items array is empty", async () => {
    await expect(
      createOrder("tenant-1", "user-1", { items: [] }),
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
  });

  it("creates order with calculated totalAmount", async () => {
    createMock.mockResolvedValue(makeOrder({ totalAmount: 200, remainingAmount: 200 }));
    const result = await createOrder("tenant-1", "user-1", {
      items: [
        { productId: "prod-1", quantity: 2, price: 50 },
        { productId: "prod-2", quantity: 1, price: 100 },
      ],
    });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalAmount: 200,
          remainingAmount: 200,
        }),
      }),
    );
    expect(result).toBeDefined();
  });
});

describe("getOrderById", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
  });

  it("returns null when order not found", async () => {
    findFirstMock.mockResolvedValue(null);
    const result = await getOrderById("tenant-1", "order-1");
    expect(result).toBeNull();
  });

  it("returns order when found for the correct tenant", async () => {
    findFirstMock.mockResolvedValue(makeOrder({ id: "order-1" }));
    const result = await getOrderById("tenant-1", "order-1");
    expect(result?.id).toBe("order-1");
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "order-1", tenantId: "tenant-1" }) }),
    );
  });
});

describe("updateOrderStatus", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    updateMock.mockReset();
  });

  it("throws 400 for invalid status", async () => {
    await expect(
      updateOrderStatus("tenant-1", "order-1", "INVALID" as never),
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
  });

  it("throws 404 when order not found", async () => {
    findFirstMock.mockResolvedValue(null);
    await expect(
      updateOrderStatus("tenant-1", "order-1", "CANCELLED"),
    ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
  });

  it("updates order status", async () => {
    findFirstMock.mockResolvedValue(makeOrder());
    updateMock.mockResolvedValue(makeOrder({ status: "CANCELLED" }));
    const result = await updateOrderStatus("tenant-1", "1", "CANCELLED");
    expect(result.status).toBe("CANCELLED");
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "1" }, data: { status: "CANCELLED" } });
  });
});

describe("getOrders", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    createMock.mockReset();
  });

  it("returns first page and nextCursor when more rows exist", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "1",
        tenantId: "tenant-1",
        userId: "user-1",
        totalAmount: 100,
        paidAmount: 0,
        remainingAmount: 100,
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "2",
        tenantId: "tenant-1",
        userId: "user-1",
        totalAmount: 200,
        paidAmount: 0,
        remainingAmount: 200,
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "3",
        tenantId: "tenant-1",
        userId: "user-1",
        totalAmount: 300,
        paidAmount: 0,
        remainingAmount: 300,
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await getOrders("tenant-1", { limit: 2 });

    expect(findManyMock).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
      orderBy: { id: "asc" },
      take: 3,
    });
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("2");
  });

  it("uses cursor pagination for subsequent pages", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "12",
        tenantId: "tenant-1",
        userId: "user-1",
        totalAmount: 120,
        paidAmount: 0,
        remainingAmount: 120,
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "13",
        tenantId: "tenant-1",
        userId: "user-1",
        totalAmount: 130,
        paidAmount: 0,
        remainingAmount: 130,
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await getOrders("tenant-1", { limit: 2, cursor: "11" });

    expect(findManyMock).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
      orderBy: { id: "asc" },
      take: 3,
      cursor: { id: "11" },
      skip: 1,
    });
    expect(result.items.map((item) => item.id)).toEqual(["12", "13"]);
    expect(result.nextCursor).toBeNull();
  });

  it("maps Prisma P2025 cursor errors to HttpError(400)", async () => {
    findManyMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Cursor record not found", {
        code: "P2025",
        clientVersion: "test",
      }),
    );

    await expect(getOrders("tenant-1", { limit: 2, cursor: "999" })).rejects.toEqual(
      expect.objectContaining({
        statusCode: 400,
        code: "VALIDATION_ERROR",
      }),
    );

    await expect(getOrders("tenant-1", { limit: 2, cursor: "999" })).rejects.toBeInstanceOf(HttpError);
  });

  it("rethrows unexpected query errors", async () => {
    const dbError = new Error("database unavailable");
    findManyMock.mockRejectedValue(dbError);

    await expect(getOrders("tenant-1", { limit: 2, cursor: "999" })).rejects.toBe(dbError);
  });
});
