import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { getAuthErrorMessage, updatePassword } from "@/lib/api/auth";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 1200);
    } catch (err: unknown) {
      setError(
        getAuthErrorMessage(err, "Unable to reset password. Please open the latest reset link and try again.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto border rounded-lg p-8">
        <h1 className="text-3xl font-semibold mb-2">Reset password</h1>
        <p className="text-muted-foreground mb-6">Set a new password for your account.</p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-100 text-green-800 text-sm">
            Password updated. Redirecting to sign in...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              placeholder="Enter new password"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              placeholder="Confirm new password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? "Updating..." : "Update password"}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground text-center">
          Back to{" "}
          <Link to="/login" className="text-red-600 hover:underline">
            sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
