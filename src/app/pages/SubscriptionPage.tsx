import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { useNavigate } from "react-router";
import { useUser } from "../context/UserContext";

export function SubscriptionPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (searchParams.get("success") === "1") {
      setMessage({ type: "success", text: "You're now a Premium member. Enjoy bookmarks and more!" });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    // Guests should subscribe from the landing page, not a separate page.
    if (!user) {
      navigate("/#subscription-section", { replace: true });
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-semibold mb-4">Choose Your Plan</h1>
        <p className="text-lg text-muted-foreground">
          Get unlimited access to quality journalism
        </p>
      </div>

      {message && (
        <div
          className={`max-w-2xl mx-auto mb-8 p-4 rounded-lg ${
            message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {/* Free Plan */}
        <div className="border rounded-lg p-8">
          <h3 className="text-2xl font-semibold mb-2">Free</h3>
          <div className="mb-6">
            <span className="text-4xl font-bold">$0</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">View news articles</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">Search for articles</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">Comment on articles</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">Upload your own articles</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">Report articles</span>
            </li>
          </ul>
          <Link
            to="/signup"
            className="block w-full px-4 py-2 bg-gray-600 text-white text-center rounded-lg hover:bg-gray-700"
          >
            Get Started
          </Link>
        </div>

        {/* Premium Plan */}
        <div className="border-2 border-red-600 rounded-lg p-8 relative">
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-red-600 text-white text-sm rounded-full">
            Most Popular
          </div>
          <h3 className="text-2xl font-semibold mb-2">Premium</h3>
          <div className="mb-6">
            <span className="text-4xl font-bold">$9.99</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm font-semibold">All Free features, plus:</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">AI-generated article summaries</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">Bookmark articles</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">Apply for expert verification</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">Share on social media</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">Priority customer support</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">Offline reading mode</span>
            </li>
          </ul>
          {user ? (
            user.role === "premium" ? (
              <Link
                to="/profile"
                className="block w-full px-4 py-2 bg-gray-600 text-white text-center rounded-lg hover:bg-gray-700"
              >
                Current plan · Manage in Profile
              </Link>
            ) : user.role === "free" ? (
              <Link
                to="/subscription/checkout?plan=monthly"
                className="block w-full px-4 py-2 bg-red-600 text-white text-center rounded-lg hover:bg-red-700"
              >
                Upgrade Now
              </Link>
            ) : (
              <span className="block w-full px-4 py-2 bg-gray-200 text-gray-600 text-center rounded-lg">
                {user.role === "expert" ? "Expert account" : user.role === "admin" ? "Admin account" : "Current plan"}
              </span>
            )
          ) : (
            <Link
              to="/signup"
              className="block w-full px-4 py-2 bg-red-600 text-white text-center rounded-lg hover:bg-red-700"
            >
              Sign up to get Premium
            </Link>
          )}
        </div>

        {/* Premium Yearly Plan */}
        <div className="border rounded-lg p-8 relative">
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-1 bg-yellow-500 text-white text-sm rounded-full">
            Best Value
          </div>
          <h3 className="text-2xl font-semibold mb-2">Premium (Yearly)</h3>
          <div className="mb-2">
            <span className="text-4xl font-bold">$4.99</span>
            <span className="text-muted-foreground">/month</span>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Billed yearly · <span className="font-medium text-gray-900">$59.88</span>/year
          </p>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm font-semibold">All Premium features, plus:</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">Save 50% vs monthly billing</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm">One payment per year</span>
            </li>
          </ul>
          {user ? (
            user.role === "premium" ? (
              <Link
                to="/profile"
                className="block w-full px-4 py-2 bg-gray-600 text-white text-center rounded-lg hover:bg-gray-700"
              >
                Current plan · Manage in Profile
              </Link>
            ) : user.role === "free" ? (
              <Link
                to="/subscription/checkout?plan=yearly"
                className="block w-full px-4 py-2 bg-yellow-500 text-white text-center rounded-lg hover:bg-yellow-600"
              >
                Upgrade Yearly — $59.88/year
              </Link>
            ) : (
              <span className="block w-full px-4 py-2 bg-gray-200 text-gray-600 text-center rounded-lg">
                {user.role === "expert" ? "Expert account" : user.role === "admin" ? "Admin account" : "Current plan"}
              </span>
            )
          ) : (
            <Link
              to="/signup"
              className="block w-full px-4 py-2 bg-yellow-500 text-white text-center rounded-lg hover:bg-yellow-600"
            >
              Sign up to get Premium Yearly
            </Link>
          )}
        </div>
      </div>

      {/* Testimonials */}
      <div className="max-w-4xl mx-auto mt-16">
        <h2 className="text-3xl font-semibold text-center mb-8">What Our Subscribers Say</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border p-6 rounded-lg">
            <p className="text-sm mb-4 italic">
              "The AI summaries save me so much time. I can stay informed even on my busiest days."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-300 rounded-full" />
              <div>
                <p className="font-semibold text-sm">Sarah Johnson</p>
                <p className="text-xs text-muted-foreground">Premium Member</p>
              </div>
            </div>
          </div>
          <div className="border p-6 rounded-lg">
            <p className="text-sm mb-4 italic">
              "Being able to upload my own articles and get expert verification has been invaluable."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-300 rounded-full" />
              <div>
                <p className="font-semibold text-sm">Michael Chen</p>
                <p className="text-xs text-muted-foreground">Premium Member</p>
              </div>
            </div>
          </div>
          <div className="border p-6 rounded-lg">
            <p className="text-sm mb-4 italic">
              "The credibility scores help me distinguish reliable news from misinformation."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-300 rounded-full" />
              <div>
                <p className="font-semibold text-sm">Emily Davis</p>
                <p className="text-xs text-muted-foreground">Premium Member</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
