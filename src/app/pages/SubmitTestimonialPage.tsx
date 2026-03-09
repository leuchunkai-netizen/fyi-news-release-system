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
    if (rating === 0) {
      alert("Please select a star rating.");
      return;
    }
    if (!message.trim()) {
      alert("Please write a short testimonial.");
      return;
    }
    setSubmitting(true);
    try {
      await addTestimonial(
        {
          name: user.name,
          role: displayRole,
          message: message.trim(),
          rating,
        },
        user.id
      );
      setSubmitted(true);
    } catch (err) {
      alert((err as Error)?.message ?? "Failed to submit testimonial.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-xl mx-auto border rounded-lg p-8 text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-14 h-14 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold mb-3">Thanks — we got it</h1>
          <p className="text-muted-foreground mb-4">
            Your testimonial has been submitted. Our AI is checking it before we publish.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            We hide new testimonials from the site until they’re approved. If it passes review, it’ll show up on the homepage.
          </p>
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
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Submit testimonial
          </button>
        </form>
      </div>
    </div>
  );
}

