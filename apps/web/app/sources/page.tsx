import { SurfaceShell } from "../../components/surface-shell";
import { getAppSurface } from "../../lib/app-surfaces";

export default function SourcesPage() {
  return <SurfaceShell surface={getAppSurface("/sources")} />;
}
