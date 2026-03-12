import { eventBus } from "../event-bus.js";
import { EVENTS } from "../event.types.js";
import { logger } from "../../core/logger/index.js";

export const registerEmailListener = () => {
    eventBus.on(EVENTS.USER_CREATED, async (user) => {
    logger.info("Email event handled", { email: user.email });
    });
};