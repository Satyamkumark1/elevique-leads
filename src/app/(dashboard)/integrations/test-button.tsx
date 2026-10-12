"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

export function TestButton({ integration, label }: { integration: string; label: string }) {
  const [state, setState] = useState<{ busy?: boolean; ok?: boolean; detail?: string }>({});
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={state.busy}
        aria-label={`Test ${label}`}
        onClick={async () => {
          setState({ busy: true });
          const res = await fetch("/api/integrations/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ integration }),
          });
          const json = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: string };
          setState({ ok: !!json.ok, detail: json.detail ?? `HTTP ${res.status}` });
        }}
        className="h-8 rounded-md border bg-surface-2 px-3 text-[13px] hover:border-text-muted disabled:opacity-60"
      >
        {state.busy ? "Testing…" : "Test"}
      </button>
      {state.detail && (
        <span
          role="status"
          className={`flex items-center gap-1 text-xs ${state.ok ? "text-success" : "text-error"}`}
        >
          {state.ok ? <Check size={12} aria-hidden /> : <X size={12} aria-hidden />} {state.detail}
        </span>
      )}
    </div>
  );
}
