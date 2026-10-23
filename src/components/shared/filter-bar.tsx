"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterDef {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
}

/**
 * Search box + filter selects that live in the URL, so results are queried on the
 * server from real saved data and filtered views can be bookmarked.
 */
export function FilterBar({
  searchPlaceholder = "Search…",
  filters = [],
  sort,
  className,
}: {
  searchPlaceholder?: string;
  filters?: FilterDef[];
  sort?: FilterDef;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const first = useRef(true);

  function push(next: URLSearchParams) {
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function setParam(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    push(next);
  }

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const current = params.get("q") ?? "";
      if (current !== q.trim()) setParam("q", q.trim());
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = [...filters.map((f) => f.name), "q", "tag"].some((n) => params.get(n));

  return (
    <div className={cn("no-print flex flex-col gap-2 lg:flex-row lg:items-center", className)} aria-busy={pending}>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="pl-9"
          maxLength={100}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {filters.map((f) => (
          <Select
            key={f.name}
            aria-label={f.label}
            value={params.get(f.name) ?? ""}
            onChange={(e) => setParam(f.name, e.target.value)}
            className="sm:w-auto sm:min-w-36"
          >
            <option value="">{f.label}: all</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ))}
        {sort && (
          <Select
            aria-label={sort.label}
            value={params.get(sort.name) ?? sort.options[0]?.value ?? ""}
            onChange={(e) => setParam(sort.name, e.target.value === sort.options[0]?.value ? "" : e.target.value)}
            className="sm:w-auto sm:min-w-40"
          >
            {sort.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
        {active && (
          <Button
            variant="ghost"
            onClick={() => {
              setQ("");
              const next = new URLSearchParams();
              const s = sort && params.get(sort.name);
              if (s) next.set(sort!.name, s);
              push(next);
            }}
          >
            <X /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
