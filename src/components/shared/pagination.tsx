import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Server-rendered pager that keeps the current filters in the URL. */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && k !== "page" && q.set(k, v));
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav className="no-print flex items-center justify-between gap-3 px-1 py-3 text-sm" aria-label="Pagination">
      <p className="text-muted">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={href(page - 1)} className={buttonVariants({ variant: "secondary", size: "sm" })} aria-label="Previous page">
            <ChevronLeft /> Previous
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "pointer-events-none opacity-40")} aria-hidden>
            <ChevronLeft /> Previous
          </span>
        )}
        <span className="px-2 text-muted">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={buttonVariants({ variant: "secondary", size: "sm" })} aria-label="Next page">
            Next <ChevronRight />
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "pointer-events-none opacity-40")} aria-hidden>
            Next <ChevronRight />
          </span>
        )}
      </div>
    </nav>
  );
}
