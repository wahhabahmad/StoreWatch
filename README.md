# Storewatch

Watchlist-driven feed for **App Store** and **Google Play** updates: icons, screenshots, release notes, developer links, **categories**, and (on Android) **install-tier milestones** plus **game surge** hints. Uses **Apple’s free iTunes Lookup API** and **public Google Play HTML parsing** — no paid third-party store APIs.

- **Feed filters**: platform, **category** (from store metadata), **Games only**.
- **Alerts** (`/alerts`): in-app notifications when an Android app’s parsed install **tier** crosses configured thresholds (1k, 2k, … 5k, 10k, then larger steps). **Surge** alerts fire when a **game**’s tier jumps quickly between ingests.
- **iOS**: install counts are **not** available from the public API — milestones are **Android-only**.
- **Push / email**: not included; alerts are on the Alerts page (extend with webhooks later if you want).
- **Daily report** (`/report`): end-of-day style summary for all watchlisted apps, **top performers** ranked by that day’s alerts + feed activity (plus a small Android install-tier tie-break). Prefer **snapshots** (stable) once the cron runs; until then the page is computed live from the DB.

### How “top performers” are ranked

Scores combine **that calendar day** (in `DAILY_REPORT_TIMEZONE`, default `UTC`):

| Signal | Weight |
|--------|--------|
| Download surge alert | 150 each |
| Install milestone alert | 100 each |
| Version update in feed | 50 each |
| First-seen feed event | 25 each |
| Tie-break | `log10(installMin + 1) × 10` (Android tier lower bound only) |

This is **not** exact download velocity; Play only exposes coarse install tiers.

## Prerequisites

- Node.js 20+
- **No database server.** Data is stored in **`prisma/dev.db`** (SQLite). `start.bat` or `npm run db:push` creates/updates it.
- **Optional:** [`docker-compose.yml`](docker-compose.yml) is only if you want PostgreSQL instead — you would change `provider` + `url` in `prisma/schema.prisma` and set `DATABASE_URL` accordingly.

## Setup

1. Copy environment:

   ```bash
   cp .env.example .env
   ```

2. Create/update the local database file:

   ```bash
   npm run db:push
   ```

3. Run the app:

   ```bash
   npm run dev
   ```

Or double-click **`start.bat`** (Windows): copies `.env` from `.env.example` if needed, runs `db push`, then `npm run dev`.

