import type { DeveloperDiscoveredApp, WishlistedDeveloper } from "@prisma/client";

import {
  addWishlistedDeveloper,
  removeWishlistedDeveloper,
  runDeveloperDiscoveryNow,
} from "@/app/actions/developers";

type DevWithCount = WishlistedDeveloper & {
  _count: { discoveries: number };
};

export function DeveloperWishlistPanel({
  developers,
  discoveries,
}: {
  developers: DevWithCount[];
  discoveries: DeveloperDiscoveredApp[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Add developer</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Track iOS/Android developers and auto-discover new games.
        </p>
        <form action={addWishlistedDeveloper} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="from" value="watchlist" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Platform</span>
              <select
                name="platform"
                defaultValue="IOS"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="IOS">iOS</option>
                <option value="ANDROID">Android</option>
              </select>
            </label>
            <label className="flex-[3] text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Developer URL / ID</span>
              <input
                name="identifier"
                required
                placeholder="https://apps.apple.com/.../id12345 or https://play.google.com/store/apps/dev?id=..."
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          </div>
          <button
            type="submit"
            className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Add developer
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Developer wishlist ({developers.length})
          </h2>
          <form action={runDeveloperDiscoveryNow}>
            <input type="hidden" name="from" value="watchlist" />
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Run discovery now
            </button>
          </form>
        </div>

        {developers.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No developers yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Platform</th>
                  <th className="px-3 py-2">Developer</th>
                  <th className="px-3 py-2">Discoveries</th>
                  <th className="px-3 py-2">Last checked</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {developers.map((dev) => (
                  <tr key={dev.id}>
                    <td className="px-3 py-2">{dev.platform}</td>
                    <td className="px-3 py-2">{dev.name || dev.externalDeveloperId}</td>
                    <td className="px-3 py-2">{dev._count.discoveries}</td>
                    <td className="px-3 py-2">{dev.lastCheckedAt ? dev.lastCheckedAt.toLocaleString() : "—"}</td>
                    <td className="px-3 py-2">
                      {dev.lastError ? (
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
                      <form action={removeWishlistedDeveloper}>
                        <input type="hidden" name="from" value="watchlist" />
                        <input type="hidden" name="id" value={dev.id} />
                        <button type="submit" className="text-sm font-medium text-red-600 hover:underline dark:text-red-400">
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Recent discovered games: {discoveries.length}
        </p>
      </section>
    </div>
  );
}
