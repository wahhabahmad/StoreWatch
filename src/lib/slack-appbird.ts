/**
 * Fetch Slack channel messages and extract iOS App Store ids + Android package names
 * from Appbird-style posts (links, plain text). Adjust regexes if message format differs.
 */

import { prisma } from "@/lib/db";
import { ingestWatchedApp } from "@/lib/ingest";
import { fetchItunesSnapshot } from "@/lib/itunes";
import { fetchPlayStoreSnapshot } from "@/lib/play-store";

const SLACK_API = "https://slack.com/api";

export type ParsedAppCandidate = {
  platform: "IOS" | "ANDROID";
  externalId: string;
};

/** Extract candidates from one message body (text + attachment fallback). */
export function extractAppCandidatesFromText(text: string): ParsedAppCandidate[] {
  const seen = new Set<string>();
  const out: ParsedAppCandidate[] = [];

  const add = (platform: "IOS" | "ANDROID", externalId: string) => {
    const key = `${platform}:${externalId}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ platform, externalId });
  };

  // iOS: App Store / iTunes URLs with /id123456789
  const iosUrlRe = /(?:apps\.apple\.com|itunes\.apple\.com)[^\s]*\/id(\d{6,})/gi;
  let m: RegExpExecArray | null;
  while ((m = iosUrlRe.exec(text)) !== null) {
    add("IOS", m[1]);
  }

  // Android: Play Store details?id=
  const playIdRe =
    /play\.google\.com\/store\/apps\/details\?[^\s]*[&?]id=([a-zA-Z][a-zA-Z0-9._]*)/gi;
  while ((m = playIdRe.exec(text)) !== null) {
    add("ANDROID", m[1]);
  }
  const marketIdRe = /market:\/\/details\?[^\s]*id=([a-zA-Z][a-zA-Z0-9._]*)/gi;
  while ((m = marketIdRe.exec(text)) !== null) {
    add("ANDROID", m[1]);
  }

  // Plain package names (reverse-domain style), including non-com roots like arcade.foo.bar.
  const pkgRe = /\b([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,})\b/gi;
  const domainTailBlacklist = new Set(["com", "net", "org", "io", "app", "ai", "co", "dev"]);
  while ((m = pkgRe.exec(text)) !== null) {
    const pkg = m[1];
    const parts = pkg.split(".");
    const tail = parts[parts.length - 1]?.toLowerCase() ?? "";
    // Drop likely web domains (example.com) while keeping package ids (com.foo.app).
    if (domainTailBlacklist.has(tail) && parts[0]?.toLowerCase() !== "com") continue;
    add("ANDROID", pkg);
  }

  return out;
}

type SlackMessage = {
  ts?: string;
  text?: string;
  attachments?: { text?: string; fallback?: string }[];
};

function messageToPlainText(msg: SlackMessage): string {
  const parts: string[] = [];
  if (msg.text) parts.push(msg.text);
  if (msg.attachments?.length) {
    for (const a of msg.attachments) {
      if (a.text) parts.push(a.text);
      else if (a.fallback) parts.push(a.fallback);
    }
  }
  return parts.join("\n");
}

/** Split comma- or whitespace-separated Slack channel ids (e.g. `C111,C222,C333`). */
export function parseSlackChannelIdsList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[,]+|\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function collectCandidatesFromMessages(messages: SlackMessage[]): ParsedAppCandidate[] {
  const seen = new Set<string>();
  const candidates: ParsedAppCandidate[] = [];
  for (const msg of messages) {
    const plain = messageToPlainText(msg);
    for (const c of extractAppCandidatesFromText(plain)) {
      const key = `${c.platform}:${c.externalId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(c);
    }
  }
  return candidates;
}

