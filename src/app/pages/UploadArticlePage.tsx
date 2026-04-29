import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { AlertTriangle, ClipboardCheck, Upload, X } from "lucide-react";
import { useUser } from "../context/UserContext";
import { factcheckArticle, verifyClaimSource, type ClaimSourceVerifyResult, type FactcheckResult } from "../../lib/api/factcheck";
import { evaluateSubmitForReview } from "../../lib/api/submitReview";
import {
  createArticle,
  getArticleById,
  normalizeArticleTags,
  suggestArticleTags,
  updateArticle,
} from "../../lib/api/articles";
import { getCategories } from "../../lib/api/categories";
import { uploadArticleImage } from "../../lib/storage";
import type { CategoryRow } from "../../lib/types/database";
import { canAuthorArticles } from "../../lib/userRoles";

interface RejectionFinding {
  snippet: string;
  issue: string;
  reason: string;
}

type ClaimSignal = { verdict: "SUPPORT" | "CONTRADICT" | "UNRELATED"; credibility: "HIGH" | "LOW" };

const CATEGORY_HINT_KEYWORDS: Record<string, string[]> = {
  "world-news": ["world", "global", "international", "country", "countries", "nation", "diplomatic", "conflict", "war"],
  politics: ["politics", "government", "policy", "election", "parliament", "minister", "senate", "lawmakers"],
  business: ["business", "market", "stocks", "economy", "economic", "finance", "trade", "industry", "investor"],
  technology: ["technology", "tech", "software", "ai", "artificial intelligence", "startup", "cybersecurity", "digital"],
  science: ["science", "scientist", "research", "study", "laboratory", "experiment", "discovery"],
  health: ["health", "medical", "medicine", "hospital", "doctor", "disease", "treatment", "clinical"],
  sports: ["sports", "match", "tournament", "league", "coach", "player", "goal", "championship"],
  entertainment: ["entertainment", "movie", "film", "music", "celebrity", "show", "series", "festival"],
  culture: ["culture", "art", "museum", "heritage", "literature", "theater", "tradition"],
  environment: ["environment", "climate", "emissions", "pollution", "wildlife", "sustainability", "renewable"],
  "breaking-news": ["breaking", "urgent", "developing", "just in", "latest"],
};

/** Bonus points from user-verified sources only; never reduces base pipeline confidence. */
function estimateSourceDelta(rows: ClaimSourceVerifyResult[]) {
  const checks = Array.isArray(rows) ? rows : [];
  const supportHigh = checks.filter((r) => r.aiVerdict === "SUPPORT" && r.sourceCredibility === "HIGH").length;
  const supportLow = checks.filter((r) => r.aiVerdict === "SUPPORT" && r.sourceCredibility === "LOW").length;
  return supportHigh * 5 + supportLow * 2;
}

function flattenChecksByClaim(allByClaim: Record<number, ClaimSourceVerifyResult[]>) {
  return Object.values(allByClaim || {}).flatMap((rows) => (Array.isArray(rows) ? rows : []));
}

