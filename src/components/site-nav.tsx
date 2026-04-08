import Link from "next/link";

const link =
  "text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";

export function SiteNav() {
  return (
    <header className="print:hidden border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Storewatch
        </Link>
        <nav className="flex items-center gap-6">
          <Link className={link} href="/">
            Feed
          </Link>
          <Link className={link} href="/watchlist">
            Wishlist
          </Link>
          <Link className={link} href="/inspiration">
            Inspiration
          </Link>
          <Link className={link} href="/report">
            Report
          </Link>
        </nav>
      </div>
    </header>
  );
}
