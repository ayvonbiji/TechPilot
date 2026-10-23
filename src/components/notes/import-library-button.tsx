"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SquareTerminal } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { importCommandLibrary } from "@/lib/actions/notes";

export function ImportLibraryButton({ variant = "secondary", autoRun }: { variant?: ButtonProps["variant"]; autoRun?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ran = useRef(false);

  const run = () =>
    start(async () => {
      const res = await importCommandLibrary();
      if (res.ok) toast.success(res.message ?? "Imported");
      else toast.error(res.error);
    });

  // Deep link from the dashboard: /notes?import=1
  useEffect(() => {
    if (autoRun && params.get("import") === "1" && !ran.current) {
      ran.current = true;
      router.replace(pathname, { scroll: false });
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);

  return (
    <Button variant={variant} onClick={run} disabled={pending}>
      <SquareTerminal /> {pending ? "Importing…" : "Import command library"}
    </Button>
  );
}
