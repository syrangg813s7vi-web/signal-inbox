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

            <div className="rounded-[1.5rem] border border-[var(--border)] bg-[rgba(31,107,92,0.08)] p-4 lg:mt-auto">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.28em] text-[var(--accent)]">
                Reading Flow
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">
                Scan the preview, title, and short summary in one pass before deciding what deserves deeper reading.
              </p>
            </div>
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[0_18px_80px_rgba(29,34,28,0.08)]">
          <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-[var(--warm)]">
                  Review Layer
                </p>
                <h2 className="mt-2 font-[family-name:var(--font-display)] text-[1.8rem] leading-tight tracking-[-0.05em] text-[var(--foreground)] sm:text-[2.1rem]">
                  Compact queue for processed Items.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  Minimal reader-style rows over the existing persisted Inbox data path.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <ToolbarChip label={`${viewModel.items.length} visible`} />
                <ToolbarChip label={`${groupedCount} grouped`} />
                <ToolbarChip label={`${duplicateCount} duplicates`} />
              </div>
            </div>

            {!viewModel.isAvailable && viewModel.unavailableReason ? (
              <Banner message={viewModel.unavailableReason} tone="warning" />
            ) : null}
          </div>

          <div className="px-3 py-3 sm:px-4">
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
  const tone = getRowTone(item);
  const previewLabel = getPreviewLabel(item);

  return (
    <article className="group grid gap-3 rounded-[1.4rem] border border-[var(--border)] bg-[rgba(255,250,239,0.74)] px-3 py-3 transition hover:bg-[rgba(255,250,239,0.95)] md:grid-cols-[72px_minmax(0,1fr)] md:items-start md:px-4">
      <div
        className={`flex h-[84px] w-[64px] shrink-0 items-end overflow-hidden rounded-[1.1rem] border border-[var(--border)] px-3 py-2 text-left md:h-[92px] md:w-[72px] ${tone.previewClassName}`}
      >
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.24em] text-[rgba(255,250,239,0.86)]">
            {item.sourceTypeLabel ?? "Item"}
          </p>
          <p className="mt-1 text-lg leading-none text-white">{previewLabel}</p>
        </div>
      </div>

      <div className="min-w-0">
        <h3
          className="text-[15px] leading-6 font-medium text-[var(--foreground)] sm:text-base"
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          }}
        >
          {item.title}
        </h3>

        <p
          className="mt-1.5 overflow-hidden text-sm leading-6 text-[var(--muted)]"
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
          }}
        >
          {item.summaryShort ?? "No short summary was produced for this item."}
        </p>

        {item.url ? (
          <Link
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full border border-[rgba(29,34,28,0.1)] bg-[rgba(255,255,255,0.52)] px-2.5 py-1 text-[11px] uppercase tracking-[0.22em] text-[var(--accent)] transition hover:border-[rgba(31,107,92,0.24)] hover:bg-[rgba(31,107,92,0.08)]"
          >
            <span>Open</span>
            <span aria-hidden="true">↗</span>
          </Link>
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

function ToolbarChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
      {label}
    </span>
  );
}

function getPreviewLabel(item: InboxItemViewModel) {
  const sourceSeed = item.sourceName ?? item.topic ?? item.title;
  const letters = sourceSeed
    .split(/[\s/-]+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return letters || "IN";
}

function getRowTone(item: InboxItemViewModel) {
  if (item.duplicateOfItemId) {
    return {
      previewClassName: "bg-[linear-gradient(180deg,rgba(187,108,47,0.85),rgba(119,69,30,0.92))]",
    };
  }

  if (item.topic) {
    return {
      previewClassName: "bg-[linear-gradient(180deg,rgba(31,107,92,0.78),rgba(17,62,53,0.94))]",
    };
  }

  return {
    previewClassName: "bg-[linear-gradient(180deg,rgba(99,113,105,0.82),rgba(47,56,52,0.94))]",
  };
}
