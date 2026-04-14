import Link from "next/link";

const ARCHITECTURE_DOMAINS = [
  "Capture",
  "Knowledge",
  "Review",
] as const;

const ARCHITECTURE_LAYERS = [
  "Capture Layer",
  "Normalization Layer",
  "Knowledge Layer",
  "Review Layer",
] as const;

type ArchitectureDomain = (typeof ARCHITECTURE_DOMAINS)[number];
type ArchitectureLayer = (typeof ARCHITECTURE_LAYERS)[number];
type ArchitectureName = ArchitectureDomain | ArchitectureLayer;

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
  activeHref: string;
  eyebrow: string;
  title: string;
  description: string;
  callout: string;
  children?: React.ReactNode;
}

export function ShellFrame({
  activeHref,
  eyebrow,
  title,
  description,
  callout,
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
                  Shared reader shell for the core product surfaces.
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

            <section className="space-y-3 rounded-[1.5rem] border border-[var(--border)] bg-[rgba(29,34,28,0.03)] p-4">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
                Product Model
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-[var(--muted)]">Domains</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ARCHITECTURE_DOMAINS.map((domain) => (
                      <Chip key={domain} label={domain} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-[var(--muted)]">Layers</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ARCHITECTURE_LAYERS.map((layer) => (
                      <Chip key={layer} label={layer} />
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <div className="rounded-[1.5rem] border border-[var(--border)] bg-[rgba(31,107,92,0.08)] p-4 lg:mt-auto">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.28em] text-[var(--accent)]">
                Reader Rhythm
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">{callout}</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[0_18px_80px_rgba(29,34,28,0.08)]">
          <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-[var(--warm)]">
                {eyebrow}
              </p>
              <h2 className="mt-2 max-w-3xl font-[family-name:var(--font-display)] text-[1.8rem] leading-tight tracking-[-0.05em] text-[var(--foreground)] sm:text-[2.1rem]">
                {title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p>
            </div>
          </div>

          {children ? <div className="px-3 py-3 sm:px-4">{children}</div> : null}
        </section>
      </div>
    </main>
  );
}
