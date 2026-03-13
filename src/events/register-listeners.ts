import { registerAnalyticsListener } from "./listeners/analytics.listener.js";
import { registerEmailListener } from "./listeners/email.listener.js";
import { registerInventoryListener } from "./listeners/inventory.listener.js";
import { logger } from "../core/logger/index.js";

let listenersRegistered = false;

export const registerListeners = () => {
    if (listenersRegistered) {
        return;
    }

    registerAnalyticsListener();
    registerEmailListener();
    registerInventoryListener();

    listenersRegistered = true;
    logger.info("Event listeners registered");
};