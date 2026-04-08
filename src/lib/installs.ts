/**
 * Parse Google Play install / download strings (public page / embedded JSON).
 * Values are approximate; the store only exposes tiers or ranges.
 */

function parseNumberToken(token: string): number {
  const t = token.replace(/,/g, "").trim();
  if (!t) return 0;
  const upper = t.toUpperCase();
  const num = parseFloat(upper.replace(/[KMB]+$/i, ""));
  if (Number.isNaN(num)) return 0;
  if (upper.endsWith("B")) return Math.round(num * 1_000_000_000);
  if (upper.endsWith("M")) return Math.round(num * 1_000_000);
  if (upper.endsWith("K")) return Math.round(num * 1_000);
  return Math.round(num);
}

export function parsePlayInstallString(raw: string): {
  label: string;
  min: number;
  max: number | null;
} | null {
  const label = raw.replace(/\s+/g, " ").trim();
  if (!label) return null;

  const plus = label.match(/^([\d.,]+[KkMmBb]?)\s*\+$/);
  if (plus) {
    const min = parseNumberToken(plus[1]);
    if (min > 0) return { label, min, max: null };
  }

  const range = label.match(
    /^([\d.,]+[KkMmBb]?)\s*[–-]\s*([\d.,]+[KkMmBb]?)\s*$/u,
  );
  if (range) {
    const a = parseNumberToken(range[1]);
    const b = parseNumberToken(range[2]);
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    if (min > 0) return { label, min, max: max > 0 ? max : null };
  }

  const barePlus = label.match(/^([\d.,]+)\s*\+$/);
  if (barePlus) {
    const min = parseNumberToken(barePlus[1]);
    if (min > 0) return { label, min, max: null };
  }

  return null;
}

export function extractPlayInstallsFromHtml(html: string): {
  label: string;
  min: number;
  max: number | null;
} | null {
  const fromJson = html.match(/"numDownloads"\s*:\s*"([^"]+)"/);
  if (fromJson?.[1]) {
    const p = parsePlayInstallString(fromJson[1]);
    if (p) return p;
  }

  const alt = html.match(
    /"installs"\s*:\s*\{[^}]*"text"\s*:\s*"([^"]+)"/,
  );
  if (alt?.[1]) {
    const p = parsePlayInstallString(alt[1]);
    if (p) return p;
  }

  const loose = html.match(/([\d,]+(?:\s*[–-]\s*[\d,]+)?)\s*\+\s*(?:downloads|install)/i);
  if (loose?.[1]) {
    const p = parsePlayInstallString(loose[1].includes("–") || loose[1].includes("-") ? loose[1] : `${loose[1]}+`);
    if (p) return p;
  }

  return null;
}
