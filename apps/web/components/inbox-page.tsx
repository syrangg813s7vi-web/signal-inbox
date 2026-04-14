import Link from "next/link";

import type { InboxItemViewModel, InboxPageViewModel } from "@/server/inbox";
import { ShellFrame } from "./shell-frame";

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
    <ShellFrame
      activeHref="/inbox"
      eyebrow="Inbox"
      title="Compact queue for processed Items."
      description="Minimal reader-style rows over the existing persisted Inbox data path."
      sidebarDescription="Primary reader surface for processed Item review and fast triage."
      headerAside={
        <>
          <ToolbarChip label={`${viewModel.items.length} visible`} />
          <ToolbarChip label={`${groupedCount} grouped`} />
          <ToolbarChip label={`${duplicateCount} duplicates`} />
          <ToolbarChip label={`${topicCount} topics`} />
        </>
      }
    >
      {!viewModel.isAvailable && viewModel.unavailableReason ? (
        <Banner message={viewModel.unavailableReason} tone="warning" />
      ) : null}

      {viewModel.items.length === 0 ? (
        <EmptyState isAvailable={viewModel.isAvailable} />
      ) : (
        <div className="space-y-2">
          {viewModel.items.map((item) => (
            <InboxListRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </ShellFrame>
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
