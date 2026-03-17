import type { Order, Prisma } from "@prisma/client";

export interface HookPayloadMap {
  "order.beforeCreated": Prisma.OrderCreateInput;
  "order.afterCreated": Order;
  "user.beforeProfileUpdate": { userId: string; input: { name?: string } };
  "user.afterProfileUpdate": { id: string; email: string; name: string };
  "payment.beforeProcess": { paymentId: string; orderId: string; tenantId: string; amount: number };
  "payment.afterProcess": { paymentId: string; orderId: string; tenantId: string; amount: number; status: string };
}

type HookFn<T> = (payload: T) => Promise<void> | void;

class HookManager<TMap extends object> {
  private hooks: { [K in keyof TMap]?: HookFn<TMap[K]>[] } = {};

  register<K extends keyof TMap>(event: K, fn: HookFn<TMap[K]>): void {
    const existing = this.hooks[event] ?? [];
    this.hooks[event] = [...existing, fn];
  }

  async run<K extends keyof TMap>(event: K, payload: TMap[K]): Promise<void> {
    const handlers = this.hooks[event] ?? [];
    for (const handler of handlers) {
      await handler(payload);
    }
  }
}

export const hookManager = new HookManager<HookPayloadMap>();
