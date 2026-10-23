import { isSupabaseConfigured } from "@/lib/supabase/env";
import { redirect } from "next/navigation";

export const metadata = { title: "Finish setup" };

export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/login");
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="max-w-lg">
        <span className="led text-warn" aria-hidden />
        <h1 className="mt-3 text-2xl font-semibold">Connect a Supabase project</h1>
        <p className="mt-2 text-sm text-muted">
          The app needs a database before anyone can sign in. This page only appears while the environment
          variables are missing.
        </p>
        <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm">
          <li>Create a project at supabase.com and run <code className="font-mono text-[13px]">supabase/migrations/*.sql</code> in its SQL editor.</li>
          <li>Copy <code className="font-mono text-[13px]">.env.example</code> to <code className="font-mono text-[13px]">.env.local</code>.</li>
          <li>Fill in <code className="font-mono text-[13px]">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono text-[13px]">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>.</li>
          <li>Restart the dev server. On Vercel, add the same variables and redeploy.</li>
        </ol>
        <p className="mt-6 text-sm text-muted">Full steps are in the project README.</p>
      </div>
    </main>
  );
}
