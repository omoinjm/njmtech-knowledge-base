"use server";

import { cookies } from "next/headers";
import { 
  dbHasPersonalAccessKey, 
  dbCreatePersonalAccessKey, 
  dbVerifyPersonalAccessKey 
} from "@/lib/db";
import { PERSONAL_ACCESS_COOKIE } from "@/lib/personal-access-cookie";
import type { ActionResponse } from "@/types/api";

/**
 * Validates the format of a personal access key.
 *
 * @param key - The raw key string
 * @returns Error message if invalid, null if valid
 */
function validatePersonalAccessKey(key: string): string | null {
  if (!key.trim()) return "Access key is required";
  if (key.trim().length < 8) return "Access key must be at least 8 characters";
  return null;
}

/**
 * Grants personal access by setting an HTTP-only session cookie.
 */
async function grantPersonalAccess(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PERSONAL_ACCESS_COOKIE, "granted", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/omoinjm",
  });
}

/**
 * Checks if the primary personal access key has been configured in the database.
 *
 * @returns True if configured
 */
export async function hasPersonalAccessConfigured(): Promise<boolean> {
  try {
    return await dbHasPersonalAccessKey();
  } catch (err) {
    console.error("[hasPersonalAccessConfigured] Failed to check key config:", err);
    return false;
  }
}

/**
 * Performs initial setup of the personal access key and grants access.
 *
 * @param key - The raw key string to configure
 * @returns Success status or error message
 */
export async function setupPersonalAccessKey(
  key: string,
): Promise<ActionResponse> {
  try {
    const validationError = validatePersonalAccessKey(key);
    if (validationError) return { success: false, error: validationError };

    const created = await dbCreatePersonalAccessKey(key.trim());
    if (!created) return { success: false, error: "Personal access already configured" };

    await grantPersonalAccess();
    return { success: true };
  } catch (err) {
    console.error("[setupPersonalAccessKey]", err);
    return { success: false, error: "Failed to create personal access key" };
  }
}

/**
 * Verifies the access key and grants access to the personal route.
 *
 * @param key - The raw key string to verify
 * @returns Success status or error message
 */
export async function unlockPersonalRoute(
  key: string,
): Promise<ActionResponse> {
  try {
    const validationError = validatePersonalAccessKey(key);
    if (validationError) return { success: false, error: validationError };

    const verified = await dbVerifyPersonalAccessKey(key.trim());
    if (!verified) return { success: false, error: "Invalid access key" };

    await grantPersonalAccess();
    return { success: true };
  } catch (err) {
    console.error("[unlockPersonalRoute]", err);
    return { success: false, error: "Failed to verify access key" };
  }
}
