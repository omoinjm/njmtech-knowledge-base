export type Platform = "youtube" | "tiktok" | "instagram" | "twitter" | "vimeo" | "unknown";

export interface MediaItem {
  id: string;
  url: string;
  platform: Platform;
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  authorName: string | null;
  transcriptUrl: string | null;
  notesUrl: string | null;
  category: string | null;
  tags: string[];
  createdAt: string;
}