export async function fetchChannelHistory(
  botToken: string,
  channelId: string,
  options?: { limit?: number; oldest?: string },
): Promise<SlackMessage[]> {
  const limit = Math.min(options?.limit ?? 100, 200);
  const params = new URLSearchParams({
    channel: channelId,
    limit: String(limit),
  });
  if (options?.oldest) params.set("oldest", options.oldest);

  const url = `${SLACK_API}/conversations.history?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${botToken}` },
    cache: "no-store",
  });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    messages?: SlackMessage[];
  };
  if (!data.ok) {
    throw new Error(data.error ?? "Slack API error");
  }
  return data.messages ?? [];
}

export type SlackAppbirdIngestResult = {
  channelId: string;
  messagesFetched: number;
  candidates: ParsedAppCandidate[];
  created: number;
  skippedDuplicate: number;
  ingestErrors: number;
};

export type SlackAppbirdChannelSlice = {
  channelId: string;
  messagesFetched: number;
  candidatesExtracted: number;
};

export type SlackAppbirdMultiIngestResult = {
  channels: SlackAppbirdChannelSlice[];
  /** Unique app ids across all channels (after cross-channel dedupe). */
  candidates: ParsedAppCandidate[];
  created: number;
  skippedDuplicate: number;
  ingestErrors: number;
};

export type SlackAppbirdPreviewChannel = {
  channelId: string;
  messagesFetched: number;
  candidatesExtracted: number;
  iosCandidates: number;
  androidCandidates: number;
};

export type SlackAppbirdPreviewResult = {
  channels: SlackAppbirdPreviewChannel[];
  totalCandidates: number;
  iosCandidates: number;
  androidCandidates: number;
};

export type SlackAppbirdCatalogRow = {
  platform: "IOS" | "ANDROID";
  externalId: string;
  title: string;
  category: string | null;
  developerName: string | null;
  iconUrl: string | null;
  storeUrl: string;
  screenshots: string[];
  firstSeenAt: Date | null;
  channels: string[];
};

export type SlackAppbirdCatalogResult = {
  channels: SlackAppbirdPreviewChannel[];
  rows: SlackAppbirdCatalogRow[];
  totalParsedCandidates: number;
};

type CatalogCacheEntry = {
  key: string;
  expiresAt: number;
  value: Promise<SlackAppbirdCatalogResult>;
};

let catalogCache: CatalogCacheEntry | null = null;

async function persistCandidates(
  candidates: ParsedAppCandidate[],
  options: { isGame: boolean; trackDownloadMilestones: boolean },
): Promise<{ created: number; skippedDuplicate: number; ingestErrors: number }> {
  let created = 0;
  let skippedDuplicate = 0;
  let ingestErrors = 0;
  const { isGame, trackDownloadMilestones } = options;

  for (const c of candidates) {
    try {
      const app = await prisma.watchedApp.create({
        data: {
          platform: c.platform,
          externalId: c.externalId,
          isGame,
          trackDownloadMilestones,
        },
      });
      created += 1;
      try {
        await ingestWatchedApp(app.id);
      } catch {
        ingestErrors += 1;
      }
    } catch (e: unknown) {
      const code =
        e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      if (code === "P2002") skippedDuplicate += 1;
      else throw e;
    }
  }

  return { created, skippedDuplicate, ingestErrors };
}

/**
 * Pull recent channel messages, parse app ids, create WatchedApp rows (games), run ingest.
 * Idempotent: duplicate (platform, externalId) is skipped.
 */
export async function ingestAppbirdChannel(options: {
  botToken: string;
  channelId: string;
  messageLimit?: number;
  isGame?: boolean;
  trackDownloadMilestones?: boolean;
}): Promise<SlackAppbirdIngestResult> {
  const {
    botToken,
    channelId,
    messageLimit = 100,
    isGame = true,
    trackDownloadMilestones = true,
  } = options;

  const messages = await fetchChannelHistory(botToken, channelId, {
    limit: messageLimit,
  });
  const candidates = collectCandidatesFromMessages(messages);
  const { created, skippedDuplicate, ingestErrors } = await persistCandidates(candidates, {
    isGame,
    trackDownloadMilestones,
  });

  return {
    channelId,
    messagesFetched: messages.length,
    candidates,
    created,
    skippedDuplicate,
    ingestErrors,
  };
}

