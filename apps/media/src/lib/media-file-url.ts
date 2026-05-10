const INLINE_MEDIA_FILE_ROUTE = "/api/media-file";

export type MediaFileKind = "transcript" | "notes";

export function getInlineMediaFileUrl(
  sourceUrl: string | null,
  kind: MediaFileKind
): string | null {
  if (!sourceUrl || sourceUrl.startsWith("data:")) {
    return sourceUrl;
  }

  const params = new URLSearchParams({
    kind,
    url: sourceUrl,
  });

  return `${INLINE_MEDIA_FILE_ROUTE}?${params.toString()}`;
}
