import { jest } from "@jest/globals";
import { eventBus } from "../event-bus.js";
import { EVENTS } from "../event.types.js";
import { registerEmailListener } from "./email.listener.js";
import type { EmailService } from "../../integrations/email/email.service.js";

describe("registerEmailListener", () => {
  beforeEach(() => {
    eventBus.removeAllListeners(EVENTS.USER_CREATED);
  });

  it("sends welcome email when user.created is emitted", async () => {
    const sendWelcomeEmail = jest.fn<EmailService["sendWelcomeEmail"]>().mockResolvedValue();
    registerEmailListener({ sendWelcomeEmail });

    eventBus.emit(EVENTS.USER_CREATED, { email: "user@example.com" });
    await new Promise((resolve) => setImmediate(resolve));

    expect(sendWelcomeEmail).toHaveBeenCalledWith("user@example.com");
  });

  it("does not throw when integration send fails", async () => {
    const sendWelcomeEmail = jest
      .fn<EmailService["sendWelcomeEmail"]>()
      .mockRejectedValue(new Error("SMTP unavailable"));

    registerEmailListener({ sendWelcomeEmail });

    expect(() => {
      eventBus.emit(EVENTS.USER_CREATED, { email: "user@example.com" });
    }).not.toThrow();

    await new Promise((resolve) => setImmediate(resolve));
    expect(sendWelcomeEmail).toHaveBeenCalledWith("user@example.com");
  });
});
