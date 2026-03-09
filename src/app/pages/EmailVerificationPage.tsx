import { useSearchParams, useNavigate } from "react-router";

export function EmailVerificationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const email = searchParams.get("email") || "your email address";

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-lg mx-auto border rounded-lg p-8 text-center">
        <h1 className="text-3xl font-semibold mb-4">Verify your email</h1>
        <p className="text-muted-foreground mb-4">
          We&apos;ve sent a verification link to <span className="font-semibold">{email}</span>.
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          Please check your inbox (and spam folder) and click the link to confirm your account. This is handled by our
          authentication provider (for example, Supabase).
        </p>

        <button
          type="button"
          onClick={() => navigate("/personal-info")}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          I&apos;ve verified my email
        </button>
      </div>
    </div>
  );
}

