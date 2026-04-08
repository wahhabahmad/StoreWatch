"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SHOW_DELAY_MS = 200;
const HIDE_DELAY_MS = 160;

export function GameNameWithStorePreview({
  href,
  children,
  screenshotUrls,
}: {
  href: string;
  children: React.ReactNode;
  screenshotUrls: string[];
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePos = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelW = 340;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - panelW - 8);
    setPos({ top: r.bottom + 8, left });
  }, []);

  const scheduleShow = useCallback(() => {
    clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => {
      updatePos();
      setOpen(true);
    }, SHOW_DELAY_MS);
  }, [updatePos]);

  const scheduleHide = useCallback(() => {
    clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setOpen(false), HIDE_DELAY_MS);
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

  const linkClass = "hover:underline";

  if (screenshotUrls.length === 0) {
    return (
      <span ref={anchorRef} className="inline-block">
        <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {children}
        </a>
      </span>
    );
  }

  return (
    <>
      <span
        ref={anchorRef}
        className="inline-block"
        onMouseEnter={scheduleShow}
        onMouseLeave={scheduleHide}
      >
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          onFocus={scheduleShow}
          onBlur={scheduleHide}
        >
          {children}
        </a>
      </span>
      {mounted && open
        ? createPortal(
            <div
              className="pointer-events-auto fixed z-[100] max-w-[min(340px,calc(100vw-24px))] rounded-xl border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
              style={{ top: pos.top, left: pos.left }}
              onMouseEnter={cancelHide}
              onMouseLeave={scheduleHide}
            >
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                App Store screenshots
              </p>
              <div className="flex max-h-[260px] gap-2 overflow-x-auto overflow-y-hidden pb-1">
                {screenshotUrls.slice(0, 8).map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- remote App Store assets
                  <img
                    key={`${src}-${i}`}
                    src={src}
                    alt=""
                    className="h-[220px] w-auto max-w-[none] shrink-0 rounded-md border border-zinc-100 object-contain dark:border-zinc-800"
                  />
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
