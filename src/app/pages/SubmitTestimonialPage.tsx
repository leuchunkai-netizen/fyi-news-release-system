import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Star, CheckCircle } from "lucide-react";
import { useUser } from "../context/UserContext";
import { useTestimonials } from "../context/TestimonialsContext";

export function SubmitTestimonialPage() {
  const { user } = useUser();
  const { addTestimonial } = useTestimonials();
  const navigate = useNavigate();

  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
  const [submittedStatus, setSubmittedStatus] = useState<"approved" | "pending" | null>(null);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold mb-4">Share your experience</h1>
        <p className="text-muted-foreground mb-6">
          Please sign in before submitting a testimonial.
        </p>
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Sign in
        </button>
      </div>
    );
  }

  const displayRole =
    user.role === "premium"
      ? "Premium Member"
      : user.role === "free"
      ? "Free Member"
      : user.role === "expert"
      ? "Verified Expert"
      : user.role === "admin"
      ? "Administrator"
      : "Member";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitNotice(null);
    if (rating === 0) {
      setSubmitError("Please select a star rating.");
      return;
    }
    if (!message.trim()) {
      setSubmitError("Please write a short testimonial.");
      return;
    }
    setSubmitting(true);
    try {
      const row = await addTestimonial(
        {
          name: user.name,
          role: displayRole,
          message: message.trim(),
          rating,
        },
        user.id
      );
      const live = row.status === "approved";
      setSubmittedStatus(live ? "approved" : "pending");
      if (live) {
        setSubmitted(true);
      } else {
        setSubmitNotice(
          "Thanks — your testimonial is submitted and queued for review. It will appear publicly after approval."
        );
        setMessage("");
        setRating(0);
      }
    } catch (err) {
      setSubmitError((err as Error)?.message ?? "Failed to submit testimonial.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    const live = submittedStatus === "approved";
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-xl mx-auto border rounded-lg p-8 text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-14 h-14 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold mb-3">Thanks — we got it</h1>
          {live ? (
            <>
              <p className="text-muted-foreground mb-4">
                Your testimonial passed our automated checks and is now visible on the homepage.
              </p>
              <p className="text-sm text-muted-foreground mb-8">
                We still reserve the right to remove content that violates guidelines after publication.
              </p>
            </>
          ) : (
            <>
              <p className="text-muted-foreground mb-4">
                Your testimonial is saved and queued for review. It is not shown publicly until a moderator approves it.
              </p>
              <p className="text-sm text-muted-foreground mb-8">
                Tip: longer, specific feedback is more likely to pass automatically next time.
              </p>
            </>
          )}
          <Link
            to="/"
            className="inline-block px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-xl mx-auto border rounded-lg p-8">
        <h1 className="text-3xl font-semibold mb-2">Submit a Testimonial</h1>
        <p className="text-muted-foreground mb-6">
          Rate your experience and share a short quote we can show to future visitors.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {submitNotice && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {submitNotice}
            </div>
          )}
          {submitError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {submitError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Your rating</label>
            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, idx) => {
                const value = idx + 1;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className="focus:outline-none"
                    aria-label={`${value} star${value > 1 ? "s" : ""}`}
                  >
                    <Star
                      className={`w-7 h-7 ${
                        value <= rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Your testimonial</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              placeholder="Write a short quote about your experience..."
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit testimonial"}
          </button>
        </form>
      </div>
    </div>
  );
}

