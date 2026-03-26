/**
 * Database types matching Supabase schema (fyi_news_release_system).
 * Generate with: npx supabase gen types typescript --project-id YOUR_REF > src/lib/types/database.ts
 * Or keep this hand-written for prototype.
 */
export type UserRole = "guest" | "free" | "premium" | "expert" | "admin";
export type UserStatus = "active" | "suspended";
export type ArticleStatus = "draft" | "pending" | "published" | "rejected" | "flagged";
export type CommentStatus = "active" | "flagged";
export type TestimonialStatus = "pending" | "approved" | "rejected";
export type ReportStatus = "pending" | "reviewed";
export type ExpertApplicationStatus = "pending" | "approved" | "rejected";
export type ExpertReviewDecision = "approved" | "rejected";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: UserRole;
          avatar: string | null;
          gender: string | null;
          age: number | null;
          location: string | null;
          website: string | null;
          status: UserStatus;
          email_verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          role?: UserRole;
          avatar?: string | null;
          gender?: string | null;
          age?: number | null;
          location?: string | null;
          website?: string | null;
          status?: UserStatus;
          email_verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
      };
      user_interests: {
        Row: { user_id: string; category_id: string };
        Insert: { user_id: string; category_id: string };
        Update: Partial<Database["public"]["Tables"]["user_interests"]["Insert"]>;
      };
      articles: {
        Row: {
          id: string;
          category_id: string | null;
          author_id: string | null;
          title: string;
          excerpt: string | null;
          content: string | null;
          image_url: string | null;
          author_display_name: string | null;
          author_bio: string | null;
          status: ArticleStatus;
          credibility_score: number | null;
          is_verified: boolean;
          expert_reviewer_id: string | null;
          published_at: string | null;
          submitted_at: string | null;
          rejection_reason: string | null;
          views: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          author_id?: string | null;
          title: string;
          excerpt?: string | null;
          content?: string | null;
          image_url?: string | null;
          author_display_name?: string | null;
          author_bio?: string | null;
          status?: ArticleStatus;
          credibility_score?: number | null;
          is_verified?: boolean;
          expert_reviewer_id?: string | null;
          published_at?: string | null;
          submitted_at?: string | null;
          rejection_reason?: string | null;
          views?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["articles"]["Insert"]>;
      };
      article_credibility_analysis: {
        Row: {
          id: string;
          article_id: string;
          score: number;
          source_quality: number | null;
          factual_accuracy: number | null;
          expert_review_score: number | null;
          citations_score: number | null;
          author_credibility_score: number | null;
          strengths: unknown;
          concerns: unknown;
          warnings: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          score: number;
          source_quality?: number | null;
          factual_accuracy?: number | null;
          expert_review_score?: number | null;
          citations_score?: number | null;
          author_credibility_score?: number | null;
          strengths?: unknown;
          concerns?: unknown;
          warnings?: unknown;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["article_credibility_analysis"]["Insert"]>;
      };
      expert_reviews: {
        Row: {
          id: string;
          article_id: string;
          expert_id: string;
          credibility_score: number;
          factual_accuracy: number | null;
          rating: number | null;
          comments: string | null;
          flagged: boolean;
          decision: ExpertReviewDecision;
          reviewed_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          expert_id: string;
          credibility_score: number;
          factual_accuracy?: number | null;
          rating?: number | null;
          comments?: string | null;
          flagged?: boolean;
          decision: ExpertReviewDecision;
          reviewed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["expert_reviews"]["Insert"]>;
      };
      comments: {
        Row: {
          id: string;
          article_id: string;
          user_id: string;
          content: string;
          likes: number;
          status: CommentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          user_id: string;
          content: string;
          likes?: number;
          status?: CommentStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Insert"]>;
      };
      bookmarks: {
        Row: { user_id: string; article_id: string; created_at: string };
        Insert: { user_id: string; article_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["bookmarks"]["Insert"]>;
      };
      article_reports: {
        Row: {
          id: string;
          article_id: string;
          user_id: string;
          reason: string | null;
          status: ReportStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          user_id: string;
          reason?: string | null;
          status?: ReportStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["article_reports"]["Insert"]>;
      };
      testimonials: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          role: string;
          message: string;
          rating: number;
          status: TestimonialStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          role: string;
          message: string;
          rating: number;
          status?: TestimonialStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["testimonials"]["Insert"]>;
      };
      guest_landing_settings: {
        Row: {
          id: string;
          video_title: string;
          video_description: string | null;
          video_url: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          video_title?: string;
          video_description?: string | null;
          video_url?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guest_landing_settings"]["Insert"]>;
      };
      intro_slides: {
        Row: {
          id: string;
          sort_order: number;
          category: string;
          title: string;
          excerpt: string;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sort_order: number;
          category: string;
          title: string;
          excerpt: string;
          image_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["intro_slides"]["Insert"]>;
      };
      expert_applications: {
        Row: {
          id: string;
          user_id: string;
          expertise: string;
          credentials: string;
          status: ExpertApplicationStatus;
          applied_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          expertise: string;
          credentials: string;
          status?: ExpertApplicationStatus;
          applied_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["expert_applications"]["Insert"]>;
      };
      featured_articles: {
        Row: { article_id: string; sort_order: number; featured_at: string };
        Insert: { article_id: string; sort_order: number; featured_at?: string };
        Update: Partial<Database["public"]["Tables"]["featured_articles"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience types
export type UserRow = Database["public"]["Tables"]["users"]["Row"];
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
export type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];
export type CommentRow = Database["public"]["Tables"]["comments"]["Row"];
export type TestimonialRow = Database["public"]["Tables"]["testimonials"]["Row"];
export type BookmarkRow = Database["public"]["Tables"]["bookmarks"]["Row"];
