import { HttpError } from "../../core/errors/http-error.js";
import {
  __resetUsersForTests,
  getOrCreateProfile,
  getUserById,
  updateUser,
} from "./users.service.js";

describe("users.service", () => {
  beforeEach(() => {
    __resetUsersForTests();
  });

  it("updates name when provided", async () => {
    getOrCreateProfile("user-1", "user@example.com");

    const updated = await updateUser("user-1", { name: "Alice" });

    expect(updated.name).toBe("Alice");
  });

  it("does not overwrite name with undefined", async () => {
    getOrCreateProfile("user-1", "user@example.com");
    await updateUser("user-1", { name: "Alice" });

    await updateUser("user-1", { name: undefined } as unknown as { name?: string });

    const profile = await getUserById("user-1");
    expect(profile?.name).toBe("Alice");
  });

  it("returns 404 for unknown profile", async () => {
    await expect(updateUser("missing-user", { name: "Alice" })).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    } satisfies Partial<HttpError>);
  });
});
