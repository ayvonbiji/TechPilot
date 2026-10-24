import Image from "next/image";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Logo mark plus wordmark. `onDark` uses the white variant for the navy sidebar. */
export function BrandLockup({ onDark, className, size = "md" }: { onDark?: boolean; className?: string; size?: "md" | "lg" }) {
  const px = size === "lg" ? 44 : 36;
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Image src={onDark ? BRAND.markDark : BRAND.markLight} alt="" width={px} height={px} priority className="shrink-0" />
      <span className="leading-none">
        <span className={cn("block font-bold tracking-[0.02em]", size === "lg" ? "text-[19px]" : "text-[16px]", onDark ? "text-white" : "text-foreground")}>
          {BRAND.name}
        </span>
        <span className={cn("mt-1 block text-[9.5px] font-medium uppercase tracking-[0.18em]", onDark ? "text-sidebar-muted" : "text-muted")}>
          {BRAND.tagline}
        </span>
      </span>
    </span>
  );
}
