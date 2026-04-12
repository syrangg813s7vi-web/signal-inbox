import Link from "next/link";
import { APP_NAME, V1_PROCESSOR_ORDER } from "@signal-inbox/core";

import { appSurfaces } from "../lib/app-surfaces";

const productSurfaces = appSurfaces.filter((surface) => surface.href !== "/");

const moduleBoundaries = [
  "Web",
  "Database",
  "Connectors",
  "Processors",
  "AI",
  "Delivery",
  "Core Jobs",
] as const;

export function HomeShell() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 py-10 md:px-10">
      <section className="rounded-[2rem] border border-[var(--card-border)] bg-[var(--card)] px-7 py-8 shadow-[0_24px_80px_rgba(20,33,61,0.08)] backdrop-blur">
        <div className="mb-8 flex flex-col gap-5">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            {APP_NAME}
          </p>
          <div className="max-w-3xl">
            <h1 className="text-4xl leading-tight font-semibold md:text-6xl">
              A quiet inbox for high-volume information intake.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)] md:text-lg">
              This shell keeps Home minimal and leaves room for the first RSS
              vertical slice to land inside stable module boundaries.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-[1.5rem] border border-[var(--card-border)] bg-white/80 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
              First surface
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Inbox stays primary.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
              Follow-up issues can wire source sync, Item ingest, processing,
              and delivery without collapsing module ownership into the web app.
            </p>
          </div>

          <div className="rounded-[1.5rem] bg-[var(--foreground)] p-6 text-[#fdf6ec]">
            <p className="text-sm uppercase tracking-[0.2em] text-[#f4b6a6]">
              V1 pipeline
            </p>
            <ol className="mt-4 space-y-3 text-lg">
              {V1_PROCESSOR_ORDER.map((step, index) => (
                <li key={step}>
                  {index + 1}. {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-[var(--card-border)] bg-[var(--card)] p-7">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Product surfaces
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {productSurfaces.map((surface) => (
              <Link
                key={surface.href}
                href={surface.href}
                className="rounded-full border border-[var(--card-border)] bg-white/75 px-4 py-2 text-sm"
              >
                {surface.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--card-border)] bg-[var(--card)] p-7">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Module boundaries
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {moduleBoundaries.map((boundary) => (
              <div
                key={boundary}
                className="rounded-[1.25rem] border border-[var(--card-border)] bg-white/80 px-4 py-4 text-sm"
              >
                {boundary}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
