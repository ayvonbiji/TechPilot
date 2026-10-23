import Link from "next/link";

export function TagList({ tags, hrefBase }: { tags: string[]; hrefBase?: string }) {
  if (!tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
      {tags.map((t) => (
        <li key={t}>
          {hrefBase ? (
            <Link
              href={`${hrefBase}?tag=${encodeURIComponent(t)}`}
              className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-xs text-muted hover:border-border-strong hover:text-foreground"
            >
              #{t}
            </Link>
          ) : (
            <span className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-xs text-muted">#{t}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
