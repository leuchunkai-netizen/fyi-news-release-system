import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Lock, ArrowLeft } from "lucide-react";
import { useUser } from "../context/UserContext";
import { getCurrentUserWithInterests, upgradeToPremium } from "../../lib/api/auth";
import {
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  isValidCardByLuhn,
  isValidExpiry,
} from "../../lib/cardValidation";

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
  const [error, setError] = useState<string | null>(null);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const actionButtonLabel = useMemo(() => {
    if (isUpdateMode) return "Confirm current plan";
    return ctaLabel;
  }, [isUpdateMode, ctaLabel]);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "free" && !isUpdateMode) {
      navigate("/subscription", { replace: true });
    }
  }, [isUpdateMode, navigate, user]);

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
        <Link to="/billing" className="text-red-600 font-medium hover:underline">
          Manage plan
        </Link>
      </div>
    );
  }

  if (user.role !== "free" && !isUpdateMode) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!cardName.trim()) {
      setError("Cardholder name is required.");
      return;
    }
    if (!isValidCardByLuhn(cardNumber)) {
      setError("Card number is invalid. Please check and try again.");
      return;
    }
    if (!isValidExpiry(expiry)) {
      setError("Expiry date is invalid or already expired.");
      return;
    }
    const cvcDigits = digitsOnly(cvc);
    if (cvcDigits.length < 3 || cvcDigits.length > 4) {
      setError("CVC must be 3 or 4 digits.");
      return;
    }
    setSubmitting(true);
    try {
      if (!isUpdateMode && user.role === "free") {
        await upgradeToPremium(user.id);
        const data = await getCurrentUserWithInterests();
        if (data) setUser(profileToUser(data.profile, data.interests));
        navigate("/subscription?success=1", { replace: true });
      } else {
        navigate("/billing", { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update subscription. Please try again.");
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
            {isUpdateMode ? "Manage subscription" : "Complete your subscription"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isUpdateMode ? "Review your active membership and plan actions." : planLabel}
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="w-4 h-4" />
            Premium is activated directly in-app (no external payment gateway).
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm border border-red-200">
              {error}
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Cardholder name</label>
              <input
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Name on card"
                autoComplete="cc-name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Card number</label>
              <input
                type="text"
                inputMode="numeric"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="1234 5678 9012 3456"
                autoComplete="cc-number"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Expiry (MM/YY)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="MM/YY"
                  autoComplete="cc-exp"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">CVC</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cvc}
                  onChange={(e) => setCvc(digitsOnly(e.target.value).slice(0, 4))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="123"
                  autoComplete="cc-csc"
                  required
                />
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Updating..." : actionButtonLabel}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            {isUpdateMode
              ? "Use Billing to switch between Free and Premium."
              : "By subscribing you agree to our terms. You can cancel anytime from your profile."}
          </p>
        </form>
      </div>
    </div>
  );
}