/** Single place for pipeline base + optional source bonus → estimated total (matches submit-review logic). */
function computeScoreBreakdown(
  result: FactcheckResult | null,
  claimVerifyResults: Record<number, ClaimSourceVerifyResult[]>
) {
  if (!result) return null;
  const pipelineScore = Math.round(Number(result.confidence) || 0);
  const allChecks = flattenChecksByClaim(claimVerifyResults);
  const sourceBonus = estimateSourceDelta(allChecks);
  const estimatedTotal = Math.max(0, Math.min(100, pipelineScore + sourceBonus));
  return { pipelineScore, sourceBonus, estimatedTotal };
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeForTokens(input: string): string[] {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

function countKeywordHits(text: string, keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.reduce((hits, kw) => {
    const word = kw.trim().toLowerCase();
    if (!word) return hits;
    return lower.includes(word) ? hits + 1 : hits;
  }, 0);
}

function getCategoryMismatchMessage(
  selectedSlug: string,
  title: string,
  content: string,
  categories: CategoryRow[]
): string | null {
  const selected = categories.find((c) => c.slug === selectedSlug);
  if (!selected) return "Please select a valid category.";
  const text = `${title}\n${stripHtml(content)}`.trim();
  if (!text) return null;

  const ranked = categories
    .map((c) => {
      const fromNameAndDescription = [...normalizeForTokens(`${c.name} ${c.description ?? ""}`)];
      const hints = CATEGORY_HINT_KEYWORDS[c.slug] ?? [];
      const keywords = Array.from(new Set([...fromNameAndDescription, ...hints]));
      return {
        slug: c.slug,
        name: c.name,
        score: countKeywordHits(text, keywords),
      };
    })
    .sort((a, b) => b.score - a.score);

  const selectedScore = ranked.find((r) => r.slug === selectedSlug)?.score ?? 0;
  const best = ranked[0];
  if (!best || best.slug === selectedSlug) return null;
  const scoreGap = best.score - selectedScore;
  // Stricter gate: if a different category has a clear lead, block mismatch.
  const clearlyDifferent = best.score >= 2 && scoreGap >= 2;
  if (!clearlyDifferent) return null;
  return `This draft looks closer to "${best.name}" than "${selected.name}". Please choose a matching category.`;
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
    imageCaption: "",
    tags: "",
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
  const [factcheckLoading, setFactcheckLoading] = useState(false);
  const [factcheckError, setFactcheckError] = useState<string | null>(null);
  const [factcheckResult, setFactcheckResult] = useState<FactcheckResult | null>(null);
  const [tagSuggestLoading, setTagSuggestLoading] = useState(false);
  const [tagSuggestError, setTagSuggestError] = useState<string | null>(null);
  const [tagSuggestSource, setTagSuggestSource] = useState<"openai" | "huggingface" | "extract" | null>(null);
  const [claimSourceUrls, setClaimSourceUrls] = useState<Record<number, string>>({});
  const [claimVerifyLoading, setClaimVerifyLoading] = useState<Record<number, boolean>>({});
  const [claimVerifyErrors, setClaimVerifyErrors] = useState<Record<number, string>>({});
  const [claimVerifyResults, setClaimVerifyResults] = useState<Record<number, ClaimSourceVerifyResult[]>>({});

  const factcheckScoreBreakdown = useMemo(
    () => computeScoreBreakdown(factcheckResult, claimVerifyResults),
    [factcheckResult, claimVerifyResults]
  );
  const liveCategoryMismatch = useMemo(() => {
    const title = formData.title.trim();
    const categorySlug = formData.category.trim();
    const body = stripHtml(formData.content);
    if (!categorySlug || !title || body.length < 80) return null;
    return getCategoryMismatchMessage(categorySlug, title, formData.content, categories);
  }, [formData.title, formData.category, formData.content, categories]);

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
          imageCaption: article.excerpt ?? "",
          tags: (article.tags ?? []).join(", "),
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

  if (!user || !canAuthorArticles(user.role)) {
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

  const handleRunFactcheck = async () => {
    setFactcheckError(null);
    const title = formData.title.trim();
    if (!title) {
      setFactcheckError("Add an article title before running a fact check.");
      return;
    }
    const categorySlug = formData.category.trim();
    const category = categorySlug ? categories.find((c) => c.slug === categorySlug) : null;
    if (!category) {
      setFactcheckError("Select a valid category before running a fact check.");
      return;
    }
    const mismatch = getCategoryMismatchMessage(categorySlug, title, formData.content, categories);
    if (mismatch) {
      setFactcheckError(mismatch);
      return;
    }
    const body = stripHtml(formData.content);
    if (body.length < 80) {
      setFactcheckError("Add article text (at least 80 characters) before running a fact check.");
      return;
    }
    setFactcheckLoading(true);
    setFactcheckResult(null);
    setClaimSourceUrls({});
    setClaimVerifyLoading({});
    setClaimVerifyErrors({});
    setClaimVerifyResults({});
    try {
      const result = await factcheckArticle({
        title: title || undefined,
        body,
        ...(isEditing && editingArticleId ? { articleId: editingArticleId } : {}),
      });
      setFactcheckResult(result);
    } catch (err) {
      setFactcheckError(err instanceof Error ? err.message : "Fact check failed.");
    } finally {
      setFactcheckLoading(false);
    }
  };

  const handleVerifyClaimSource = async (claimIndex: number, claimText: string) => {
    const sourceUrl = (claimSourceUrls[claimIndex] || "").trim();
    if (!sourceUrl) {
      setClaimVerifyErrors((prev) => ({ ...prev, [claimIndex]: "Add a source URL first." }));
      return;
    }
    setClaimVerifyErrors((prev) => ({ ...prev, [claimIndex]: "" }));
    setClaimVerifyLoading((prev) => ({ ...prev, [claimIndex]: true }));
    try {
      const priorSignals: ClaimSignal[] =
        (claimVerifyResults[claimIndex] || []).map((row) => ({
          verdict: row.aiVerdict,
          credibility: row.sourceCredibility,
        })) ?? [];
      const result = await verifyClaimSource({
        claim: claimText,
        sourceUrl,
        priorSignals,
      });
      setClaimVerifyResults((prev) => ({
        ...prev,
        [claimIndex]: [...(prev[claimIndex] || []), result],
      }));
      setClaimSourceUrls((prev) => ({ ...prev, [claimIndex]: "" }));
    } catch (err) {
      setClaimVerifyErrors((prev) => ({
        ...prev,
        [claimIndex]: err instanceof Error ? err.message : "Source check failed.",
      }));
    } finally {
      setClaimVerifyLoading((prev) => ({ ...prev, [claimIndex]: false }));
    }
  };

  const handleSuggestTags = async () => {
    setTagSuggestError(null);
    const title = formData.title.trim();
    const content = formData.content.trim();
    const body = stripHtml(content);
    if (body.length < 40) {
      setTagSuggestError("Add article content (at least 40 characters) before generating tags.");
      return;
    }
    setTagSuggestLoading(true);
    try {
      const result = await suggestArticleTags({ title: title || undefined, content });
      if (!result.tags.length) {
        setTagSuggestError("No tag suggestions returned. Add more detail and try again.");
        return;
      }
      setFormData((prev) => ({ ...prev, tags: result.tags.join(", ") }));
      setTagSuggestSource(result.source);
    } catch (err) {
      setTagSuggestError(err instanceof Error ? err.message : "Tag generation failed.");
    } finally {
      setTagSuggestLoading(false);
    }
  };

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
      if (!isDraft && categorySlug) {
        const mismatch = getCategoryMismatchMessage(categorySlug, title, formData.content, categories);
        if (mismatch) {
          setError(mismatch);
          setSubmitting(false);
          return;
        }
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

      let resolvedArticleId = "";
      const tags = normalizeArticleTags(formData.tags);

      if (isEditing && editingArticleId) {
        await updateArticle(editingArticleId, {
          title,
          excerpt: formData.imageCaption.trim() || null,
          content: formData.content.trim() || null,
          image_url,
          category_id,
          status: isDraft ? "draft" : "pending",
          submitted_at: isDraft ? null : new Date().toISOString(),
          rejection_reason: null,
          tags,
        });
        resolvedArticleId = editingArticleId;
      } else {
        const created = await createArticle({
          author_id: user.id,
          title,
          excerpt: formData.imageCaption.trim() || null,
          content: formData.content.trim() || null,
          image_url,
          author_display_name: user.name,
          category_id,
          status: isDraft ? "draft" : "pending",
          tags,
        });
        resolvedArticleId = created.id;
      }

      if (!isDraft && resolvedArticleId) {
        try {
          const checksForSubmit =
            Array.isArray(factcheckResult?.claims) && factcheckResult?.claims
              ? factcheckResult.claims.flatMap((claim, idx) =>
                  (claimVerifyResults[idx] || []).map((r) => ({
                    claim: claim.claim,
                    sourceUrl: r.url,
                    sourceTitle: r.sourceTitle,
                    aiVerdict: r.aiVerdict,
                    sourceCredibility: r.sourceCredibility,
                    confidence: r.confidence,
                    reason: r.reason,
                  }))
                )
              : [];
          const outcome = await evaluateSubmitForReview({
            articleId: resolvedArticleId,
            title: title || undefined,
            body: formData.content.trim() || "",
            pipelineConfidence:
              factcheckResult != null ? Math.round(Number(factcheckResult.confidence) || 0) : undefined,
            userSourceChecks: checksForSubmit,
          });
          navigate("/my-articles", {
            state: {
              submitNotice: outcome.autoApproved
                ? "auto-published"
                : "pending-review",
            },
          });
        } catch (reviewErr) {
          console.error(reviewErr);
          navigate("/my-articles", {
            state: {
              submitNotice: "review-failed",
              submitError: reviewErr instanceof Error ? reviewErr.message : "Review step failed",
            },
          });
        }
      } else {
        navigate("/my-articles");
      }
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
            ? "Continue refining your article. Save draft changes anytime, or submit for review — we may publish automatically if the fact-check clears your thresholds."
            : "Share your story with our community. Save a draft anytime, or submit for review — we may publish automatically if the fact-check clears your thresholds."}
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

          {/* Tags (comma-separated; used for “Also read” matching) */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="block text-sm font-medium">Tags</label>
              <button
                type="button"
                onClick={handleSuggestTags}
                disabled={tagSuggestLoading}
                className="px-3 py-1.5 border rounded-md text-xs hover:bg-gray-50 disabled:opacity-50"
              >
                {tagSuggestLoading ? "Generating tags..." : "Auto-generate tags"}
              </button>
            </div>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              placeholder="e.g. health, research, nutrition"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Comma-separated. Helps readers find related stories in the same category.
            </p>
            {tagSuggestError ? <p className="text-xs text-red-700 mt-1">{tagSuggestError}</p> : null}
            {tagSuggestSource ? (
              <p className="text-xs text-muted-foreground mt-1">Tag suggestions source: {tagSuggestSource}</p>
            ) : null}
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
            <div className="mt-3">
              <label className="block text-sm font-medium mb-2">Image Caption</label>
              <input
                type="text"
                value={formData.imageCaption}
                onChange={(e) => setFormData({ ...formData, imageCaption: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="Add a short caption for the featured image"
              />
            </div>
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

          {/* Fact check (calls backend POST /api/articles/factcheck — run Vite dev so /api proxies to port 10000) */}
          <div className="border rounded-lg p-4 bg-slate-50 border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-slate-700" />
                  Fact check draft
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Uses your title and article text. Does not submit the article.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunFactcheck}
                disabled={factcheckLoading || Boolean(liveCategoryMismatch)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50 text-sm shrink-0"
              >
                {factcheckLoading ? "Checking…" : "Run fact check"}
              </button>
            </div>
            {factcheckError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{factcheckError}</div>
            )}
            {liveCategoryMismatch && (
              <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
                {liveCategoryMismatch}
              </div>
            )}
            {factcheckResult && (
              <div className="space-y-3 text-sm">
                <p>
                  <span className="font-semibold">Automated verdict:</span>{" "}
                  <span className="uppercase tracking-wide">{factcheckResult.verdict}</span>
                </p>
                <p className="text-muted-foreground">{factcheckResult.summary}</p>
                {factcheckScoreBreakdown && (
                  <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
                    <p className="font-semibold text-slate-900">Confidence — how this adds up</p>
                    <dl className="space-y-2.5 text-slate-800">
                      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                        <dt className="text-muted-foreground min-w-[12rem] flex-1">
                          Starting score (from your draft + retrieved news evidence)
                        </dt>
                        <dd className="font-semibold tabular-nums shrink-0">{factcheckScoreBreakdown.pipelineScore}%</dd>
                      </div>
                      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                        <dt className="text-muted-foreground min-w-[12rem] flex-1">
                          Extra points from your verified links (SUPPORT only, capped)
                        </dt>
                        <dd className="font-semibold tabular-nums shrink-0 text-green-800">
                          {factcheckScoreBreakdown.sourceBonus > 0
                            ? `+${factcheckScoreBreakdown.sourceBonus}`
                            : "0 (add sources on unverified claims below)"}
                        </dd>
                      </div>
                      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-slate-200 pt-3">
                        <dt className="font-semibold text-slate-900 min-w-[12rem] flex-1">Estimated score if you submit now</dt>
                        <dd className="font-bold tabular-nums text-lg text-slate-900 shrink-0">
                          {factcheckScoreBreakdown.estimatedTotal}%
                        </dd>
                      </div>
                    </dl>
                    <p className="text-xs text-muted-foreground leading-relaxed border-t border-slate-100 pt-2">
                      Everyone starts from the same <strong className="text-slate-700">starting score</strong> after you run
                      fact check. Verifying sources only <strong className="text-slate-700">adds</strong> bonus points — it does
                      not replace that base. One estimated total applies to the whole article (not per claim).
                    </p>
                  </div>
                )}
                {Array.isArray(factcheckResult.claims) && factcheckResult.claims.length > 0 && (
                  <ul className="space-y-3">
                    {factcheckResult.claims.map((c, i) => {
                      const checks = claimVerifyResults[i] || [];
                      const checksVisible = checks.filter(
                        (row) => String(row.aiVerdict).toUpperCase() === "SUPPORT"
                      );
                      return (
                        <li key={i} className="border border-slate-200 rounded p-3 bg-white">
                          <p>
                            <span className="font-medium">{c.verdict}</span>: {c.claim}
                          </p>
                          {c.why ? <p className="text-muted-foreground mt-0.5">{c.why}</p> : null}

                          {c.verdict === "UNVERIFIED" && (
                            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                              <p className="text-xs uppercase tracking-wide text-slate-600">Add Source</p>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                  type="url"
                                  value={claimSourceUrls[i] || ""}
                                  onChange={(e) =>
                                    setClaimSourceUrls((prev) => ({ ...prev, [i]: e.target.value }))
                                  }
                                  placeholder="https://example.com/article"
                                  className="flex-1 px-3 py-2 border rounded text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleVerifyClaimSource(i, c.claim)}
                                  disabled={Boolean(claimVerifyLoading[i])}
                                  className="px-3 py-2 bg-slate-800 text-white rounded text-sm disabled:opacity-50"
                                >
                                  {claimVerifyLoading[i] ? "Checking..." : "Re-check"}
                                </button>
                              </div>
                              {claimVerifyErrors[i] ? (
                                <p className="text-xs text-red-700">{claimVerifyErrors[i]}</p>
                              ) : null}
                              {checksVisible.length > 0 &&
                                checksVisible.map((row, idx) => (
                                  <div key={idx} className="text-xs border rounded p-2 bg-slate-50 space-y-1">
                                    <p>
                                      Source credibility: <span className="font-semibold">{row.sourceCredibility}</span>
                                      {" · "}
                                      AI verdict: <span className="font-semibold">{row.aiVerdict}</span>
                                    </p>
                                    <p className="text-slate-700">{row.reason}</p>
                                    {row.evidenceQuote ? (
                                      <blockquote className="italic border-l-2 border-slate-300 pl-2 text-slate-600">
                                        "{row.evidenceQuote}"
                                      </blockquote>
                                    ) : null}
                                  </div>
                                ))}
                              {checksVisible.length > 0 ? (
                                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                                  These verified links count toward the <strong>extra points</strong> in the score box above
                                  (shared across all claims).
                                </p>
                              ) : null}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {Array.isArray(factcheckResult.top3) && factcheckResult.top3.length > 0 && (
                  <div>
                    <p className="font-semibold mb-1">Evidence snippets used</p>
                    <ul className="space-y-2 border-t border-slate-200 pt-2">
                      {factcheckResult.top3.map((raw, i) => {
                        const e = raw ?? {};
                        const title = String(e.title ?? "");
                        const source = String(e.source ?? "");
                        const desc =
                          e.desc != null && typeof e.desc === "string"
                            ? e.desc
                            : e.desc != null
                              ? String(e.desc)
                              : "";
                        return (
                          <li key={i} className="text-xs text-muted-foreground">
                            <span className="text-slate-800 font-medium">{title}</span> ({source})
                            {desc ? (
                              <span className="block mt-0.5">
                                {desc.slice(0, 280)}
                                {desc.length > 280 ? "…" : ""}
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {isEditing && editingArticleId && factcheckResult.credibilitySaved === true && (
                  <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded px-2 py-1.5">
                    Credibility breakdown saved to the database for this article. It will appear on the article page for readers after you publish.
                  </p>
                )}
                {isEditing && editingArticleId && factcheckResult.credibilitySaveError && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    Could not save credibility data: {factcheckResult.credibilitySaveError}. Check backend Supabase service role in .env.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Guidelines */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h3 className="font-semibold mb-2">Publishing Guidelines</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• You can save as draft anytime; drafts are private until you submit for review.</li>
              <li>• Run Fact check draft before submitting to catch unsupported or disputed claims early.</li>
              <li>• Submit for Review runs server-side fact-check + confidence scoring automatically.</li>
              <li>• If confidence/verdict passes your configured thresholds, the article auto-publishes; otherwise it stays pending for manual review.</li>
              <li>• If rejected, update the flagged sections and resubmit from this editor.</li>
              <li>• Published articles show credibility analysis; list previews come from article body and premium readers can open AI summary on article detail pages.</li>
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
