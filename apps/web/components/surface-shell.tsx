import Link from "next/link";

import type { AppSurface } from "../lib/app-surfaces";
import { appSurfaces } from "../lib/app-surfaces";

interface SurfaceShellProps {
  surface: AppSurface;
}

export function SurfaceShell({ surface }: SurfaceShellProps) {
  const relatedSurfaces = appSurfaces.filter(
    (candidate) => candidate.href !== surface.href,
  );

  return (
    <main className="flex flex-1 flex-col gap-8 pb-10">
      <section className="rounded-[2rem] border border-[var(--card-border)] bg-[var(--card)] px-7 py-8 shadow-[0_24px_80px_rgba(20,33,61,0.08)] backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
          {surface.eyebrow}
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-semibold md:text-5xl">
          {surface.title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          {surface.description}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.75rem] border border-[var(--card-border)] bg-[var(--card)] p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Scaffold intent
          </p>
          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
            This route is intentionally light. Follow-up issues should add data
            loading, actions, and domain behavior inside the package boundary
            that owns the change instead of pushing implementation into page
            files.
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-[var(--card-border)] bg-[var(--card)] p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Next surfaces
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {relatedSurfaces.map((candidate) => (
              <Link
                key={candidate.href}
                href={candidate.href}
                className="rounded-full border border-[var(--card-border)] bg-white/80 px-4 py-2 text-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {candidate.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
