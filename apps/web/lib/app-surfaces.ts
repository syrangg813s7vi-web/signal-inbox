export interface AppSurface {
  href: string;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
}

export const appSurfaces: AppSurface[] = [
  {
    href: "/",
    label: "Home",
    eyebrow: "Minimal entry",
    title: "Home stays result-first.",
    description:
      "Keep Home focused on the most important outcomes for the day instead of turning it into an admin dashboard.",
  },
  {
    href: "/inbox",
    label: "Inbox",
    eyebrow: "Primary work surface",
    title: "Processed Items land here first.",
    description:
      "The first vertical slice ends when RSS items can move through ingest and processing into a useful Inbox view.",
  },
  {
    href: "/digest",
    label: "Digest",
    eyebrow: "Compressed review",
    title: "Digest builds on processed Items.",
    description:
      "Daily and weekly summaries belong here after the shared Item pipeline is in place.",
  },
  {
    href: "/sources",
    label: "Sources",
    eyebrow: "Source manager",
    title: "Source CRUD stays separate from connector logic.",
    description:
      "This surface will manage source configuration and status without taking on fetch or normalization responsibilities.",
  },
  {
    href: "/destinations",
    label: "Destinations",
    eyebrow: "Delivery targets",
    title: "Delivery adapters stay behind stable boundaries.",
    description:
      "Destination configuration lives here while formatting and delivery remain inside the delivery package.",
  },
  {
    href: "/settings",
    label: "Settings",
    eyebrow: "Global controls",
    title: "Settings remain intentionally narrow in V1.",
    description:
      "Global defaults and environment-driven behavior can surface here without introducing a workflow builder.",
  },
];

export function getAppSurface(href: string): AppSurface {
  const surface = appSurfaces.find((candidate) => candidate.href === href);

  if (!surface) {
    throw new Error(`App surface configuration is missing for ${href}.`);
  }

  return surface;
}
