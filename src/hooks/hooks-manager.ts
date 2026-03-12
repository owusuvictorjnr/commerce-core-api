import type { Order, Prisma } from "@prisma/client";

export interface HookPayloadMap {
  "order.beforeCreated": Prisma.OrderCreateInput;
  "order.afterCreated": Order;
}

type HookFn<T> = (payload: T) => Promise<void> | void;

class HookManager<TMap extends { [K in keyof TMap]: unknown }> {
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
