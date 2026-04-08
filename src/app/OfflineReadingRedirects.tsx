import { Navigate, useParams } from "react-router";

/** Old URL `/offline-reading` — feature removed; send users to reading history + download HTML there. */
export function RedirectOfflineReadingToHistory() {
  return <Navigate to="/reading-history" replace />;
}

/** Old URL `/offline-reading/article/:articleId` — redirect to live article (user can use Download HTML). */
export function RedirectOfflineArticleToArticle() {
  const { articleId } = useParams<{ articleId: string }>();
  if (!articleId) return <Navigate to="/reading-history" replace />;
  return <Navigate to={`/article/${articleId}`} replace />;
}
