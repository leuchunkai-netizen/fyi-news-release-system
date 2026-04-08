/** Escape text for embedding in HTML (title, byline). Body is stored as author HTML. */
function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface OfflineArticlePayload {
  title: string;
  author_display_name: string | null;
  published_at: string | null;
  excerpt: string | null;
  content: string | null;
  image_url: string | null;
  siteName?: string;
}

/** Resolve relative / protocol-relative image URLs so fetch() can load them. */
function resolveImageUrl(src: string): string {
  const t = src.trim();
  if (!t) return t;
  if (typeof window === "undefined") return t;
  try {
    if (t.startsWith("//")) return `${window.location.protocol}${t}`;
    if (t.startsWith("/")) return `${window.location.origin}${t}`;
    if (/^https?:\/\//i.test(t)) return t;
    return new URL(t, window.location.href).href;
  } catch {
    return t;
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Fetch image and return data URL, or null if CORS/network blocks it. */
export async function tryFetchImageAsDataUrl(imageUrl: string): Promise<string | null> {
  const url = resolveImageUrl(imageUrl);
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

/**
 * Replace <img src="http..."> in HTML with data: URLs where fetch succeeds,
 * so the saved file works offline (no network needed for those images).
 */
export async function inlineRemoteImagesInHtmlFragment(html: string): Promise<string> {
  if (!html.trim() || typeof window === "undefined") return html;
  const wrapped = `<div id="__offline_root">${html}</div>`;
  const doc = new DOMParser().parseFromString(wrapped, "text/html");
  const root = doc.getElementById("__offline_root");
  if (!root) return html;

  const imgs = root.querySelectorAll("img[src]");
  await Promise.all(
    Array.from(imgs).map(async (img) => {
      const src = img.getAttribute("src")?.trim();
      if (!src || src.startsWith("data:")) return;
      const dataUrl = await tryFetchImageAsDataUrl(src);
      if (dataUrl) img.setAttribute("src", dataUrl);
    })
  );
  return root.innerHTML;
}

function heroImgSrcForHtml(url: string): string {
  const t = url.trim();
  if (t.startsWith("data:image/")) return t;
  return escapeHtmlText(t);
}

/** Build a self-contained HTML file for offline reading (open in any browser). */
export function buildOfflineArticleHtml(a: OfflineArticlePayload): string {
  const title = escapeHtmlText(a.title || "Article");
  const byline = escapeHtmlText(a.author_display_name ?? "Unknown author");
  const date = a.published_at
    ? escapeHtmlText(new Date(a.published_at).toLocaleString())
    : "";
  const excerpt = a.excerpt?.trim()
    ? `<p class="excerpt">${escapeHtmlText(a.excerpt)}</p>`
    : "";
  const heroSrc = a.image_url?.trim();
  const hero = heroSrc
    ? `<figure class="hero"><img src="${heroImgSrcForHtml(heroSrc)}" alt="" /></figure>`
    : "";
  const body = a.content?.trim() ? `<div class="body">${a.content}</div>` : "<p><em>No content.</em></p>";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; color: #111; line-height: 1.6; }
    .meta { color: #555; font-size: 0.95rem; margin-bottom: 1rem; }
    h1 { font-size: 1.75rem; line-height: 1.25; margin-bottom: 0.5rem; }
    .excerpt { font-style: italic; color: #444; }
    .hero img { width: 100%; height: auto; border-radius: 6px; }
    .body { margin-top: 1rem; }
    .body img { max-width: 100%; height: auto; }
    footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: 0.8rem; color: #888; }
  </style>
</head>
<body>
  <article>
    <h1>${title}</h1>
    <p class="meta">${byline}${date ? ` · ${date}` : ""}</p>
    ${excerpt}
    ${hero}
    ${body}
  </article>
  <footer>Saved for offline reading${a.siteName ? ` · ${escapeHtmlText(a.siteName)}` : ""}. Images are embedded when your browser can load them (some external hosts block this).</footer>
</body>
</html>`;
}

/** Build HTML with images inlined where possible, then trigger download. */
export async function downloadOfflineArticleFile(a: OfflineArticlePayload, filenameBase?: string) {
  const [contentInlined, heroDataUrl] = await Promise.all([
    inlineRemoteImagesInHtmlFragment(a.content ?? ""),
    a.image_url ? tryFetchImageAsDataUrl(a.image_url) : Promise.resolve(null),
  ]);

  const imageUrlForFile = heroDataUrl ?? a.image_url ?? null;

  const html = buildOfflineArticleHtml({
    ...a,
    content: contentInlined,
    image_url: imageUrlForFile,
  });

  const raw = filenameBase || a.title || "article";
  const safe = raw.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 80).trim() || "article";
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safe}.html`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
