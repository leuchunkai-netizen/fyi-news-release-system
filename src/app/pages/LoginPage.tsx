import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useUser } from "../context/UserContext";
import { signIn, getCurrentUserWithInterests, getAuthErrorMessage } from "@/lib/api/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      const data = await getCurrentUserWithInterests();
      if (data) {
        const nextUser = {
          id: data.profile.id,
          name: data.profile.name,
          email: data.profile.email,
          role: data.profile.role,
          avatar: data.profile.avatar ?? undefined,
          gender: data.profile.gender ?? undefined,
          age: data.profile.age ?? undefined,
          location: data.profile.location ?? undefined,
          interests: data.interests.length ? data.interests : undefined,
        };
        setUser(nextUser);
        // Redirect admins directly to the admin dashboard; others go to home.
        navigate(nextUser.role === "admin" ? "/admin" : "/");
      } else {
        // Fallback: no profile loaded, go home.
        navigate("/");
      }
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, "Invalid email or password."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto">
        <div className="border rounded-lg p-8">
          <h1 className="text-3xl font-semibold mb-2">Sign In</h1>
          <p className="text-muted-foreground mb-6">
            Welcome back! Please enter your details.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="Enter your password"
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm">Remember me</span>
              </label>
              <a href="#" className="text-sm text-red-600 hover:underline">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="text-red-600 hover:underline">
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
