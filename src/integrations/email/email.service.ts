import { logger } from "../../core/logger/index.js";

export type EmailProvider = "console" | "noop";

export type SendEmailPayload = {
  from: string;
  to: string;
  subject: string;
  text: string;
};

type EmailServiceConfig = {
  provider: EmailProvider;
  fromEmail: string;
};

export interface EmailService {
  sendWelcomeEmail(email: string): Promise<void>;
}

class ConsoleEmailService implements EmailService {
  constructor(private readonly fromEmail: string) {}

  async sendWelcomeEmail(email: string): Promise<void> {
    const payload: SendEmailPayload = {
      from: this.fromEmail,
      to: email,
      subject: "Welcome to Commerce Core",
      text: "Your account has been created successfully.",
    };

    logger.info("Email integration: simulated send", payload);
  }
}

class NoopEmailService implements EmailService {
  async sendWelcomeEmail(email: string): Promise<void> {
    void email;
  }
}

let emailService: EmailService | null = null;

export const resolveEmailServiceConfig = (
  env: NodeJS.ProcessEnv = process.env,
): EmailServiceConfig => {
  const rawProvider = env["EMAIL_PROVIDER"]?.trim().toLowerCase();
  const provider = rawProvider === "console" || rawProvider === "noop"
    ? rawProvider
    : env["NODE_ENV"] === "production"
      ? "noop"
      : "console";

  const fromEmail = env["EMAIL_FROM"]?.trim() || "no-reply@commerce-core.local";

  return {
    provider,
    fromEmail,
  };
};

const createEmailService = (config: EmailServiceConfig): EmailService => {
  if (config.provider === "noop") {
    logger.info("Email integration disabled (noop provider)");
    return new NoopEmailService();
  }

  return new ConsoleEmailService(config.fromEmail);
};

export const getEmailService = (): EmailService => {
  if (!emailService) {
    emailService = createEmailService(resolveEmailServiceConfig());
  }

  return emailService;
};

export const resetEmailServiceForTests = (): void => {
  emailService = null;
};
