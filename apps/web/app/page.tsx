import Link from "next/link";

import { v1ProcessorOrder } from "@signal-inbox/core";

import { PageFrame } from "../components/page-frame";

const moduleCards = [
  {
    title: "Connectors",
    description: "Source-specific fetch and normalization live in shared packages, not inside route handlers."
  },
  {
    title: "Processors",
    description: "Items move through an explicit fixed-order pipeline before the Inbox renders them."
  },
  {
    title: "Delivery",
    description: "External destinations stay isolated behind adapters so follow-up issues can add outputs cleanly."
  }
];

export default function HomePage() {
  return (
    <PageFrame
      eyebrow="Signal Inbox"
      title="A calm shell for the first vertical slice."
      description="This scaffold keeps Home minimal, points quickly to Inbox, and preserves the shared module boundaries needed for the RSS slice."
    >
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-8">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              Immediate next step
            </p>
            <h2 className="text-3xl">Inbox becomes the first useful surface.</h2>
            <p className="max-w-2xl text-base leading-7 text-[var(--muted)]">
              The web shell is intentionally small. Follow-up work can add RSS source
              CRUD, sync jobs, ingest, and item processing without undoing the repo
              layout.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/inbox"
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              Open Inbox
            </Link>
            <Link
              href="/digest"
              className="rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)]"
            >
              View Digest Shell
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--border)] bg-[#24190e] p-8 text-[#f6ecde]">
          <p className="text-sm uppercase tracking-[0.24em] text-[#f3b075]">
            V1 processing order
          </p>
          <ol className="mt-5 space-y-4">
            {v1ProcessorOrder.map((step, index) => (
              <li key={step} className="flex items-center gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-sm">
                  {index + 1}
                </span>
                <span className="text-lg capitalize">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {moduleCards.map((card) => (
          <article
            key={card.title}
            className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--card)] p-6"
          >
            <h2 className="text-2xl">{card.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {card.description}
            </p>
          </article>
        ))}
      </section>
    </PageFrame>
  );
}
