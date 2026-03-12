import { Clock, Sparkles, Flag, CheckCircle, Eye, MessageCircle } from "lucide-react";
import { Link } from "react-router";
import { useUser } from "../context/UserContext";

interface ArticleCardProps {
  id: string;
  imageUrl: string;
  category: string;
  title: string;
  excerpt: string;
  author: string;
  time: string;
  variant?: "horizontal" | "vertical" | "compact";
  views?: number;
  commentsCount?: number;
  credibilityScore?: number;
  isVerified?: boolean;
}

export function ArticleCard({ 
  id,
  imageUrl, 
  category, 
  title, 
  excerpt, 
  author, 
  time,
  variant = "vertical",
  views,
  commentsCount,
  credibilityScore,
  isVerified
}: ArticleCardProps) {
  const { user } = useUser();

  if (variant === "compact") {
    return (
      <article className="group border border-gray-200 bg-white text-xs">
        <Link
          to={`/article/${id}`}
          className="block aspect-[4/2.5] bg-gray-200 border-b border-gray-200 overflow-hidden"
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-gray-400 text-[10px]">
              No image
            </span>
          )}
        </Link>
        <div className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase border border-black px-1.5 py-0.5">
              {category}
            </span>
            {isVerified && (
              <CheckCircle
                className="w-3 h-3 text-blue-600"
                title="Verified by Expert"
              />
            )}
            {credibilityScore && (
              <span className="text-[10px] font-bold">
                {credibilityScore}% Credible
              </span>
            )}
          </div>
          <Link to={`/article/${id}`}>
            <h3 className="font-semibold mb-1 line-clamp-2 group-hover:underline text-sm">
              {title}
            </h3>
          </Link>
          <p className="text-[11px] text-muted-foreground mb-2 line-clamp-2">
            {excerpt}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>By {author}</span>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{time}</span>
            </div>
            {typeof views === "number" && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  <span>{views}</span>
                </div>
              </>
            )}
            {typeof commentsCount === "number" && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" />
                  <span>{commentsCount}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </article>
    );
  }

  if (variant === "horizontal") {
    return (
      <article className="flex gap-4 group border-b pb-3">
        <Link to={`/article/${id}`} className="w-32 h-24 flex-shrink-0 bg-gray-200 border border-gray-300 overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-gray-400 text-xs">[IMG]</span>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase border border-black px-2 py-0.5">
              {category}
            </span>
            {isVerified && (
              <CheckCircle className="w-4 h-4 text-blue-600" title="Verified by Expert" />
            )}
            {credibilityScore && (
              <span className="text-xs font-bold">
                {credibilityScore}% Credible
              </span>
            )}
          </div>
          <Link to={`/article/${id}`}>
            <h3 className="font-bold mb-1 line-clamp-2 group-hover:underline">
              {title}
            </h3>
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{author}</span>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{time}</span>
            </div>
            {typeof views === "number" && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  <span>{views}</span>
                </div>
              </>
            )}
            {typeof commentsCount === "number" && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" />
                  <span>{commentsCount}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group border border-gray-300 bg-white">
      <Link to={`/article/${id}`} className="block aspect-[4/3] bg-gray-200 border-b border-gray-300 overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No image</span>
        )}
      </Link>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold uppercase border border-black px-2 py-0.5">
            {category}
          </span>
          {isVerified && (
            <CheckCircle className="w-4 h-4 text-blue-600" title="Verified by Expert" />
          )}
          {credibilityScore && (
            <span className="text-xs font-bold">
              {credibilityScore}% Credible
            </span>
          )}
        </div>
        <Link to={`/article/${id}`}>
          <h3 className="font-bold mb-2 line-clamp-2 group-hover:underline">
            {title}
          </h3>
        </Link>
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {excerpt}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>By {author}</span>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{time}</span>
          </div>
          {typeof views === "number" && (
            <>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                <span>{views}</span>
              </div>
            </>
          )}
          {typeof commentsCount === "number" && (
            <>
              <span>•</span>
              <div className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                <span>{commentsCount}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}