import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { AlertTriangle, Upload, X } from "lucide-react";
import { useUser } from "../context/UserContext";
import { createArticle, getArticleById, updateArticle } from "../../lib/api/articles";
import { getCategories } from "../../lib/api/categories";
import { uploadArticleImage } from "../../lib/storage";
import type { CategoryRow } from "../../lib/types/database";

interface RejectionFinding {
  snippet: string;
  issue: string;
  reason: string;
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function getSampleRejectionFindings(content: string, rejectionReason: string): RejectionFinding[] {
  const plain = stripHtml(content);
  const sentences = (plain.match(/[^.!?]+[.!?]?/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length >= 50);
  const snippets = [
    sentences[0] ?? "This claim appears in the article but does not include a verifiable source citation.",
    sentences[1] ?? "This statement makes a strong factual assertion without clear supporting evidence.",
  ];
  return [
    {
      snippet: snippets[0],
      issue: "Unverified factual claim",
      reason: rejectionReason || "The claim could not be verified against reliable source material.",
    },
    {
      snippet: snippets[1],
      issue: "Possible overstatement or missing citation",
      reason: "High-confidence language was used, but supporting proof was not sufficiently provided.",
    },
  ];
}

export function UploadArticlePage() {
  const { id: editingArticleId } = useParams<{ id?: string }>();
  const isEditing = Boolean(editingArticleId);
  const { user } = useUser();
  const navigate = useNavigate();
  const [submitMode, setSubmitMode] = useState<"draft" | "pending">("pending");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    content: "",
    excerpt: "",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRejectedEdit, setIsRejectedEdit] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [rejectionFindings, setRejectionFindings] = useState<RejectionFinding[]>([]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!isEditing || !editingArticleId || !user?.id) return;
    let cancelled = false;
    setInitialLoading(true);
    setError(null);
    (async () => {
      try {
        const article = await getArticleById(editingArticleId);
        if (cancelled) return;
        if (!article) {
          setError("Article not found.");
          return;
        }
        if (article.author_id !== user.id) {
          setError("You can only edit your own articles.");
          return;
        }
        setFormData({
          title: article.title ?? "",
          category: article.category?.slug ?? "",
          content: article.content ?? "",
          excerpt: article.excerpt ?? "",
        });
        if (article.status === "rejected") {
          const reason = article.rejection_reason?.trim() || "The article did not meet credibility requirements.";
          setIsRejectedEdit(true);
          setRejectionReason(reason);
          setRejectionFindings(getSampleRejectionFindings(article.content ?? "", reason));
        } else {
          setIsRejectedEdit(false);
          setRejectionReason("");
          setRejectionFindings([]);
        }
        setExistingImageUrl(article.image_url ?? null);
        setImagePreview(article.image_url ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load article.");
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditing, editingArticleId, user?.id]);

  if (!user || (user.role !== "free" && user.role !== "premium")) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold mb-4">Access Denied</h1>
        <p className="text-muted-foreground">You need to be logged in to upload articles.</p>
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Loading article editor…</p>
      </div>
    );
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const title = formData.title.trim();
      if (!title) {
        setError("Please enter an article title.");
        setSubmitting(false);
        return;
      }

      const isDraft = submitMode === "draft";
      const categorySlug = formData.category.trim();
      const category = categorySlug ? categories.find((c) => c.slug === categorySlug) : null;
      const category_id = category?.id ?? null;
      if (categorySlug && !category_id) {
        setError("Please select a valid category.");
        setSubmitting(false);
        return;
      }
      if (!isDraft && !category_id) {
        setError("Please select a category before submitting for review.");
        setSubmitting(false);
        return;
      }

      if (!isDraft && !formData.excerpt.trim()) {
        setError("Please add an excerpt before submitting for review.");
        setSubmitting(false);
        return;
      }

      if (!isDraft && !formData.content.trim()) {
        setError("Please add article content before submitting for review.");
        setSubmitting(false);
        return;
      }

      let image_url: string | null = existingImageUrl;
      if (imageFile && user) {
        try {
          image_url = await uploadArticleImage(imageFile, user.id);
        } catch (uploadErr) {
          console.error(uploadErr);
          const message =
            uploadErr instanceof Error && uploadErr.message
              ? uploadErr.message
              : "Image upload failed. Please try again.";
          setError(message);
          setSubmitting(false);
          return;
        }
      }

      if (isEditing && editingArticleId) {
        await updateArticle(editingArticleId, {
          title,
          excerpt: formData.excerpt.trim() || null,
          content: formData.content.trim() || null,
          image_url,
          category_id,
          status: isDraft ? "draft" : "pending",
          submitted_at: isDraft ? null : new Date().toISOString(),
          rejection_reason: null,
        });
      } else {
        await createArticle({
          author_id: user.id,
          title,
          excerpt: formData.excerpt.trim() || null,
          content: formData.content.trim() || null,
          image_url,
          author_display_name: user.name,
          category_id,
          status: isDraft ? "draft" : "pending",
        });
      }
      navigate("/my-articles");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit article.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-semibold mb-2">{isEditing ? "Edit Article" : "Upload New Article"}</h1>
        <p className="text-muted-foreground mb-8">
          {isEditing
            ? "Continue refining your article. Save draft changes anytime or submit for expert review when ready."
            : "Share your story with our community. Save a draft anytime, or submit for expert review when ready."}
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-800 border border-red-200">
            {error}
          </div>
        )}

