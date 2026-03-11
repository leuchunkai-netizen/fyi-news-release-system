import { createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { SubscriptionPage } from "./pages/SubscriptionPage";
import { SubscriptionPaymentPage } from "./pages/SubscriptionPaymentPage";
import { ArticleDetailPage } from "./pages/ArticleDetailPage";
import { UploadArticlePage } from "./pages/UploadArticlePage";
import { MyArticlesPage } from "./pages/MyArticlesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ExpertDashboard } from "./pages/ExpertDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { SearchPage } from "./pages/SearchPage";
import { BookmarksPage } from "./pages/BookmarksPage";
import { SubmitTestimonialPage } from "./pages/SubmitTestimonialPage";
import { EmailVerificationPage } from "./pages/EmailVerificationPage";
import { BillingPage } from "./pages/BillingPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: HomePage },
      { path: "login", Component: LoginPage },
      { path: "signup", Component: SignupPage },
      { path: "verify-email", Component: EmailVerificationPage },
      { path: "subscription", Component: SubscriptionPage },
      { path: "subscription/checkout", Component: SubscriptionPaymentPage },
      { path: "article/:id", Component: ArticleDetailPage },
      { path: "upload-article", Component: UploadArticlePage },
      { path: "my-articles", Component: MyArticlesPage },
      { path: "profile", Component: ProfilePage },
      { path: "expert-dashboard", Component: ExpertDashboard },
      { path: "admin", Component: AdminDashboard },
      { path: "search", Component: SearchPage },
      { path: "bookmarks", Component: BookmarksPage },
      { path: "category/:category", Component: HomePage },
      { path: "billing", Component: BillingPage },
      { path: "subscription-manage", Component: SubscriptionPage },
      { path: "testimonials/submit", Component: SubmitTestimonialPage },
    ],
  },
]);
