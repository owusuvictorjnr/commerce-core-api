import { registerAnalyticsListener } from "./listeners/analytics.listener.js";
import { registerEmailListener } from "./listeners/email.listener.js";
import { registerInventoryListener } from "./listeners/inventory.listener.js";

let listenersRegistered = false;

export const registerListeners = () => {
    if (listenersRegistered) {
        return;
    }

    registerAnalyticsListener();
    registerEmailListener();
    registerInventoryListener();

    listenersRegistered = true;
    console.log("Event listeners registered");
};