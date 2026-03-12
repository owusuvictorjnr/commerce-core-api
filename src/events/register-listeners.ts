import "./listeners/analytics.listener.js";
import "./listeners/email.listener.js";
import "./listeners/inventory.listener.js";

let listenersRegistered = false;

export const registerListeners = () => {
    if (listenersRegistered) {
        return;
    }

    listenersRegistered = true;
    console.log("Event listeners registered");
};