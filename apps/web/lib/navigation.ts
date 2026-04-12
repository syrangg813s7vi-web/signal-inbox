export interface AppNavItem {
  href: string;
  label: string;
}

export const appNavItems: AppNavItem[] = [
  { href: "/", label: "Home" },
  { href: "/inbox", label: "Inbox" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/digest", label: "Digest" },
  { href: "/sources", label: "Sources" },
  { href: "/settings", label: "Settings" }
];
