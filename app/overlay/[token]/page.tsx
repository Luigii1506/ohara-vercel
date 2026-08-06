import { notFound } from "next/navigation";
import OverlayCanvasClient from "@/components/live-overlay/OverlayCanvasClient";
import {
  getLiveOverlayToken,
  getLiveOverlayTokenEnvKey,
  isLiveOverlayTokenValid,
} from "@/lib/live-overlay/token";

export const dynamic = "force-dynamic";

type OverlayPageProps = {
  params: {
    token: string;
  };
};

export default function OverlayPage({ params }: OverlayPageProps) {
  const configuredToken = getLiveOverlayToken();

  if (!configuredToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div className="max-w-lg rounded-[28px] border border-white/10 bg-white/5 p-8 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">
            Overlay unavailable
          </p>
          <h1 className="mt-3 text-3xl font-black">Falta configurar el token del overlay</h1>
          <p className="mt-3 text-sm text-white/70">
            Define <code>{getLiveOverlayTokenEnvKey()}</code> para habilitar esta vista pública.
          </p>
        </div>
      </div>
    );
  }

  if (!isLiveOverlayTokenValid(params.token)) {
    notFound();
  }

  return <OverlayCanvasClient token={params.token} />;
}
