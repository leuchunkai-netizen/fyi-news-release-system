import { useState, useEffect, useMemo } from "react";
import { Users, FileText, MessageSquare, Tag, Ban, Search, Plus, Edit, Trash2, Shield, LayoutDashboard } from "lucide-react";
import { useUser } from "../context/UserContext";
import { useGuestLanding, type IntroSlide, type VideoSection } from "../context/GuestLandingContext";
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
  updateUserStatus,
  updateArticleStatus,
  deleteArticle,
  updateCommentStatus,
  deleteComment,
  updateExpertApplicationStatus,
  createCategory,
} from "@/lib/api/admin";
import type { CategoryRow } from "@/lib/types/database";

interface CategoryWithCount extends CategoryRow {
  articleCount: number;
}

export function AdminDashboard() {
  const { user } = useUser();
  const { introSlides, videoSection, setIntroSlides, setVideoSection } = useGuestLanding();
  const [activeTab, setActiveTab] = useState<"users" | "articles" | "comments" | "categories" | "experts" | "guestLanding">("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [editingIntroSlides, setEditingIntroSlides] = useState<IntroSlide[]>([]);
  const [editingVideoSection, setEditingVideoSection] = useState<VideoSection>({ title: "", description: "", videoUrl: "" });

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [expertApplications, setExpertApplications] = useState<AdminExpertApplication[]>([]);
  const [categoriesRaw, setCategoriesRaw] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    setLoading(true);
    Promise.all([
      getAdminUsers().catch(() => []),
      getAdminArticles().catch(() => []),
      getAdminComments().catch(() => []),
      getAdminExpertApplications().catch(() => []),
      getCategories().catch(() => []),
    ])
      .then(([u, a, c, e, cat]) => {
        setUsers(u);
        setArticles(a);
        setComments(c);
        setExpertApplications(e);
        setCategoriesRaw(cat);
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
  const commentsFiltered = searchTerm.trim() ? comments.filter((c) => c.content.toLowerCase().includes(searchTerm.toLowerCase()) || c.author.toLowerCase().includes(searchTerm.toLowerCase())) : comments;
  const expertsFiltered = searchTerm.trim() ? expertApplications.filter((e) => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.expertise.toLowerCase().includes(searchTerm.toLowerCase())) : expertApplications;
  const categoriesFiltered = searchTerm.trim() ? categories.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase())) : categories;

  const handleUserAction = async (userId: string, action: "suspend" | "unsuspend") => {
    try {
      await updateUserStatus(userId, action === "suspend" ? "suspended" : "active");
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: action === "suspend" ? "suspended" : "active" } : u))
      );
      alert(`User ${action === "suspend" ? "suspended" : "unsuspended"}.`);
    } catch (err) {
      alert((err as Error)?.message ?? "Action failed.");
    }
  };

  const handleArticleAction = async (articleId: string, action: "suspend" | "delete") => {
    try {
      if (action === "delete") {
        await deleteArticle(articleId);
        setArticles((prev) => prev.filter((a) => a.id !== articleId));
        alert("Article deleted.");
      } else {
        await updateArticleStatus(articleId, "flagged");
        setArticles((prev) =>
          prev.map((a) => (a.id === articleId ? { ...a, status: "flagged" } : a))
        );
        alert("Article flagged.");
      }
    } catch (err) {
      alert((err as Error)?.message ?? "Action failed.");
    }
  };

  const handleCommentAction = async (commentId: string, action: "suspend" | "delete") => {
    try {
      if (action === "delete") {
        await deleteComment(commentId);
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        alert("Comment deleted.");
      } else {
        await updateCommentStatus(commentId, "flagged");
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, status: "flagged" } : c))
        );
        alert("Comment flagged.");
      }
    } catch (err) {
      alert((err as Error)?.message ?? "Action failed.");
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

  const handleExpertAction = async (expertId: string, action: "approve" | "reject") => {
    try {
      await updateExpertApplicationStatus(expertId, action, user?.id);
      setExpertApplications((prev) =>
        prev.map((e) => (e.id === expertId ? { ...e, status: action } : e))
      );
      alert(
        action === "approve"
          ? "Expert application approved. User now has expert role."
          : "Expert application rejected."
      );
    } catch (err) {
      alert((err as Error)?.message ?? "Action failed.");
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
      await updateGuestLandingSettings({
        video_title: editingVideoSection.title,
        video_description: editingVideoSection.description || null,
        video_url: editingVideoSection.videoUrl || null,
      });
      setVideoSection(editingVideoSection);
      alert("Video section saved.");
    } catch (err) {
      alert((err as Error)?.message ?? "Failed to save video section.");
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
    setEditingIntroSlides((prev) => [...prev, { category: "Features", title: "", excerpt: "" }]);
  };

  const removeIntroSlide = (index: number) => {
    setEditingIntroSlides((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-semibold mb-8">Admin Dashboard</h1>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
            <p className="text-sm text-muted-foreground">Total Comments</p>
          </div>
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-2xl font-bold">{loading ? "—" : expertApplications.filter((e) => e.status === "pending").length}</p>
            <p className="text-sm text-muted-foreground">Pending Expert Applications</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b mb-6">
          <div className="flex gap-4">
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
              Comments
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
              Categories
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
              Expert Applications
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
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleUserAction(u.id, u.status === "active" ? "suspend" : "unsuspend")
                          }
                          className={`px-3 py-1 text-xs rounded ${
                            u.status === "active"
                              ? "bg-red-600 text-white hover:bg-red-700"
                              : "bg-green-600 text-white hover:bg-green-700"
                          }`}
                        >
                          {u.status === "active" ? "Suspend" : "Unsuspend"}
                        </button>
                      </div>
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
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {article.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{article.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleArticleAction(article.id, "suspend")}
                          className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                        >
                          Suspend
                        </button>
                        <button
                          onClick={() => handleArticleAction(article.id, "delete")}
                          className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
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
                  <th className="px-6 py-3 text-left text-sm font-semibold">Author</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Article</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Comment</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {commentsFiltered.map((comment) => (
                  <tr key={comment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold">{comment.author}</td>
                    <td className="px-6 py-4 text-sm">{comment.article}</td>
                    <td className="px-6 py-4 text-sm">{comment.content}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          comment.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {comment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCommentAction(comment.id, "suspend")}
                          className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                        >
                          Suspend
                        </button>
                        <button
                          onClick={() => handleCommentAction(comment.id, "delete")}
                          className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
                          <button className="p-2 hover:bg-gray-100 rounded">
                            <Edit className="w-4 h-4 text-blue-600" />
                          </button>
                          <button className="p-2 hover:bg-gray-100 rounded">
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
          </div>
        )}

        {/* Expert Applications Tab */}
        {activeTab === "experts" && (
          <div className="border rounded-lg">
            <div className="p-6 bg-blue-50 border-b">
              <h3 className="font-semibold text-blue-900 mb-2">Expert Verification Applications</h3>
              <p className="text-sm text-blue-700">
                Review and approve users who have applied for expert verification status. Experts can review and verify articles in their field of expertise.
              </p>
            </div>
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
                {expertsFiltered.map((expert) => (
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleExpertAction(expert.id, "approve")}
                          className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleExpertAction(expert.id, "reject")}
                          className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Reject
                        </button>
                        <button
                          className="px-3 py-1 text-xs border rounded hover:bg-gray-100"
                        >
                          View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Guest Landing Tab - edit intro slides and video (admin only) */}
        {activeTab === "guestLanding" && (
          <div className="border rounded-lg space-y-8">
            <div className="p-6 bg-amber-50 border-b">
              <h3 className="font-semibold text-amber-900 mb-2">Guest home page content</h3>
              <p className="text-sm text-amber-800">
                This content is shown only to visitors who are not logged in. Edit the intro/feature slides and the video section below.
              </p>
            </div>

            <div className="p-6">
              <h4 className="font-semibold mb-4">Intro &amp; feature slides</h4>
              <p className="text-sm text-muted-foreground mb-4">
                These slides replace breaking news for guests. Order is preserved.
              </p>
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
              <p className="text-sm text-muted-foreground mb-4">
                Optional intro video for guests. Use a full embed URL (e.g. https://www.youtube.com/embed/VIDEO_ID) or a YouTube video ID.
              </p>
              <div className="space-y-3 max-w-xl">
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
                  placeholder="YouTube embed URL or video ID"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveVideoSection}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Save video section
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}