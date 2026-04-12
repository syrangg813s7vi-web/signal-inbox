import type { SourcesPageViewModel } from "@/server/sources";

import { ShellFrame } from "./shell-frame";

export interface SourcesPageProps {
  errorMessage?: string;
  noticeMessage?: string;
  viewModel: SourcesPageViewModel;
}

export function SourcesPage({ errorMessage, noticeMessage, viewModel }: SourcesPageProps) {
  return (
    <ShellFrame
      eyebrow="Sources"
      title="Register recurring RSS sources without leaving the Capture layer."
      description="Add a feed, keep it visible, and pause or reactivate it later without mixing sync execution into the same workflow."
      callout="Source status combines the configured source state with the initialized sync-state baseline so later sync tracking has a clear place to land."
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <article className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel)] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                Add RSS Source
              </p>
              <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--muted)]">
                Keep setup low-friction: name and feed URL are required, topic is optional.
              </p>
            </div>
            <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
              Capture
            </span>
          </div>

          {noticeMessage ? <Banner tone="notice" message={noticeMessage} /> : null}
          {errorMessage ? <Banner tone="error" message={errorMessage} /> : null}
          {!viewModel.isAvailable && viewModel.unavailableReason ? (
            <Banner tone="warning" message={viewModel.unavailableReason} />
          ) : null}

          <form action="/sources/create" method="post" className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-[var(--foreground)]">Name</span>
              <input
                disabled={!viewModel.isAvailable}
                required
                name="name"
                type="text"
                placeholder="AI Research Feed"
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-[var(--foreground)]">RSS URL</span>
              <input
                disabled={!viewModel.isAvailable}
                required
                name="sourceUrl"
                type="url"
                placeholder="https://example.com/feed.xml"
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-[var(--foreground)]">Topic</span>
              <input
                disabled={!viewModel.isAvailable}
                name="topic"
                type="text"
                placeholder="AI"
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
              />
            </label>

            <button
              disabled={!viewModel.isAvailable}
              type="submit"
              className="inline-flex rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-medium text-[var(--panel-strong)] transition enabled:hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add Source
            </button>
          </form>
        </article>

        <article className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel)] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                Registered Sources
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Status is visible now even before sync jobs are implemented.
              </p>
            </div>
            <span className="rounded-full border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
              {viewModel.sources.length} total
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {viewModel.sources.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-[rgba(29,34,28,0.03)] px-5 py-8 text-sm leading-6 text-[var(--muted)]">
                {viewModel.isAvailable
                  ? "No RSS sources yet. Add one above to initialize source state and the sync-status placeholder."
                  : "No sources can be loaded until storage is configured for this environment."}
              </div>
            ) : (
              viewModel.sources.map((source) => (
                <article
                  key={source.id}
                  className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-lg font-medium text-[var(--foreground)]">{source.name}</h2>
                        <StatusBadge
                          label={source.statusView.badgeLabel}
                          tone={source.statusView.badgeTone}
                        />
                        {source.topic ? (
                          <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                            {source.topic}
                          </span>
                        ) : null}
                      </div>

                      <p className="text-sm leading-6 text-[var(--muted)]">{source.statusView.detail}</p>

                      {source.sourceUrl ? (
                        <a
                          href={source.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-sm leading-6 text-[var(--accent)] underline-offset-4 hover:underline"
                        >
                          {source.sourceUrl}
                        </a>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3">
                      {source.status === "paused" ? (
                        <form action={`/sources/${source.id}/reactivate`} method="post">
                          <input type="hidden" name="sourceId" value={source.id} />
                          <button
                            disabled={!viewModel.isAvailable}
                            type="submit"
                            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--panel-strong)] transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        </form>
                      ) : (
                        <form action={`/sources/${source.id}/pause`} method="post">
                          <input type="hidden" name="sourceId" value={source.id} />
                          <button
                            disabled={!viewModel.isAvailable}
                            type="submit"
                            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition enabled:hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Pause
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>
      </section>
    </ShellFrame>
  );
}

function Banner({ message, tone }: { message: string; tone: "error" | "notice" | "warning" }) {
  const toneClassName =
    tone === "error"
      ? "border-[rgba(181,71,33,0.28)] bg-[rgba(181,71,33,0.08)] text-[var(--warm)]"
      : tone === "warning"
        ? "border-[rgba(29,34,28,0.16)] bg-[rgba(29,34,28,0.05)] text-[var(--foreground)]"
      : "border-[rgba(31,107,92,0.22)] bg-[rgba(31,107,92,0.08)] text-[var(--accent)]";

  return <p className={`mt-6 rounded-2xl border px-4 py-3 text-sm leading-6 ${toneClassName}`}>{message}</p>;
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "active" | "muted" | "error";
}) {
  const toneClassName =
    tone === "active"
      ? "bg-[rgba(31,107,92,0.12)] text-[var(--accent)]"
      : tone === "error"
        ? "bg-[rgba(181,71,33,0.12)] text-[var(--warm)]"
        : "bg-[rgba(29,34,28,0.08)] text-[var(--muted)]";

  return (
    <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.22em] ${toneClassName}`}>
      {label}
    </span>
  );
}
