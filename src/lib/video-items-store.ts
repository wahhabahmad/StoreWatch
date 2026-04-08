import { prisma } from "@/lib/db";
import type { VideoSource } from "@prisma/client";

export type VideoItemRecord = {
  id: string;
  source: VideoSource;
  sourceId: string;
  subreddit: string;
  title: string;
  postUrl: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  author: string | null;
  publishedAt: Date;
  fetchedAt: Date;
  score: number | null;
  nsfw: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type VideoItemDelegate = {
  findMany(args: {
    where: { source?: VideoSource };
    orderBy: { publishedAt: "desc" };
    take: number;
  }): Promise<VideoItemRecord[]>;
  findUnique(args: {
    where: { source_sourceId: { source: VideoSource; sourceId: string } };
    select: { id: true };
  }): Promise<{ id: string } | null>;
  upsert(args: {
    where: { source_sourceId: { source: VideoSource; sourceId: string } };
    update: Record<string, unknown>;
    create: Record<string, unknown>;
  }): Promise<unknown>;
};

function videoItemDelegate(): VideoItemDelegate | null {
  const delegate = (prisma as unknown as { videoItem?: VideoItemDelegate }).videoItem;
  return delegate ?? null;
}

function asDate(input: unknown): Date {
  if (input instanceof Date) return input;
  return new Date(String(input));
}

function normalizeRow(row: Record<string, unknown>): VideoItemRecord {
  return {
    id: String(row.id),
    source: String(row.source) as VideoSource,
    sourceId: String(row.sourceId),
    subreddit: String(row.subreddit),
    title: String(row.title),
    postUrl: String(row.postUrl),
    embedUrl: row.embedUrl == null ? null : String(row.embedUrl),
    thumbnailUrl: row.thumbnailUrl == null ? null : String(row.thumbnailUrl),
    author: row.author == null ? null : String(row.author),
    publishedAt: asDate(row.publishedAt),
    fetchedAt: asDate(row.fetchedAt),
    score: row.score == null ? null : Number(row.score),
    nsfw: Boolean(row.nsfw),
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  };
}

export async function listInspirationVideoItems(limit: number, source?: VideoSource): Promise<VideoItemRecord[]> {
  const delegate = videoItemDelegate();
  try {
    if (delegate) {
      return delegate.findMany({
        where: source ? { source } : {},
        orderBy: { publishedAt: "desc" },
        take: limit,
      });
    }

    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "id","source","sourceId","subreddit","title","postUrl","embedUrl","thumbnailUrl","author","publishedAt","fetchedAt","score","nsfw","createdAt","updatedAt"
       FROM "VideoItem"
       ${source ? 'WHERE "source" = ?' : ""}
       ORDER BY "publishedAt" DESC
       LIMIT ?`,
      ...(source ? [source, limit] : [limit]),
    )) as Array<Record<string, unknown>>;
    return rows.map(normalizeRow);
  } catch (error) {
    console.error("Failed to list inspiration video items", error);
    return [];
  }
}

export type UpsertVideoItemInput = {
  source: VideoSource;
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

export async function upsertVideoItem(row: UpsertVideoItemInput): Promise<{ existed: boolean }> {
  const delegate = videoItemDelegate();
  if (delegate) {
    const existing = await delegate.findUnique({
      where: { source_sourceId: { source: row.source, sourceId: row.sourceId } },
      select: { id: true },
    });
    await delegate.upsert({
      where: { source_sourceId: { source: row.source, sourceId: row.sourceId } },
      update: {
        subreddit: row.subreddit,
        title: row.title,
        postUrl: row.postUrl,
        embedUrl: row.embedUrl,
        thumbnailUrl: row.thumbnailUrl,
        author: row.author,
        publishedAt: row.publishedAt,
        fetchedAt: new Date(),
        score: row.score,
        nsfw: row.nsfw,
      },
      create: {
        source: row.source,
        sourceId: row.sourceId,
        subreddit: row.subreddit,
        title: row.title,
        postUrl: row.postUrl,
        embedUrl: row.embedUrl,
        thumbnailUrl: row.thumbnailUrl,
        author: row.author,
        publishedAt: row.publishedAt,
        fetchedAt: new Date(),
        score: row.score,
        nsfw: row.nsfw,
      },
    });
    return { existed: Boolean(existing) };
  }

  const existingRows = (await prisma.$queryRawUnsafe(
    `SELECT "id" FROM "VideoItem" WHERE "source" = ? AND "sourceId" = ? LIMIT 1`,
    row.source,
    row.sourceId,
  )) as Array<{ id: string }>;
  const existed = existingRows.length > 0;

  await prisma.$executeRawUnsafe(
    `INSERT INTO "VideoItem"
      ("source","sourceId","subreddit","title","postUrl","embedUrl","thumbnailUrl","author","publishedAt","fetchedAt","score","nsfw")
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT("source","sourceId") DO UPDATE SET
      "subreddit"=excluded."subreddit",
      "title"=excluded."title",
      "postUrl"=excluded."postUrl",
      "embedUrl"=excluded."embedUrl",
      "thumbnailUrl"=excluded."thumbnailUrl",
      "author"=excluded."author",
      "publishedAt"=excluded."publishedAt",
      "fetchedAt"=excluded."fetchedAt",
      "score"=excluded."score",
      "nsfw"=excluded."nsfw",
      "updatedAt"=CURRENT_TIMESTAMP`,
    row.source,
    row.sourceId,
    row.subreddit,
    row.title,
    row.postUrl,
    row.embedUrl,
    row.thumbnailUrl,
    row.author,
    row.publishedAt.toISOString(),
    new Date().toISOString(),
    row.score,
    row.nsfw ? 1 : 0,
  );

  return { existed };
}
