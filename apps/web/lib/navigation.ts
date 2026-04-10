export interface AppNavItem {
  href: string;
  label: string;
}

export const appNavItems: AppNavItem[] = [
  { href: "/", label: "Home" },
  { href: "/inbox", label: "Inbox" },
  { href: "/digest", label: "Digest" }
];
