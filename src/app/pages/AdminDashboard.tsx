import { useId, useState, useEffect, useMemo } from "react";
import { Users, FileText, MessageSquare, Tag, Ban, Search, Plus, Edit, Trash2, Shield, LayoutDashboard } from "lucide-react";
import { useUser } from "../context/UserContext";
import { UserAvatar } from "../components/UserAvatar";
import { useGuestLanding, type IntroSlide, type VideoSection } from "../context/GuestLandingContext";
import { uploadGuestSlideImage } from "@/lib/storage";
import {
  getAdminUsers,
  getAdminArticles,
  getAdminComments,
  getAdminExpertApplications,
  getCategories,
  updateGuestLandingSettings,
  upsertIntroSlides,
} from "@/lib/api";
import {
  type AdminUser,
  type AdminArticle,
  type AdminComment,
  type AdminExpertApplication,
  type AdminReport,
  updateUserStatus,
  updateUserRole,
  updateArticleStatus,
  deleteArticle,
  updateCommentStatus,
  deleteComment,
  updateExpertApplicationStatus,
  createCategory,
  updateCategory,
  deleteCategory,
  reassignCategoryArticles,
  getAdminArticleReports,
  updateArticleReportStatus,
  markCommentReportsReviewed,
} from "@/lib/api/admin";
import type { CategoryRow } from "@/lib/types/database";
import { getArticleById, getArticleByIdForAdminPreview, type ArticleWithCategory } from "@/lib/api/articles";
import { getUserInterestNames } from "@/lib/api/userInterests";

interface CategoryWithCount extends CategoryRow {
  articleCount: number;
}

/** DB stores admin-hidden articles as `flagged`; surface as Suspended so it is not confused with Delete. */
function articleModerationStatusLabel(status: string): string {
  if (status === "flagged") return "Suspended";
  if (status === "published") return "Published";
  if (status === "pending") return "Pending";
  if (status === "draft") return "Draft";
  if (status === "rejected") return "Rejected";
  return status;
}

