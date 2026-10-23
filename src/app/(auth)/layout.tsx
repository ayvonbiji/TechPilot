export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5 text-white">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-active">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="3" y="4" width="18" height="12" rx="2" />
              <path d="M8 20h8M12 16v4" strokeLinecap="round" />
            </svg>
            <span className="led absolute -right-0.5 -top-0.5 text-ok" aria-hidden />
          </span>
          <span className="font-semibold">IT Engineer Companion</span>
        </div>

        <div className="max-w-sm">
          <p className="text-[1.65rem] font-semibold leading-snug text-white">
            Every fix you figure out, written down where you can find it again.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-sidebar-muted">
            Tasks, troubleshooting records, command notes, daily logs and your learning plan, in one private
            workspace that moves with you from internship to career.
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