/**
 * Same as {@link ingestAppbirdChannel} but fetches several channels and dedupes candidates
 * across them before creating watchlist rows (an app mentioned in two channels is added once).
 */
export async function ingestAppbirdChannels(options: {
  botToken: string;
  channelIds: string[];
  messageLimit?: number;
  isGame?: boolean;
  trackDownloadMilestones?: boolean;
}): Promise<SlackAppbirdMultiIngestResult> {
  const {
    botToken,
    channelIds,
    messageLimit = 100,
    isGame = true,
    trackDownloadMilestones = true,
  } = options;

  if (channelIds.length === 0) {
    return { channels: [], candidates: [], created: 0, skippedDuplicate: 0, ingestErrors: 0 };
  }

  const channels: SlackAppbirdChannelSlice[] = [];
  const mergedSeen = new Set<string>();
  const candidates: ParsedAppCandidate[] = [];

  for (const channelId of channelIds) {
    const messages = await fetchChannelHistory(botToken, channelId, {
      limit: messageLimit,
    });
    const fromChannel = collectCandidatesFromMessages(messages);
    for (const c of fromChannel) {
      const key = `${c.platform}:${c.externalId}`;
      if (mergedSeen.has(key)) continue;
      mergedSeen.add(key);
      candidates.push(c);
    }
    channels.push({
      channelId,
      messagesFetched: messages.length,
      candidatesExtracted: fromChannel.length,
    });
  }

  const { created, skippedDuplicate, ingestErrors } = await persistCandidates(candidates, {
    isGame,
    trackDownloadMilestones,
  });

  return {
    channels,
    candidates,
    created,
    skippedDuplicate,
    ingestErrors,
  };
}

/** Read-only channel summary for dashboard UI (does not write DB / trigger ingest). */
export async function previewAppbirdChannels(options: {
  botToken: string;
  channelIds: string[];
  messageLimit?: number;
}): Promise<SlackAppbirdPreviewResult> {
  const { botToken, channelIds, messageLimit = 50 } = options;
  const channels: SlackAppbirdPreviewChannel[] = [];
  const mergedSeen = new Set<string>();
  const mergedCandidates: ParsedAppCandidate[] = [];

  for (const channelId of channelIds) {
    const messages = await fetchChannelHistory(botToken, channelId, {
      limit: messageLimit,
    });
    const candidates = collectCandidatesFromMessages(messages);
    const iosCandidates = candidates.filter((c) => c.platform === "IOS").length;
    const androidCandidates = candidates.length - iosCandidates;
    channels.push({
      channelId,
      messagesFetched: messages.length,
      candidatesExtracted: candidates.length,
      iosCandidates,
      androidCandidates,
    });

    for (const c of candidates) {
      const key = `${c.platform}:${c.externalId}`;
      if (mergedSeen.has(key)) continue;
      mergedSeen.add(key);
      mergedCandidates.push(c);
    }
  }

  const iosTotal = mergedCandidates.filter((c) => c.platform === "IOS").length;
  const androidTotal = mergedCandidates.length - iosTotal;

  return {
    channels,
    totalCandidates: mergedCandidates.length,
    iosCandidates: iosTotal,
    androidCandidates: androidTotal,
  };
}

function parseSlackTs(ts: string | undefined): Date | null {
  if (!ts) return null;
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(Math.floor(n * 1000));
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<U>,
): Promise<U[]> {
  const out = new Array<U>(items.length);
  let i = 0;
  const run = async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, () => run()),
  );
  return out;
}

/**
 * Build a rich app catalog from Slack messages:
 * - reads channel history
 * - extracts app ids/package names
 * - fetches store metadata (title, icon, screenshots, category, developer, link)
 */