export function AdminDashboard() {
  const { user } = useUser();
  const { introSlides, videoSection, setIntroSlides, setVideoSection } = useGuestLanding();
  const slideFileInputId = useId();
  const [activeTab, setActiveTab] = useState<
    "users" | "articles" | "comments" | "categories" | "experts" | "guestLanding" | "reports"
  >("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [editingIntroSlides, setEditingIntroSlides] = useState<IntroSlide[]>([]);
  const [editingVideoSection, setEditingVideoSection] = useState<VideoSection>({ title: "", description: "", videoUrl: "" });
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [editingCategoryForm, setEditingCategoryForm] = useState<{ name: string; description: string }>({
    name: "",
    description: "",
  });
  const [deletingCategory, setDeletingCategory] = useState<CategoryWithCount | null>(null);
  const [reassignCategoryId, setReassignCategoryId] = useState<string>("");
  const [selectedExpert, setSelectedExpert] = useState<AdminExpertApplication | null>(null);
  const [previewArticleId, setPreviewArticleId] = useState<string | null>(null);
  const [previewArticle, setPreviewArticle] = useState<ArticleWithCategory | null>(null);
  const [previewArticleLoading, setPreviewArticleLoading] = useState(false);
  const [previewArticleError, setPreviewArticleError] = useState<string | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUser | null>(null);
  const [userDetailInterests, setUserDetailInterests] = useState<string[]>([]);
  const [userDetailInterestsLoading, setUserDetailInterestsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AdminReport | null>(null);
  const [selectedCommentDetail, setSelectedCommentDetail] = useState<AdminComment | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [expertApplications, setExpertApplications] = useState<AdminExpertApplication[]>([]);
  const [categoriesRaw, setCategoriesRaw] = useState<CategoryRow[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    setLoading(true);
    setReportsError(null);
    Promise.all([
      getAdminUsers().catch(() => []),
      getAdminArticles().catch(() => []),
      getAdminComments().catch(() => []),
      getAdminExpertApplications().catch(() => []),
      getCategories().catch(() => []),
      getAdminArticleReports().catch((err) => {
        setReportsError((err as Error)?.message ?? "Could not load flagged reports.");
        return [];
      }),
    ])
      .then(([u, a, c, e, cat, r]) => {
        setUsers(u);
        setArticles(a);
        setComments(c);
        setExpertApplications(e);
        setCategoriesRaw(cat);
        setReports(r);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const categories = useMemo((): CategoryWithCount[] => {
    const countByCategory = new Map<string, number>();
    for (const a of articles) {
      if (a.category_id) countByCategory.set(a.category_id, (countByCategory.get(a.category_id) ?? 0) + 1);
    }
    return categoriesRaw.map((c) => ({
      ...c,
      articleCount: countByCategory.get(c.id) ?? 0,
    }));
  }, [categoriesRaw, articles]);

  useEffect(() => {
    if (activeTab === "guestLanding") {
      setEditingIntroSlides(introSlides.map((s) => ({ ...s })));
      setEditingVideoSection({ ...videoSection });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when opening tab
  }, [activeTab]);

  if (!user || user.role !== "admin") {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold mb-4">Access Denied</h1>
        <p className="text-muted-foreground">This page is only accessible to administrators.</p>
      </div>
    );
  }

  const usersFiltered = searchTerm.trim() ? users.filter((u) => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())) : users;
  const articlesFiltered = searchTerm.trim() ? articles.filter((a) => a.title.toLowerCase().includes(searchTerm.toLowerCase()) || a.author.toLowerCase().includes(searchTerm.toLowerCase())) : articles;
  const commentsFiltered = searchTerm.trim()
    ? comments.filter((c) => {
        const q = searchTerm.toLowerCase();
        return (
          c.content.toLowerCase().includes(q) ||
          c.author.toLowerCase().includes(q) ||
          c.article.toLowerCase().includes(q) ||
          (c.pendingReportSummary ?? "").toLowerCase().includes(q)
        );
      })
    : comments;
  const expertApplicationsPending = expertApplications.filter((e) => e.status === "pending");
  const expertsFiltered = searchTerm.trim()
    ? expertApplicationsPending.filter(
        (e) =>
          e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.expertise.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : expertApplicationsPending;
  const categoriesFiltered = searchTerm.trim() ? categories.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase())) : categories;
  const reportsFiltered = searchTerm.trim()
    ? reports.filter((r) => r.article_title.toLowerCase().includes(searchTerm.toLowerCase()))
    : reports;
  const tabTitleMap: Record<typeof activeTab, string> = {
    users: "User Management",
    articles: "Content Moderation",
    comments: "Comment Moderation (flagged & reported)",
    categories: "Category Management",
    experts: "Expert Application Management",
    guestLanding: "Guest Landing",
    reports: "Flagged Content",
  };

  const closeUserDetail = () => {
    setSelectedUserDetail(null);
    setUserDetailInterests([]);
    setUserDetailInterestsLoading(false);
  };

  const openUserDetail = async (u: AdminUser) => {
    setSelectedUserDetail(u);
    setUserDetailInterests([]);
    setUserDetailInterestsLoading(true);
    try {
      const names = await getUserInterestNames(u.id);
      setUserDetailInterests(names);
    } catch {
      setUserDetailInterests([]);
    } finally {
      setUserDetailInterestsLoading(false);
    }
  };

  const handleUserAction = async (userId: string, action: "suspend" | "unsuspend") => {
    try {
      await updateUserStatus(userId, action === "suspend" ? "suspended" : "active");
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: action === "suspend" ? "suspended" : "active" } : u))
      );
      setSelectedUserDetail((prev) =>
        prev?.id === userId ? { ...prev, status: action === "suspend" ? "suspended" : "active" } : prev
      );
      alert(`User ${action === "suspend" ? "suspended" : "unsuspended"}.`);
    } catch (err) {
      alert((err as Error)?.message ?? "Action failed.");
    }
  };

  const handleRevokeExpert = async (userId: string) => {
    try {
      await updateUserRole(userId, "free");
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: "free" } : u))
      );
      setSelectedUserDetail((prev) => (prev?.id === userId ? { ...prev, role: "free" } : prev));
      alert("Expert role revoked. User is now a free member.");
    } catch (err) {
      alert((err as Error)?.message ?? "Failed to update user role.");
    }
  };

  const closeArticlePreview = () => {
    setPreviewArticleId(null);
    setPreviewArticle(null);
    setPreviewArticleError(null);
    setPreviewArticleLoading(false);
  };

  const openArticlePreview = async (articleId: string) => {
    setPreviewArticleId(articleId);
    setPreviewArticle(null);
    setPreviewArticleError(null);
    setPreviewArticleLoading(true);
    try {
      const data =
        user?.role === "admin"
          ? await getArticleByIdForAdminPreview(articleId)
          : await getArticleById(articleId);
      if (!data) {
        setPreviewArticleError("Article not found.");
        return;
      }
      setPreviewArticle(data);
    } catch (e) {
      setPreviewArticleError((e as Error)?.message ?? "Could not load article.");
    } finally {
      setPreviewArticleLoading(false);
    }
  };

  const handleArticleAction = async (articleId: string, action: "suspend" | "unsuspend" | "delete") => {
    try {
      if (action === "delete") {
        await deleteArticle(articleId);
        setArticles((prev) => prev.filter((a) => a.id !== articleId));
        if (previewArticleId === articleId) closeArticlePreview();
        alert("Article deleted.");
      } else if (action === "unsuspend") {
        await updateArticleStatus(articleId, "published");
        setArticles((prev) =>
          prev.map((a) => (a.id === articleId ? { ...a, status: "published" } : a))
        );
        setPreviewArticle((prev) =>
          prev?.id === articleId ? { ...prev, status: "published" } : prev
        );
        alert("Article unsuspended and published again.");
      } else {
        await updateArticleStatus(articleId, "flagged");
        setArticles((prev) =>
          prev.map((a) => (a.id === articleId ? { ...a, status: "flagged" } : a))
        );
        setPreviewArticle((prev) =>
          prev?.id === articleId ? { ...prev, status: "flagged" } : prev
        );
        alert("Article suspended.");
      }
    } catch (err) {
      alert((err as Error)?.message ?? "Action failed.");
    }
  };

  const commentInModerationQueue = (c: AdminComment) =>
    c.status === "flagged" || (c.pendingReportIds?.length ?? 0) > 0;

  const closeCommentDetail = () => setSelectedCommentDetail(null);

  const handleDismissCommentReports = async (commentId: string): Promise<boolean> => {
    const row = comments.find((c) => c.id === commentId);
    const ids = row?.pendingReportIds ?? [];
    if (ids.length === 0) return false;
    try {
      await markCommentReportsReviewed(ids);
      setComments((prev) =>
        prev
          .map((c) =>
            c.id === commentId
              ? { ...c, pendingReportIds: undefined, pendingReportSummary: undefined }
              : c
          )
          .filter(commentInModerationQueue)
      );
      setSelectedCommentDetail((prev) => {
        if (!prev || prev.id !== commentId) return prev;
        const next: AdminComment = {
          ...prev,
          pendingReportIds: undefined,
          pendingReportSummary: undefined,
        };
        return commentInModerationQueue(next) ? next : null;
      });
      alert("User reports marked as reviewed.");
      return true;
    } catch (err) {
      alert((err as Error)?.message ?? "Failed to update reports.");
      return false;
    }
  };

  const handleCommentAction = async (
    commentId: string,
    action: "suspend" | "unsuspend" | "delete"
  ): Promise<boolean> => {
    try {
      if (action === "delete") {
        await deleteComment(commentId);
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setSelectedCommentDetail((prev) => (prev?.id === commentId ? null : prev));
        alert("Comment deleted.");
        return true;
      }
      if (action === "unsuspend") {
        await updateCommentStatus(commentId, "active");
        setComments((prev) =>
          prev
            .map((c) => (c.id === commentId ? { ...c, status: "active" } : c))
            .filter(commentInModerationQueue)
        );
        setSelectedCommentDetail((prev) => {
          if (!prev || prev.id !== commentId) return prev;
          const next: AdminComment = { ...prev, status: "active" };
          return commentInModerationQueue(next) ? next : null;
        });
        alert("Comment restored and visible again.");
        return true;
      }
      const row = comments.find((c) => c.id === commentId);
      await updateCommentStatus(commentId, "flagged");
      if (row?.pendingReportIds?.length) {
        await markCommentReportsReviewed(row.pendingReportIds);
      }
      setComments((prev) =>
        prev
          .map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  status: "flagged",
                  pendingReportIds: undefined,
                  pendingReportSummary: undefined,
                }
              : c
          )
          .filter(commentInModerationQueue)
      );
      setSelectedCommentDetail((prev) => {
        if (!prev || prev.id !== commentId) return prev;
        return {
          ...prev,
          status: "flagged",
          pendingReportIds: undefined,
          pendingReportSummary: undefined,
        };
      });
      alert("Comment flagged.");
      return true;
    } catch (err) {
      alert((err as Error)?.message ?? "Action failed.");
      return false;
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = categoryForm.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    if (!slug) {
      alert("Category name must contain at least one letter or number.");
      return;
    }
    try {
      await createCategory(categoryForm.name, slug, categoryForm.description || null);
      const cats = await getCategories();
      setCategoriesRaw(cats);
      setShowCategoryForm(false);
      setCategoryForm({ name: "", description: "" });
      alert(`Category "${categoryForm.name}" created.`);
    } catch (err) {
      alert((err as Error)?.message ?? "Failed to create category.");
    }
  };

  /** Returns true if the server update succeeded (DB expects approved | rejected). */
  const handleExpertAction = async (expertId: string, action: "approve" | "reject"): Promise<boolean> => {
    const nextStatus = action === "approve" ? "approved" : "rejected";
    try {
      await updateExpertApplicationStatus(expertId, nextStatus, user?.id);
      setExpertApplications((prev) =>
        prev.map((e) => (e.id === expertId ? { ...e, status: nextStatus } : e))
      );
      alert(
        action === "approve"
          ? "Expert application approved. User now has expert role."
          : "Expert application rejected."
      );
      return true;
    } catch (err) {
      alert((err as Error)?.message ?? "Action failed.");
      return false;
    }
  };

  const closeReportDetail = () => setSelectedReport(null);

  const handleReportAction = async (
    reportId: string,
    articleId: string,
    action: "suspend" | "ignore"
  ): Promise<boolean> => {
    try {
      const reportMeta = reports.find((r) => r.id === reportId);
      if (action === "suspend") {
        await updateArticleStatus(articleId, "flagged");
      }
      await updateArticleReportStatus(reportId, "reviewed");
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setSelectedReport((prev) => (prev?.id === reportId ? null : prev));
      if (action === "suspend") {
        // Ensure the suspended article is visible immediately in Content Moderation.
        setArticles((prev) => {
          const exists = prev.some((a) => a.id === articleId);
          if (exists) {
            return prev.map((a) =>
              a.id === articleId ? { ...a, status: "flagged" } : a
            );
          }
          return [
            {
              id: articleId,
              title: reportMeta?.article_title ?? "Unknown article",
              author: "Unknown",
              status: "flagged",
              date: new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
              author_id: null,
              category_id: null,
            },
            ...prev,
          ];
        });
        setSearchTerm("");
      }
      alert(
        action === "suspend"
          ? "Article suspended (not deleted): hidden from users and kept in Content Moderation."
          : "Report marked as resolved."
      );
      return true;
    } catch (err) {
      alert((err as Error)?.message ?? "Failed to update report.");
      return false;
    }
  };

  const handleSaveIntroSlides = async () => {
    try {
      await upsertIntroSlides(editingIntroSlides);
      setIntroSlides(editingIntroSlides);
      alert("Intro slides saved. Guests will see this content on the home page.");
    } catch (err) {
      alert((err as Error)?.message ?? "Failed to save intro slides.");
    }
  };

  const handleSaveVideoSection = async () => {
    try {
      const saved = await updateGuestLandingSettings({
        video_title: editingVideoSection.title,
        video_description: editingVideoSection.description || null,
        video_url: editingVideoSection.videoUrl || null,
      });
      if (!saved) {
        throw new Error("Save failed. No settings row returned from Supabase.");
      }
      setVideoSection(editingVideoSection);
      alert("Video section saved.");
    } catch (err) {
      alert((err as Error)?.message ?? "Failed to save video section.");
    }
  };

  function getYouTubeEmbedUrl(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "";

    if (trimmed.includes("youtube.com/embed/")) return trimmed;
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return `https://www.youtube.com/embed/${trimmed}`;

    try {
      const url = new URL(trimmed);
      const host = url.hostname.replace(/^www\./, "");

      if (host === "youtu.be") {
        const id = url.pathname.split("/").filter(Boolean)[0];
        return id ? `https://www.youtube.com/embed/${id}` : trimmed;
      }

      if (host.endsWith("youtube.com")) {
        const v = url.searchParams.get("v");
        if (v) return `https://www.youtube.com/embed/${v}`;

        const parts = url.pathname.split("/").filter(Boolean);
        if (parts[0] === "shorts" && parts[1]) return `https://www.youtube.com/embed/${parts[1]}`;
        if (parts[0] === "embed" && parts[1]) return `https://www.youtube.com/embed/${parts[1]}`;
      }
    } catch {
      // ignore
    }

    return trimmed;
  }

  const handlePickSlideImage = async (index: number, file: File | null) => {
    if (!file) return;
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }
    try {
      const url = await uploadGuestSlideImage(file, user.id);
      updateIntroSlide(index, "imageUrl", url);
    } catch (err) {
      alert((err as Error)?.message ?? "Failed to upload slide image.");
    }
  };

  const updateIntroSlide = (index: number, field: keyof IntroSlide, value: string) => {
    setEditingIntroSlides((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addIntroSlide = () => {
    setEditingIntroSlides((prev) => [...prev, { category: "Features", title: "", excerpt: "", imageUrl: "" }]);
  };

  const removeIntroSlide = (index: number) => {
    setEditingIntroSlides((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-semibold mb-8">Admin Dashboard</h1>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-2xl font-bold">{loading ? "—" : users.length}</p>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </div>
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <FileText className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-2xl font-bold">{loading ? "—" : articles.filter((a) => a.status === "published").length}</p>
            <p className="text-sm text-muted-foreground">Published Articles</p>
          </div>
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <MessageSquare className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-2xl font-bold">{loading ? "—" : comments.length}</p>
            <p className="text-sm text-muted-foreground">Comment moderation queue</p>
          </div>
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-2xl font-bold">{loading ? "—" : expertApplications.filter((e) => e.status === "pending").length}</p>
            <p className="text-sm text-muted-foreground">Pending Expert Applications</p>
          </div>
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Ban className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-2xl font-bold">{loading ? "—" : reports.filter((r) => r.status === "pending").length}</p>
            <p className="text-sm text-muted-foreground">Flagged Content</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="sticky top-[11rem] z-40 bg-background border-b mb-6 shadow-sm">
          <div className="flex gap-4 overflow-x-auto py-2">
            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2 ${
                activeTab === "users"
                  ? "border-b-2 border-red-600 font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              User Management
            </button>
            <button
              onClick={() => setActiveTab("articles")}
              className={`px-4 py-2 ${
                activeTab === "articles"
                  ? "border-b-2 border-red-600 font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Content Moderation
            </button>
            <button
              onClick={() => setActiveTab("comments")}
              className={`px-4 py-2 ${
                activeTab === "comments"
                  ? "border-b-2 border-red-600 font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              <MessageSquare className="w-4 h-4 inline mr-2" />
              Comment Moderation
            </button>
            <button
              onClick={() => setActiveTab("categories")}
              className={`px-4 py-2 ${
                activeTab === "categories"
                  ? "border-b-2 border-red-600 font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              <Tag className="w-4 h-4 inline mr-2" />
              Category Management
            </button>
            <button
              onClick={() => setActiveTab("experts")}
              className={`px-4 py-2 ${
                activeTab === "experts"
                  ? "border-b-2 border-red-600 font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              <Shield className="w-4 h-4 inline mr-2" />
              Expert Application Management
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`px-4 py-2 ${
                activeTab === "reports"
                  ? "border-b-2 border-red-600 font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              <Ban className="w-4 h-4 inline mr-2" />
              Flagged Content
            </button>
            <button
              onClick={() => setActiveTab("guestLanding")}
              className={`px-4 py-2 ${
                activeTab === "guestLanding"
                  ? "border-b-2 border-red-600 font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 inline mr-2" />
              Guest Landing
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>
        </div>

        <div className="mb-4">
          <h2 className="text-2xl font-semibold">{tabTitleMap[activeTab]}</h2>
        </div>

        {/* User Management Tab */}
        {activeTab === "users" && (
          <div className="border rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">User</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Role</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Joined</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {usersFiltered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold">{u.name}</p>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs capitalize">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          u.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{u.joined ?? ""}</td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => openUserDetail(u)}
                        className="px-3 py-1 text-xs border border-slate-300 text-slate-800 rounded hover:bg-slate-50"
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Content Moderation Tab */}
        {activeTab === "articles" && (
          <div className="border rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Article</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Author</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {articlesFiltered.map((article) => (
                  <tr key={article.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold">{article.title}</td>
                    <td className="px-6 py-4 text-sm">{article.author}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          article.status === "published"
                            ? "bg-green-100 text-green-700"
                            : article.status === "flagged"
                              ? "bg-red-100 text-red-700"
                              : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {articleModerationStatusLabel(article.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{article.date}</td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => openArticlePreview(article.id)}
                        className="inline-flex items-center px-3 py-1 text-xs border border-slate-300 text-slate-800 rounded hover:bg-slate-50"
                      >
                        View article
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Comments Tab */}
        {activeTab === "comments" && (
          <div className="border rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Commenter</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Article</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Comment</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Reports (anonymous)</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {commentsFiltered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-6 text-sm text-muted-foreground text-center"
                    >
                      No flagged comments and no pending user reports. The queue is empty.
                    </td>
                  </tr>
                ) : (
                  commentsFiltered.map((comment) => (
                    <tr key={comment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-semibold">{comment.author}</td>
                      <td className="px-6 py-4 text-sm">{comment.article}</td>
                      <td className="px-6 py-4 text-sm max-w-xs break-words">{comment.content}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs">
                        {(comment.pendingReportIds?.length ?? 0) > 0 ? (
                          <>
                            <span className="text-xs font-medium text-amber-800">
                              {comment.pendingReportIds!.length} report
                              {comment.pendingReportIds!.length === 1 ? "" : "s"}
                            </span>
                            {comment.pendingReportSummary ? (
                              <p className="mt-1 text-xs text-gray-700 whitespace-pre-wrap border rounded p-2 bg-amber-50/80">
                                {comment.pendingReportSummary}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {comment.status === "flagged" && (
                            <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700">Flagged</span>
                          )}
                          {(comment.pendingReportIds?.length ?? 0) > 0 && (
                            <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-800">
                              Reported
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedCommentDetail(comment)}
                          className="px-3 py-1 text-xs border border-slate-300 text-slate-800 rounded hover:bg-slate-50"
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === "categories" && (
          <div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowCategoryForm(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Category
              </button>
            </div>

            <div className="border rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Category</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Description</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Articles</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {categoriesFiltered.map((category) => (
                    <tr key={category.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-semibold">{category.name}</td>
                      <td className="px-6 py-4 text-sm">{category.description}</td>
                      <td className="px-6 py-4 text-sm">{category.articleCount}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            className="p-2 hover:bg-gray-100 rounded"
                            onClick={() => {
                              setEditingCategory(category);
                              setEditingCategoryForm({
                                name: category.name,
                                description: category.description ?? "",
                              });
                            }}
                          >
                            <Edit className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            className="p-2 hover:bg-gray-100 rounded"
                            onClick={() => {
                              setDeletingCategory(category);
                              setReassignCategoryId("");
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add Category Modal */}
            {showCategoryForm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-8 max-w-md w-full">
                  <h2 className="text-2xl font-semibold mb-4">Add New Category</h2>
                  <form onSubmit={handleCategorySubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Category Name *</label>
                      <input
                        type="text"
                        value={categoryForm.name}
                        onChange={(e) =>
                          setCategoryForm({ ...categoryForm, name: e.target.value })
                        }
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Description</label>
                      <textarea
                        value={categoryForm.description}
                        onChange={(e) =>
                          setCategoryForm({ ...categoryForm, description: e.target.value })
                        }
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setShowCategoryForm(false)}
                        className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Edit Category Modal */}
            {editingCategory && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-8 max-w-md w-full">
                  <h2 className="text-2xl font-semibold mb-4">Edit Category</h2>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const slug = editingCategoryForm.name
                        .toLowerCase()
                        .replace(/\s+/g, "-")
                        .replace(/[^a-z0-9-]/g, "");
                      if (!slug) {
                        alert("Category name must contain at least one letter or number.");
                        return;
                      }
                      try {
                        await updateCategory(editingCategory.id, {
                          name: editingCategoryForm.name,
                          slug,
                          description: editingCategoryForm.description || null,
                        });
                        const cats = await getCategories();
                        setCategoriesRaw(cats);
                        alert("Category updated.");
                        setEditingCategory(null);
                      } catch (err) {
                        alert((err as Error)?.message ?? "Failed to update category.");
                      }
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium mb-2">Category Name *</label>
                      <input
                        type="text"
                        value={editingCategoryForm.name}
                        onChange={(e) =>
                          setEditingCategoryForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Description</label>
                      <textarea
                        value={editingCategoryForm.description}
                        onChange={(e) =>
                          setEditingCategoryForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setEditingCategory(null)}
                        className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Delete / Reassign Category Modal */}
            {deletingCategory && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-8 max-w-md w-full space-y-4">
                  <h2 className="text-2xl font-semibold">Delete Category</h2>
                  {deletingCategory.articleCount > 0 ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        This category currently has {deletingCategory.articleCount} articles. Please
                        select another category to reassign them before deleting.
                      </p>
                      <select
                        value={reassignCategoryId}
                        onChange={(e) => setReassignCategoryId(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="">Select replacement category</option>
                        {categories
                          .filter((c) => c.id !== deletingCategory.id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This category has no linked articles. You can safely delete it.
                    </p>
                  )}
                  <div className="flex gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => setDeletingCategory(null)}
                      className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          if (deletingCategory.articleCount > 0) {
                            if (!reassignCategoryId) {
                              alert("Please select a replacement category.");
                              return;
                            }
                            await reassignCategoryArticles(
                              deletingCategory.id,
                              reassignCategoryId
                            );
                          }
                          await deleteCategory(deletingCategory.id);
                          const cats = await getCategories();
                          setCategoriesRaw(cats);
                          alert("Category deleted.");
                          setDeletingCategory(null);
                        } catch (err) {
                          alert((err as Error)?.message ?? "Failed to delete category.");
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      {deletingCategory.articleCount > 0 ? "Reassign & Delete" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Expert Applications Tab */}
        {activeTab === "experts" && (
          <div className="border rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Applicant</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Expertise</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Credentials</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Applied</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expertsFiltered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-sm text-muted-foreground text-center">
                      No pending expert applications. Approved and rejected applications are not listed here.
                    </td>
                  </tr>
                ) : (
                  expertsFiltered.map((expert) => (
                    <tr key={expert.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold">{expert.name}</p>
                          <p className="text-sm text-muted-foreground">{expert.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                          {expert.expertise}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm max-w-xs">
                        <p className="truncate">{expert.credentials}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{expert.appliedDate}</td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedExpert(expert)}
                          className="px-3 py-1 text-xs border rounded hover:bg-gray-100"
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Guest Landing Tab - edit intro slides and video (admin only) */}
        {activeTab === "guestLanding" && (
          <div className="border rounded-lg space-y-8">
            <div className="p-6">
              <h4 className="font-semibold mb-4">Intro &amp; feature slides</h4>
              <div className="space-y-4 mb-6">
                {editingIntroSlides.map((slide, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-gray-50 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Slide {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeIntroSlide(index)}
                        className="text-red-600 hover:underline text-sm flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" /> Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      value={slide.category}
                      onChange={(e) => updateIntroSlide(index, "category", e.target.value)}
                      placeholder="Category (e.g. Features)"
                      className="w-full px-3 py-2 border rounded text-sm"
                    />
                    <input
                      type="text"
                      value={slide.title}
                      onChange={(e) => updateIntroSlide(index, "title", e.target.value)}
                      placeholder="Title"
                      className="w-full px-3 py-2 border rounded text-sm"
                    />
                    <textarea
                      value={slide.excerpt}
                      onChange={(e) => updateIntroSlide(index, "excerpt", e.target.value)}
                      placeholder="Short description"
                      rows={2}
                      className="w-full px-3 py-2 border rounded text-sm"
                    />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Slide image</span>
                        {slide.imageUrl ? (
                          <button
                            type="button"
                            onClick={() => updateIntroSlide(index, "imageUrl", "")}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove image
                          </button>
                        ) : null}
                      </div>

                      <label
                        className="block w-full cursor-pointer rounded border border-dashed bg-white px-3 py-4 text-sm text-muted-foreground hover:bg-gray-50"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const file = e.dataTransfer.files?.[0] ?? null;
                          void handlePickSlideImage(index, file);
                        }}
                      >
                        <input
                          id={`${slideFileInputId}-${index}`}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => void handlePickSlideImage(index, e.target.files?.[0] ?? null)}
                        />
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-gray-800">Drag & drop an image</div>
                            <div className="text-xs text-muted-foreground">
                              or click to upload (PNG/JPG/WebP)
                            </div>
                          </div>
                          <div className="text-xs px-2 py-1 border rounded bg-gray-50 text-gray-700">
                            Upload
                          </div>
                        </div>
                      </label>

                      {slide.imageUrl ? (
                        <div className="rounded border bg-white overflow-hidden">
                          <img src={slide.imageUrl} alt={slide.title || `Slide ${index + 1}`} className="w-full h-40 object-cover" />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addIntroSlide}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add slide
              </button>
              <button
                type="button"
                onClick={handleSaveIntroSlides}
                className="ml-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Save intro slides
              </button>
            </div>

            <div className="p-6 border-t">
              <h4 className="font-semibold mb-4">Video section</h4>
              <div className="space-y-3 max-w-3xl">
                <input
                  type="text"
                  value={editingVideoSection.title}
                  onChange={(e) => setEditingVideoSection((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Section title"
                  className="w-full px-3 py-2 border rounded"
                />
                <textarea
                  value={editingVideoSection.description}
                  onChange={(e) => setEditingVideoSection((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Short description"
                  rows={2}
                  className="w-full px-3 py-2 border rounded"
                />
                <input
                  type="text"
                  value={editingVideoSection.videoUrl}
                  onChange={(e) => setEditingVideoSection((p) => ({ ...p, videoUrl: e.target.value }))}
                  placeholder="Paste YouTube link / embed URL / video ID"
                  className="w-full px-3 py-2 border rounded"
                />
                {editingVideoSection.videoUrl ? (
                  <div className="pt-2">
                    <div className="text-sm font-medium mb-2">Preview (admin)</div>
                    <div className="aspect-video w-full max-w-3xl rounded-lg overflow-hidden bg-black">
                      <iframe
                        title="Guest landing video preview"
                        src={getYouTubeEmbedUrl(editingVideoSection.videoUrl)}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Note: the guest landing sections only appear on the home page when you are logged out.
                    </div>
                  </div>
                ) : null}
              </div>
              {editingVideoSection.videoUrl ? (
                <div className="mt-0" />
              ) : null}
              <button
                type="button"
                onClick={handleSaveVideoSection}
                className="mt-6 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Save video section
              </button>
            </div>
          </div>
        )}

        {/* Flagged Content / Reports Tab */}
        {activeTab === "reports" && (
          <div className="border rounded-lg">
            {reportsError && (
              <div className="px-6 pt-6">
                <p className="text-sm text-red-700">{reportsError}</p>
              </div>
            )}
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Article</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Reported By</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Reason</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reportsFiltered.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-semibold">{report.article_title}</p>
                    </td>
                    <td className="px-6 py-4 text-sm">{report.reporter_email || "User"}</td>
                    <td className="px-6 py-4 text-sm">
                      {report.reason ?? "No reason provided"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          report.status === "pending"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {report.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => setSelectedReport(report)}
                        className="px-3 py-1 text-xs border border-slate-300 text-slate-800 rounded hover:bg-slate-50"
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                ))}
                {reportsFiltered.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-6 text-sm text-muted-foreground text-center"
                    >
                      No flagged articles at the moment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Flagged content: report detail (actions only in modal) */}
      {selectedReport && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeReportDetail}
          role="presentation"
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-report-detail-title"
          >
            <h2 id="admin-report-detail-title" className="text-xl font-semibold mb-2">
              Flagged article report
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Review the report below. Suspend hides the article from readers; Ignore marks the report resolved without changing the article.
            </p>

            <dl className="space-y-3 text-sm border-t pt-4">
              <div>
                <dt className="font-medium text-gray-700">Article</dt>
                <dd className="text-gray-900 font-semibold mt-0.5">{selectedReport.article_title}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Article ID</dt>
                <dd className="text-gray-900 font-mono text-xs break-all mt-0.5">{selectedReport.article_id}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Reported by</dt>
                <dd className="text-gray-900 mt-0.5">{selectedReport.reporter_email || "User"}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Reason</dt>
                <dd className="text-gray-900 whitespace-pre-wrap mt-0.5 border rounded-md p-3 bg-gray-50">
                  {selectedReport.reason?.trim() || "No reason provided."}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Status</dt>
                <dd className="mt-0.5">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      selectedReport.status === "pending"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {selectedReport.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Reported at</dt>
                <dd className="text-gray-900 mt-0.5">
                  {selectedReport.created_at
                    ? new Date(selectedReport.created_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t pt-4">
              <button
                type="button"
                onClick={closeReportDetail}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm order-2 sm:order-1"
              >
                Close
              </button>
              {selectedReport.status === "pending" ? (
                <div className="flex flex-wrap gap-2 order-1 sm:order-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await handleReportAction(
                        selectedReport.id,
                        selectedReport.article_id,
                        "ignore"
                      );
                      if (ok) closeReportDetail();
                    }}
                    className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
                  >
                    Ignore
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await handleReportAction(
                        selectedReport.id,
                        selectedReport.article_id,
                        "suspend"
                      );
                      if (ok) closeReportDetail();
                    }}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Suspend article
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground order-1 sm:order-2">
                  This report is already resolved. No further action is available.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comment moderation: detail (actions only in modal) */}
      {selectedCommentDetail && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeCommentDetail}
          role="presentation"
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-comment-detail-title"
          >
            <h2 id="admin-comment-detail-title" className="text-xl font-semibold mb-2">
              Comment details
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Review the comment and user reports below. Suspend hides the comment from the article; Dismiss reports
              marks user reports as reviewed without changing the comment; Delete removes it permanently.
            </p>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Who wrote this comment</h3>
              <p className="text-lg font-semibold text-gray-900">{selectedCommentDetail.author}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Commenter account ID:{" "}
                <span className="font-mono text-gray-800 break-all">{selectedCommentDetail.user_id}</span>
              </p>
            </div>

            <dl className="space-y-3 text-sm border-t pt-4">
              <div>
                <dt className="font-medium text-gray-700">Article</dt>
                <dd className="text-gray-900 mt-0.5">{selectedCommentDetail.article}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Comment ID</dt>
                <dd className="text-gray-900 font-mono text-xs break-all mt-0.5">{selectedCommentDetail.id}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Article ID</dt>
                <dd className="text-gray-900 font-mono text-xs break-all mt-0.5">{selectedCommentDetail.article_id}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700 mb-1">Comment</dt>
                <dd className="text-gray-900 whitespace-pre-wrap border rounded-md p-3 bg-gray-50 text-sm">
                  {selectedCommentDetail.content}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">User reports</dt>
                <dd className="mt-0.5">
                  <p className="text-xs text-muted-foreground mb-2">
                    Reporters stay anonymous here—we only show what they wrote, not their names or emails.
                  </p>
                  {(selectedCommentDetail.pendingReportIds?.length ?? 0) > 0 ? (
                    <>
                      <span className="text-xs font-medium text-amber-800">
                        {selectedCommentDetail.pendingReportIds!.length} pending report
                        {selectedCommentDetail.pendingReportIds!.length === 1 ? "" : "s"}
                      </span>
                      {selectedCommentDetail.pendingReportSummary ? (
                        <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap border rounded-md p-3 bg-amber-50/90">
                          {selectedCommentDetail.pendingReportSummary}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">None pending</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Status</dt>
                <dd className="mt-0.5 flex flex-wrap gap-1">
                  {selectedCommentDetail.status === "flagged" && (
                    <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700">Flagged</span>
                  )}
                  {(selectedCommentDetail.pendingReportIds?.length ?? 0) > 0 && (
                    <span className="px-2 py-1 rounded text-xs bg-amber-100 text-amber-800">Reported</span>
                  )}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t pt-4">
              <button
                type="button"
                onClick={closeCommentDetail}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm order-2 sm:order-1"
              >
                Close
              </button>
              <div className="flex flex-wrap gap-2 justify-end order-1 sm:order-2">
                {(selectedCommentDetail.pendingReportIds?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleDismissCommentReports(selectedCommentDetail.id);
                    }}
                    className="px-4 py-2 text-sm border border-amber-600 text-amber-900 rounded-lg hover:bg-amber-50"
                  >
                    Dismiss reports
                  </button>
                )}
                {selectedCommentDetail.status === "flagged" ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleCommentAction(selectedCommentDetail.id, "unsuspend");
                    }}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Unsuspend
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleCommentAction(selectedCommentDetail.id, "suspend");
                    }}
                    className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    Suspend
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    await handleCommentAction(selectedCommentDetail.id, "delete");
                  }}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User management: profile detail */}
      {selectedUserDetail && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeUserDetail}
          role="presentation"
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-user-detail-title"
          >
            <div className="flex items-start gap-4 mb-4">
              <UserAvatar
                avatar={selectedUserDetail.avatar}
                name={selectedUserDetail.name}
                size="lg"
                className="shrink-0"
              />
              <div className="min-w-0">
                <h2 id="admin-user-detail-title" className="text-xl font-semibold truncate">
                  {selectedUserDetail.name}
                </h2>
                <p className="text-sm text-muted-foreground break-all">{selectedUserDetail.email}</p>
              </div>
            </div>

            <dl className="space-y-3 text-sm border-t pt-4">
              <div>
                <dt className="font-medium text-gray-700">User ID</dt>
                <dd className="text-gray-900 font-mono text-xs break-all mt-0.5">{selectedUserDetail.id}</dd>
              </div>
              <div className="flex flex-wrap gap-4">
                <div>
                  <dt className="font-medium text-gray-700">Role</dt>
                  <dd className="text-gray-900 capitalize mt-0.5">{selectedUserDetail.role}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-700">Account status</dt>
                  <dd className="text-gray-900 capitalize mt-0.5">{selectedUserDetail.status}</dd>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div>
                  <dt className="font-medium text-gray-700">Gender</dt>
                  <dd className="text-gray-900 mt-0.5">{selectedUserDetail.gender ?? "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-700">Age</dt>
                  <dd className="text-gray-900 mt-0.5">
                    {selectedUserDetail.age != null ? selectedUserDetail.age : "—"}
                  </dd>
                </div>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Location</dt>
                <dd className="text-gray-900 mt-0.5">{selectedUserDetail.location?.trim() || "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Website</dt>
                <dd className="text-gray-900 mt-0.5 break-all">
                  {(() => {
                    const w = selectedUserDetail.website?.trim();
                    if (!w) return "—";
                    const href =
                      w.startsWith("http://") || w.startsWith("https://") ? w : `https://${w}`;
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-600 hover:underline"
                      >
                        {w}
                      </a>
                    );
                  })()}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Email verified</dt>
                <dd className="text-gray-900 mt-0.5">
                  {selectedUserDetail.email_verified_at
                    ? new Date(selectedUserDetail.email_verified_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Joined</dt>
                <dd className="text-gray-900 mt-0.5">
                  {selectedUserDetail.joined ??
                    (selectedUserDetail.created_at
                      ? new Date(selectedUserDetail.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—")}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Last updated</dt>
                <dd className="text-gray-900 mt-0.5">
                  {selectedUserDetail.updated_at
                    ? new Date(selectedUserDetail.updated_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700 mb-1">Interests</dt>
                <dd className="text-gray-900">
                  {userDetailInterestsLoading ? (
                    <span className="text-muted-foreground">Loading…</span>
                  ) : userDetailInterests.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {userDetailInterests.map((name) => (
                        <li
                          key={name}
                          className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded text-xs border border-blue-100"
                        >
                          {name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t pt-4">
              <button
                type="button"
                onClick={closeUserDetail}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm order-2 sm:order-1"
              >
                Close
              </button>
              <div className="flex flex-wrap gap-2 order-1 sm:order-2">
                {selectedUserDetail.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => handleUserAction(selectedUserDetail.id, "suspend")}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Suspend
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUserAction(selectedUserDetail.id, "unsuspend")}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Unsuspend
                  </button>
                )}
                {selectedUserDetail.role === "expert" && (
                  <button
                    type="button"
                    onClick={() => handleRevokeExpert(selectedUserDetail.id)}
                    className="px-4 py-2 text-sm border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
                  >
                    Revoke Expert
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content moderation: article preview (no navigation away from dashboard) */}
      {previewArticleId && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeArticlePreview}
          role="presentation"
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-article-preview-title"
          >
            <div className="shrink-0 px-6 pt-6 pb-4 flex items-start justify-between gap-4 border-b border-gray-100">
              <h2 id="admin-article-preview-title" className="text-xl font-semibold">
                Article preview
              </h2>
              <button
                type="button"
                onClick={closeArticlePreview}
                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 shrink-0"
              >
                Close
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
              {previewArticleLoading && (
                <p className="text-sm text-muted-foreground py-8 text-center">Loading article…</p>
              )}
              {previewArticleError && !previewArticleLoading && (
                <p className="text-sm text-red-600 py-4">{previewArticleError}</p>
              )}

              {previewArticle && !previewArticleLoading && (
                <div className="space-y-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`px-2 py-1 rounded font-medium ${
                        previewArticle.status === "published"
                          ? "bg-green-100 text-green-800"
                          : previewArticle.status === "flagged"
                            ? "bg-red-100 text-red-800"
                            : "bg-orange-100 text-orange-800"
                      }`}
                    >
                      {articleModerationStatusLabel(previewArticle.status)}
                    </span>
                    {previewArticle.category?.name && (
                      <span className="text-muted-foreground">{previewArticle.category.name}</span>
                    )}
                  </div>
                  <h3 className="text-2xl font-semibold text-gray-900">{previewArticle.title}</h3>
                  <p className="text-muted-foreground">
                    By {previewArticle.author_display_name ?? "Unknown author"}
                    {previewArticle.tags?.length ? (
                      <span className="block mt-1 text-xs">
                        Tags: {previewArticle.tags.join(", ")}
                      </span>
                    ) : null}
                  </p>
                  {previewArticle.excerpt?.trim() && (
                    <p className="text-gray-700 border-l-4 border-gray-200 pl-3 italic">
                      {previewArticle.excerpt}
                    </p>
                  )}
                  {previewArticle.image_url && (
                    <div className="rounded-lg overflow-hidden border">
                      <img
                        src={previewArticle.image_url}
                        alt={previewArticle.title}
                        className="w-full max-h-64 object-cover"
                      />
                    </div>
                  )}
                  {previewArticle.status === "rejected" && previewArticle.rejection_reason?.trim() && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-900">
                      <span className="font-semibold">Rejection reason: </span>
                      {previewArticle.rejection_reason}
                    </div>
                  )}
                  <div
                    className="prose prose-sm sm:prose-base max-w-none text-gray-900"
                    dangerouslySetInnerHTML={{ __html: previewArticle.content || "" }}
                  />
                </div>
              )}
            </div>

            {previewArticle && !previewArticleLoading && (
              <div className="shrink-0 border-t px-6 py-3 flex flex-wrap gap-2 bg-gray-50">
                {previewArticle.status === "flagged" ? (
                  <button
                    type="button"
                    onClick={() => handleArticleAction(previewArticle.id, "unsuspend")}
                    className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Unsuspend
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleArticleAction(previewArticle.id, "suspend")}
                    className="px-3 py-1.5 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                  >
                    Suspend
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleArticleAction(previewArticle.id, "delete")}
                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expert application detail modal */}
      {selectedExpert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-semibold mb-2">Expert Application Details</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Review the full details before approving or rejecting this application.
            </p>

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-medium text-gray-700">Applicant</dt>
                <dd className="text-gray-900">
                  {selectedExpert.name}{" "}
                  {selectedExpert.email && (
                    <span className="text-muted-foreground text-xs block">{selectedExpert.email}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Expertise</dt>
                <dd className="text-gray-900">{selectedExpert.expertise}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Applied</dt>
                <dd className="text-gray-900">{selectedExpert.appliedDate || "—"}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Status</dt>
                <dd className="text-gray-900 capitalize">{selectedExpert.status}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700 mb-1">Credentials & Experience</dt>
                <dd className="whitespace-pre-wrap text-gray-900 border rounded-md p-3 bg-gray-50">
                  {selectedExpert.credentials || "No details provided."}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
              <button
                type="button"
                onClick={() => setSelectedExpert(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm order-2 sm:order-1"
              >
                Close
              </button>
              {selectedExpert.status === "pending" ? (
                <div className="flex gap-2 order-1 sm:order-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedExpert) return;
                      const ok = await handleExpertAction(selectedExpert.id, "reject");
                      if (ok) setSelectedExpert(null);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedExpert) return;
                      const ok = await handleExpertAction(selectedExpert.id, "approve");
                      if (ok) setSelectedExpert(null);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    Approve
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground order-1 sm:order-2">
                  This application was already reviewed. Approve and reject are not available.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}