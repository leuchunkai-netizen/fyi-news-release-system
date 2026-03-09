import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Upload, X } from "lucide-react";
import { useUser } from "../context/UserContext";
import { createArticle } from "../../lib/api/articles";
import { getCategories } from "../../lib/api/categories";
import type { CategoryRow } from "../../lib/types/database";

export function UploadArticlePage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    content: "",
    excerpt: "",
    tags: ""
  });
  const [image, setImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  if (!user || (user.role !== "free" && user.role !== "premium")) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold mb-4">Access Denied</h1>
        <p className="text-muted-foreground">You need to be logged in to upload articles.</p>
      </div>
    );
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const categorySlug = formData.category.trim();
      const category = categories.find((c) => c.slug === categorySlug);
      const category_id = category?.id ?? null;
      if (!category_id) {
        setError("Please select a valid category.");
        setSubmitting(false);
        return;
      }
      // image_url column is varchar(500); data URLs are too long, so only use if it's a short URL
      const image_url =
        image && image.startsWith("http") && image.length <= 500
          ? image
          : null;

      await createArticle({
        author_id: user.id,
        title: formData.title.trim(),
        excerpt: formData.excerpt.trim() || null,
        content: formData.content.trim() || null,
        image_url,
        author_display_name: user.name,
        category_id,
        status: "pending",
      });
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
        <h1 className="text-3xl font-semibold mb-2">Upload New Article</h1>
        <p className="text-muted-foreground mb-8">
          Share your story with our community. Articles will be reviewed by our expert team before publication.
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-800 border border-red-200">
            {error}
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
            <label className="block text-sm font-medium mb-2">Category *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              required
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
            <label className="block text-sm font-medium mb-2">Excerpt *</label>
            <textarea
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              rows={3}
              placeholder="Write a brief summary (2-3 sentences)"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {formData.excerpt.length} / 300 characters
            </p>
          </div>

          {/* Featured Image */}
          <div>
            <label className="block text-sm font-medium mb-2">Featured Image</label>
            {image ? (
              <div className="relative">
                <img src={image} alt="Preview" className="w-full h-64 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => setImage(null)}
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
            <label className="block text-sm font-medium mb-2">Article Content *</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 font-mono text-sm"
              rows={20}
              placeholder="Write your article content here..."
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Supports basic HTML formatting
            </p>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-2">Tags (optional)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              placeholder="e.g. artificial intelligence, healthcare, innovation"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Separate tags with commas
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
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting…" : "Submit for Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
