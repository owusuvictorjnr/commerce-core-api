import { hookManager } from "./hooks-manager.js";

hookManager.register("order.beforeCreated", async (order) => {
  if (!order.item?.length) {
    throw new Error("Order must have at least one item");
  }
});
