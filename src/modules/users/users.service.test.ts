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

  it("evicts oldest profile when capacity is exceeded", async () => {
    for (let index = 0; index <= 1000; index += 1) {
      const userId = `user-${index}`;
      getOrCreateProfile(userId, `${userId}@example.com`);
    }

    const firstProfile = await getUserById("user-0");
    const lastProfile = await getUserById("user-1000");

    expect(firstProfile).toBeNull();
    expect(lastProfile).not.toBeNull();
  });

  it("does not evict unrelated profiles when updating at capacity", async () => {
    for (let index = 0; index < 1000; index += 1) {
      const userId = `user-${index}`;
      getOrCreateProfile(userId, `${userId}@example.com`);
    }

    await updateUser("user-999", { name: "Updated" });

    const firstProfile = await getUserById("user-0");
    const updatedProfile = await getUserById("user-999");

    expect(firstProfile).not.toBeNull();
    expect(updatedProfile?.name).toBe("Updated");
  });
});
