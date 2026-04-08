import { load } from "cheerio";

import { extractPlayInstallsFromHtml } from "./installs";
import type { StoreFetchResult } from "./types";

const PLAY_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export function buildPlayStoreUrl(packageName: string): string {
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}`;
}

/**
 * Google Play has no free public “top charts / new games” API like Apple’s RSS.
 * This URL opens Play’s in-store app search (name + optional developer) so users can find an Android listing.
 * It is not a guaranteed match for the same title as on the App Store.
 */
export function playStoreSearchAppsUrl(appName: string, developer?: string): string {
  const parts = [appName.trim(), (developer ?? "").trim()].filter(Boolean);
  const q = parts.join(" ");
  return `https://play.google.com/store/search?q=${encodeURIComponent(q)}&c=apps`;
}

export function extractPlayCategoryFromHtml(html: string): string | null {
  const g = html.match(/"genre"\s*:\s*"([^"]+)"/);
  if (g?.[1]) {
    return g[1].replace(/_/g, " ");
  }
  const appCat = html.match(/"applicationCategory"\s*:\s*"([^"]+)"/);
  if (appCat?.[1]) {
    return appCat[1].replace(/_/g, " ");
  }
  return null;
}

/** Skip tiny play-lh assets (PEGI/ESRB badges, etc.) that use small =sNN- scale. */
function isPlayLhScreenshotCandidate(src: string): boolean {
  const m = src.match(/=s(\d+)(?:-rw\d?)?(?:\?|#|$)/i);
  if (m && Number(m[1]) < 200) return false;
  return true;
}

/**
 * Bump size tokens in play-lh URLs so the CDN serves larger images (best-effort).
 */
export function upgradePlayLhScreenshotUrl(src: string): string {
  let out = src;
  out = out.replace(/=w(\d+)-h(\d+)(-rw\d?)?(?=\?|#|$)/i, (_, w, h, rw) => {
    const ow = Number(w);
    const oh = Number(h);
    const nw = Math.min(1440, Math.max(800, ow * 2));
    const nh = Math.min(2560, Math.round((nw / ow) * oh));
    return `=w${nw}-h${nh}${rw ?? ""}`;
  });
  out = out.replace(/=s(\d+)(-rw\d?)(?=\?|#|$)/i, (_, s, rw) => {
    const n = Math.min(900, Math.max(640, Number(s) * 2));
    return `=s${n}${rw}`;
  });
  return out;
}

function detectGameFromPlayCategory(category: string | null, html: string): boolean {
  const c = (category ?? "").toUpperCase();
  if (c.includes("GAME")) return true;
  if (/GAME|CASUAL|ARCADE|ACTION/i.test(html) && /"genre"/i.test(html)) {
    const genre = html.match(/"genre"\s*:\s*"([^"]+)"/);
    if (genre?.[1]?.toUpperCase().includes("GAME")) return true;
  }
  return false;
}

/**
 * Parse a public Google Play app detail HTML document.
 * Heuristic-based; Google may change markup — tests use fixtures.
 */
export function parsePlayStoreHtml(html: string, packageName: string): StoreFetchResult {
  const storeUrl = buildPlayStoreUrl(packageName);
  const $ = load(html);

  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim();
  const ogDesc = $('meta[property="og:description"]').attr("content")?.trim();

  let title =
    ogTitle?.replace(/\s*-\s*Apps on Google Play\s*$/i, "").trim() ??
    $("h1 span").first().text().trim() ??
    $("h1").first().text().trim() ??
    "";

  if (!title) {
    title = packageName;
  }

  const iconUrl = ogImage && ogImage.startsWith("http") ? ogImage : null;

  const devLink = $('a[href*="store/apps/dev"]').first();
  const developerUrlRaw = devLink.attr("href");
  const developerUrl = developerUrlRaw
    ? new URL(developerUrlRaw, "https://play.google.com").href
    : null;
  const developerName = devLink.text().trim() || null;

  const screenshots = new Set<string>();
  $('img[src*="googleusercontent"]').each((_, el) => {
    const src = $(el).attr("src");
    if (!src?.startsWith("http")) return;
    if (!/play-lh\.googleusercontent\.com/i.test(src)) return;
    if (iconUrl && src === iconUrl) return;
    if (!isPlayLhScreenshotCandidate(src)) return;
    screenshots.add(upgradePlayLhScreenshotUrl(src));
  });

  let version: string | null = null;
  const bodyText = $.root().text();
  const verMatch =
    html.match(/Current Version<\/[^>]+>\s*<[^>]+>([^<]+)</i) ||
    html.match(/"softwareVersion"\s*:\s*"([^"]+)"/) ||
    bodyText.match(/Current Version\s*([\d.]+)/i);
  if (verMatch?.[1]) {
    version = verMatch[1].trim();
  }

  let releaseNotes: string | null = ogDesc ?? null;
  const whatsNew = $('[itemprop="description"]').first().text().trim();
  if (whatsNew && whatsNew.length > 20) {
    releaseNotes = whatsNew;
  }

  const embeddedNotes = extractWhatsNewFromScripts(html);
  if (embeddedNotes && embeddedNotes.length > (releaseNotes?.length ?? 0)) {
    releaseNotes = embeddedNotes;
  }

  const category = extractPlayCategoryFromHtml(html);
  const isGame = detectGameFromPlayCategory(category, html);
  const installs = extractPlayInstallsFromHtml(html);

  if (!iconUrl && !version && screenshots.size === 0 && title === packageName) {
    return {
      ok: false,
      error:
        "Could not parse Play Store page (blocked, wrong id, or markup changed). Try again later.",
    };
  }

  return {
    ok: true,
    platform: "ANDROID",
    externalId: packageName,
    title,
    category,
    isGame,
    version,
    releaseNotes,
    iconUrl,
    screenshots: [...screenshots].slice(0, 12),
    developerName,
    developerUrl,
    storeUrl,
    installLabel: installs?.label ?? null,
    installMin: installs?.min ?? null,
    installMax: installs?.max ?? null,
    raw: {
      ogTitle,
      ogImage,
      parsedVersion: version,
      installs,
      category,
    },
  };
}

function extractWhatsNewFromScripts(html: string): string | null {
  const m = html.match(/"recentChanges"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (!m?.[1]) return null;
  return m[1]
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

export async function fetchPlayStoreSnapshot(
  packageName: string,
  options?: { revalidateSeconds?: number },
): Promise<StoreFetchResult> {
  const trimmed = packageName.trim();
  if (!trimmed || !/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(trimmed)) {
    return {
      ok: false,
      error:
        "Invalid Android package name (expected form like com.example.app).",
    };
  }

  const revalidate = options?.revalidateSeconds ?? 0;
  const url = buildPlayStoreUrl(trimmed);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": PLAY_UA,
        "Accept-Language": "en-US,en;q=0.9",
      },
      next: { revalidate },
    });
  } catch (e) {
    return { ok: false, error: `Play Store fetch failed: ${String(e)}` };
  }

  if (!res.ok) {
    return { ok: false, error: `Play Store HTTP ${res.status}` };
  }

  const html = await res.text();
  return parsePlayStoreHtml(html, trimmed);
}
