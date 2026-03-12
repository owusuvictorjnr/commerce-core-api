import type { Prisma } from "@prisma/client";

export interface HookPayloadMap {
  "order.beforeCreated": Prisma.OrderCreateInput;
  "order.afterCreated": Prisma.OrderGetPayload<Record<string, never>>;
}

type HookFn<T> = (payload: T) => Promise<void> | void;

class HookManager<TMap extends { [K in keyof TMap]: unknown }> {
  private hooks = new Map<keyof TMap, Array<HookFn<TMap[keyof TMap]>>>();

  register<K extends keyof TMap>(event: K, fn: HookFn<TMap[K]>): void {
    const existing = this.hooks.get(event) ?? [];
    this.hooks.set(event, [...existing, fn as HookFn<TMap[keyof TMap]>]);
  }

  async run<K extends keyof TMap>(event: K, payload: TMap[K]): Promise<void> {
    const handlers = this.hooks.get(event) ?? [];
    for (const handler of handlers) {
      await handler(payload);
    }
  }
}

export const hookManager = new HookManager<HookPayloadMap>();
