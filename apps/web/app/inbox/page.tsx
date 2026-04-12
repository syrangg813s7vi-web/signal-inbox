import { SurfaceShell } from "../../components/surface-shell";
import { getAppSurface } from "../../lib/app-surfaces";

export default function InboxPage() {
  return <SurfaceShell surface={getAppSurface("/inbox")} />;
}
