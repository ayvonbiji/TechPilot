import { ShieldAlert } from "lucide-react";
import { PRIVACY_REMINDER } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function PrivacyNotice({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        "flex gap-3 rounded-lg border border-warn/30 bg-warn-soft px-3.5 py-3 text-[13px] text-foreground",
        className,
      )}
    >
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
      <p>
        <span className="font-medium">Keep it personal and general.</span> {PRIVACY_REMINDER}
      </p>
    </div>
  );
}
