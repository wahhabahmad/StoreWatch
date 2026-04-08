/**
 * Download milestones (lower-bound installs). Play shows coarse tiers; we alert when
 * the parsed minimum crosses each threshold for the first time after baseline.
 */
export const DOWNLOAD_MILESTONE_THRESHOLDS: number[] = (() => {
  const m: number[] = [];
  for (let x = 1000; x <= 5000; x += 1000) m.push(x);
  m.push(10_000);
  for (let x = 15_000; x <= 95_000; x += 5000) m.push(x);
  m.push(100_000);
  for (let x = 150_000; x <= 950_000; x += 50_000) m.push(x);
  for (let x = 1_000_000; x <= 10_000_000; x += 1_000_000) m.push(x);
  m.push(25_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000, 1_000_000_000);
  return [...new Set(m)].sort((a, b) => a - b);
})();

export function milestonesUpTo(installMin: number): number[] {
  return DOWNLOAD_MILESTONE_THRESHOLDS.filter((t) => t <= installMin);
}

/**
 * First time we learn install count: establish baseline (no alerts) so we don't spam
 * every step below the first visible tier.
 */
export function baselineAlertedSet(installMin: number): number[] {
  return milestonesUpTo(installMin);
}

type MilestoneResult = {
  fireThresholds: number[];
  nextAlerted: number[];
};

/**
 * When install lower bound increases from prevMin to newMin, return thresholds to alert.
 * `alerted` is the set already acknowledged (from DB).
 */
export function milestonesCrossed(
  prevMin: number | null,
  newMin: number,
  alerted: number[],
): MilestoneResult {
  const alertedSet = new Set(alerted);
  const fire: number[] = [];

  if (prevMin === null) {
    const next = baselineAlertedSet(newMin);
    return { fireThresholds: [], nextAlerted: next };
  }

  for (const T of DOWNLOAD_MILESTONE_THRESHOLDS) {
    if (newMin < T) break;
    if (prevMin < T && !alertedSet.has(T)) {
      fire.push(T);
      alertedSet.add(T);
    }
  }

  const nextAlerted = [...alertedSet].sort((a, b) => a - b);
  return { fireThresholds: fire, nextAlerted };
}

const SURGE_RATIO = 1.45;
const SURGE_MIN_DELTA = 800;
const SURGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldFireSurgeAlert(options: {
  isGame: boolean;
  trackMilestones: boolean;
  prevMin: number | null;
  newMin: number | null;
  lastSurgeAlertAt: Date | null;
  now?: Date;
}): boolean {
  const now = options.now ?? new Date();
  if (!options.isGame || !options.trackMilestones) return false;
  if (options.prevMin == null || options.newMin == null) return false;
  if (options.prevMin < 500) return false;
  if (options.newMin < options.prevMin * SURGE_RATIO) return false;
  if (options.newMin - options.prevMin < SURGE_MIN_DELTA) return false;
  if (options.lastSurgeAlertAt) {
    if (now.getTime() - options.lastSurgeAlertAt.getTime() < SURGE_COOLDOWN_MS) {
      return false;
    }
  }
  return true;
}
