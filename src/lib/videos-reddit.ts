import { upsertVideoItem } from "@/lib/video-items-store";

export type RedditPost = {
  id: string;
  subreddit: string;
  title: string;
  permalink: string;
  url?: string;
  author?: string;
  created_utc?: number;
  score?: number;
  over_18?: boolean;
  is_video?: boolean;
  media?: {
    reddit_video?: {
      fallback_url?: string;
    };
    oembed?: {
      thumbnail_url?: string;
    };
  };
  secure_media?: {
    reddit_video?: {
      fallback_url?: string;
    };
    oembed?: {
      thumbnail_url?: string;
    };
  };
  post_hint?: string;
  preview?: {
    images?: Array<{ source?: { url?: string } }>;
  };
  thumbnail?: string;
};

type RedditListing = {
  data?: {
    children?: Array<{
      data?: RedditPost;
    }>;
  };
};

export type NormalizedRedditVideo = {
  sourceId: string;
  subreddit: string;
  title: string;
  postUrl: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  author: string | null;
  publishedAt: Date;
  score: number | null;
  nsfw: boolean;
};

export type RedditRefreshSummary = {
  subreddits: string[];
  processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  failedSubreddits?: string[];
};

const REDDIT_BASE = "https://www.reddit.com";
const USER_AGENT = "storewatch-inspiration/1.0 (+https://localhost)";

export function parseRedditSubreddits(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return [...new Set(
    value
      .split(/[,\s]+/)
      .map((s) => s.trim().replace(/^r\//i, "").replace(/^\/?r\//i, ""))
      .filter(Boolean),
  )];
}

export function dedupeNormalizedVideos(rows: NormalizedRedditVideo[]): NormalizedRedditVideo[] {
  const seen = new Set<string>();
  const out: NormalizedRedditVideo[] = [];
  for (const row of rows) {
    if (seen.has(row.sourceId)) continue;
    seen.add(row.sourceId);
    out.push(row);
  }
  return out;
}

function decodeHtml(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export function normalizeRedditPostToVideo(post: RedditPost): NormalizedRedditVideo | null {
  const sourceId = (post.id ?? "").trim();
  const subreddit = (post.subreddit ?? "").trim();
  const title = (post.title ?? "").trim();
  const permalink = (post.permalink ?? "").trim();
  if (!sourceId || !subreddit || !title || !permalink) return null;

  const postUrl = permalink.startsWith("http") ? permalink : `${REDDIT_BASE}${permalink}`;
  const redditVideoUrl =
    post.secure_media?.reddit_video?.fallback_url ?? post.media?.reddit_video?.fallback_url ?? null;
  const isLikelyVideo =
    Boolean(redditVideoUrl) ||
    post.is_video === true ||
    post.post_hint === "hosted:video" ||
    post.post_hint === "rich:video";
  if (!isLikelyVideo) return null;

  const embedUrl = redditVideoUrl;
  const previewThumb = post.preview?.images?.[0]?.source?.url
    ? decodeHtml(post.preview.images[0].source.url)
    : null;
  const thumbnailUrl =
    previewThumb ||
    post.secure_media?.oembed?.thumbnail_url ||
    post.media?.oembed?.thumbnail_url ||
    (post.thumbnail?.startsWith("http") ? post.thumbnail : null) ||
    null;
  const publishedAt = post.created_utc ? new Date(post.created_utc * 1000) : new Date();

  return {
    sourceId,
    subreddit,
    title,
    postUrl,
    embedUrl,
    thumbnailUrl,
    author: post.author?.trim() || null,
    publishedAt,
    score: typeof post.score === "number" ? post.score : null,
    nsfw: post.over_18 === true,
  };
}

export async function fetchLatestRedditVideosForSubreddit(
  subreddit: string,
  limit: number,
): Promise<NormalizedRedditVideo[]> {
  const safeSub = encodeURIComponent(subreddit);
  const url = `${REDDIT_BASE}/r/${safeSub}/new.json?limit=${Math.max(1, Math.min(100, limit))}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`Reddit HTTP ${res.status} for r/${subreddit}`);
  const data = (await res.json()) as RedditListing;
  const posts = data.data?.children?.map((c) => c.data).filter(Boolean) as RedditPost[];
  return posts.map(normalizeRedditPostToVideo).filter((x): x is NormalizedRedditVideo => Boolean(x));
}

export async function refreshRedditVideoItems(): Promise<RedditRefreshSummary> {
  const subreddits = parseRedditSubreddits(process.env.VIDEOS_REDDIT_SUBREDDITS);
  if (subreddits.length === 0) {
    return { subreddits: [], processed: 0, inserted: 0, updated: 0, skipped: 0 };
  }
  const limit = Number(process.env.VIDEOS_REDDIT_LIMIT_PER_SUB ?? "20") || 20;
  const includeNsfw = process.env.VIDEOS_INCLUDE_NSFW === "1";

  let processed = 0;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const failedSubreddits: string[] = [];

  for (const sub of subreddits) {
    let rows: NormalizedRedditVideo[] = [];
    try {
      rows = dedupeNormalizedVideos(await fetchLatestRedditVideosForSubreddit(sub, limit));
    } catch (error) {
      console.error(`Failed to fetch subreddit r/${sub}`, error);
      failedSubreddits.push(sub);
      continue;
    }
    for (const row of rows) {
      if (!includeNsfw && row.nsfw) {
        skipped += 1;
        continue;
      }
      processed += 1;
      try {
        const upserted = await upsertVideoItem({
          source: "REDDIT",
          ...row,
        });
        if (upserted.existed) updated += 1;
        else inserted += 1;
      } catch (error) {
        console.error(`Failed to upsert video item ${row.sourceId}`, error);
        skipped += 1;
      }
    }
  }

  return { subreddits, processed, inserted, updated, skipped, failedSubreddits };
}
