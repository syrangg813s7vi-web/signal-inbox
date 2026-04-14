import Link from "next/link";

import { ShellFrame } from "@/components/shell-frame";

export default function HomePage() {
  return (
    <ShellFrame
      activeHref="/"
      eyebrow="Home"
      title="Start from the quietest summary, then step into Inbox, Knowledge, or Sources."
      description="Home stays intentionally minimal. It should orient the product, surface the current operating areas, and hand off quickly to the primary reader surfaces."
      callout="Keep Home result-first and low-noise. The heavier scanning work still belongs to Inbox."
    >
      <section className="space-y-2">
        <HomeRouteRow
          href="/inbox"
          label="Inbox"
          detail="Primary reader surface for processed Items, compact queue review, and fast triage."
        />
        <HomeRouteRow
          href="/knowledge"
          label="Knowledge"
          detail="Preserved Notes and destination sync outcomes once high-value Items cross the knowledge boundary."
        />
        <HomeRouteRow
          href="/sources"
          label="Sources"
          detail="Low-friction capture setup and source status management for the shared capture path."
        />
      </section>
    </ShellFrame>
  );
}

function HomeRouteRow({
  href,
  label,
  detail,
}: {
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-[1.4rem] border border-[var(--border)] bg-[rgba(255,250,239,0.74)] px-4 py-3 transition hover:bg-[rgba(255,250,239,0.95)] sm:flex-row sm:items-start sm:justify-between sm:gap-4"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{detail}</p>
      </div>
      <span className="shrink-0 rounded-full border border-[rgba(29,34,28,0.1)] bg-[rgba(255,255,255,0.52)] px-2.5 py-1 text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
        Open
      </span>
    </Link>
  );
}
