import Link from "next/link";

export function EmptyState({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="rounded-xl border bg-surface p-8 text-center">
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="mt-2 text-text-muted">{body}</p>
      {href && cta && (
        <Link href={href} className="mt-4 inline-block text-accent underline-offset-4 hover:underline">
          {cta}
        </Link>
      )}
    </div>
  );
}
