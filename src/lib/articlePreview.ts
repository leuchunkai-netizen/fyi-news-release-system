/** Card / list preview: use excerpt when set; otherwise plain text from HTML body. */
export function previewTextFromArticle(
  excerpt: string | null | undefined,
  content: string | null | undefined,
  maxLen = 180
): string {
  const ex = excerpt?.trim();
  if (ex) return ex.length <= maxLen ? ex : `${ex.slice(0, maxLen).trim()}…`;
  const plain = String(content ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  return plain.length <= maxLen ? plain : `${plain.slice(0, maxLen).trim()}…`;
}
