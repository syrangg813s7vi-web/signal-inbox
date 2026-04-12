import { ShellFrame } from "@/components/shell-frame";

export default function InboxPage() {
  return (
    <ShellFrame
      eyebrow="Inbox"
      title="Processed Items will land here."
      description="Inbox is the primary work surface. Follow-up issues can connect Sources, CaptureEntry, RawAsset, Item, and the first knowledge pipeline without moving UI boundaries."
      callout="V1 processing order remains fixed: score, dedupe, summarize, classify, and group."
    />
  );
}
