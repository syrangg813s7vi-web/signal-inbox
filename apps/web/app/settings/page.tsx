import { SurfaceShell } from "../../components/surface-shell";
import { getAppSurface } from "../../lib/app-surfaces";

export default function SettingsPage() {
  return <SurfaceShell surface={getAppSurface("/settings")} />;
}
