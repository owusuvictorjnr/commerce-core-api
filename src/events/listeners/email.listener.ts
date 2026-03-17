import { eventBus } from "../event-bus.js";
import { EVENTS } from "../event.types.js";
import { logger } from "../../core/logger/index.js";
import { getEmailService, type EmailService } from "../../integrations/email/email.service.js";

export const registerEmailListener = (emailService: EmailService = getEmailService()) => {
  eventBus.on(EVENTS.USER_CREATED, async (user) => {
    await emailService.sendWelcomeEmail(user.email);
    logger.info("Email event handled", { email: user.email });
  });
};