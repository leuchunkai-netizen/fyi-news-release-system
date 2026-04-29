import { useState } from "react";
import { Link } from "react-router";
import { getAuthErrorMessage, sendPasswordResetEmail } from "@/lib/api/auth";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await sendPasswordResetEmail(email);
      setSent(true);
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, "Unable to send reset email. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto border rounded-lg p-8">
        <h1 className="text-3xl font-semibold mb-2">Forgot password</h1>
        <p className="text-muted-foreground mb-6">
          Enter your email and we&apos;ll send a password reset link.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        {sent && (
          <div className="mb-4 p-3 rounded-lg bg-green-100 text-green-800 text-sm">
            Reset email sent. Check your inbox and spam folder.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              placeholder="Enter your account email"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? "Sending..." : "Send reset email"}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground text-center">
          Remembered your password?{" "}
          <Link to="/login" className="text-red-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
