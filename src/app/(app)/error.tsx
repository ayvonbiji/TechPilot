"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <span className="led mx-auto block text-danger" aria-hidden />
      <h1 className="mt-4 text-xl font-semibold">This page didn&apos;t load</h1>
      <p className="mt-2 text-sm text-muted">
        Something went wrong while loading your data. Your saved work is safe. Try again, and if it keeps happening, check that
        your Supabase project is running.
      </p>
      {error.digest && <p className="mt-2 font-mono text-[12px] text-subtle">Reference: {error.digest}</p>}
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </div>
  );
}
