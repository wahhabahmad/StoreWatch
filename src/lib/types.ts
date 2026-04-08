import type { EventKind, Platform } from "@prisma/client";

export type { EventKind, Platform };

/** Normalized metadata from either store before persisting. */
export type StoreSnapshot = {
  ok: true;
  platform: Platform;
  externalId: string;
  title: string;
  category: string | null;
  isGame: boolean;
  version: string | null;
  releaseNotes: string | null;
  iconUrl: string | null;
  screenshots: string[];
  developerName: string | null;
  developerUrl: string | null;
  storeUrl: string;
  installLabel: string | null;
  installMin: number | null;
  installMax: number | null;
  raw: unknown;
};

export type StoreSnapshotError = {
  ok: false;
  error: string;
};

export type StoreFetchResult = StoreSnapshot | StoreSnapshotError;
