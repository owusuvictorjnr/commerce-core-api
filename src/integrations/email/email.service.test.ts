import { jest } from "@jest/globals";

const loggerInfo = jest.fn();
const loggerWarn = jest.fn();

jest.unstable_mockModule("../../core/logger/index.js", () => ({
  logger: {
    info: loggerInfo,
    warn: loggerWarn,
    error: jest.fn(),
  },
}));

const {
  getEmailService,
  resolveEmailServiceConfig,
  resetEmailServiceForTests,
} = await import("./email.service.js");

const originalEnv = { ...process.env };

describe("email.service", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    resetEmailServiceForTests();
    loggerInfo.mockReset();
    loggerWarn.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("defaults to console provider outside production", () => {
    const config = resolveEmailServiceConfig({ NODE_ENV: "development" });

    expect(config.provider).toBe("console");
    expect(config.fromEmail).toBe("no-reply@commerce-core.local");
  });

  it("defaults to noop provider in production", () => {
    const config = resolveEmailServiceConfig({ NODE_ENV: "production" });

    expect(config.provider).toBe("noop");
  });

  it("uses env overrides for provider and from email", () => {
    const config = resolveEmailServiceConfig({
      NODE_ENV: "production",
      EMAIL_PROVIDER: "console",
      EMAIL_FROM: "billing@example.com",
    });

    expect(config.provider).toBe("console");
    expect(config.fromEmail).toBe("billing@example.com");
  });

  it("returns a singleton instance", () => {
    const first = getEmailService();
    const second = getEmailService();

    expect(first).toBe(second);
  });

  it("sends via console provider and logs payload", async () => {
    process.env["NODE_ENV"] = "development";
    delete process.env["EMAIL_PROVIDER"];
    process.env["EMAIL_FROM"] = "ops@example.com";

    const service = getEmailService();
    await service.sendWelcomeEmail("user@example.com");

    expect(loggerInfo).toHaveBeenCalledWith(
      "Email integration: simulated send",
      expect.objectContaining({
        from: "ops@example.com",
        to: "user@example.com",
      }),
    );
  });

  it("uses noop provider in production default", async () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["EMAIL_PROVIDER"];

    const service = getEmailService();
    await service.sendWelcomeEmail("user@example.com");

    expect(loggerWarn).toHaveBeenCalledWith(
      "Email integration disabled (noop provider)",
      { email: "user@example.com" },
    );
  });
});
