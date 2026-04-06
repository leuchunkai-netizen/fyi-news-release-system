import { Link, useParams } from "react-router";

const PAGE_CONTENT: Record<string, { title: string; body: string }> = {
  about: {
    title: "About Us",
    body: "FYI News Release System helps readers discover credible stories, follow categories they care about, and engage with a community-driven review workflow.",
  },
  contact: {
    title: "Contact",
    body: "Need help or want to reach the team? Email us at support@fyi-news.local and we will get back to you as soon as possible.",
  },
  careers: {
    title: "Careers",
    body: "We are always looking for thoughtful builders, editors, and reviewers. Share your resume and interest at careers@fyi-news.local.",
  },
  privacy: {
    title: "Privacy Policy",
    body: "We value your privacy. Your profile and activity data are used to personalize your experience and improve platform safety.",
  },
  terms: {
    title: "Terms of Service",
    body: "By using this platform, you agree to follow community guidelines, applicable laws, and fair-use content policies.",
  },
};

export function SiteInfoPage() {
  const { slug } = useParams<{ slug: string }>();
  const page = PAGE_CONTENT[slug ?? ""];

  if (!page) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold mb-3">Page not found</h1>
        <Link to="/" className="text-red-600 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold mb-4">{page.title}</h1>
        <p className="text-muted-foreground">{page.body}</p>
      </div>
    </div>
  );
}
