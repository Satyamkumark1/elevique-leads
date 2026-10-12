"use client";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-error bg-surface p-8 text-center">
      <h2 className="font-serif text-2xl">Something went wrong</h2>
      <p className="mt-2 text-text-muted">This page could not load. Your data is safe.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 h-9 rounded-md border bg-surface-2 px-4 font-medium"
      >
        Try again
      </button>
    </div>
  );
}
