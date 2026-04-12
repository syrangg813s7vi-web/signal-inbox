import { SurfaceShell } from "../../components/surface-shell";
import { getAppSurface } from "../../lib/app-surfaces";

export default function DigestPage() {
  return <SurfaceShell surface={getAppSurface("/digest")} />;
}
