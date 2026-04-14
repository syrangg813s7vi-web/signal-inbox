import Link from "next/link";

import type { InboxItemViewModel, InboxPageViewModel } from "@/server/inbox";

const surfaceLinks = [
  { href: "/", label: "Home", isActive: false },
  { href: "/inbox", label: "Inbox", isActive: true },
  { href: "/knowledge", label: "Knowledge", isActive: false },
  { href: "/sources", label: "Sources", isActive: false },
] as const;

export interface InboxPageProps {
  viewModel: InboxPageViewModel;
}

export function InboxPage({ viewModel }: InboxPageProps) {
  const duplicateCount = viewModel.items.filter((item) => item.duplicateOfItemId !== null).length;
  const groupedCount = viewModel.items.filter((item) => item.topicGroupTitle !== null).length;
  const topicCount = new Set(
    viewModel.items
      .map((item) => item.topic ?? item.classification)
      .filter((value): value is string => Boolean(value)),
  ).size;

  return (
    <main className="min-h-screen px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel-strong)] lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <div className="flex h-full flex-col gap-5 p-4 sm:p-5">
            <div className="space-y-2">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.32em] text-[var(--muted)]">
                Signal Inbox
              </p>
              <div>
                <h1 className="font-[family-name:var(--font-display)] text-[2rem] leading-none tracking-[-0.05em] text-[var(--foreground)]">
                  Inbox
                </h1>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Compact review surface for persisted Knowledge-layer output.
                </p>
              </div>
            </div>

            <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
              {surfaceLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition ${
                    link.isActive
                      ? "border border-[rgba(31,107,92,0.2)] bg-[rgba(31,107,92,0.12)] text-[var(--accent)]"
                      : "text-[var(--foreground)] hover:bg-[rgba(29,34,28,0.05)]"
                  }`}
                >
                  <span>{link.label}</span>
                  {link.isActive ? (
                    <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.22em]">
                      Now
                    </span>
                  ) : null}
                </Link>
              ))}
            </nav>

            <section className="space-y-3 rounded-[1.5rem] border border-[var(--border)] bg-[rgba(29,34,28,0.03)] p-4">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
                Queue Profile
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <SidebarMetric label="Visible now" value={viewModel.items.length.toString()} />
                <SidebarMetric label="Topic clusters" value={groupedCount.toString()} />
                <SidebarMetric label="Duplicates" value={duplicateCount.toString()} />
                <SidebarMetric label="Active topics" value={topicCount.toString()} />
              </div>
            </section>

            <section className="space-y-3 rounded-[1.5rem] border border-[var(--border)] bg-[rgba(255,255,255,0.45)] p-4">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
                Routing Rules
              </p>
              <ul className="space-y-2 text-sm leading-6 text-[var(--muted)]">
                <li>Result-first ordering stays on persisted importance and recency.</li>
                <li>Preview rows reflect processed Items, not raw capture payloads.</li>
                <li>Long source values stay clipped inside the reading column.</li>
              </ul>
            </section>

            <div className="rounded-[1.5rem] border border-[var(--border)] bg-[rgba(31,107,92,0.08)] p-4 lg:mt-auto">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.28em] text-[var(--accent)]">
                Reading Flow
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
                Scan the title first, glance source context second, then open the original link only when the
                summary earns it.
              </p>
            </div>
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[0_18px_80px_rgba(29,34,28,0.08)]">
          <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-[var(--warm)]">
                  Review Layer
                </p>
                <h2 className="mt-2 font-[family-name:var(--font-display)] text-[2rem] leading-tight tracking-[-0.05em] text-[var(--foreground)] sm:text-[2.35rem]">
                  Dense reader view for processed Items.
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)] sm:text-[15px]">
                  The Inbox remains result-first and continues to render persisted Knowledge output only. This
                  surface tightens the layout into scan-first rows instead of stacked cards.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <ToolbarChip label={`${viewModel.items.length} visible`} />
                <ToolbarChip label={`${groupedCount} grouped`} />
                <ToolbarChip label={`${duplicateCount} duplicates`} />
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <SummaryTile
                label="Ordering"
                value="Importance then recency"
                detail="Persisted scores from the Knowledge layer."
              />
              <SummaryTile
                label="Focus"
                value="Title, source, summary, date"
                detail="The primary scan path mirrors a reader list."
              />
              <SummaryTile
                label="Contract"
                value="Existing Inbox data path"
                detail="No fallback to raw capture payloads."
              />
            </div>

            {!viewModel.isAvailable && viewModel.unavailableReason ? (
              <Banner message={viewModel.unavailableReason} tone="warning" />
            ) : null}
          </div>

          <div className="px-3 py-3 sm:px-4">
            <div className="hidden grid-cols-[minmax(0,1.35fr)_minmax(180px,0.7fr)_120px] gap-4 rounded-[1.25rem] px-4 py-3 text-[11px] uppercase tracking-[0.28em] text-[var(--muted)] md:grid">
              <span>Item</span>
              <span>Source Context</span>
              <span className="text-right">Signals</span>
            </div>

            {viewModel.items.length === 0 ? (
              <EmptyState isAvailable={viewModel.isAvailable} />
            ) : (
              <div className="space-y-2">
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
  return (
    <article className="grid gap-4 rounded-[1.4rem] border border-[var(--border)] bg-[rgba(255,250,239,0.72)] px-4 py-4 transition hover:bg-[rgba(255,250,239,0.92)] md:grid-cols-[minmax(0,1.35fr)_minmax(180px,0.7fr)_120px] md:px-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start gap-2">
          <h3 className="min-w-0 flex-1 text-base leading-6 font-medium text-[var(--foreground)] sm:text-[17px]">
            {item.title}
          </h3>
          {item.duplicateOfItemId ? <InlineChip label="Duplicate" tone="warm" /> : null}
          {item.classification ? <InlineChip label={item.classification} tone="neutral" /> : null}
          {item.topic ? <InlineChip label={item.topic} tone="accent" /> : null}
        </div>

        <p
          className="mt-2 overflow-hidden text-sm leading-6 text-[var(--muted)]"
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
          }}
        >
          {item.summaryShort ?? "No short summary was produced for this item."}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          {item.sourceTypeLabel ? <span>{item.sourceTypeLabel}</span> : null}
          {item.sourceName ? <span>{item.sourceName}</span> : null}
          {item.sourceTopic ? <span>{item.sourceTopic}</span> : null}
          {item.topicGroupTitle ? <span>Group {item.topicGroupTitle}</span> : null}
        </div>

        {item.url ? (
          <div className="mt-3 min-w-0">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[var(--accent)] underline-offset-4 hover:underline"
              title={item.url}
            >
              {item.url}
            </a>
          </div>
        ) : null}
      </div>

      <div className="min-w-0 space-y-3 border-t border-[var(--border)] pt-3 md:border-t-0 md:border-l md:pl-4 md:pt-0">
        <MetadataBlock label="Published" value={item.publishedAtLabel ?? "Recently processed"} />
        <MetadataBlock label="Topic group" value={item.topicGroupTitle ?? "Unclustered"} />

        <div className="flex flex-wrap gap-2">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 border-t border-[var(--border)] pt-3 md:block md:border-t-0 md:pt-0">
        <div className="space-y-3 text-right md:text-left">
          <SignalPair label="Impact" value={item.importanceScore} />
          <SignalPair label="Novelty" value={item.noveltyScore} />
        </div>

        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-full border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-xs uppercase tracking-[0.2em] text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Open
          </a>
        ) : null}
      </div>
    </article>
  );
}

function Banner({ message, tone }: { message: string; tone: "warning" }) {
  const toneClassName =
    tone === "warning"
      ? "border-[rgba(29,34,28,0.16)] bg-[rgba(29,34,28,0.05)] text-[var(--foreground)]"
      : "";

  return <p className={`mt-4 rounded-[1.25rem] border px-4 py-3 text-sm leading-6 ${toneClassName}`}>{message}</p>;
}

function EmptyState({ isAvailable }: { isAvailable: boolean }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-[rgba(255,250,239,0.65)] px-5 py-12 text-sm leading-6 text-[var(--muted)]">
      {isAvailable
        ? "No processed Items are available yet. Once capture and normalization produce Items, the Knowledge pipeline will populate this reading list."
        : "The route loaded, but processed Items are unavailable in this environment."}
    </div>
  );
}

function SidebarMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[1rem] border border-[var(--border)] bg-[rgba(255,255,255,0.35)] px-3 py-2.5">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.22em] text-[var(--foreground)]">
        {value}
      </span>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-[1.1rem] border border-[var(--border)] bg-[rgba(255,255,255,0.42)] p-3.5">
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-[var(--foreground)]">{value}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{detail}</p>
    </article>
  );
}

function ToolbarChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
      {label}
    </span>
  );
}

function InlineChip({ label, tone }: { label: string; tone: "accent" | "neutral" | "warm" }) {
  const toneClassName =
    tone === "accent"
      ? "bg-[rgba(31,107,92,0.12)] text-[var(--accent)]"
      : tone === "warm"
        ? "bg-[rgba(187,108,47,0.12)] text-[var(--warm)]"
        : "bg-[rgba(29,34,28,0.08)] text-[var(--muted)]";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${toneClassName}`}>
      {label}
    </span>
  );
}

function MetadataBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-6 text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function SignalPair({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm leading-6 text-[var(--foreground)]">{formatScore(value)}</p>
    </div>
  );
}

function formatScore(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  return value.toFixed(2);
}
