import { hookManager } from "./hooks-manager.js";

hookManager.register("order.beforeCreated", async (order) => {
  const items = order.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Order must have at least one item");
  }
});
