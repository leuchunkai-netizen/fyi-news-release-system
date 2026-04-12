import { supabase } from "./supabase";

// Must exactly match your Supabase bucket name
const ARTICLE_IMAGES_BUCKET = "article_image";

/**
 * Upload an article image file to Supabase Storage and return a public URL.
 * Assumes you have a public bucket called "article_image".
 */
export async function uploadArticleImage(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const safeExt = ext.toLowerCase().split("?")[0];
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;

  const { data, error } = await supabase.storage
    .from(ARTICLE_IMAGES_BUCKET)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error || !data) {
    throw error ?? new Error("Failed to upload image");
  }

  const { data: publicUrlData } = supabase.storage.from(ARTICLE_IMAGES_BUCKET).getPublicUrl(data.path);
  if (!publicUrlData?.publicUrl) {
    throw new Error("Failed to get public URL for uploaded image");
  }

  return publicUrlData.publicUrl;
}

/**
 * Upload a guest landing slide image to Supabase Storage and return a public URL.
 * Reuses the existing "article_image" bucket.
 */
export async function uploadGuestSlideImage(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const safeExt = ext.toLowerCase().split("?")[0];
  const fileName = `guest-slides/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;

  const { data, error } = await supabase.storage
    .from(ARTICLE_IMAGES_BUCKET)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error || !data) {
    throw error ?? new Error("Failed to upload slide image");
  }

  const { data: publicUrlData } = supabase.storage.from(ARTICLE_IMAGES_BUCKET).getPublicUrl(data.path);
  if (!publicUrlData?.publicUrl) {
    throw new Error("Failed to get public URL for uploaded slide image");
  }

  return publicUrlData.publicUrl;
}

/**
 * Upload expert verification proof (image or PDF) to Storage and return a public URL.
 * Uses the same bucket as article images; path prefix keeps objects grouped for admins.
 */
export async function uploadExpertProofDocument(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const safeExt = ext.toLowerCase().split("?")[0];
  const fileName = `expert-applications/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;

  const { data, error } = await supabase.storage
    .from(ARTICLE_IMAGES_BUCKET)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error || !data) {
    throw error ?? new Error("Failed to upload proof document");
  }

  const { data: publicUrlData } = supabase.storage.from(ARTICLE_IMAGES_BUCKET).getPublicUrl(data.path);
  if (!publicUrlData?.publicUrl) {
    throw new Error("Failed to get public URL for proof document");
  }

  return publicUrlData.publicUrl;
}
