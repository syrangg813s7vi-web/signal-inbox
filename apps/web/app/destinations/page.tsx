import { SurfaceShell } from "../../components/surface-shell";
import { getAppSurface } from "../../lib/app-surfaces";

export default function DestinationsPage() {
  return <SurfaceShell surface={getAppSurface("/destinations")} />;
}
