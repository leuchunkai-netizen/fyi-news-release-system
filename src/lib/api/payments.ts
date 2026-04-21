import { supabase } from "../supabase";
import { apiUrl } from "./apiBase";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again to continue checkout.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function createStripeCheckoutSession(plan: "monthly" | "yearly"): Promise<string> {
  const res = await fetch(apiUrl("/api/payments/checkout-session"), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ plan }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || typeof body?.url !== "string") {
    throw new Error(body?.message || "Failed to create Stripe checkout session.");
  }
  return body.url;
}

export async function confirmStripeCheckout(sessionId: string): Promise<void> {
  const res = await fetch(apiUrl("/api/payments/confirm-checkout"), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ sessionId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.ok !== true) {
    throw new Error(body?.message || "Stripe checkout confirmation failed.");
  }
}
