import Link from "next/link";

const shellLinks = [
  { href: "/", label: "Home" },
  { href: "/inbox", label: "Inbox" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/sources", label: "Sources" },
];

export interface ShellFrameProps {
  activeHref: string;
  eyebrow: string;
  title: string;
  description: string;
  sidebarDescription?: string;
  headerAside?: React.ReactNode;
  children?: React.ReactNode;
}

export function ShellFrame({
  activeHref,
  eyebrow,
  title,
  description,
  sidebarDescription,
  headerAside,
  children,
}: ShellFrameProps) {
  return (
    <main className="min-h-screen px-3 py-3 sm:px-5 sm:py-5 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel-strong)] lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <div className="flex h-full flex-col gap-5 p-4 sm:p-5">
            <div className="space-y-2">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.32em] text-[var(--muted)]">
                Signal Inbox
              </p>
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-[2rem] leading-none tracking-[-0.05em] text-[var(--foreground)]">
                  {eyebrow}
                </h1>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {sidebarDescription ?? description}
                </p>
              </div>
            </div>

            <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
              {shellLinks.map((link) => {
                const isActive = link.href === activeHref;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition ${
                      isActive
                        ? "border border-[rgba(31,107,92,0.2)] bg-[rgba(31,107,92,0.12)] text-[var(--accent)]"
                        : "text-[var(--foreground)] hover:bg-[rgba(29,34,28,0.05)]"
                    }`}
                  >
                    <span>{link.label}</span>
                    {isActive ? (
                      <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.22em]">
                        Now
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[0_18px_80px_rgba(29,34,28,0.08)]">
          <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-[var(--warm)]">
                  {eyebrow}
                </p>
                <h2 className="mt-2 max-w-3xl font-[family-name:var(--font-display)] text-[1.8rem] leading-tight tracking-[-0.05em] text-[var(--foreground)] sm:text-[2.1rem]">
                  {title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p>
              </div>

              {headerAside ? <div className="flex flex-wrap gap-2">{headerAside}</div> : null}
            </div>
          </div>

          {children ? <div className="px-3 py-3 sm:px-4">{children}</div> : null}
        </section>
      </div>
    </main>
  );
}
