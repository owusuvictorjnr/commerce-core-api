import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import jwt, { type SignOptions } from "jsonwebtoken";
import { eventBus } from "../../events/event-bus.js";
import { EVENTS } from "../../events/event.types.js";
import { HttpError } from "../../core/errors/http-error.js";

const scrypt = promisify(scryptCallback);
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 8;

type AuthUser = {
  id: string;
  email: string;
  passwordHash: string;
};

type AuthResult = {
  user: {
    id: string;
    email: string;
  };
  token: string;
};

type JwtExpiresIn = Exclude<SignOptions["expiresIn"], undefined>;

const DEFAULT_MAX_AUTH_USERS = 10_000;
let maxAuthUsers = DEFAULT_MAX_AUTH_USERS;
const usersByEmail = new Map<string, AuthUser>();

const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(SCRYPT_SALT_BYTES).toString("hex");
  const derivedKey = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
};

const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) {
    return false;
  }

  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
};

const getJwtSecret = (): string => {
  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    throw new HttpError(500, "INTERNAL_SERVER_ERROR", "Authentication is misconfigured on the server");
  }

  return secret;
};

const issueToken = (user: AuthUser): string => {
  const secret = getJwtSecret();
  const rawExpiresIn = process.env["JWT_EXPIRES_IN"];
  const expiresIn = (rawExpiresIn ?? "1h") as JwtExpiresIn;

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    secret,
    { expiresIn },
  );
};

const toAuthResult = (user: AuthUser): AuthResult => ({
  user: {
    id: user.id,
    email: user.email,
  },
  token: issueToken(user),
});

export const registerUser = async (email: string, password: string): Promise<AuthResult> => {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedPassword = password.trim();

  if (!normalizedEmail) {
    throw new HttpError(400, "VALIDATION_ERROR", "Email is required");
  }
  if (!trimmedPassword) {
    throw new HttpError(400, "VALIDATION_ERROR", "Password is required");
  }
  if (trimmedPassword.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, "VALIDATION_ERROR", "Password must be at least 8 characters long");
  }

  if (usersByEmail.has(normalizedEmail)) {
    throw new HttpError(409, "CONFLICT", "User with this email already exists");
  }
  if (usersByEmail.size >= maxAuthUsers) {
    throw new HttpError(
      503,
      "RESOURCE_LIMIT_EXCEEDED",
      "In-memory auth user limit reached. This storage is non-production and bounded.",
    );
  }

  const passwordHash = await hashPassword(trimmedPassword);

  const user: AuthUser = {
    id: randomUUID(),
    email: normalizedEmail,
    passwordHash,
  };

  usersByEmail.set(normalizedEmail, user);
  try {
    eventBus.emit(EVENTS.USER_CREATED, { email: normalizedEmail });
  } catch {
    // Intentionally ignore: EventBus already logs handler failures.
  }

  return toAuthResult(user);
};

export const loginUser = async (email: string, password: string): Promise<AuthResult> => {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedPassword = password.trim();
  const user = usersByEmail.get(normalizedEmail);
  const isValid = user ? await verifyPassword(trimmedPassword, user.passwordHash) : false;
  if (!user || !isValid) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid email or password");
  }

  return toAuthResult(user);
};

export const __resetAuthUsersForTests = (): void => {
  usersByEmail.clear();
  maxAuthUsers = DEFAULT_MAX_AUTH_USERS;
};

export const __setMaxAuthUsersForTests = (max: number): void => {
  maxAuthUsers = max;
};
