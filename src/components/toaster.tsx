"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; text: string; error?: boolean };

/** Fire a toast from any client component. */
export function toast(text: string, opts: { error?: boolean } = {}) {
  window.dispatchEvent(new CustomEvent("app-toast", { detail: { text, error: opts.error } }));
}

/** Bottom-right toasts (UI_SPEC §4). Mounted once in the dashboard layout. */
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    let n = 0;
    const onToast = (e: Event) => {
      const { text, error } = (e as CustomEvent<{ text: string; error?: boolean }>).detail;
      const id = ++n;
      setToasts((t) => [...t, { id, text, error }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
    };
    window.addEventListener("app-toast", onToast);
    return () => window.removeEventListener("app-toast", onToast);
  }, []);

  return (
    <div aria-live="polite" className="fixed right-4 bottom-20 z-50 flex flex-col gap-2 md:bottom-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`rounded-md border bg-surface px-4 py-3 text-sm ${t.error ? "border-error text-error-fg" : ""}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
