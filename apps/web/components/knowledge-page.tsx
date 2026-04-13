import type { KnowledgePageViewModel } from "@/server/knowledge";

import { ShellFrame } from "./shell-frame";

export interface KnowledgePageProps {
  viewModel: KnowledgePageViewModel;
}

export function KnowledgePage({ viewModel }: KnowledgePageProps) {
  return (
    <ShellFrame
      eyebrow="Knowledge"
      title="Preserved Notes live here once high-value Items cross the knowledge boundary."
      description="This surface renders persisted Notes and destination sync outcomes. Inbox stays focused on processed Items; Knowledge shows what was preserved."
      callout="Notes are created inside the Knowledge layer from preservation-worthy Items, then synced to KnowledgeDestination adapters for Notion and Obsidian."
    >
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
        <article className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel)] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                Preserved Notes
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Notes are ordered by preservation time and show the first sync result for each knowledge sink.
              </p>
            </div>
            <span className="rounded-full border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
              {viewModel.notes.length} visible
            </span>
          </div>

          {!viewModel.isAvailable && viewModel.unavailableReason ? (
            <Banner message={viewModel.unavailableReason} />
          ) : null}

          <div className="mt-6 space-y-4">
            {viewModel.notes.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-[rgba(29,34,28,0.03)] px-5 py-8 text-sm leading-6 text-[var(--muted)]">
                {viewModel.isAvailable
                  ? "No Notes yet. Once preservation-worthy Items are processed, their Note records will appear here."
                  : "The route loaded, but Note data is unavailable in this environment."}
              </div>
            ) : (
              viewModel.notes.map((note) => <KnowledgeNoteCard key={note.itemId} note={note} />)
            )}
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel)] p-6">
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
            Knowledge Destinations
          </p>
          <div className="mt-5 space-y-3">
            {viewModel.destinations.length === 0 ? (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Destination records will appear here after knowledge storage is ready.
              </p>
            ) : (
              viewModel.destinations.map((destination) => (
                <div
                  key={destination.id}
                  className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--panel-strong)] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-[var(--foreground)]">{destination.name}</span>
                    <span className="rounded-full bg-[rgba(31,107,92,0.12)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
                      {destination.typeLabel}
                    </span>
                    <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      {destination.status}
                    </span>
                  </div>
                  <p className="mt-3 break-all text-sm leading-6 text-[var(--muted)]">{destination.targetRef}</p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </ShellFrame>
  );
}

function KnowledgeNoteCard({ note }: { note: KnowledgePageViewModel["notes"][number] }) {
  return (
    <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-medium text-[var(--foreground)]">{note.title}</h2>
        <Chip label={note.typeLabel} tone="accent" />
        {note.topic ? <Chip label={note.topic} tone="neutral" /> : null}
      </div>

      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{note.bodyPreview}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {note.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm leading-6 text-[var(--muted)]">
        <span>Review weight {note.reviewWeightLabel}</span>
        {note.sourceName ? <span>Source {note.sourceName}</span> : null}
        {note.publishedAtLabel ? <span>{note.publishedAtLabel}</span> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {note.destinationStatuses.map((destination) => (
          <a
            key={`${destination.destinationType}-${destination.externalRef}`}
            href={destination.externalRef}
            className="rounded-full border border-[var(--border)] bg-[rgba(31,107,92,0.08)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--foreground)]"
          >
            {destination.destinationType} {destination.status}
          </a>
        ))}
      </div>
    </article>
  );
}

function Banner({ message }: { message: string }) {
  return (
    <p className="mt-6 rounded-2xl border border-[rgba(29,34,28,0.16)] bg-[rgba(29,34,28,0.05)] px-4 py-3 text-sm leading-6 text-[var(--foreground)]">
      {message}
    </p>
  );
}

function Chip({ label, tone }: { label: string; tone: "accent" | "neutral" }) {
  const toneClassName =
    tone === "accent"
      ? "bg-[rgba(31,107,92,0.12)] text-[var(--accent)]"
      : "bg-[rgba(29,34,28,0.08)] text-[var(--muted)]";

  return (
    <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.22em] ${toneClassName}`}>
      {label}
    </span>
  );
}
