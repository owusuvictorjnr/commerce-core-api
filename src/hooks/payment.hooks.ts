import { hookManager } from "./hooks-manager.js";
import { logger } from "../core/logger/index.js";

hookManager.register("payment.beforeProcess", ({ paymentId, amount }) => {
	if (amount <= 0) {
		throw new Error("Payment amount must be greater than zero");
	}
	logger.info("payment.beforeProcess hook", { paymentId });
});
