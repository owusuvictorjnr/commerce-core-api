import { HttpError } from "../../core/errors/http-error.js";
import { __resetAuthUsersForTests, loginUser, registerUser } from "./auth.service.js";

describe("auth.service", () => {
  const originalJwtSecret = process.env["JWT_SECRET"];

  beforeEach(() => {
    process.env["JWT_SECRET"] = "test-secret";
    __resetAuthUsersForTests();
  });

  afterAll(() => {
    if (originalJwtSecret === undefined) {
      delete process.env["JWT_SECRET"];
    } else {
      process.env["JWT_SECRET"] = originalJwtSecret;
    }
  });

  it("registers then logs in with the same credentials", async () => {
    const registerResult = await registerUser("user@example.com", "password123");
    const loginResult = await loginUser("user@example.com", "password123");

    expect(registerResult.user.email).toBe("user@example.com");
    expect(loginResult.user.email).toBe("user@example.com");
    expect(typeof registerResult.token).toBe("string");
    expect(typeof loginResult.token).toBe("string");
  });

  it("allows login when password has surrounding whitespace", async () => {
    await registerUser("user@example.com", "password123");

    const loginResult = await loginUser("user@example.com", "  password123  ");

    expect(loginResult.user.email).toBe("user@example.com");
    expect(typeof loginResult.token).toBe("string");
  });

  it("rejects login with incorrect password", async () => {
    await registerUser("user@example.com", "password123");

    await expect(loginUser("user@example.com", "wrong-password")).rejects.toMatchObject({
      statusCode: 401,
      code: "UNAUTHORIZED",
    } satisfies Partial<HttpError>);
  });

  it("rejects duplicate registration case-insensitively", async () => {
    await registerUser("User@Example.com", "password123");

    await expect(registerUser("user@example.com", "password123")).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    } satisfies Partial<HttpError>);
  });

  it("rejects registration when email is empty after trimming", async () => {
    await expect(registerUser("   ", "password123")).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Email is required",
    } satisfies Partial<HttpError>);
  });

  it("rejects registration when password is whitespace-only", async () => {
    await expect(registerUser("user@example.com", "    ")).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Password is required",
    } satisfies Partial<HttpError>);
  });

  it("rejects registration when password is shorter than 8 characters", async () => {
    await expect(registerUser("user@example.com", "short")).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "Password must be at least 8 characters long",
    } satisfies Partial<HttpError>);
  });
});
