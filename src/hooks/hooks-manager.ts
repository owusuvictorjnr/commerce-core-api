type HookFn = (payload: any) => Promise<void> | void;

class HookManager {
  private hooks: Record<string, HookFn[]> = {};

  register(event: string, fn: HookFn) {
    if (!this.hooks[event]) {
      this.hooks[event] = [];
    }
    this.hooks[event].push(fn);
  }

  async run(event: string, payload: any) {
    const handlers = this.hooks[event] || [];

    for (const handler of handlers) {
      await handler(payload);
    }
  }
}

export const hookManager = new HookManager();