Open [http://localhost:3000](http://localhost:3000). Add apps on **Watchlist**, then **Run ingestion now** (or call the cron route below).

## Cron / scheduled ingest

`GET /api/cron/ingest` runs ingestion for every watched app.

- If `CRON_SECRET` is set in `.env`, send header `Authorization: Bearer <CRON_SECRET>`.
- If `CRON_SECRET` is **unset** (development only), the route is open — do not deploy that way.

Example (with secret):

```bash
curl -H "Authorization: Bearer change-me-in-production" http://localhost:3000/api/cron/ingest
```

On Vercel, add `vercel.json` with a `crons` entry pointing at `/api/cron/ingest` and set `CRON_SECRET` in project env.

## Daily report cron

`GET /api/cron/daily-report` builds and **upserts** a snapshot for **yesterday** in `DAILY_REPORT_TIMEZONE` (same auth rules as ingest: `CRON_SECRET` and/or `x-vercel-cron: 1` on Vercel).

- The UI at `/report` loads a stored snapshot when present; otherwise it shows a **live** rebuild (useful before the first cron run).
- `vercel.json` includes a schedule at **23:55 UTC**; adjust if your reporting timezone needs a different wall-clock time, or trigger the route manually:

```bash
curl -H "Authorization: Bearer change-me-in-production" http://localhost:3000/api/cron/daily-report
```

## Slack Appbird channel (optional)

If Appbird (or another bot) posts new iOS/Android apps in Slack, you can **pull recent messages**, parse App Store / Play links and package-like ids, and **add new `WatchedApp` rows** plus run ingestion — same idea as the watchlist quick-add.

Typical channels (names for reference — configure **channel ids** in env, e.g. `C0123ABC` from each channel’s details): **`#appbird-market-stats`**, **`#apple-new-games`**, **`#googleplay-new-games`**. The bot must be **invited to every channel** it should read.

1. **Slack app**: create an app in your workspace, add a **Bot User OAuth Token** (`xoxb-…`) with scopes **`channels:history`** (public channels) and/or **`groups:history`** (private).
2. **Env** (production / `.env`):

   - `SLACK_BOT_TOKEN` — bot token
   - `SLACK_APPBIRD_CHANNEL_IDS` — comma-separated Slack **channel ids** (e.g. `C111,C222,C333`). Legacy: a single `SLACK_APPBIRD_CHANNEL_ID` still works.
   - `SLACK_APPBIRD_ENABLED=1` — must be set or the cron route returns **503** (safe default)
   - Optional: `SLACK_APPBIRD_MESSAGE_LIMIT` — default `100` (recent messages **per channel** per run)

3. **Cron**: `GET /api/cron/slack-appbird` — same auth as other crons (`CRON_SECRET` / Vercel cron header). `vercel.json` schedules it daily at **07:30 UTC**; change the schedule if Appbird posts later.

Parsing looks for `apps.apple.com` / `itunes.apple.com` `/id…` links, Play `details?id=…`, `market://details?id=…`, and `com.*.*` package-like tokens. If Appbird’s format differs, adjust `extractAppCandidatesFromText` in `src/lib/slack-appbird.ts`.

## Developer wishlist (optional)

Use `/developers` to wishlist studios/publishers and auto-discover their latest **games** on iOS + Android.

- Add a developer by platform:
  - iOS: developer URL (contains `/id123...`) or numeric developer id
  - Android: Play developer URL (`/store/apps/dev?id=...`) or raw developer id
- Click **Run discovery now** to fetch each wishlisted developer's game catalog and add newly seen games to `WatchedApp`.
- New discoveries are tracked in `DeveloperDiscoveredApp` to avoid duplicate adds in future runs.

Cron endpoint:

- `GET /api/cron/developer-discovery` (same auth rules as other cron routes with `CRON_SECRET`)
- `vercel.json` includes a daily schedule at **07:45 UTC**

Optional env:

- `DEVELOPER_WISHLIST_MAX_APPS_PER_DEVELOPER` (default `60`) limits Android developer list breadth per run.

## Inspiration tab (Reddit videos)

Use `/inspiration` to browse recent video posts from configured subreddits.

- Source is Reddit subreddits only (v1).
- Refresh modes: hourly cron and manual refresh button on the page.
- Video-capable posts are cached in `VideoItem` and rendered with embedded playback when possible.

Env:

- `VIDEOS_REDDIT_SUBREDDITS` (comma-separated, required to ingest anything)
- `VIDEOS_REDDIT_LIMIT_PER_SUB` (optional, default `20`, max `100`)
- `VIDEOS_INCLUDE_NSFW=1` (optional, default excludes NSFW)

Cron endpoint:

- `GET /api/cron/videos` (same auth behavior as other cron routes with `CRON_SECRET`)
- `vercel.json` includes an hourly schedule for this route

## Feed board + Wishlist + Report v2

- Main `/` is a board with `Top downloads`, `Top grossing`, and `New games`.
- `New games` unions feed first-seen, iTunes new games, Slack catalog, and Play scrape rows.
- Each row/card includes quick wishlist add and iOS/Android links when available.
- `/watchlist` is restored and works with app wishlist plus developer wishlist link.
- `/report` now shows KPI/trend summaries and source-aware board tables.
- Feed/report views revalidate about every 10 minutes.

## Tests

```bash
npm test
```

Play Store parsing is covered with a **fixture HTML** under `src/lib/__fixtures__/`.

## Notes

- **iOS**: use numeric App Store id (e.g. Facebook `284882215`) or bundle id.
- **Android**: package name must look like `com.vendor.app`. Parsing may break if Google changes markup; errors surface on the watchlist row.
- Respect Apple and Google terms; use reasonable fetch volume and caching.

## License

MIT
