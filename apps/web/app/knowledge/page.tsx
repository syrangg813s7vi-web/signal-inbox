import { SurfaceShell } from "../../components/surface-shell";
import { getAppSurface } from "../../lib/app-surfaces";

export default function KnowledgePage() {
  return <SurfaceShell surface={getAppSurface("/knowledge")} />;
}
