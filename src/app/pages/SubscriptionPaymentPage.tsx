import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { CreditCard, Lock, ArrowLeft } from "lucide-react";
import { useUser } from "../context/UserContext";
import { upgradeToPremium, getCurrentUserWithInterests } from "../../lib/api/auth";

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

function formatCardNumber(value: string): string {
  const v = value.replace(/\D/g, "").slice(0, 16);
  return v.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value: string): string {
  const v = value.replace(/\D/g, "").slice(0, 4);
  if (v.length >= 2) return v.slice(0, 2) + "/" + v.slice(2);
  return v;
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
  const [form, setForm] = useState({
    cardNumber: "",
    expiry: "",
    cvc: "",
    nameOnCard: "",
    billingZip: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (user.role !== "free" && !isUpdateMode) {
    navigate("/subscription", { replace: true });
    return null;
  }

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, cardNumber: formatCardNumber(e.target.value) }));
  };
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, expiry: formatExpiry(e.target.value) }));
  };
  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    setForm((prev) => ({ ...prev, cvc: v }));
  };

  const validate = (): string | null => {
    const digits = form.cardNumber.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return "Enter a valid card number.";
    if (!/^\d{2}\/\d{2}$/.test(form.expiry)) return "Enter expiry as MM/YY.";
    const [mm, yy] = form.expiry.split("/").map(Number);
    if (mm < 1 || mm > 12) return "Enter a valid expiry month.";
    const now = new Date();
    const year = 2000 + yy;
    if (year < now.getFullYear() || (year === now.getFullYear() && mm < now.getMonth() + 1)) {
      return "Card has expired.";
    }
    if (form.cvc.length < 3) return "Enter a valid CVC.";
    if (!form.nameOnCard.trim()) return "Enter the name on card.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setSubmitting(true);
    try {
      if (isUpdateMode) {
        await new Promise((r) => setTimeout(r, 600));
        navigate("/profile?payment_updated=1", { replace: true });
      } else {
        await upgradeToPremium(user.id);
        const data = await getCurrentUserWithInterests();
        if (data) setUser(profileToUser(data.profile, data.interests));
        navigate("/subscription?success=1", { replace: true });
      }
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
            Secure payment
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Card number</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="1234 5678 9012 3456"
                value={form.cardNumber}
                onChange={handleCardNumberChange}
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Expiry (MM/YY)</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                value={form.expiry}
                onChange={handleExpiryChange}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">CVC</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                value={form.cvc}
                onChange={handleCvcChange}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Name on card</label>
            <input
              type="text"
              autoComplete="cc-name"
              placeholder="John Doe"
              value={form.nameOnCard}
              onChange={(e) => setForm((prev) => ({ ...prev, nameOnCard: e.target.value }))}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Billing ZIP (optional)</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="12345"
              value={form.billingZip}
              onChange={(e) => setForm((prev) => ({ ...prev, billingZip: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
              className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Processing…" : isUpdateMode ? "Update payment method" : ctaLabel}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            {isUpdateMode
              ? "Your new card will be used for future payments."
              : "By subscribing you agree to our terms. You can cancel anytime from your profile."}
          </p>
        </form>
      </div>
    </div>
  );
}
