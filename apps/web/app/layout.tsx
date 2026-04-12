import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { appConfig } from "../lib/app-config";

import "./globals.css";

const navigationItems = [
  { href: "/", label: "Home" },
  { href: "/inbox", label: "Inbox" },
  { href: "/digest", label: "Digest" },
  { href: "/sources", label: "Sources" },
  { href: "/destinations", label: "Destinations" },
  { href: "/settings", label: "Settings" },
] as const;

export const metadata: Metadata = {
  title: appConfig.name,
  description: appConfig.description,
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6 md:px-10">
          <header className="mb-8 flex flex-col gap-4 rounded-[1.75rem] border border-[var(--card-border)] bg-[var(--card)] px-5 py-5 shadow-[0_18px_60px_rgba(20,33,61,0.08)] backdrop-blur">
            <div>
              <Link href="/" className="text-lg font-semibold tracking-[0.04em]">
                {appConfig.name}
              </Link>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                Minimal app shell for the first vertical slice.
              </p>
            </div>

            <nav aria-label="Primary" className="flex flex-wrap gap-2">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-[var(--card-border)] bg-white/80 px-4 py-2 text-sm transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>

          {children}
        </div>
      </body>
    </html>
  );
}
