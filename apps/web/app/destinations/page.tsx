import { PageFrame } from "../../components/page-frame";
import { SurfacePlaceholder } from "../../components/surface-placeholder";

export default function DestinationsPage() {
  return (
    <PageFrame
      eyebrow="Destinations"
      title="Delivery adapters stay downstream from Items and Digests."
      description="This placeholder keeps the destination management surface in place so later work can add configuration without mixing delivery behavior into the UI shell."
    >
      <SurfacePlaceholder
        plannedScope="Follow-up issues will add destination CRUD and delivery controls here while adapter formatting and send behavior remain inside packages/delivery."
        description="This route is scaffold only."
      />
    </PageFrame>
  );
}
