export const articlePlaceholderImage = "/images/article-placeholder.svg";

export function buildArticleImageUrl(fileName: string) {
  return `/api/article-images/${encodeURIComponent(fileName)}`;
}

export function parseArticleImageFileName(imageUrl: string | null | undefined) {
  if (!imageUrl?.startsWith("/api/article-images/")) {
    return null;
  }

  const encodedFileName = imageUrl.slice("/api/article-images/".length);
  return decodeURIComponent(encodedFileName);
}
