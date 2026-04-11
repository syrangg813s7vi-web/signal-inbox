import { PageFrame } from "../../components/page-frame";
import { SurfacePlaceholder } from "../../components/surface-placeholder";

export default function SettingsPage() {
  return (
    <PageFrame
      eyebrow="Settings"
      title="Global defaults belong here, not workflow builders."
      description="This placeholder preserves the minimal V1 settings surface while keeping advanced automation and connector-specific controls out of scope."
    >
      <SurfacePlaceholder
        plannedScope="Follow-up issues can add application-level defaults and runtime configuration here without changing the route layout."
        description="This route is scaffold only."
      />
    </PageFrame>
  );
}
