import { PageFrame } from "../../components/page-frame";

const inboxColumns = [
  {
    title: "Processed items",
    description: "The primary work surface will list shared Items after ingest and processing."
  },
  {
    title: "Grouping",
    description: "Topic grouping lands here after the fixed processor chain has run."
  },
  {
    title: "Actions",
    description: "Delivery and archive actions stay downstream from processing."
  }
];

export default function InboxPage() {
  return (
    <PageFrame
      eyebrow="Inbox"
      title="Processed results belong here."
      description="This shell reserves the primary work surface for Items, not raw source feeds, matching the product direction documented for V1."
    >
      <section className="grid gap-4 lg:grid-cols-3">
        {inboxColumns.map((column) => (
          <article
            key={column.title}
            className="min-h-56 rounded-[1.75rem] border border-dashed border-[var(--border)] bg-[var(--card)] p-6"
          >
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              Placeholder
            </p>
            <h2 className="mt-4 text-2xl">{column.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {column.description}
            </p>
          </article>
        ))}
      </section>
    </PageFrame>
  );
}
