"use client";

import { useEffect } from "react";

/** Last-resort error screen for failures in layouts (e.g. the app shell). */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="max-w-md text-center">
        <span className="led mx-auto block text-danger" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">KADACKAL couldn&apos;t load</h1>
        <p className="mt-2 text-sm text-muted">
          Your saved work is safe. This is usually a temporary connection problem with the database. Try again in a moment.
        </p>
        {error.digest && <p className="mt-2 font-mono text-[12px] text-subtle">Reference: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={reset} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover">
            Try again
          </button>
          <a href="/login" className="rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2">
            Sign in again
          </a>
        </div>
      </div>
    </main>
  );
}
