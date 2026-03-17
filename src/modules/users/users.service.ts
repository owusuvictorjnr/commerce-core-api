import { hookManager } from "../../hooks/hooks-manager.js";
import { HttpError } from "../../core/errors/http-error.js";

export type UserProfile = {
  id: string;
  email: string;
  name: string;
};

type UpdateUserInput = {
  name?: string;
};

const MAX_PROFILES = 1000;
const profilesById = new Map<string, UserProfile>();

const ensureCapacity = (): void => {
  if (profilesById.size >= MAX_PROFILES) {
    const firstKey = profilesById.keys().next().value as string | undefined;
    if (firstKey !== undefined) {
      profilesById.delete(firstKey);
    }
  }
};

export const getOrCreateProfile = (userId: string, email: string): UserProfile => {
  const existing = profilesById.get(userId);
  if (existing) return existing;

  const profile: UserProfile = { id: userId, email, name: "" };
  ensureCapacity();
  profilesById.set(userId, profile);
  return profile;
};

export const getUserById = async (userId: string): Promise<UserProfile | null> => {
  return profilesById.get(userId) ?? null;
};

export const updateUser = async (
  userId: string,
  input: UpdateUserInput,
): Promise<UserProfile> => {
  const profile = profilesById.get(userId);
  if (!profile) {
    throw new HttpError(404, "NOT_FOUND", "User profile not found");
  }

  await hookManager.run("user.beforeProfileUpdate", { userId, input });

  const updated: UserProfile = { ...profile };
  if (input.name !== undefined) {
    updated.name = input.name;
  }
  ensureCapacity();
  profilesById.set(userId, updated);

  await hookManager.run("user.afterProfileUpdate", updated);

  return updated;
};

/** Reset in-memory store — tests only */
export const __resetUsersForTests = (): void => {
  profilesById.clear();
};
