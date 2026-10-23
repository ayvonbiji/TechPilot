import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[60dvh] items-center justify-center px-5">
      <div className="max-w-sm text-center">
        <span className="led mx-auto block text-subtle" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted">It may have been deleted, or the link is wrong.</p>
        <Button asChild className="mt-6"><Link href="/dashboard">Go to dashboard</Link></Button>
      </div>
    </main>
  );
}
