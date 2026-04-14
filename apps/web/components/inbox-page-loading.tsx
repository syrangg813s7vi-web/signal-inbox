const placeholderRows = [0, 1, 2, 3, 4];

export function InboxPageLoading() {
  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-4 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel-strong)]">
          <div className="flex h-full flex-col gap-6 p-5 sm:p-6">
            <div className="space-y-3">
              <div className="h-3 w-28 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              <div className="space-y-2">
                <div className="h-10 w-28 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                <div className="h-4 w-full animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              </div>
            </div>

            <div className="space-y-2">
              {surfacePlaceholders.map((item) => (
                <div
                  key={item}
                  className="h-12 animate-pulse rounded-2xl bg-[rgba(29,34,28,0.08)]"
                />
              ))}
            </div>

            <div className="space-y-3 rounded-[1.5rem] border border-[var(--border)] bg-[rgba(29,34,28,0.03)] p-4">
              <div className="h-3 w-24 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              {metricPlaceholders.map((item) => (
                <div
                  key={item}
                  className="h-4 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]"
                />
              ))}
            </div>

            <div className="rounded-[1.5rem] border border-[var(--border)] bg-[rgba(31,107,92,0.08)] p-4">
              <div className="h-3 w-28 animate-pulse rounded-full bg-[rgba(31,107,92,0.16)]" />
              <div className="mt-3 space-y-2">
                <div className="h-4 w-full animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                <div className="h-4 w-4/5 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              </div>
            </div>
          </div>
        </aside>

        <section className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] shadow-[0_18px_80px_rgba(29,34,28,0.08)]">
          <div className="border-b border-[var(--border)] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 md:flex-row md:items-end md:justify-between">
              <div className="space-y-3">
                <div className="h-3 w-28 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                <div className="h-12 w-80 max-w-full animate-pulse rounded-[1rem] bg-[rgba(29,34,28,0.08)]" />
                <div className="h-4 w-[32rem] max-w-full animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              </div>

              <div className="flex gap-2">
                {toolbarPlaceholders.map((item) => (
                  <div
                    key={item}
                    className="h-8 w-24 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]"
                  />
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {summaryPlaceholders.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.25rem] border border-[var(--border)] bg-[rgba(255,255,255,0.42)] p-4"
                >
                  <div className="h-3 w-20 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                  <div className="mt-3 h-4 w-40 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                  <div className="mt-2 h-4 w-full animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                </div>
              ))}
            </div>
          </div>

          <div className="px-3 py-3 sm:px-4">
            <div className="hidden grid-cols-[minmax(0,1.35fr)_minmax(180px,0.7fr)_120px] gap-4 rounded-[1.25rem] px-4 py-3 md:grid">
              <div className="h-3 w-14 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              <div className="h-3 w-28 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              <div className="ml-auto h-3 w-16 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
            </div>

            <div className="space-y-2">
              {placeholderRows.map((row) => (
                <article
                  key={row}
                  className="grid gap-4 rounded-[1.4rem] border border-[var(--border)] bg-[rgba(255,250,239,0.72)] px-4 py-4 md:grid-cols-[minmax(0,1.35fr)_minmax(180px,0.7fr)_120px] md:px-5"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <div className="h-5 w-72 max-w-full animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                      <div className="h-5 w-20 animate-pulse rounded-full bg-[rgba(31,107,92,0.12)]" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-full animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                      <div className="h-4 w-5/6 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="h-3 w-16 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                      <div className="h-3 w-24 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                      <div className="h-3 w-20 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                    </div>
                    <div className="h-4 w-3/4 animate-pulse rounded-full bg-[rgba(31,107,92,0.12)]" />
                  </div>

                  <div className="space-y-3 border-t border-[var(--border)] pt-3 md:border-t-0 md:border-l md:pl-4 md:pt-0">
                    <div className="h-3 w-20 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                    <div className="h-4 w-32 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                    <div className="h-3 w-24 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                    <div className="flex flex-wrap gap-2">
                      <div className="h-6 w-16 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                      <div className="h-6 w-20 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-3 border-t border-[var(--border)] pt-3 md:block md:border-t-0 md:pt-0">
                    <div className="space-y-3">
                      <div className="h-3 w-16 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                      <div className="h-4 w-12 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                      <div className="h-3 w-16 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                      <div className="h-4 w-12 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                    </div>
                    <div className="h-9 w-16 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

const metricPlaceholders = [0, 1, 2, 3];
const summaryPlaceholders = [0, 1, 2];
const surfacePlaceholders = [0, 1, 2, 3];
const toolbarPlaceholders = [0, 1, 2];
