import { Link } from "react-router";
import { CreditCard, CheckCircle, ArrowLeft } from "lucide-react";
import { useUser } from "../context/UserContext";
import { supabase } from "../../lib/supabase";

export function BillingPage() {
  const { user, setUser } = useUser();

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-4">Sign in to view billing</h1>
        <p className="text-muted-foreground mb-6">
          You need an account to view your plan and billing details.
        </p>
        <Link to="/login" className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
          Sign In
        </Link>
      </div>
    );
  }

  const handleCancel = async () => {
    if (user.role !== "premium") return;
    if (!window.confirm("Cancel Premium and move back to Free?")) return;
    try {
      await supabase.from("users").update({ role: "free" }).eq("id", user.id);
      setUser({ ...user, role: "free" });
      alert("Your Premium subscription has been cancelled. You are now on the Free plan.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel subscription.");
    }
  };

  const isPremium = user.role === "premium";

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link
        to="/profile"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-red-600 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to profile
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-red-700" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Billing &amp; Plan</h1>
          <p className="text-sm text-muted-foreground">
            Manage your current plan and payment settings.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-2">Current plan</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Signed in as <span className="font-medium text-gray-900">{user.email}</span>
          </p>

          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold">
                {isPremium ? "Premium" : "Free"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isPremium ? "$9.99/month · full access" : "$0/month · basic access"}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                isPremium ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
              }`}
            >
              {isPremium ? "Active" : "Free"}
            </span>
          </div>

          {isPremium ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Next billing date is shown for demonstration purposes only and does not reflect a real charge.
              </p>
              <div className="text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Next billing date: March 19, 2026</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Upgrade to Premium to unlock bookmarks, expert features, and an ad-free experience.
            </p>
          )}
        </div>

        <div className="border rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold mb-2">Actions</h2>
          {isPremium ? (
            <>
              <Link
                to="/subscription/checkout?update=1"
                className="block w-full px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm text-center"
              >
                Update payment method
              </Link>
              <button
                type="button"
                onClick={handleCancel}
                className="block w-full px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm"
              >
                Cancel Premium and switch to Free
              </button>
            </>
          ) : (
            <>
              <Link
                to="/subscription"
                className="block w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm text-center"
              >
                View Premium plans
              </Link>
              <p className="text-xs text-muted-foreground">
                You are not currently paying for a subscription. Upgrading will start billing.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

