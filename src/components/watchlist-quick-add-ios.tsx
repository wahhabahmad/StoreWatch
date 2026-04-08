"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { quickAddIosGameToWatchlist } from "@/app/actions/watchlist";

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

export function WatchlistQuickAddIos({
  appStoreId,
  isGame = true,
  compact = false,
}: {
  appStoreId: string;
  isGame?: boolean;
  /** Smaller control; status via native tooltip instead of text under the button */
  compact?: boolean;
}) {
  const router = useRouter();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const baseTitle = "Add to watchlist";

  const runAdd = () => {
    setFeedback(null);
    startTransition(async () => {
      const r = await quickAddIosGameToWatchlist(appStoreId, isGame);
      router.refresh();
      if (r.ok) {
        if (compact && btnRef.current) {
          btnRef.current.title = "Added to watchlist";
          setTimeout(() => {
            if (btnRef.current) btnRef.current.title = baseTitle;
          }, 2200);
        } else {
          setFeedback("Added");
          setTimeout(() => setFeedback(null), 2200);
        }
      } else if (compact && btnRef.current) {
        btnRef.current.title = r.error;
        setTimeout(() => {
          if (btnRef.current) btnRef.current.title = baseTitle;
        }, 3200);
      } else {
        setFeedback(r.error);
      }
    });
  };

  const size = compact ? "h-7 w-7" : "h-9 w-9";
  const iconClass = compact ? "h-3.5 w-3.5" : "h-5 w-5";

  return (
    <div className={compact ? "inline-flex" : "flex flex-col items-center gap-0.5"}>
      <button
        ref={btnRef}
        type="button"
        disabled={pending}
        title={baseTitle}
        aria-label={`Add app ${appStoreId} to watchlist`}
        onClick={runAdd}
        className={`inline-flex ${size} shrink-0 items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800`}
      >
        {pending ? (
          <span className="h-3 w-3 animate-pulse rounded-full bg-zinc-400 dark:bg-zinc-500" />
        ) : (
          <PlusIcon className={iconClass} />
        )}
      </button>
      {!compact && feedback ? (
        <span
          className={`max-w-[88px] text-center text-[10px] leading-tight ${
            feedback === "Added" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {feedback}
        </span>
      ) : null}
    </div>
  );
}
