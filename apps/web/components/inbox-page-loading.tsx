const metricPlaceholders = [0, 1, 2, 3];
const placeholderRows = [0, 1, 2, 3, 4];
const surfacePlaceholders = [0, 1, 2, 3];
const toolbarPlaceholders = [0, 1, 2];

export function InboxPageLoading() {
  return (
    <main className="min-h-screen px-3 py-3 sm:px-5 sm:py-5 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--panel-strong)]">
          <div className="flex h-full flex-col gap-5 p-4 sm:p-5">
            <div className="space-y-3">
              <div className="h-3 w-28 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              <div className="space-y-2">
                <div className="h-10 w-28 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                <div className="h-4 w-full animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              </div>
            </div>

            <div className="space-y-2">
              {surfacePlaceholders.map((item) => (
                <div key={item} className="h-12 animate-pulse rounded-2xl bg-[rgba(29,34,28,0.08)]" />
              ))}
            </div>

            <div className="space-y-3 rounded-[1.5rem] border border-[var(--border)] bg-[rgba(29,34,28,0.03)] p-4">
              <div className="h-3 w-24 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              {metricPlaceholders.map((item) => (
                <div key={item} className="h-4 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
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
          <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-3">
                <div className="h-3 w-28 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                <div className="h-12 w-72 max-w-full animate-pulse rounded-[1rem] bg-[rgba(29,34,28,0.08)]" />
                <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              </div>

              <div className="flex gap-2">
                {toolbarPlaceholders.map((item) => (
                  <div key={item} className="h-8 w-24 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                ))}
              </div>
            </div>
          </div>

          <div className="px-3 py-3 sm:px-4">
            <div className="hidden grid-cols-[6px_72px_minmax(0,1fr)_112px] gap-3 rounded-[1.25rem] px-4 py-2 md:grid">
              <div className="h-3 w-2 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              <div className="h-3 w-16 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              <div className="h-3 w-14 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
              <div className="ml-auto h-3 w-24 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
            </div>

            <div className="space-y-2">
              {placeholderRows.map((row) => (
                <article
                  key={row}
                  className="grid gap-3 rounded-[1.4rem] border border-[var(--border)] bg-[rgba(255,250,239,0.74)] px-3 py-3 md:grid-cols-[6px_72px_minmax(0,1fr)_112px] md:items-start md:px-4"
                >
                  <div className="hidden rounded-full bg-[rgba(31,107,92,0.18)] md:block" />

                  <div className="h-[84px] w-[64px] animate-pulse rounded-[1.1rem] border border-[var(--border)] bg-[rgba(31,107,92,0.22)] md:h-[92px] md:w-[72px]" />

                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <div className="h-5 w-72 max-w-full animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                      <div className="h-5 w-20 animate-pulse rounded-full bg-[rgba(31,107,92,0.12)]" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-full animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                      <div className="h-4 w-5/6 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="h-3 w-24 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                      <div className="h-3 w-28 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                      <div className="h-3 w-16 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                    </div>
                    <div className="h-4 w-48 max-w-full animate-pulse rounded-full bg-[rgba(31,107,92,0.12)]" />
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3 md:block md:border-t-0 md:pt-0">
                    <div className="space-y-2 md:text-right">
                      <div className="ml-auto h-3 w-14 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                      <div className="ml-auto h-4 w-24 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                    </div>
                    <div className="flex gap-2 md:mt-4 md:flex-col md:items-end">
                      <div className="h-6 w-20 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                      <div className="h-6 w-24 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                      <div className="h-9 w-16 animate-pulse rounded-full bg-[rgba(29,34,28,0.08)]" />
                    </div>
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
