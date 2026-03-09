import { useState, useEffect } from "react";
import { Shield, Upload as UploadIcon, CheckCircle } from "lucide-react";
import { useUser } from "../context/UserContext";
import { Link } from "react-router";
import { upsertUserProfile, getCurrentUserWithInterests } from "../../lib/api/auth";
import { setUserInterests } from "../../lib/api/userInterests";
import { submitExpertApplication } from "../../lib/api/expertApplications";
import { supabase } from "../../lib/supabase";

const EXPERTISE_LABELS: Record<string, string> = {
  medicine: "Medicine & Healthcare",
  science: "Science & Research",
  technology: "Technology & Engineering",
  economics: "Economics & Finance",
  law: "Law & Legal Studies",
  journalism: "Journalism & Media",
  other: "Other",
};

export function ProfilePage() {
  const { user, setUser } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [showExpertApplication, setShowExpertApplication] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    location: "",
    website: "",
    gender: user?.gender || "",
    interests: (user?.interests || []) as string[]
  });
  const [expertApplication, setExpertApplication] = useState({
    expertise: "",
    credentials: "",
    experience: "",
    proofDocument: null as File | null
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [expertSubmitting, setExpertSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: user.name,
        email: user.email,
        gender: user.gender || "",
        interests: user.interests || [],
      }));
    }
  }, [user?.id]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold mb-4">Please Sign In</h1>
        <p className="text-muted-foreground mb-6">
          You need to be logged in to view your profile.
        </p>
        <Link to="/login" className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 inline-block">
          Sign In
        </Link>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileSaving(true);
    try {
      await upsertUserProfile({
        id: user.id,
        email: formData.email,
        name: formData.name,
        gender: formData.gender || null,
      });
      if (formData.interests.length) {
        await setUserInterests(user.id, formData.interests);
      }
      const data = await getCurrentUserWithInterests();
      if (data) {
        setUser({
          id: data.profile.id,
          name: data.profile.name,
          email: data.profile.email,
          role: data.profile.role as "guest" | "free" | "premium" | "expert" | "admin",
          avatar: data.profile.avatar ?? undefined,
          gender: data.profile.gender ?? undefined,
          interests: data.interests.length ? data.interests : undefined,
        });
      }
      setIsEditing(false);
      alert("Profile updated successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleExpertApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const expertiseLabel = EXPERTISE_LABELS[expertApplication.expertise] || expertApplication.expertise;
    const credentials = [expertApplication.credentials, expertApplication.experience].filter(Boolean).join("\n\n");
    setExpertSubmitting(true);
    try {
      await submitExpertApplication(user.id, expertiseLabel, credentials);
      setShowExpertApplication(false);
      setExpertApplication({ expertise: "", credentials: "", experience: "", proofDocument: null });
      alert("Expert verification application submitted! We'll review it within 5-7 business days.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit application.");
    } finally {
      setExpertSubmitting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExpertApplication({ ...expertApplication, proofDocument: file });
    }
  };

  const handleCancelSubscription = async () => {
    if (!user) return;
    try {
      await supabase.from("users").update({ role: "free" }).eq("id", user.id);
      setUser({ ...user, role: "free" });
      setShowCancelModal(false);
      alert("Your subscription has been cancelled. You now have free tier access.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to cancel subscription.");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("New password and confirmation do not match.");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      alert("New password must be at least 6 characters.");
      return;
    }
    if (!passwordForm.currentPassword) {
      alert("Please enter your current password.");
      return;
    }
    setIsChangingPassword(true);
    try {
      await supabase.auth.updateUser({ password: passwordForm.newPassword });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      alert("Password updated successfully.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-semibold mb-8">Profile Settings</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Profile Card */}
            <div className="border rounded-lg p-6">
              <div className="text-center mb-4">
                <div className="w-24 h-24 bg-gray-300 rounded-full mx-auto mb-4" />
                <h2 className="font-semibold">{user.name}</h2>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                {user.gender && (
                  <p className="text-xs text-muted-foreground mt-1">{user.gender}</p>
                )}
                <div className="mt-2">
                  {user.role === "free" && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                      Free Member
                    </span>
                  )}
                  {user.role === "premium" && (
                    <span className="px-3 py-1 bg-yellow-500 text-white text-xs rounded-full">
                      Premium Member
                    </span>
                  )}
                  {user.role === "expert" && (
                    <span className="px-3 py-1 bg-blue-600 text-white text-xs rounded-full flex items-center gap-1 justify-center">
                      <Shield className="w-3 h-3" />
                      Verified Expert
                    </span>
                  )}
                  {user.role === "admin" && (
                    <span className="px-3 py-1 bg-purple-600 text-white text-xs rounded-full">
                      Administrator
                    </span>
                  )}
                </div>
              </div>
              <button className="w-full px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">
                Change Photo
              </button>
            </div>

            {/* Account Actions */}
            <div className="border rounded-lg p-6 space-y-3">
              <h3 className="font-semibold mb-4">Account Actions</h3>
              {user.role === "free" && (
                <Link
                  to="/subscription"
                  className="block w-full px-4 py-2 bg-yellow-500 text-white text-center rounded-lg hover:bg-yellow-600"
                >
                  Upgrade to Premium
                </Link>
              )}
              {user.role === "premium" && user.role !== "expert" && (
                <button
                  onClick={() => setShowExpertApplication(true)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Apply as Expert
                </button>
              )}
              <Link
                to="/testimonials/submit"
                className="block w-full px-4 py-2 border rounded-lg hover:bg-gray-50 text-center text-sm"
              >
                Submit Testimonial
              </Link>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Personal Information</h2>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-sm text-red-600 hover:underline"
                >
                  {isEditing ? "Cancel" : "Edit"}
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 disabled:bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 disabled:bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 disabled:bg-gray-50 text-sm"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Interests</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    These are used to personalize your feed. Click to add or remove.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["World News","Politics","Business","Technology","Sports","Science","Health","Culture","Entertainment","Environment"].map((interest) => {
                      const active = formData.interests.includes(interest);
                      return (
                        <button
                          key={interest}
                          type="button"
                          disabled={!isEditing}
                          onClick={() => {
                            if (!isEditing) return;
                            setFormData({
                              ...formData,
                              interests: active
                                ? formData.interests.filter((i) => i !== interest)
                                : [...formData.interests, interest],
                            });
                          }}
                          className={`px-3 py-1 rounded-full text-xs border ${
                            active ? "bg-red-50 border-red-600 text-red-700" : "border-gray-200 text-gray-700"
                          } ${!isEditing ? "opacity-60 cursor-default" : "hover:bg-gray-50"}`}
                        >
                          {interest}
                        </button>
                      );
                    })}
                    {formData.interests.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        No interests selected yet.
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 disabled:bg-gray-50"
                    placeholder="City, Country"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Website</label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 disabled:bg-gray-50"
                    placeholder="https://..."
                  />
                </div>

                {isEditing && (
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {profileSaving ? "Saving…" : "Save Changes"}
                  </button>
                )}
              </form>
            </div>

            {/* Password */}
            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-6">Password</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Change your password. You will need to sign in again after updating.
              </p>
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium mb-2">Current password</label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                    placeholder="Enter current password"
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">New password</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Confirm new password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
                >
                  {isChangingPassword ? "Updating…" : "Update password"}
                </button>
              </form>
            </div>

            {/* Subscription Management - Premium Users */}
            {user.role === "premium" && (
              <div className="border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-6">Subscription Management</h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">Premium Plan</p>
                      <p className="text-sm text-muted-foreground">$9.99/month</p>
                    </div>
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded">
                      Active
                    </span>
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-2">Next billing date: March 19, 2026</p>
                    <div className="flex gap-2">
                      <Link
                        to="/subscription/checkout?update=1"
                        className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm inline-block"
                      >
                        Update payment method
                      </Link>
                      <button
                        type="button"
                        onClick={() => setShowCancelModal(true)}
                        className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm"
                      >
                        Cancel Subscription
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Expert Application Modal */}
        {showExpertApplication && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-semibold mb-4">Apply for Expert Verification</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Become a verified expert to review and verify articles in your field of expertise.
              </p>

              <form onSubmit={handleExpertApplication} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Area of Expertise *</label>
                  <select
                    value={expertApplication.expertise}
                    onChange={(e) => setExpertApplication({ ...expertApplication, expertise: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  >
                    <option value="">Select your field</option>
                    <option value="medicine">Medicine & Healthcare</option>
                    <option value="science">Science & Research</option>
                    <option value="technology">Technology & Engineering</option>
                    <option value="economics">Economics & Finance</option>
                    <option value="law">Law & Legal Studies</option>
                    <option value="journalism">Journalism & Media</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Credentials *</label>
                  <textarea
                    value={expertApplication.credentials}
                    onChange={(e) => setExpertApplication({ ...expertApplication, credentials: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    rows={3}
                    placeholder="List your degrees, certifications, licenses..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Professional Experience *</label>
                  <textarea
                    value={expertApplication.experience}
                    onChange={(e) => setExpertApplication({ ...expertApplication, experience: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    rows={4}
                    placeholder="Describe your relevant work experience..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Upload Proof of Expertise *</label>
                  <div className="border-2 border-dashed rounded-lg p-6">
                    <div className="flex flex-col items-center">
                      <UploadIcon className="w-10 h-10 text-gray-400 mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Upload credentials, diplomas, or certificates
                      </p>
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        accept=".pdf,.jpg,.jpeg,.png"
                        required
                        className="text-sm"
                      />
                      {expertApplication.proofDocument && (
                        <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          {expertApplication.proofDocument.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowExpertApplication(false)}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={expertSubmitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {expertSubmitting ? "Submitting…" : "Submit Application"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cancel Subscription Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-8 max-w-md w-full">
              <h2 className="text-2xl font-semibold mb-4">Cancel Subscription</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to cancel your premium subscription? You'll lose access to:
              </p>
              <ul className="list-disc list-inside mb-6 text-sm space-y-2">
                <li>AI-powered article summaries</li>
                <li>Bookmark articles for later</li>
                <li>Social media sharing features</li>
                <li>Ad-free reading experience</li>
              </ul>
              <p className="text-sm text-muted-foreground mb-6">
                Your premium access will continue until <strong>March 19, 2026</strong>.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Keep Premium
                </button>
                <button
                  onClick={handleCancelSubscription}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Yes, Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}