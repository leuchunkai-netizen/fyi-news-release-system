import { supabase } from "../supabase";
import type { UserRow, UserRole } from "../types/database";

/** Friendly copy when signup/email checks detect an existing account. */
export const SIGNUP_EMAIL_ALREADY_REGISTERED_MESSAGE =
  "This email is already registered. Sign in instead, or use a different email address.";

function authErrorRawMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof (err as { message?: string })?.message === "string") return (err as { message: string }).message;
  return "";
}

/** Detect duplicate-email signup errors from Supabase Auth / Postgres. */
export function signupErrorIndicatesEmailTaken(err: unknown): boolean {
  const raw = authErrorRawMessage(err);
  const lower = raw.toLowerCase();
  return (
    lower.includes("user already registered") ||
    lower.includes("already registered") ||
    lower.includes("email address is already") ||
    lower.includes("email has already") ||
    lower.includes("already been registered") ||
    lower.includes("duplicate key value") ||
    lower.includes("users_email_key") ||
    lower.includes("unique violation")
  );
}

/**
 * Whether `auth.users` already has this email (case-insensitive).
 * Requires migration `20260502120000_signup_email_taken_rpc.sql` on the Supabase project.
 * Returns null if the RPC is unavailable — caller should still rely on signUp() errors.
 */
export async function checkSignupEmailTaken(email: string): Promise<boolean | null> {
  const candidate = email.trim();
  if (!candidate) return null;
  try {
    const { data, error } = await supabase.rpc("is_signup_email_taken", {
      candidate_email: candidate,
    });
    if (error) {
      console.warn("[auth] is_signup_email_taken unavailable:", error.message);
      return null;
    }
    return data === true;
  } catch (e) {
    console.warn("[auth] checkSignupEmailTaken:", e);
    return null;
  }
}

/** Turn Supabase auth errors into a short, user-friendly message (including rate limit). */
export function getAuthErrorMessage(err: unknown, fallback: string): string {
  const raw = authErrorRawMessage(err);
  const lower = raw.toLowerCase();
  if (signupErrorIndicatesEmailTaken(err)) {
    return SIGNUP_EMAIL_ALREADY_REGISTERED_MESSAGE;
  }
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

/**
 * Ensure a profile row exists after email verification/sign-in.
 * This recovers signup details when initial profile insert was blocked by RLS.
 */
async function ensureProfileFromAuthMetadata(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return;

  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("id,email_verified_at,gender,age,location")
    .eq("id", user.id)
    .maybeSingle();
  if (existingError) throw existingError;
  const verifiedAt = user.email_confirmed_at ?? null;
  const meta = user.user_metadata ?? {};
  const metaAge = typeof meta.signup_age === "number" && Number.isFinite(meta.signup_age) ? meta.signup_age : null;
  const metaGender =
    typeof meta.signup_gender === "string" && meta.signup_gender.trim().length > 0 ? meta.signup_gender : null;
  const metaLocation =
    typeof meta.signup_location === "string" && meta.signup_location.trim().length > 0
      ? meta.signup_location
      : null;

  if (existing?.id) {
    const needsVerification = !existing.email_verified_at && !!verifiedAt;
    const needsGender = !existing.gender && !!metaGender;
    const needsAge = (existing.age === null || existing.age === undefined) && metaAge !== null;
    const needsLocation = !existing.location && !!metaLocation;

    if (needsVerification || needsGender || needsAge || needsLocation) {
      const updatePayload: {
        email_verified_at?: string;
        gender?: string;
        age?: number;
        location?: string;
        updated_at: string;
      } = {
        updated_at: new Date().toISOString(),
      };
      if (needsVerification && verifiedAt) updatePayload.email_verified_at = verifiedAt;
      if (needsGender && metaGender) updatePayload.gender = metaGender;
      if (needsAge && metaAge !== null) updatePayload.age = metaAge;
      if (needsLocation && metaLocation) updatePayload.location = metaLocation;

      const { error: updateError } = await supabase
        .from("users")
        .update(updatePayload)
        .eq("id", user.id);
      if (updateError) throw updateError;
    }
    return;
  }

  const role: UserRole | undefined =
    meta.signup_role === "free" || meta.signup_role === "premium" ? meta.signup_role : undefined;

  await upsertUserProfile({
    id: user.id,
    email: user.email,
    name: typeof meta.name === "string" && meta.name.trim().length > 0 ? meta.name : user.email.split("@")[0],
    role: role ?? "free",
    gender: metaGender,
    age: metaAge,
    location: metaLocation,
    email_verified_at: verifiedAt,
  });
}

/** Get current user profile plus interest names (for app context). */
export async function getCurrentUserWithInterests(): Promise<{ profile: UserRow; interests: string[] } | null> {
  await ensureProfileFromAuthMetadata();
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
  email_verified_at?: string | null;
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
    email_verified_at: string | null;
    updated_at: string;
  } = {
    id: params.id,
    email: params.email,
    name: params.name ?? params.email.split("@")[0],
    avatar: params.avatar ?? null,
    gender: params.gender ?? null,
    age: params.age ?? null,
    location: params.location ?? null,
    email_verified_at: params.email_verified_at ?? null,
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
        ...(options?.gender ? { signup_gender: options.gender } : {}),
        ...(typeof options?.age === "number" && Number.isFinite(options.age) ? { signup_age: options.age } : {}),
        ...(options?.location ? { signup_location: options.location } : {}),
        ...(options?.role ? { signup_role: options.role } : {}),
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
        email_verified_at: authData.user.email_confirmed_at ?? null,
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

/** Send a password reset email with a link back to the app. */
export async function sendPasswordResetEmail(email: string) {
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/reset-password`
      : undefined;
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
  return data;
}

/** Update password after user opens the password recovery link. */
export async function updatePassword(password: string) {
  const { data, error } = await supabase.auth.updateUser({ password });
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
