import { PageFrame } from "../../components/page-frame";

export default function DigestPage() {
  return (
    <PageFrame
      eyebrow="Digest"
      title="Digest stays downstream from processed Items."
      description="The page exists now so later work can add daily and weekly summaries without changing the app structure."
    >
      <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--accent-strong)]">
          Planned scope
        </p>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)]">
          Follow-up issues will select processed Items, generate stored Digest records,
          and render compressed review output here. This route is scaffold only.
        </p>
      </section>
    </PageFrame>
  );
}
