import { PageFrame } from "../../components/page-frame";
import { SurfacePlaceholder } from "../../components/surface-placeholder";

export default function DigestPage() {
  return (
    <PageFrame
      eyebrow="Digest"
      title="Digest stays downstream from processed Items."
      description="The page exists now so later work can add daily and weekly summaries without changing the app structure."
    >
      <SurfacePlaceholder
        plannedScope="Follow-up issues will select processed Items, generate stored Digest records, and render compressed review output here."
        description="This route is scaffold only."
      />
    </PageFrame>
  );
}
