import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Link expired" };

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="max-w-sm text-center">
        <span className="led mx-auto block text-danger" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">That link didn&apos;t work</h1>
        <p className="mt-2 text-sm text-muted">
          Email links expire after a while and can only be used once. Request a new one and open it on this device.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="secondary"><Link href="/forgot-password">Request a new link</Link></Button>
          <Button asChild><Link href="/login">Sign in</Link></Button>
        </div>
      </div>
    </main>
  );
}
