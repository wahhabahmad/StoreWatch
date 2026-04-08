"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SHOW_DELAY_MS = 200;
const HIDE_DELAY_MS = 160;

/** Max panel width for layout / clamping (px). */
const PANEL_MAX_PX = 880;

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; screenshots: string[] }
  | { status: "error" };

export function PlayAppIconScreenshotHover({
  packageName,
  title,
  storeUrl,
  iconUrl,
}: {
  packageName: string;
  title: string;
  storeUrl: string;
  iconUrl: string | null;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [preview, setPreview] = useState<PreviewState>({ status: "idle" });
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const fetchedOkRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    fetchedOkRef.current = false;
    abortRef.current?.abort();
    setPreview({ status: "idle" });
  }, [packageName]);

  useEffect(() => {
    fetchedOkRef.current = preview.status === "ok";
  }, [preview.status]);

  const updatePos = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelW = Math.min(PANEL_MAX_PX, window.innerWidth - 20);
    const left = Math.min(Math.max(10, r.left), Math.max(10, window.innerWidth - panelW - 10));
    setPos({ top: r.bottom + 10, left });
  }, []);

  const loadPreview = useCallback(() => {
    if (fetchedOkRef.current) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setPreview((p) => (p.status === "loading" ? p : { status: "loading" }));
    fetch(`/api/play-scrape/preview?id=${encodeURIComponent(packageName)}`, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("bad");
        const data = (await res.json()) as { screenshots?: string[] };
        const screenshots = Array.isArray(data.screenshots) ? data.screenshots : [];
        fetchedOkRef.current = true;
        setPreview({ status: "ok", screenshots });
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setPreview({ status: "error" });
      });
  }, [packageName]);

  const scheduleShow = useCallback(() => {
    clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => {
      updatePos();
      setOpen(true);
      loadPreview();
    }, SHOW_DELAY_MS);
  }, [updatePos, loadPreview]);

  const scheduleHide = useCallback(() => {
    clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => {
      setOpen(false);
    }, HIDE_DELAY_MS);
  }, []);

  const cancelHide = useCallback(() => {
    clearTimeout(hideTimer.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <span
        ref={anchorRef}
        className="inline-flex shrink-0"
        onMouseEnter={scheduleShow}
        onMouseLeave={scheduleHide}
      >
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg outline-none ring-zinc-400 focus-visible:ring-2"
          onFocus={scheduleShow}
          onBlur={scheduleHide}
          aria-label={`${title} on Google Play (hover for screenshots)`}
        >
          {iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote Play artwork
            <img
              src={iconUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg bg-zinc-100 object-cover dark:bg-zinc-900"
            />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-[10px] font-medium text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
              aria-hidden
            >
              ?
            </div>
          )}
        </a>
      </span>
      {mounted && open
        ? createPortal(
            <div
              className="pointer-events-auto fixed z-[100] w-[min(calc(100vw-20px),880px)] max-w-[calc(100vw-20px)] rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
              style={{ top: pos.top, left: pos.left }}
              onMouseEnter={cancelHide}
              onMouseLeave={scheduleHide}
            >
              <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Play Store screenshots
              </p>
              {preview.status === "loading" || preview.status === "idle" ? (
                <div className="flex min-h-[200px] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
                  Loading…
                </div>
              ) : null}
              {preview.status === "error" ? (
                <div className="flex min-h-[120px] items-center justify-center px-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  Screenshots unavailable (blocked or markup changed).
                </div>
              ) : null}
              {preview.status === "ok" && preview.screenshots.length === 0 ? (
                <div className="flex min-h-[120px] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
                  No screenshots parsed for this listing.
                </div>
              ) : null}
              {preview.status === "ok" && preview.screenshots.length > 0 ? (
                <div className="flex max-h-[min(62vh,640px)] gap-3 overflow-x-auto overflow-y-hidden pb-2">
                  {preview.screenshots.slice(0, 8).map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element -- remote Play assets
                    <img
                      key={`${src}-${i}`}
                      src={src}
                      alt=""
                      className="h-[min(58vh,520px)] w-auto max-w-[min(92vw,800px)] shrink-0 rounded-lg border border-zinc-200 object-contain dark:border-zinc-700"
                    />
                  ))}
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
