import { isSupabaseConfigured } from "@/lib/supabase/env";
import { redirect } from "next/navigation";

export const metadata = { title: "Finish setup" };

const code = "font-mono text-[13px]";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const configured = isSupabaseConfigured();

  if (configured && reason === "database-update") {
    return (
      <main className="flex min-h-dvh items-center justify-center px-5 py-12">
        <div className="max-w-xl">
          <span className="led text-warn" aria-hidden />
          <h1 className="mt-3 text-2xl font-semibold">The database needs an update</h1>
          <p className="mt-2 text-sm text-muted">
            This version of the app uses workspaces, but the connected Supabase database doesn&apos;t have them yet. Your data is
            safe; nothing has been changed.
          </p>
          <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm">
            <li>
              Check which Supabase project this deployment uses. Vercel preview deployments should point to your{" "}
              <strong>staging</strong> project (Vercel → Settings → Environment Variables, <em>Preview</em> environment).
            </li>
            <li>
              In that project&apos;s SQL Editor, run any files from <code className={code}>supabase/migrations/</code> it hasn&apos;t
              had yet, in filename order. The workspace update is <code className={code}>20261024000000_workspaces.sql</code>.
            </li>
            <li>Reload this site and sign in again.</li>
          </ol>
          <p className="mt-6 text-sm text-muted">
            Updating production? Back it up first and follow <code className={code}>docs/DEPLOYMENT.md</code>.
          </p>
        </div>
      </main>
    );
  }

  if (configured) redirect("/login");

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="max-w-lg">
        <span className="led text-warn" aria-hidden />
        <h1 className="mt-3 text-2xl font-semibold">Connect a Supabase project</h1>
        <p className="mt-2 text-sm text-muted">
          The app needs a database before anyone can sign in. This page only appears while the environment variables are missing.
        </p>
        <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm">
          <li>Create a project at supabase.com and run every file in <code className={code}>supabase/migrations/</code> in its SQL editor, in filename order.</li>
          <li>Copy <code className={code}>.env.example</code> to <code className={code}>.env.local</code>.</li>
          <li>Fill in <code className={code}>NEXT_PUBLIC_SUPABASE_URL</code> and <code className={code}>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>.</li>
          <li>Restart the dev server. On Vercel, add the same variables and redeploy.</li>
        </ol>
        <p className="mt-6 text-sm text-muted">Full steps are in the project README.</p>
      </div>
    </main>
  );
}
