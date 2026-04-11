import { supabase } from "../supabase";
import type { UserRow, UserRole } from "../types/database";

/** Turn Supabase auth errors into a short, user-friendly message (including rate limit). */
export function getAuthErrorMessage(err: unknown, fallback: string): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof (err as { message?: string })?.message === "string"
        ? (err as { message: string }).message
        : "";
  const lower = raw.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("rate_limit") || lower.includes("email rate limit exceeded")) {
    return "Too many emails sent. Please wait an hour and try again, or sign in if you already have an account.";
  }
  if (lower.includes("for security purposes") && lower.includes("once every")) {
    return "Please wait a minute before requesting another email.";
  }
  return raw.trim() || fallback;
}

/** Get current user profile from public.users by auth.uid(). Call after Supabase Auth sign-in. */
export async function getCurrentUserProfile(): Promise<UserRow | null> {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.id) return null;

  const { data, error } = await supabase.from("users").select("*").eq("id", authUser.id).maybeSingle();
  if (error) throw error;
  return data as UserRow | null;
}

/**
 * Copy signup-time category picks from auth metadata into user_interests once the user has a session.
 * Needed when email confirmation is on: signup cannot insert into user_interests without a session.
 */
export async function syncPendingSignupInterestsFromMetadata(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return false;
  const raw = user.user_metadata?.signup_interests;
  if (!Array.isArray(raw) || raw.length === 0) return false;
  const names = raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  if (names.length === 0) return false;
  try {
    const { setUserInterests } = await import("./userInterests");
    await setUserInterests(user.id, names);
    const { error } = await supabase.auth.updateUser({
      data: { signup_interests: [] as string[] },
    });
    if (error) console.warn("[auth] Could not clear signup_interests metadata:", error.message);
    return true;
  } catch (e) {
    console.warn("[auth] syncPendingSignupInterestsFromMetadata:", e);
    return false;
  }
}

/** Get current user profile plus interest names (for app context). */
export async function getCurrentUserWithInterests(): Promise<{ profile: UserRow; interests: string[] } | null> {
  await syncPendingSignupInterestsFromMetadata();
  const profile = await getCurrentUserProfile();
  if (!profile) return null;
  const { getUserInterestNames } = await import("./userInterests");
  const interests = await getUserInterestNames(profile.id);
  return { profile, interests };
}

/** Create or update user profile after sign-up. Sync from auth.users or form. */
export async function upsertUserProfile(params: {
  id: string;
  email: string;
  name?: string;
  role?: UserRole;
  avatar?: string | null;
  gender?: string | null;
  age?: number | null;
  location?: string | null;
}) {
  const payload: {
    id: string;
    email: string;
    name: string;
    role?: UserRole;
    avatar: string | null;
    gender: string | null;
    age: number | null;
    location: string | null;
    updated_at: string;
  } = {
    id: params.id,
    email: params.email,
    name: params.name ?? params.email.split("@")[0],
    avatar: params.avatar ?? null,
    gender: params.gender ?? null,
    age: params.age ?? null,
    location: params.location ?? null,
    updated_at: new Date().toISOString(),
  };

  // Only send role when explicitly provided so existing role is not reset to "free"
  if (params.role) {
    payload.role = params.role;
  }

  const { data, error } = await supabase
    .from("users")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data as UserRow;
}

/** Sign up with email/password and create profile in public.users. */
export async function signUp(
  email: string,
  password: string,
  options?: { name?: string; role?: UserRole; interests?: string[]; gender?: string | null; age?: number | null; location?: string | null }
) {
  const name = options?.name ?? email.split("@")[0];
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify-email`
      : undefined;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        ...(options?.interests?.length ? { signup_interests: [...options.interests] } : {}),
      },
      // Ensure Supabase/Resend email links redirect back into the SPA
      emailRedirectTo: redirectTo,
    },
  });
  if (authError) throw authError;
  if (authData.user) {
    // When email confirmation is required, there may not be a session yet,
    // so RLS can block writes to public.users. Never fail signup because
    // the profile insert/upsert is unauthorized – it can be created later.
    try {
      await upsertUserProfile({
        id: authData.user.id,
        email: authData.user.email!,
        name: name ?? authData.user.user_metadata?.name ?? authData.user.email?.split("@")[0],
        role: options?.role ?? "free",
        gender: options?.gender ?? null,
        age: options?.age ?? null,
        location: options?.location ?? null,
      });
      // Save interests only if we have a session (e.g. email confirmation off). Don't fail signup if this fails.
      if (options?.interests?.length) {
        try {
          const { setUserInterests } = await import("./userInterests");
          await setUserInterests(authData.user.id, options.interests);
        } catch {
          // RLS may block when session isn't set yet (e.g. confirm email required). Interests can be set later.
        }
      }
    } catch {
      // Ignore profile upsert errors at signup time (e.g. 401/403 from RLS).
    }
  }
  return authData;
}

/** Sign in with email/password. */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Sign out. */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Get user by id (e.g. for display). */
export async function getUserById(id: string): Promise<UserRow | null> {
  const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as UserRow | null;
}

/** Upgrade current user to premium (demo: no payment). RLS allows users to update own row. */
export async function upgradeToPremium(userId: string): Promise<UserRow> {
  const { data, error } = await supabase
    .from("users")
    .update({ role: "premium", updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data as UserRow;
}
