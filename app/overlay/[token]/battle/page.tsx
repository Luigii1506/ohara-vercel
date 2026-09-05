import { notFound } from "next/navigation";
import BattleOverlayClient from "@/components/live-overlay/BattleOverlayClient";
import {
  getLiveOverlayToken,
  getLiveOverlayTokenEnvKey,
  isLiveOverlayTokenValid,
} from "@/lib/live-overlay/token";

export const dynamic = "force-dynamic";

type BattlePageProps = {
  params: {
    token: string;
  };
};

export default function BattleOverlayPage({ params }: BattlePageProps) {
  const configuredToken = getLiveOverlayToken();

  if (!configuredToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div className="max-w-lg rounded-[28px] border border-white/10 bg-white/5 p-8 backdrop-blur">
          <h1 className="text-3xl font-black">
            Falta configurar el token del overlay
          </h1>
          <p className="mt-3 text-sm text-white/70">
            Define <code>{getLiveOverlayTokenEnvKey()}</code> para habilitar esta
            vista.
          </p>
        </div>
      </div>
    );
  }

  if (!isLiveOverlayTokenValid(params.token)) {
    notFound();
  }

  return <BattleOverlayClient token={params.token} />;
}
