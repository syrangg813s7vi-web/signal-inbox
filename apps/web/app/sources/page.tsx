import { PageFrame } from "../../components/page-frame";
import { SurfacePlaceholder } from "../../components/surface-placeholder";

export default function SourcesPage() {
  return (
    <PageFrame
      eyebrow="Sources"
      title="Source setup stays separate from connector execution."
      description="This placeholder reserves the UI surface for source CRUD and status views without moving connector logic into the web layer."
    >
      <SurfacePlaceholder
        plannedScope="Follow-up issues will add source creation, validation, and status updates here while keeping fetch and normalization logic inside packages/connectors."
        description="This route is scaffold only."
      />
    </PageFrame>
  );
}
