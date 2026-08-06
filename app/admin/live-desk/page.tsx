import LiveDeskClient from "@/components/live-overlay/LiveDeskClient";
import { getLiveOverlayToken, getLiveOverlayTokenEnvKey } from "@/lib/live-overlay/token";

export const dynamic = "force-dynamic";

export default function LiveDeskPage() {
  return (
    <LiveDeskClient
      overlayToken={getLiveOverlayToken()}
      tokenEnvKey={getLiveOverlayTokenEnvKey()}
    />
  );
}
