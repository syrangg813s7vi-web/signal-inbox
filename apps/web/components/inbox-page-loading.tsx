const loadingLinks = ["Home", "Inbox", "Knowledge", "Sources"];
const placeholderRows = [0, 1, 2, 3, 4];

export function InboxPageLoading() {
  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[0_18px_80px_rgba(29,34,28,0.08)] backdrop-blur">
            <div className="border-b border-[var(--border)] px-5 py-5">
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.32em] text-[var(--muted)]">
                Signal Inbox
              </p>
              <div className="mt-4 h-8 w-28 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              <div className="mt-3 h-4 w-44 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
            </div>

            <div className="border-b border-[var(--border)] px-3 py-3">
              {loadingLinks.map((link) => (
                <div
                  key={link}
                  className="mb-2 h-11 animate-pulse rounded-2xl bg-[rgba(29,34,28,0.06)] last:mb-0"
                />
              ))}
            </div>

            <div className="border-b border-[var(--border)] px-5 py-5">
              <div className="h-4 w-28 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((metric) => (
                  <div
                    key={metric}
                    className="h-20 animate-pulse rounded-[1.25rem] border border-[var(--border)] bg-[rgba(255,250,239,0.86)]"
                  />
                ))}
              </div>
            </div>

            <div className="px-5 py-5">
              <div className="h-4 w-28 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              <div className="mt-4 space-y-3">
                <div className="h-4 w-full animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                <div className="h-4 w-11/12 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                <div className="h-4 w-10/12 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              </div>
            </div>
          </div>
        </aside>

        <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[0_18px_80px_rgba(29,34,28,0.08)] backdrop-blur">
          <header className="border-b border-[var(--border)] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="h-4 w-24 animate-pulse rounded-full bg-[rgba(187,108,47,0.16)]" />
                <div className="mt-3 h-10 w-full max-w-2xl animate-pulse rounded-[1.25rem] bg-[rgba(29,34,28,0.08)]" />
                <div className="mt-3 h-4 w-full max-w-3xl animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              </div>
              <div className="flex gap-2">
                {[0, 1, 2].map((pill) => (
                  <div
                    key={pill}
                    className="h-8 w-24 animate-pulse rounded-full bg-[rgba(255,250,239,0.86)]"
                  />
                ))}
              </div>
            </div>
          </header>

          <div className="divide-y divide-[var(--border)] px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
            {placeholderRows.map((row) => (
              <article
                key={row}
                className="grid gap-4 px-3 py-4 sm:px-4 md:grid-cols-[minmax(0,1fr)_176px] md:gap-6"
              >
                <div className="min-w-0">
                  <div className="flex gap-2">
                    <div className="h-6 w-20 animate-pulse rounded-full bg-[rgba(31,107,92,0.10)]" />
                    <div className="h-6 w-20 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                  </div>
                  <div className="mt-3 h-6 w-full max-w-2xl animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                  <div className="mt-2 space-y-2">
                    <div className="h-4 w-full animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                    <div className="h-4 w-4/5 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                  </div>
                  <div className="mt-3 h-4 w-3/4 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                  <div className="mt-2 h-4 w-2/3 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                  <div className="mt-3 flex gap-2">
                    <div className="h-6 w-16 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                    <div className="h-6 w-20 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                    <div className="h-6 w-16 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                  </div>
                </div>

                <div className="border-t border-[var(--border)] pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                  <div className="h-4 w-28 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                  <div className="mt-3 h-20 animate-pulse rounded-2xl border border-[var(--border)] bg-[rgba(255,250,239,0.86)]" />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
