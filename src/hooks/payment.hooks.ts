import { hookManager } from "./hooks-manager.js";
import { logger } from "../core/logger/index.js";
import { HttpError } from "../core/errors/http-error.js";

hookManager.register("payment.beforeProcess", ({ paymentId, amount }) => {
	if (amount <= 0) {
		throw new HttpError(400, "VALIDATION_ERROR", "Payment amount must be greater than zero");
	}
	logger.info("payment.beforeProcess hook", { paymentId });
});