export async function fetchAppbirdCatalog(options: {
  botToken: string;
  channelIds: string[];
  messageLimit?: number;
  storeConcurrency?: number;
}): Promise<SlackAppbirdCatalogResult> {
  const {
    botToken,
    channelIds,
    messageLimit = 100,
    storeConcurrency = 8,
  } = options;
  const cacheTtlMs = Number(process.env.SLACK_APPBIRD_CATALOG_CACHE_MS ?? "300000") || 300000;
  const cacheKey = JSON.stringify({
    channelIds: [...channelIds].sort(),
    messageLimit,
    storeConcurrency,
  });
  const now = Date.now();
  if (catalogCache && catalogCache.key === cacheKey && catalogCache.expiresAt > now) {
    return catalogCache.value;
  }

  const work = (async (): Promise<SlackAppbirdCatalogResult> => {
  const channels: SlackAppbirdPreviewChannel[] = [];
  const merged = new Map<
    string,
    { candidate: ParsedAppCandidate; firstSeenAt: Date | null; channels: Set<string> }
  >();

  const channelHistories = await Promise.all(
    channelIds.map(async (channelId) => ({
      channelId,
      messages: await fetchChannelHistory(botToken, channelId, { limit: messageLimit }),
    })),
  );

  for (const { channelId, messages } of channelHistories) {
    let iosCandidates = 0;
    let androidCandidates = 0;
    let candidatesExtracted = 0;
    for (const msg of messages) {
      const plain = messageToPlainText(msg);
      const found = extractAppCandidatesFromText(plain);
      const seenAt = parseSlackTs(msg.ts);
      for (const c of found) {
        candidatesExtracted += 1;
        if (c.platform === "IOS") iosCandidates += 1;
        else androidCandidates += 1;
        const key = `${c.platform}:${c.externalId}`;
        const existing = merged.get(key);
        if (existing) {
          existing.channels.add(channelId);
          if (
            seenAt &&
            (!existing.firstSeenAt || seenAt.getTime() > existing.firstSeenAt.getTime())
          ) {
            existing.firstSeenAt = seenAt;
          }
          continue;
        }
        merged.set(key, {
          candidate: c,
          firstSeenAt: seenAt,
          channels: new Set([channelId]),
        });
      }
    }
    channels.push({
      channelId,
      messagesFetched: messages.length,
      candidatesExtracted,
      iosCandidates,
      androidCandidates,
    });
  }

  const items = [...merged.values()];
  const lookedUp = await mapWithConcurrency(items, storeConcurrency, async (item) => {
    const { candidate } = item;
    const snap =
      candidate.platform === "IOS"
        ? await fetchItunesSnapshot(candidate.externalId, { revalidateSeconds: 3600 })
        : await fetchPlayStoreSnapshot(candidate.externalId, { revalidateSeconds: 3600 });
    if (!snap.ok) return null;
    return {
      platform: snap.platform,
      externalId: snap.externalId,
      title: snap.title,
      category: snap.category,
      developerName: snap.developerName,
      iconUrl: snap.iconUrl,
      storeUrl: snap.storeUrl,
      screenshots: snap.screenshots,
      firstSeenAt: item.firstSeenAt,
      channels: [...item.channels],
    } satisfies SlackAppbirdCatalogRow;
  });

  const rows = lookedUp
    .filter((x): x is SlackAppbirdCatalogRow => Boolean(x))
    .sort((a, b) => {
      const at = a.firstSeenAt?.getTime() ?? 0;
      const bt = b.firstSeenAt?.getTime() ?? 0;
      return bt - at;
    });

  return {
    channels,
    rows,
    totalParsedCandidates: items.length,
  };
  })();

  catalogCache = {
    key: cacheKey,
    expiresAt: now + cacheTtlMs,
    value: work,
  };
  return work;
}
