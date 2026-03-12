import { eventBus } from "../event-bus.js";
import { EVENTS } from "../event.types.js";

eventBus.on(EVENTS.USER_CREATED, async (user) => {
    console.log("Email sent to", user.email);
})