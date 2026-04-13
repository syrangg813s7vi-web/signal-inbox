import { ShellFrame } from "@/components/shell-frame";

export default function HomePage() {
  return (
    <ShellFrame
      eyebrow="Home"
      title="A quiet shell for capture, preservation, and later review."
      description="Home stays intentionally small while Inbox handles processed Items and Knowledge makes preserved Notes visible."
      callout="The repository is now shaped to prove both the first capture-to-inbox path and the first preservation path from processed Item to Note."
    />
  );
}
