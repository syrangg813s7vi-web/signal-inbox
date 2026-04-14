import Link from "next/link";

import type { InboxItemViewModel, InboxPageViewModel } from "@/server/inbox";

const inboxSurfaceLinks = [
  { href: "/", label: "Home", active: false },
  { href: "/inbox", label: "Inbox", active: true },
  { href: "/knowledge", label: "Knowledge", active: false },
  { href: "/sources", label: "Sources", active: false },
] as const;

export interface InboxPageProps {
  viewModel: InboxPageViewModel;
}

export function InboxPage({ viewModel }: InboxPageProps) {
  const groupedCount = viewModel.items.filter((item) => item.topicGroupTitle).length;
  const duplicateCount = viewModel.items.filter((item) => item.duplicateOfItemId).length;
  const linkedCount = viewModel.items.filter((item) => item.url).length;

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[0_18px_80px_rgba(29,34,28,0.08)] backdrop-blur">
            <div className="border-b border-[var(--border)] px-5 py-5">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.32em] text-[var(--muted)]">
                Signal Inbox
              </p>
              <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl leading-none tracking-[-0.05em] text-[var(--foreground)]">
                Inbox
              </h1>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Processed Items for compact, scan-first review.
              </p>
            </div>

            <nav className="border-b border-[var(--border)] px-3 py-3">
              {inboxSurfaceLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center justify-between rounded-2xl px-3 py-3 text-sm transition ${
                    link.active
                      ? "bg-[var(--foreground)] text-[var(--panel-strong)]"
                      : "text-[var(--foreground)] hover:bg-[rgba(29,34,28,0.05)]"
                  }`}
                >
                  <span>{link.label}</span>
                  {link.active ? (
                    <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.18em]">
                      Live
                    </span>
                  ) : null}
                </Link>
              ))}
            </nav>

            <section className="border-b border-[var(--border)] px-5 py-5">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">
                Reader Summary
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <Metric label="Visible" value={String(viewModel.items.length)} />
                <Metric label="Grouped" value={String(groupedCount)} />
                <Metric label="Duplicates" value={String(duplicateCount)} />
                <Metric label="Linked" value={String(linkedCount)} />
              </dl>
            </section>

            <section className="px-5 py-5">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.26em] text-[var(--muted)]">
                Reading Notes
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
                <li>Result-first ordering from persisted Knowledge-layer output.</li>
                <li>Dense rows keep title, source, summary, and date in one scan path.</li>
                <li>Long source links are truncated inside the page width.</li>
              </ul>
            </section>
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[0_18px_80px_rgba(29,34,28,0.08)] backdrop-blur">
          <header className="border-b border-[var(--border)] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.32em] text-[var(--warm)]">
                  Reader View
                </p>
                <h2 className="mt-3 max-w-3xl font-[family-name:var(--font-display)] text-3xl leading-tight tracking-[-0.05em] text-[var(--foreground)] sm:text-4xl">
                  Processed Items, compressed into a library-style reading list.
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)] sm:text-base">
                  Inbox stays result-first: score, dedupe, summarize, classify, and group complete
                  before Items appear here for review.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                <Pill>{viewModel.items.length} visible</Pill>
                <Pill>Persisted only</Pill>
                <Pill>Compact list</Pill>
              </div>
            </div>

            {!viewModel.isAvailable && viewModel.unavailableReason ? (
              <Banner message={viewModel.unavailableReason} tone="warning" />
            ) : null}
          </header>

          <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
            {viewModel.items.length === 0 ? (
              <EmptyState isAvailable={viewModel.isAvailable} />
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {viewModel.items.map((item) => (
                  <InboxListRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function InboxListRow({ item }: { item: InboxItemViewModel }) {
  const sourceLine = compactParts([
    item.sourceName ? `Source ${item.sourceName}` : null,
    item.sourceTopic ? `Topic ${item.sourceTopic}` : null,
    item.sourceTypeLabel,
    item.topicGroupTitle ? `Group ${item.topicGroupTitle}` : null,
  ]);

  const signalLine = compactParts([
    `Importance ${formatScore(item.importanceScore)}`,
    `Novelty ${formatScore(item.noveltyScore)}`,
    item.classification,
    item.duplicateOfItemId ? "Duplicate" : null,
  ]);

  return (
    <article className="grid gap-4 px-3 py-4 sm:px-4 md:grid-cols-[minmax(0,1fr)_176px] md:gap-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {item.topic ? <InlineChip label={item.topic} tone="accent" /> : null}
          {item.classification ? <InlineChip label={item.classification} tone="neutral" /> : null}
          {item.duplicateOfItemId ? <InlineChip label="Duplicate" tone="warm" /> : null}
        </div>

        <h3 className="mt-3 text-base font-medium leading-6 text-[var(--foreground)] sm:text-lg">
          {item.title}
        </h3>

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
          {item.summaryShort ?? "No short summary was produced for this item."}
        </p>

        {sourceLine ? (
          <p className="mt-3 line-clamp-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            {sourceLine}
          </p>
        ) : null}

        <p className="mt-2 line-clamp-1 text-sm leading-6 text-[var(--muted)]">
          {signalLine}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="min-w-0 border-t border-[var(--border)] pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
          {item.publishedAtLabel ?? "Date unavailable"}
        </p>

        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            title={item.url}
            className="mt-3 block min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-3 text-sm leading-5 text-[var(--accent)] transition hover:bg-[rgba(31,107,92,0.08)]"
          >
            <span className="block font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Open source
            </span>
            <span className="mt-2 block break-all text-sm leading-5">
              {formatUrlLabel(item.url)}
            </span>
          </a>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-[var(--border)] px-3 py-3 text-sm leading-5 text-[var(--muted)]">
            Source link unavailable.
          </div>
        )}
      </div>
    </article>
  );
}

function EmptyState({ isAvailable }: { isAvailable: boolean }) {
  return (
    <div className="px-3 py-8 sm:px-4 sm:py-10">
      <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-[rgba(29,34,28,0.03)] px-5 py-8 text-sm leading-6 text-[var(--muted)]">
        {isAvailable
          ? "No processed Items yet. Once capture and normalization produce Items, the Knowledge pipeline will populate this reading list."
          : "The route loaded, but processed Items are unavailable in this environment."}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-3">
      <dt className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </dt>
      <dd className="mt-2 text-lg font-medium text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function Banner({ message, tone }: { message: string; tone: "warning" }) {
  const toneClassName =
    tone === "warning"
      ? "border-[rgba(29,34,28,0.16)] bg-[rgba(29,34,28,0.05)] text-[var(--foreground)]"
      : "";

  return <p className={`mt-5 rounded-2xl border px-4 py-3 text-sm leading-6 ${toneClassName}`}>{message}</p>;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-1.5">
      {children}
    </span>
  );
}

function InlineChip({ label, tone }: { label: string; tone: "accent" | "neutral" | "warm" }) {
  const toneClassName =
    tone === "accent"
      ? "bg-[rgba(31,107,92,0.12)] text-[var(--accent)]"
      : tone === "warm"
        ? "bg-[rgba(181,71,33,0.12)] text-[var(--warm)]"
        : "bg-[rgba(29,34,28,0.08)] text-[var(--muted)]";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] ${toneClassName}`}>
      {label}
    </span>
  );
}

function compactParts(parts: Array<string | null>) {
  return parts.filter((part): part is string => Boolean(part)).join("  ·  ");
}

function formatScore(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  return value.toFixed(2);
}

function formatUrlLabel(url: string) {
  try {
    const parsed = new URL(url);
    const normalizedPath = parsed.pathname === "/" ? "" : parsed.pathname;
    const label = `${parsed.host}${normalizedPath}`;

    return label.length > 72 ? `${label.slice(0, 69)}...` : label;
  } catch {
    return url.length > 72 ? `${url.slice(0, 69)}...` : url;
  }
}
