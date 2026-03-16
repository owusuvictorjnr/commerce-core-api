import { logger } from "../../core/logger/index.js";

export type SendEmailPayload = {
  to: string;
  subject: string;
  text: string;
};

export interface EmailService {
  sendWelcomeEmail(email: string): Promise<void>;
}

class ConsoleEmailService implements EmailService {
  async sendWelcomeEmail(email: string): Promise<void> {
    const payload: SendEmailPayload = {
      to: email,
      subject: "Welcome to Commerce Core",
      text: "Your account has been created successfully.",
    };

    logger.info("Email integration: simulated send", payload);
  }
}

let emailService: EmailService | null = null;

export const getEmailService = (): EmailService => {
  if (!emailService) {
    emailService = new ConsoleEmailService();
  }

  return emailService;
};