        {isRejectedEdit && (
          <div className="mb-6 border-2 border-red-200 rounded-lg overflow-hidden">
            <div className="bg-red-50 border-b border-red-200 px-4 py-3">
              <h3 className="font-semibold text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                AI Rejection Guidance (Sample)
              </h3>
              <p className="text-sm text-red-800 mt-1">
                Update the highlighted sections below, then submit for review again.
              </p>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm">
                <span className="font-semibold">Rejection reason:</span> {rejectionReason}
              </p>
              {rejectionFindings.map((finding, index) => (
                <div key={index} className="border border-red-200 bg-red-50 rounded p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2">Highlighted Portion {index + 1}</p>
                  <blockquote className="text-sm italic border-l-4 border-red-400 pl-3 mb-2">
                    "{finding.snippet}"
                  </blockquote>
                  <p className="text-sm">
                    <span className="font-semibold">Flag:</span> {finding.issue}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Why flagged:</span> {finding.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Article Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              placeholder="Enter a compelling title"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium mb-2">Excerpt</label>
            <textarea
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              rows={3}
              placeholder="Write a brief summary (2-3 sentences)"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formData.excerpt.length} / 300 characters
            </p>
          </div>

          {/* Featured Image */}
          <div>
            <label className="block text-sm font-medium mb-2">Featured Image</label>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-full h-64 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setImageFile(null);
                    setExistingImageUrl(null);
                  }}
                  className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50">
                <Upload className="w-12 h-12 text-gray-400 mb-4" />
                <p className="text-sm text-muted-foreground mb-2">Click to upload image</p>
                <p className="text-xs text-muted-foreground">PNG, JPG up to 10MB</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium mb-2">Article Content</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 font-mono text-sm"
              rows={20}
              placeholder="Write your article content here..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Supports basic HTML formatting
            </p>
          </div>

          {/* Guidelines */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h3 className="font-semibold mb-2">Publishing Guidelines</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• All articles are reviewed by expert verifiers before publication</li>
              <li>• Ensure your content is factually accurate and well-researched</li>
              <li>• Include credible sources when making claims</li>
              <li>• Follow journalistic ethics and avoid plagiarism</li>
              <li>• Review process typically takes 24-48 hours</li>
            </ul>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={() => setSubmitMode("draft")}
              disabled={submitting}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && submitMode === "draft"
                ? "Saving…"
                : isEditing
                  ? "Save Draft Changes"
                  : "Save as Draft"}
            </button>
            <button
              type="submit"
              onClick={() => setSubmitMode("pending")}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && submitMode === "pending"
                ? "Submitting…"
                : isEditing
                  ? "Submit Updates for Review"
                  : "Submit for Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
