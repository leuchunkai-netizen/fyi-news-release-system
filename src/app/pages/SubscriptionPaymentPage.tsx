import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Lock, ArrowLeft } from "lucide-react";
import { useUser } from "../context/UserContext";
import { getCurrentUserWithInterests } from "../../lib/api/auth";
import { confirmStripeCheckout, createStripeCheckoutSession } from "../../lib/api/payments";

function profileToUser(
  profile: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string | null;
    gender?: string | null;
    age?: number | null;
    location?: string | null;
  },
  interests: string[]
) {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role as "guest" | "free" | "premium" | "expert" | "admin",
    avatar: profile.avatar ?? undefined,
    gender: profile.gender ?? undefined,
    age: profile.age ?? undefined,
    location: profile.location ?? undefined,
    interests: interests.length ? interests : undefined,
  };
}

export function SubscriptionPaymentPage() {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isUpdateMode =
    user?.role === "premium" || user?.role === "expert" || searchParams.get("update") === "1";
  const plan = (searchParams.get("plan") === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly";
  const planLabel =
    plan === "yearly" ? "Premium (Yearly) · $59.88/year (equiv. $4.99/month)" : "Premium · $9.99/month";
  const ctaLabel = plan === "yearly" ? "Subscribe — $59.88/year" : "Subscribe — $9.99/month";
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkoutSuccess = searchParams.get("checkout_success") === "1";
  const checkoutCancelled = searchParams.get("checkout_cancelled") === "1";
  const stripeSessionId = searchParams.get("session_id");
  const isFinishing = checkoutSuccess && Boolean(stripeSessionId);
  const actionButtonLabel = useMemo(() => {
    if (isUpdateMode) return "Update payment method in Stripe";
    return ctaLabel;
  }, [isUpdateMode, ctaLabel]);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "free" && !isUpdateMode) {
      navigate("/subscription", { replace: true });
    }
  }, [isUpdateMode, navigate, user]);

  useEffect(() => {
    if (!user) return;
    if (!isFinishing || !stripeSessionId || finalizing) return;

    const run = async () => {
      setError(null);
      setFinalizing(true);
      try {
        await confirmStripeCheckout(stripeSessionId);
        const data = await getCurrentUserWithInterests();
        if (data) setUser(profileToUser(data.profile, data.interests));
        navigate("/subscription?success=1", { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to confirm your Stripe payment.");
      } finally {
        setFinalizing(false);
      }
    };

    void run();
  }, [finalizing, isFinishing, navigate, setUser, stripeSessionId, user]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-4">Sign in required</h1>
        <p className="text-muted-foreground mb-6">Please sign in to subscribe to Premium.</p>
        <Link to="/login" className="text-red-600 font-medium hover:underline">
          Sign in
        </Link>
        {" · "}
        <Link to="/subscription" className="text-red-600 font-medium hover:underline">
          View plans
        </Link>
      </div>
    );
  }

  if ((user.role === "premium" || user.role === "expert") && !searchParams.get("update")) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-4">
          {user.role === "expert" ? "You already have Premium benefits" : "You're already Premium"}
        </h1>
        <Link to="/profile" className="text-red-600 font-medium hover:underline">
          Go to Profile
        </Link>
        {" · "}
        <Link to="/subscription/checkout?update=1" className="text-red-600 font-medium hover:underline">
          Update payment method
        </Link>
      </div>
    );
  }

  if (user.role !== "free" && !isUpdateMode) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const checkoutUrl = await createStripeCheckoutSession(plan);
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <Link
        to={isUpdateMode ? "/profile" : "/subscription"}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-red-600 mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        {isUpdateMode ? "Back to profile" : "Back to plans"}
      </Link>

      <div className="border rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gray-50 border-b px-6 py-5">
          <h1 className="text-xl font-semibold mb-1">
            {isUpdateMode ? "Update payment method" : "Complete your subscription"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isUpdateMode ? "Change the card we use for your Premium billing." : planLabel}
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="w-4 h-4" />
            Secure payment with Stripe Checkout (test mode)
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm border border-red-200">
              {error}
            </div>
          )}
          {checkoutCancelled && (
            <div className="p-3 rounded-lg bg-amber-50 text-amber-800 text-sm border border-amber-200">
              Stripe checkout was cancelled. No payment was made.
            </div>
          )}
          {isFinishing && (
            <div className="p-3 rounded-lg bg-blue-50 text-blue-800 text-sm border border-blue-200">
              Confirming your Stripe payment...
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || finalizing}
            className="w-full py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Redirecting to Stripe..." : finalizing ? "Finalizing..." : actionButtonLabel}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            {isUpdateMode
              ? "You will be redirected to Stripe test checkout to update billing details."
              : "By subscribing you agree to our terms. You can cancel anytime from your profile."}
          </p>
        </form>
      </div>
    </div>
  );
}
