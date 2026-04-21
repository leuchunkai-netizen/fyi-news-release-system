const Stripe = require("stripe");
const { getUserFromBearer } = require("../utils/supabaseAuth");
const { getSupabaseAdmin } = require("../db/supabaseClient");

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function getPriceIdForPlan(plan) {
  if (plan === "yearly") return process.env.STRIPE_PRICE_YEARLY || "";
  return process.env.STRIPE_PRICE_MONTHLY || "";
}

function isValidStripePriceId(value) {
  return typeof value === "string" && value.startsWith("price_");
}

async function createCheckoutSession(req, res) {
  try {
    const user = await getUserFromBearer(req);
    if (!user?.id || !user?.email) return res.status(401).json({ message: "Unauthorized." });

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({ message: "Stripe is not configured. Missing STRIPE_SECRET_KEY." });
    }

    const plan = req.body?.plan === "yearly" ? "yearly" : "monthly";
    const priceId = getPriceIdForPlan(plan);
    if (!priceId) {
      return res.status(500).json({
        message: `Stripe price is not configured for ${plan} plan.`,
      });
    }
    if (!isValidStripePriceId(priceId)) {
      return res.status(500).json({
        message: `Invalid STRIPE_PRICE_${plan === "yearly" ? "YEARLY" : "MONTHLY"} value. Use a Stripe Price ID that starts with price_.`,
      });
    }

    const origin = process.env.APP_BASE_URL || req.headers.origin;
    if (!origin) return res.status(400).json({ message: "Missing app origin. Set APP_BASE_URL in backend/.env." });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/subscription/checkout?checkout_success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/subscription/checkout?checkout_cancelled=1`,
      customer_email: user.email,
      metadata: {
        userId: user.id,
        plan,
      },
    });

    return res.json({ url: session.url });
  } catch (e) {
    console.error("[payments] createCheckoutSession:", e);
    return res.status(500).json({ message: e.message || "Failed to create checkout session." });
  }
}

async function confirmCheckoutAndUpgrade(req, res) {
  try {
    const user = await getUserFromBearer(req);
    if (!user?.id) return res.status(401).json({ message: "Unauthorized." });

    const { sessionId } = req.body || {};
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ message: "sessionId is required." });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({ message: "Stripe is not configured. Missing STRIPE_SECRET_KEY." });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.mode !== "subscription") {
      return res.status(400).json({ message: "Invalid Stripe checkout session." });
    }

    const paid = session.payment_status === "paid";
    const sessionUserId = session.metadata?.userId;
    if (!paid || sessionUserId !== user.id) {
      return res.status(400).json({ message: "Checkout is not paid or does not belong to this user." });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({ message: "Missing Supabase admin config in backend/.env." });
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ role: "premium", updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("id, role")
      .single();
    if (error) return res.status(500).json({ message: error.message });

    return res.json({ ok: true, user: data });
  } catch (e) {
    console.error("[payments] confirmCheckoutAndUpgrade:", e);
    return res.status(500).json({ message: e.message || "Failed to confirm checkout." });
  }
}

module.exports = {
  createCheckoutSession,
  confirmCheckoutAndUpgrade,
};
