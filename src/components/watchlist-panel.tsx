import type { FeedItem, WatchedApp } from "@prisma/client";

import {
  addWatchedApp,
  removeWatchedApp,
  updateWatchedAppAlerts,
} from "@/app/actions/watchlist";
import { runIngestionNow } from "@/app/actions/ingest";
import { GameNameWithStorePreview } from "@/components/game-name-store-preview";

type WatchedAppWithLatestFeed = WatchedApp & {
  feedItems: Array<Pick<FeedItem, "title" | "iconUrl" | "screenshots" | "storeUrl">>;
};

function asScreenshotArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string" && x.length > 0);
}

export function WatchlistPanel({ apps }: { apps: WatchedAppWithLatestFeed[] }) {
  const categories = [...new Set(apps.map((a) => (a.category ?? "uncategorized").trim().toLowerCase()))].sort();
  const iosCount = apps.filter((a) => a.platform === "IOS").length;
  const androidCount = apps.length - iosCount;
  const withErrors = apps.filter((a) => Boolean(a.lastError)).length;

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Add to watchlist
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          iOS: numeric app id (e.g. <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">284882215</code>) or bundle id.
          Android: package name. <strong>Install milestones</strong> use Play’s public tiers and only apply to{" "}
          <strong>Android</strong>. Check <strong>This is a game</strong> for surge-style alerts when a tier jumps quickly.
        </p>
        <form action={addWatchedApp} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Platform</span>
              <select
                name="platform"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                defaultValue="IOS"
              >
                <option value="IOS">iOS (App Store)</option>
                <option value="ANDROID">Android (Google Play)</option>
              </select>
            </label>
            <label className="flex flex-[2] flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">App id / package</span>
              <input
                name="externalId"
                required
                placeholder="284882215 or com.example.app"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Add
            </button>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
            <input type="checkbox" name="isGame" className="rounded border-zinc-400" />
            <span>This is a game (enables surge alerts when Play install tier jumps)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
            <input type="checkbox" name="skipInstallAlerts" className="rounded border-zinc-400" />
            <span>Skip Android install milestone alerts for this app</span>
          </label>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Games wishlist ({apps.length})</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {iosCount} iOS · {androidCount} Android · {withErrors} with errors
            </p>
          </div>
          <form action={runIngestionNow}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Run ingestion now
            </button>
          </form>
        </div>
        {apps.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Nothing here yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <span
                  key={cat}
                  className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                >
                  {cat}
                </span>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2">App</th>
                    <th className="px-3 py-2">Platform</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Alerts</th>
                    <th className="px-3 py-2">Version</th>
                    <th className="px-3 py-2">Installs</th>
                    <th className="px-3 py-2">Last success</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {apps.map((app) => (
                    <tr key={app.id} className="bg-white align-top dark:bg-zinc-950">
                      <td className="px-3 py-2">
                        <div className="flex items-start gap-2">
                          {app.feedItems[0]?.iconUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- remote store artwork
                            <img
                              src={app.feedItems[0].iconUrl}
                              alt=""
                              width={36}
                              height={36}
                              className="h-9 w-9 rounded-lg bg-zinc-100 dark:bg-zinc-900"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
                          )}
                          <div>
                            <div className="font-medium text-zinc-900 dark:text-zinc-50">
                              {app.feedItems[0]?.storeUrl ? (
                                <GameNameWithStorePreview
                                  href={app.feedItems[0].storeUrl}
                                  screenshotUrls={asScreenshotArray(app.feedItems[0].screenshots)}
                                >
                                  {app.feedItems[0].title || app.externalId}
                                </GameNameWithStorePreview>
                              ) : (
                                app.externalId
                              )}
                            </div>
                            <div className="font-mono text-xs text-zinc-500">{app.externalId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{app.platform}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{app.category ?? "uncategorized"}</td>
                      <td className="px-3 py-2">
                        {app.lastError ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-200">
                            error
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                            watching
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <form action={updateWatchedAppAlerts}>
                            <input type="hidden" name="id" value={app.id} />
                            <input
                              type="hidden"
                              name="enableMilestones"
                              value={app.trackDownloadMilestones ? "0" : "1"}
                            />
                            <input type="hidden" name="enableSurge" value={app.isGame ? "1" : "0"} />
                            <button
                              type="submit"
                              className={`rounded px-2 py-0.5 text-xs font-medium ${
                                app.trackDownloadMilestones
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                              }`}
                            >
                              milestones {app.trackDownloadMilestones ? "on" : "off"}
                            </button>
                          </form>
                          <form action={updateWatchedAppAlerts}>
                            <input type="hidden" name="id" value={app.id} />
                            <input
                              type="hidden"
                              name="enableMilestones"
                              value={app.trackDownloadMilestones ? "1" : "0"}
                            />
                            <input type="hidden" name="enableSurge" value={app.isGame ? "0" : "1"} />
                            <button
                              type="submit"
                              className={`rounded px-2 py-0.5 text-xs font-medium ${
                                app.isGame
                                  ? "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200"
                                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                              }`}
                            >
                              surge {app.isGame ? "on" : "off"}
                            </button>
                          </form>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{app.lastVersion ?? "—"}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {app.platform === "ANDROID" ? app.lastInstallLabel ?? "—" : "n/a"}
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {app.lastSuccessAt ? app.lastSuccessAt.toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <form action={removeWatchedApp}>
                          <input type="hidden" name="id" value={app.id} />
                          <button
                            type="submit"
                            className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
                          >
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
