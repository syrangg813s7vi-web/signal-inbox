interface SurfacePlaceholderProps {
  plannedScope: string;
  description: string;
}

export function SurfacePlaceholder({
  plannedScope,
  description
}: SurfacePlaceholderProps) {
  return (
    <section className="rounded-[2rem] border border-[var(--card-border)] bg-[var(--card)] p-8">
      <p className="text-sm uppercase tracking-[0.24em] text-[var(--accent-strong)]">
        Planned scope
      </p>
      <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--muted)]">
        {plannedScope}
      </p>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
    </section>
  );
}
