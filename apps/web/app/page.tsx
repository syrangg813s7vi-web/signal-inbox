import { ShellFrame } from "@/components/shell-frame";

export default function HomePage() {
  return (
    <ShellFrame
      eyebrow="Home"
      title="A quiet shell for the first capture-to-inbox slice."
      description="This web surface stays intentionally small: a calm overview now, an Inbox-first workflow next."
      callout="The monorepo is scaffolded around Capture, Knowledge, and Review so the first vertical slice can land without rewriting the repository layout."
    />
  );
}
