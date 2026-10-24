import { BrandLockup } from "@/components/layout/brand-mark";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <BrandLockup onDark size="lg" />

        <div className="max-w-sm">
          <p className="text-[1.65rem] font-semibold leading-snug text-white">
            Support, solve and grow together with your clients.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-sidebar-muted">
            Tickets, clients, a customer portal, a shared knowledge base and service reports, plus a private
            workspace for your own tasks, notes and learning.
          </p>
        </div>

        <ul className="space-y-2.5 font-mono text-[12.5px]" aria-label="Example status lights">
          <li className="flex items-center gap-2.5"><span className="led text-ok" /> Link up, knowledge base synced</li>
          <li className="flex items-center gap-2.5"><span className="led led-pulse text-warn" /> 3 tasks in progress</li>
          <li className="flex items-center gap-2.5"><span className="led text-subtle" /> Nothing overdue</li>
        </ul>
      </aside>
      <main className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[380px]">{children}</div>
      </main>
    </div>
  );
}
