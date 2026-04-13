import Link from "next/link";

import {
  ARCHITECTURE_DOMAINS,
  ARCHITECTURE_LAYERS,
  type ArchitectureName,
} from "@signal-inbox/core";

const shellLinks = [
  { href: "/", label: "Home" },
  { href: "/inbox", label: "Inbox" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/sources", label: "Sources" },
];

function Chip({ label }: { label: ArchitectureName }) {
  return (
    <span className="rounded-full border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-1 text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
      {label}
    </span>
  );
}

export interface ShellFrameProps {
  eyebrow: string;
  title: string;
  description: string;
  callout: string;
  children?: React.ReactNode;
}

export function ShellFrame({
  eyebrow,
  title,
  description,
  callout,
  children,
}: ShellFrameProps) {
  return (
    <main className="min-h-screen px-6 py-8 sm:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[0_18px_80px_rgba(29,34,28,0.08)] backdrop-blur">
          <div className="flex flex-col gap-10 px-6 py-6 sm:px-8 sm:py-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.32em] text-[var(--muted)]">
                  Signal Inbox
                </p>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
                  Monorepo scaffold aligned to the documented architecture.
                </p>
              </div>
              <nav className="flex gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-strong)] p-1">
                {shellLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-full px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--accent-soft)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
              <section className="space-y-5">
                <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.28em] text-[var(--warm)]">
                  {eyebrow}
                </p>
                <div className="space-y-4">
                  <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-4xl leading-tight tracking-[-0.04em] sm:text-5xl">
                    {title}
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                    {description}
                  </p>
                </div>
              </section>

              <aside className="rounded-[1.5rem] border border-[var(--border)] bg-[rgba(29,34,28,0.03)] p-5">
                <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                  Ready For Follow-up
                </p>
                <p className="mt-4 text-sm leading-7 text-[var(--foreground)]">
                  {callout}
                </p>
              </aside>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel)] p-6">
            <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
              Product Domains
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {ARCHITECTURE_DOMAINS.map((domain) => (
                <Chip key={domain} label={domain} />
              ))}
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel)] p-6">
            <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
              Implementation Layers
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {ARCHITECTURE_LAYERS.map((layer) => (
                <Chip key={layer} label={layer} />
              ))}
            </div>
          </article>
        </section>

        {children}
      </div>
    </main>
  );
}
