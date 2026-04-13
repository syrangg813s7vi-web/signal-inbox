import { ShellFrame } from "./shell-frame";

const placeholderCards = [0, 1, 2];

export function InboxPageLoading() {
  return (
    <ShellFrame
      eyebrow="Inbox"
      title="Processed Items land here once Knowledge has done the first pass."
      description="Inbox stays result-first: score, dedupe, summarize, classify, and group run before items show up for review."
      callout="Loading the persisted review surface for processed Items."
    >
      <section className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel)] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
              Processed Items
            </p>
            <div className="mt-3 h-4 w-56 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
          </div>
          <div className="h-7 w-24 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
        </div>

        <div className="mt-6 space-y-4">
          {placeholderCards.map((card) => (
            <article
              key={card}
              className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel-strong)] p-5"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <div className="h-6 w-64 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                  <div className="h-6 w-24 animate-pulse rounded-full bg-[rgba(31,107,92,0.10)]" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                  <div className="h-4 w-5/6 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="h-7 w-20 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                  <div className="h-7 w-24 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                  <div className="h-7 w-16 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="h-4 w-28 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                  <div className="h-4 w-24 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                  <div className="h-4 w-36 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </ShellFrame>
  );
}
