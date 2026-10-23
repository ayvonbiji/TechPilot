"use client";

import { useOptimistic, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { toggleFavorite } from "@/lib/actions/notes";
import { cn } from "@/lib/utils";

export function FavoriteButton({ id, value, title }: { id: string; value: boolean; title: string }) {
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={optimistic}
      aria-label={optimistic ? `Remove "${title}" from favourites` : `Add "${title}" to favourites`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(async () => {
          setOptimistic(!optimistic);
          const res = await toggleFavorite(id, !optimistic);
          if (!res.ok) toast.error(res.error);
        });
      }}
      className="cursor-pointer rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-warn"
    >
      <Star className={cn("h-4 w-4", optimistic && "fill-warn text-warn")} aria-hidden />
    </button>
  );
}
