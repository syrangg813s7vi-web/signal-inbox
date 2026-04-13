import type { InboxItemViewModel, InboxPageViewModel } from "@/server/inbox";

import { ShellFrame } from "./shell-frame";

export interface InboxPageProps {
  viewModel: InboxPageViewModel;
}

export function InboxPage({ viewModel }: InboxPageProps) {
  return (
    <ShellFrame
      eyebrow="Inbox"
      title="Processed Items land here once Knowledge has done the first pass."
      description="Inbox stays result-first: score, dedupe, summarize, classify, and group run before items show up for review."
      callout="This view reads persisted Knowledge-layer output only. It does not fetch, normalize, or process source content."
    >
      <section className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel)] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
              Processed Items
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Ordered for review by persisted importance and recency.
            </p>
          </div>
          <span className="rounded-full border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
            {viewModel.items.length} visible
          </span>
        </div>

        {!viewModel.isAvailable && viewModel.unavailableReason ? (
          <Banner message={viewModel.unavailableReason} tone="warning" />
        ) : null}

        <div className="mt-6 space-y-4">
          {viewModel.items.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-[rgba(29,34,28,0.03)] px-5 py-8 text-sm leading-6 text-[var(--muted)]">
              {viewModel.isAvailable
                ? "No processed Items yet. Once capture and normalization produce Items, the Knowledge pipeline will populate this surface."
                : "The route loaded, but processed Items are unavailable in this environment."}
            </div>
          ) : (
            viewModel.items.map((item) => <InboxItemCard key={item.id} item={item} />)
          )}
        </div>
      </section>
    </ShellFrame>
  );
}

function InboxItemCard({ item }: { item: InboxItemViewModel }) {
  return (
    <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-medium text-[var(--foreground)]">{item.title}</h2>
            {item.topic ? <Chip label={item.topic} tone="accent" /> : null}
            {item.classification ? <Chip label={item.classification} tone="neutral" /> : null}
            {item.duplicateOfItemId ? <Chip label="Duplicate" tone="warm" /> : null}
          </div>

          <p className="text-sm leading-6 text-[var(--muted)]">
            {item.summaryShort ?? "No short summary was produced for this item."}
          </p>

          <div className="flex flex-wrap gap-2">
            {item.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]"
              >
                {tag}
              </span>
            ))}
          </div>

          {item.sourceName || item.sourceTopic || item.sourceTypeLabel ? (
            <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              {item.sourceName ? (
                <span className="rounded-full border border-[var(--border)] px-3 py-1">
                  Source {item.sourceName}
                </span>
              ) : null}
              {item.sourceTopic ? (
                <span className="rounded-full border border-[var(--border)] px-3 py-1">
                  Topic {item.sourceTopic}
                </span>
              ) : null}
              {item.sourceTypeLabel ? (
                <span className="rounded-full border border-[var(--border)] px-3 py-1">
                  {item.sourceTypeLabel}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-4 text-sm leading-6 text-[var(--muted)]">
            <span>Importance {formatScore(item.importanceScore)}</span>
            <span>Novelty {formatScore(item.noveltyScore)}</span>
            {item.topicGroupTitle ? <span>Group {item.topicGroupTitle}</span> : null}
            {item.publishedAtLabel ? <span>{item.publishedAtLabel}</span> : null}
          </div>

          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block text-sm leading-6 text-[var(--accent)] underline-offset-4 hover:underline"
            >
              {item.url}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Banner({ message, tone }: { message: string; tone: "warning" }) {
  const toneClassName =
    tone === "warning"
      ? "border-[rgba(29,34,28,0.16)] bg-[rgba(29,34,28,0.05)] text-[var(--foreground)]"
      : "";

  return <p className={`mt-6 rounded-2xl border px-4 py-3 text-sm leading-6 ${toneClassName}`}>{message}</p>;
}

function Chip({ label, tone }: { label: string; tone: "accent" | "neutral" | "warm" }) {
  const toneClassName =
    tone === "accent"
      ? "bg-[rgba(31,107,92,0.12)] text-[var(--accent)]"
      : tone === "warm"
        ? "bg-[rgba(181,71,33,0.12)] text-[var(--warm)]"
        : "bg-[rgba(29,34,28,0.08)] text-[var(--muted)]";

  return (
    <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.22em] ${toneClassName}`}>
      {label}
    </span>
  );
}

function formatScore(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  return value.toFixed(2);
}
