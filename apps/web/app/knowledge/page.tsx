import { KnowledgePage } from "@/components/knowledge-page";
import { getKnowledgePageViewModel } from "@/server/knowledge";

export const dynamic = "force-dynamic";

export default async function KnowledgeRoute() {
  const viewModel = await getKnowledgePageViewModel();

  return <KnowledgePage viewModel={viewModel} />;
}
