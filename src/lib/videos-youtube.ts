import { upsertVideoItem } from "@/lib/video-items-store";

export type YouTubeRefreshSummary = {
  channels: string[];
  processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  failedChannels?: string[];
};

type YouTubeVideo = {
  sourceId: string;
  channel: string;
  title: string;
  postUrl: string;
  embedUrl: string;
  thumbnailUrl: string | null;
  author: string | null;
  publishedAt: Date;
};

const YT_BASE = "https://www.youtube.com";

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function parseYouTubeChannels(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return [...new Set(value.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean))];
}

async function resolveChannelId(input: string): Promise<{ channelId: string; label: string }> {
  const normalized = input.startsWith("http") ? input : `${YT_BASE}/${input.replace(/^\//, "")}`;
  const url = normalized.replace(/\/+$/, "");
  const feedMatch = url.match(/[?&]channel_id=([A-Za-z0-9_-]+)/i);
  if (feedMatch) return { channelId: feedMatch[1], label: feedMatch[1] };
  if (/^UC[A-Za-z0-9_-]+$/.test(input)) return { channelId: input, label: input };

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`YouTube channel HTTP ${res.status}: ${url}`);
  const html = await res.text();

  const idFromJson = html.match(/"channelId":"(UC[^"]+)"/)?.[1];
  const idFromMeta = html.match(/<meta itemprop="identifier" content="(UC[^"]+)"/)?.[1];
  const channelId = idFromJson ?? idFromMeta;
  if (!channelId) throw new Error(`Could not resolve channel id from ${url}`);

  const handle = html.match(/"canonicalBaseUrl":"(\/@[^"]+)"/)?.[1]?.replace(/^\//, "");
  return { channelId, label: handle ?? channelId };
}

async function fetchLatestVideosForChannel(channelId: string, label: string, limit: number): Promise<YouTubeVideo[]> {
  const url = `${YT_BASE}/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const res = await fetch(url, { next: { revalidate: 900 } });
  if (!res.ok) throw new Error(`YouTube feed HTTP ${res.status} for ${channelId}`);
  const xml = await res.text();

  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]).slice(0, limit);
  return entries
    .map((entry): YouTubeVideo | null => {
      const sourceId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]?.trim();
      const title = decodeXml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "");
      const publishedRaw = entry.match(/<published>([^<]+)<\/published>/)?.[1]?.trim();
      const postUrl = entry.match(/<link rel="alternate" href="([^"]+)"/)?.[1]?.trim();
      const author = decodeXml(entry.match(/<name>([\s\S]*?)<\/name>/)?.[1]?.trim() ?? "");
      if (!sourceId || !title || !publishedRaw || !postUrl) return null;
      return {
        sourceId,
        channel: label,
        title,
        postUrl,
        embedUrl: `${YT_BASE}/embed/${sourceId}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${sourceId}/hqdefault.jpg`,
        author: author || null,
        publishedAt: new Date(publishedRaw),
      };
    })
    .filter((x): x is YouTubeVideo => Boolean(x));
}

export async function refreshYouTubeVideoItems(): Promise<YouTubeRefreshSummary> {
  const channels = parseYouTubeChannels(process.env.VIDEOS_YOUTUBE_CHANNELS);
  if (channels.length === 0) {
    return { channels: [], processed: 0, inserted: 0, updated: 0, skipped: 0 };
  }

  const limit = Number(process.env.VIDEOS_YOUTUBE_LIMIT_PER_CHANNEL ?? "12") || 12;
  let processed = 0;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const failedChannels: string[] = [];

  for (const ch of channels) {
    let resolved: { channelId: string; label: string };
    try {
      resolved = await resolveChannelId(ch);
    } catch (error) {
      console.error(`Failed to resolve YouTube channel ${ch}`, error);
      failedChannels.push(ch);
      continue;
    }

    let videos: YouTubeVideo[] = [];
    try {
      videos = await fetchLatestVideosForChannel(resolved.channelId, resolved.label, limit);
    } catch (error) {
      console.error(`Failed to fetch YouTube videos for ${ch}`, error);
      failedChannels.push(ch);
      continue;
    }

    for (const video of videos) {
      processed += 1;
      try {
        const upserted = await upsertVideoItem({
          source: "YOUTUBE",
          sourceId: video.sourceId,
          subreddit: video.channel,
          title: video.title,
          postUrl: video.postUrl,
          embedUrl: video.embedUrl,
          thumbnailUrl: video.thumbnailUrl,
          author: video.author,
          publishedAt: video.publishedAt,
          score: null,
          nsfw: false,
        });
        if (upserted.existed) updated += 1;
        else inserted += 1;
      } catch (error) {
        console.error(`Failed to upsert YouTube video ${video.sourceId}`, error);
        skipped += 1;
      }
    }
  }

  return { channels, processed, inserted, updated, skipped, failedChannels };
}
