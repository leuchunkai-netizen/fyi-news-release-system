import type { UserRole } from "./types/database";

/** Premium subscribers and experts get the same subscriber features (bookmarks, AI summary, billing nav, etc.). */
export function hasPremiumBenefits(role: UserRole | undefined): boolean {
  return role === "premium" || role === "expert";
}

/** Roles that can author and manage their own articles in the app. */
export function canAuthorArticles(role: UserRole | undefined): boolean {
  return role === "free" || role === "premium" || role === "expert";
}
