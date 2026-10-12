"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "./toaster";

/** Retry a dead job or cancel a pending one (FR-32, FR-38). */
export function JobButton({ id, action, label }: { id: string; action: "retry" | "cancel"; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={label}
      onClick={async () => {
        setBusy(true);
        const res = await fetch(`/api/jobs/${id}/${action}`, { method: "POST" });
        setBusy(false);
        toast(res.ok ? (action === "retry" ? "Job queued for retry" : "Job cancelled") : "Action failed", {
          error: !res.ok,
        });
        router.refresh();
      }}
      className="rounded-md border px-2.5 py-1 text-xs hover:bg-surface-2 disabled:opacity-60"
    >
      {action === "retry" ? "Retry" : "Cancel"}
    </button>
  );
}
