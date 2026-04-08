-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('FIRST_SEEN', 'VERSION_UPDATE');

-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('DOWNLOAD_MILESTONE', 'DOWNLOAD_SURGE');

-- CreateEnum
CREATE TYPE "VideoSource" AS ENUM ('REDDIT', 'YOUTUBE');

-- CreateTable
CREATE TABLE "WatchedApp" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "category" TEXT,
    "isGame" BOOLEAN NOT NULL DEFAULT false,
    "trackDownloadMilestones" BOOLEAN NOT NULL DEFAULT true,
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastVersion" TEXT,
    "lastInstallMin" INTEGER,
    "lastInstallMax" INTEGER,
    "lastInstallLabel" TEXT,
    "alertedMilestones" JSONB NOT NULL DEFAULT '[]',
    "lastSurgeAlertAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchedApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistedDeveloper" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalDeveloperId" TEXT NOT NULL,
    "name" TEXT,
    "storeUrl" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistedDeveloper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeveloperDiscoveredApp" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT,
    "category" TEXT,
    "storeUrl" TEXT,
    "iconUrl" TEXT,
    "screenshots" JSONB NOT NULL DEFAULT '[]',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "watchedAppId" TEXT,

    CONSTRAINT "DeveloperDiscoveredApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedItem" (
    "id" TEXT NOT NULL,
    "watchedAppId" TEXT NOT NULL,
    "eventKind" "EventKind" NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "version" TEXT,
    "releaseNotes" TEXT,
    "iconUrl" TEXT,
    "screenshots" JSONB NOT NULL DEFAULT '[]',
    "developerName" TEXT,
    "developerUrl" TEXT,
    "storeUrl" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB,
    "parseOk" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FeedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "watchedAppId" TEXT NOT NULL,
    "kind" "AlertKind" NOT NULL,
    "threshold" INTEGER,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN,
    "message" TEXT,
    "details" JSONB,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReportSnapshot" (
    "id" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoItem" (
    "id" TEXT NOT NULL,
    "source" "VideoSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "postUrl" TEXT NOT NULL,
    "embedUrl" TEXT,
    "thumbnailUrl" TEXT,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER,
    "nsfw" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WatchedApp_platform_externalId_key" ON "WatchedApp"("platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistedDeveloper_platform_externalDeveloperId_key" ON "WishlistedDeveloper"("platform", "externalDeveloperId");

-- CreateIndex
CREATE INDEX "DeveloperDiscoveredApp_firstSeenAt_idx" ON "DeveloperDiscoveredApp"("firstSeenAt");

-- CreateIndex
CREATE INDEX "DeveloperDiscoveredApp_watchedAppId_idx" ON "DeveloperDiscoveredApp"("watchedAppId");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperDiscoveredApp_developerId_platform_externalId_key" ON "DeveloperDiscoveredApp"("developerId", "platform", "externalId");

-- CreateIndex
CREATE INDEX "FeedItem_detectedAt_idx" ON "FeedItem"("detectedAt");

-- CreateIndex
CREATE INDEX "FeedItem_watchedAppId_idx" ON "FeedItem"("watchedAppId");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE INDEX "Alert_watchedAppId_idx" ON "Alert"("watchedAppId");

-- CreateIndex
CREATE INDEX "Alert_read_idx" ON "Alert"("read");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReportSnapshot_reportDate_timezone_key" ON "DailyReportSnapshot"("reportDate", "timezone");

-- CreateIndex
CREATE INDEX "VideoItem_publishedAt_idx" ON "VideoItem"("publishedAt");

-- CreateIndex
CREATE INDEX "VideoItem_subreddit_idx" ON "VideoItem"("subreddit");

-- CreateIndex
CREATE UNIQUE INDEX "VideoItem_source_sourceId_key" ON "VideoItem"("source", "sourceId");

-- AddForeignKey
ALTER TABLE "DeveloperDiscoveredApp" ADD CONSTRAINT "DeveloperDiscoveredApp_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "WishlistedDeveloper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperDiscoveredApp" ADD CONSTRAINT "DeveloperDiscoveredApp_watchedAppId_fkey" FOREIGN KEY ("watchedAppId") REFERENCES "WatchedApp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedItem" ADD CONSTRAINT "FeedItem_watchedAppId_fkey" FOREIGN KEY ("watchedAppId") REFERENCES "WatchedApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_watchedAppId_fkey" FOREIGN KEY ("watchedAppId") REFERENCES "WatchedApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
