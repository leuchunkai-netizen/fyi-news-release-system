import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useUser } from "../context/UserContext";
import { signUp, getCurrentUserWithInterests, getAuthErrorMessage } from "@/lib/api/auth";
import { Check } from "lucide-react";

export function SignupPage() {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState<"free" | "premium">("free");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [interests, setInterests] = useState<string[]>([]);

  const availableInterests = [
    "World News",
    "Politics",
    "Business",
    "Technology",
    "Sports",
    "Science",
    "Health",
    "Culture",
    "Entertainment",
    "Environment"
  ];

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the user is already registered/logged in, prevent access to the signup page.
  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2 && accountType === "premium") {
      setStep(3);
      return;
    }
    if ((step === 2 && accountType === "free") || step === 3) {
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      setSubmitting(true);
      try {
        await signUp(formData.email, formData.password, {
          name: formData.name,
          role: accountType === "premium" ? "premium" : "free",
          interests,
        });
        // If Supabase set a session (e.g. email confirmation off), load profile into context
        try {
          const data = await getCurrentUserWithInterests();
          if (data) {
            setUser({
              id: data.profile.id,
              name: data.profile.name,
              email: data.profile.email,
              role: data.profile.role,
              avatar: data.profile.avatar ?? undefined,
              gender: data.profile.gender ?? undefined,
              interests: data.interests.length ? data.interests : undefined,
            });
          }
        } catch {
          // No session yet (e.g. email confirmation required) – account was still created
        }
        navigate(`/verify-email?email=${encodeURIComponent(formData.email)}`);
      } catch (err: unknown) {
        setError(getAuthErrorMessage(err, "Sign up failed. Please try again."));
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <div className="border rounded-lg p-8">
          <h1 className="text-3xl font-semibold mb-2">Create Account</h1>
          <p className="text-muted-foreground mb-6">
            Join our community of informed readers
          </p>

          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? "bg-red-600 text-white" : "bg-gray-200"}`}>
                1
              </div>
              <span className="text-sm">Account Info</span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 mx-4">
              <div className={`h-full bg-red-600 transition-all ${step >= 2 ? "w-full" : "w-0"}`} />
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? "bg-red-600 text-white" : "bg-gray-200"}`}>
                2
              </div>
              <span className="text-sm">Select Interests</span>
            </div>
            {accountType === "premium" && (
              <>
                <div className="flex-1 h-1 bg-gray-200 mx-4">
                  <div className={`h-full bg-red-600 transition-all ${step >= 3 ? "w-full" : "w-0"}`} />
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? "bg-red-600 text-white" : "bg-gray-200"}`}>
                    3
                  </div>
                  <span className="text-sm">Payment</span>
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                    placeholder="Enter your name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                    placeholder="Enter your email"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                    placeholder="Create a password"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                    placeholder="Confirm your password"
                    required
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium">Account Type</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setAccountType("free")}
                      className={`p-4 border-2 rounded-lg text-left ${accountType === "free" ? "border-red-600 bg-red-50" : "border-gray-200"}`}
                    >
                      <h3 className="font-semibold mb-1">Free Account</h3>
                      <p className="text-sm text-muted-foreground">
                        Access to basic features
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType("premium")}
                      className={`p-4 border-2 rounded-lg text-left ${accountType === "premium" ? "border-red-600 bg-red-50" : "border-gray-200"}`}
                    >
                      <h3 className="font-semibold mb-1">
                        Premium Account
                        <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded">$9.99/mo</span>
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        AI summaries, bookmarks & more
                      </p>
                    </button>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <div>
                <h3 className="font-semibold mb-4">Select Your Interests</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose topics you're interested in to personalize your feed
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {availableInterests.map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`p-3 border-2 rounded-lg text-left flex items-center justify-between ${
                        interests.includes(interest) ? "border-red-600 bg-red-50" : "border-gray-200"
                      }`}
                    >
                      <span>{interest}</span>
                      {interests.includes(interest) && (
                        <Check className="w-5 h-5 text-red-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h3 className="font-semibold mb-4">Payment Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Card Number</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                      placeholder="1234 5678 9012 3456"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Expiry Date</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                        placeholder="MM/YY"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">CVV</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                        placeholder="123"
                      />
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span>Premium Subscription</span>
                      <span>$9.99/month</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>$9.99</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? "Please wait…" : step === 1 ? "Continue" : step === 2 && accountType === "free" ? "Create Account" : step === 2 ? "Continue to Payment" : "Complete Registration"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-red-600 hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
