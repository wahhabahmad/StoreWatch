"use client";

import { useState } from "react";

export function CopyAppIdButton({ appStoreId }: { appStoreId: string }) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(appStoreId).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        });
      }}
      className="rounded border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {done ? "Copied" : "Copy id"}
    </button>
  );
}
