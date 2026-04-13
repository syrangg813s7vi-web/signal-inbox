import { InboxPage } from "@/components/inbox-page";
import { getInboxPageViewModel } from "@/server/inbox";

export const dynamic = "force-dynamic";

export default async function InboxPageRoute() {
  const viewModel = await getInboxPageViewModel();

  return <InboxPage viewModel={viewModel} />;
}
