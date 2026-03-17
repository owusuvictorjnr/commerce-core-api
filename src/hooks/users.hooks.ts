import { hookManager } from "./hooks-manager.js";
import { logger } from "../core/logger/index.js";
import { HttpError } from "../core/errors/http-error.js";

const MAX_NAME_LENGTH = 100;

hookManager.register("user.beforeProfileUpdate", ({ userId, input }) => {
	if (input.name !== undefined && input.name.trim().length > MAX_NAME_LENGTH) {
		throw new HttpError(400, "VALIDATION_ERROR", `Name must not exceed ${MAX_NAME_LENGTH} characters`);
	}
	logger.info("user.beforeProfileUpdate hook", { userId });
});
