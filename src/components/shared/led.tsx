import { cn } from "@/lib/utils";

export type LedTone = "ok" | "warn" | "danger" | "idle" | "accent" | "info";

const toneClass: Record<LedTone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  idle: "text-subtle",
  accent: "text-accent",
  info: "text-info",
};

/** Port-light style status indicator. Always pair with a text label. */
export function Led({ tone, pulse, className }: { tone: LedTone; pulse?: boolean; className?: string }) {
  return <span aria-hidden className={cn("led", toneClass[tone], pulse && "led-pulse", className)} />;
}

export function LedLabel({
  tone,
  pulse,
  children,
  className,
}: {
  tone: LedTone;
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[13px] whitespace-nowrap", className)}>
      <Led tone={tone} pulse={pulse} />
      {children}
    </span>
  );
}
