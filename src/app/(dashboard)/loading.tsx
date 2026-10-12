export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border bg-surface" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl border bg-surface" />
    </div>
  );
}
