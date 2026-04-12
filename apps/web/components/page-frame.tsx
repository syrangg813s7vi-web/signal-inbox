import Link from "next/link";
import type { ReactNode } from "react";

import { appNavItems } from "../lib/navigation";

interface PageFrameProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function PageFrame({
  eyebrow,
  title,
  description,
  children
}: PageFrameProps) {
  return (
    <main className="min-h-screen px-6 py-10 sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="rounded-[2rem] border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-[0_20px_80px_rgba(68,48,22,0.08)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent-strong)]">
                {eyebrow}
              </p>
              <h1 className="text-4xl leading-tight sm:text-5xl">{title}</h1>
              <p className="max-w-xl text-base leading-7 text-[var(--muted)]">
                {description}
              </p>
            </div>

            <nav className="flex flex-wrap gap-3 text-sm text-[var(--muted)]">
              {appNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-[var(--card-border)] px-4 py-2 transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
