import { jest } from "@jest/globals";
import { Prisma } from "@prisma/client";
import type { Order, Preorder } from "@prisma/client";

const orderFindFirstMock = jest.fn<(...args: unknown[]) => Promise<Order | null>>();
const preorderCreateMock = jest.fn<(...args: unknown[]) => Promise<Preorder>>();
const preorderFindManyMock = jest.fn<(...args: unknown[]) => Promise<Preorder[]>>();
const preorderFindFirstMock = jest.fn<(...args: unknown[]) => Promise<Preorder | null>>();
const preorderUpdateMock = jest.fn<(...args: unknown[]) => Promise<Preorder>>();

jest.unstable_mockModule("../../database/prisma-client.js", () => ({
  default: () => ({
    order: { findFirst: orderFindFirstMock },
    preorder: {
      create: preorderCreateMock,
      findMany: preorderFindManyMock,
      findFirst: preorderFindFirstMock,
      update: preorderUpdateMock,
    },
  }),
}));

const {
  createSubscription,
  listSubscriptions,
  getSubscriptionById,
  updateSubscription,
} = await import("./subscriptions.service.js");

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: "order-1",
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

const makeSubscription = (overrides: Partial<Preorder> = {}): Preorder => ({
  id: "sub-1",
  orderId: "order-1",
  preorderStatus: "RESERVED",
  pickupDeadline: new Date("2026-12-31T00:00:00.000Z"),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("createSubscription", () => {
  beforeEach(() => {
    orderFindFirstMock.mockReset();
    preorderCreateMock.mockReset();
  });

  it("throws 404 when order does not exist for tenant", async () => {
    orderFindFirstMock.mockResolvedValue(null);
    await expect(
      createSubscription("tenant-1", { orderId: "order-1", pickupDeadline: new Date() }),
    ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
  });

  it("throws 409 for duplicate order subscription", async () => {
    orderFindFirstMock.mockResolvedValue(makeOrder());
    preorderCreateMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    await expect(
      createSubscription("tenant-1", { orderId: "order-1", pickupDeadline: new Date() }),
    ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
  });

  it("creates subscription for tenant order", async () => {
    orderFindFirstMock.mockResolvedValue(makeOrder());
    preorderCreateMock.mockResolvedValue(makeSubscription());
    const result = await createSubscription("tenant-1", {
      orderId: "order-1",
      pickupDeadline: new Date("2026-12-31T00:00:00.000Z"),
    });
    expect(result.id).toBe("sub-1");
  });
});

describe("listSubscriptions", () => {
  beforeEach(() => {
    preorderFindManyMock.mockReset();
  });

  it("returns paginated subscriptions", async () => {
    preorderFindManyMock.mockResolvedValue([
      makeSubscription({ id: "sub-1" }),
      makeSubscription({ id: "sub-2" }),
      makeSubscription({ id: "sub-3" }),
    ]);
    const result = await listSubscriptions("tenant-1", { limit: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("sub-2");
    expect(preorderFindManyMock).toHaveBeenCalledWith({
      where: {
        order: {
          tenantId: "tenant-1",
        },
      },
      orderBy: { id: "asc" },
      take: 3,
    });
  });
});

describe("getSubscriptionById", () => {
  beforeEach(() => {
    preorderFindFirstMock.mockReset();
  });

  it("returns null when not found", async () => {
    preorderFindFirstMock.mockResolvedValue(null);
    const result = await getSubscriptionById("tenant-1", "sub-1");
    expect(result).toBeNull();
  });

  it("returns subscription when found", async () => {
    preorderFindFirstMock.mockResolvedValue(makeSubscription());
    const result = await getSubscriptionById("tenant-1", "sub-1");
    expect(result?.id).toBe("sub-1");
  });
});

describe("updateSubscription", () => {
  beforeEach(() => {
    preorderFindFirstMock.mockReset();
    preorderUpdateMock.mockReset();
  });

  it("throws 400 for invalid status", async () => {
    await expect(
      updateSubscription("tenant-1", "sub-1", { preorderStatus: "INVALID" as never }),
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
  });

  it("throws 404 when subscription is not found", async () => {
    preorderFindFirstMock.mockResolvedValue(null);
    await expect(
      updateSubscription("tenant-1", "sub-1", { preorderStatus: "EXPIRED" }),
    ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
  });

  it("updates subscription fields", async () => {
    preorderFindFirstMock.mockResolvedValue(makeSubscription());
    preorderUpdateMock.mockResolvedValue(makeSubscription({ preorderStatus: "READY_FOR_PICKUP" }));
    const result = await updateSubscription("tenant-1", "sub-1", {
      preorderStatus: "READY_FOR_PICKUP",
    });
    expect(result.preorderStatus).toBe("READY_FOR_PICKUP");
  });
});
