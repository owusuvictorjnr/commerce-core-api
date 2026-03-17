import { jest } from "@jest/globals";
import type { Order, Payment } from "@prisma/client";

const orderFindFirstMock = jest.fn<(...args: unknown[]) => Promise<Order | null>>();
const orderUpdateMock = jest.fn<(...args: unknown[]) => Promise<Order>>();
const paymentCreateMock = jest.fn<(...args: unknown[]) => Promise<Payment>>();
const paymentFindManyMock = jest.fn<(...args: unknown[]) => Promise<Payment[]>>();
const paymentFindFirstMock = jest.fn<(...args: unknown[]) => Promise<Payment | null>>();
const transactionMock = jest.fn();

jest.unstable_mockModule("../../database/prisma-client.js", () => ({
  default: () => ({
    $transaction: transactionMock,
    order: {
      findFirst: orderFindFirstMock,
      update: orderUpdateMock,
    },
    payment: {
      create: paymentCreateMock,
      findMany: paymentFindManyMock,
      findFirst: paymentFindFirstMock,
    },
  }),
}));

jest.unstable_mockModule("../../events/event-bus.js", () => ({
  eventBus: { emit: jest.fn() },
}));

const { createPayment, getPayments, getPaymentById } = await import("./payments.service.js");

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: "order-1",
  tenantId: "tenant-1",
  userId: "user-1",
  totalAmount: 200,
  paidAmount: 0,
  remainingAmount: 200,
  status: "PENDING",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makePayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: "pay-1",
  tenantId: "tenant-1",
  orderId: "order-1",
  amount: 100,
  paymentType: "DEPOSIT",
  status: "SUCCESS",
  transactionReference: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("createPayment", () => {
  beforeEach(() => {
    orderFindFirstMock.mockReset();
    orderUpdateMock.mockReset();
    paymentCreateMock.mockReset();
    transactionMock.mockReset();
    transactionMock.mockImplementation(async (...args: unknown[]) => {
      const callback = args[0] as (tx: unknown) => Promise<unknown>;
      return callback({
        order: {
          findFirst: orderFindFirstMock,
          update: orderUpdateMock,
        },
        payment: {
          create: paymentCreateMock,
        },
      });
    });
  });

  it("throws 400 for non-positive amount", async () => {
    await expect(
      createPayment("tenant-1", "order-1", { amount: 0, paymentType: "DEPOSIT" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 for invalid paymentType", async () => {
    await expect(
      createPayment("tenant-1", "order-1", { amount: 50, paymentType: "INVALID" as never }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 404 when order not found", async () => {
    orderFindFirstMock.mockResolvedValue(null);
    await expect(
      createPayment("tenant-1", "order-1", { amount: 50, paymentType: "DEPOSIT" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 400 for a cancelled order", async () => {
    orderFindFirstMock.mockResolvedValue(makeOrder({ status: "CANCELLED" }));
    await expect(
      createPayment("tenant-1", "order-1", { amount: 50, paymentType: "DEPOSIT" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("creates payment and updates order to PARTIAL_PAID", async () => {
    orderFindFirstMock.mockResolvedValue(makeOrder());
    paymentCreateMock.mockResolvedValue(makePayment());
    orderUpdateMock.mockResolvedValue(makeOrder());
    const result = await createPayment("tenant-1", "order-1", { amount: 100, paymentType: "DEPOSIT" });
    expect(result.amount).toBe(100);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(orderUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAmount: { increment: 100 },
          remainingAmount: 100,
          status: "PARTIAL_PAID",
        }),
      }),
    );
  });

  it("sets order to FULLY_PAID when payment covers total", async () => {
    orderFindFirstMock.mockResolvedValue(
      makeOrder({ totalAmount: 100, paidAmount: 0, remainingAmount: 100 }),
    );
    paymentCreateMock.mockResolvedValue(makePayment({ amount: 100 }));
    orderUpdateMock.mockResolvedValue(makeOrder());
    await createPayment("tenant-1", "order-1", { amount: 100, paymentType: "BALANCE" });
    expect(orderUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FULLY_PAID" }),
      }),
    );
  });
});

describe("getPayments", () => {
  beforeEach(() => {
    orderFindFirstMock.mockReset();
    paymentFindManyMock.mockReset();
  });

  it("throws 404 when order not found", async () => {
    orderFindFirstMock.mockResolvedValue(null);
    await expect(getPayments("tenant-1", "order-1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("returns payments page for an order", async () => {
    orderFindFirstMock.mockResolvedValue(makeOrder());
    paymentFindManyMock.mockResolvedValue([makePayment()]);
    const result = await getPayments("tenant-1", "order-1");
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
    expect(paymentFindManyMock).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", orderId: "order-1" },
      orderBy: { id: "asc" },
      take: 21,
    });
  });
});

describe("getPaymentById", () => {
  beforeEach(() => {
    paymentFindFirstMock.mockReset();
  });

  it("throws 404 when payment not found", async () => {
    paymentFindFirstMock.mockResolvedValue(null);
    await expect(getPaymentById("tenant-1", "pay-1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("returns payment when found", async () => {
    paymentFindFirstMock.mockResolvedValue(makePayment());
    const result = await getPaymentById("tenant-1", "pay-1");
    expect(result.id).toBe("pay-1");
  });
});
