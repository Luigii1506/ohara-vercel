"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDefaultBattleConfig,
  type LiveOverlayBattleConfig,
  type LiveOverlayBattleRoster,
  type LiveOverlayState,
} from "@/lib/live-overlay/types";
import { useOverlaySocket } from "@/lib/live-overlay/useOverlaySocket";
import BattleArena from "@/components/live-overlay/BattleArena";
import { ensureOverlayAudio } from "@/lib/live-overlay/sfx";

type Props = { token: string };

/**
 * Ruta dedicada de la batalla (Browser Source aparte, opcional) — a
 * diferencia de la variante embebida en OverlayCanvasClient, esta SÍ puede
 * mostrar un fondo personalizado (battle.backgroundUrl). El overlay principal
 * sigue mostrando la versión sin fondo cuando hay una ronda activa.
 */
export default function BattleOverlayClient({ token }: Props) {
  const [battle, setBattle] = useState<LiveOverlayBattleConfig>(createDefaultBattleConfig());
  const [roster, setRoster] = useState<LiveOverlayBattleRoster>({});
  const lastUpdatedAt = useRef<string | null>(null);

  const apply = useCallback((s: LiveOverlayState) => {
    lastUpdatedAt.current = s?.updatedAt ?? lastUpdatedAt.current;
    setBattle(s?.battle ?? createDefaultBattleConfig());
    setRoster(s?.battleRoster ?? {});
  }, []);

  const { connected } = useOverlaySocket({ token, onState: apply });

  const load = useCallback(async () => {
    try {
      const since = lastUpdatedAt.current
        ? `&since=${encodeURIComponent(lastUpdatedAt.current)}`
        : "";
      const r = await fetch(
        `/api/live-overlay/state?token=${encodeURIComponent(token)}${since}`,
        { cache: "no-store" }
      );
      if (!r.ok) throw new Error("bad");
      const d = await r.json();
      if (d.changed === false) return;
      apply(d.state ?? null);
    } catch {
      // reintenta en el próximo tick
    }
  }, [token, apply]);

  useEffect(() => {
    // Mientras hay ronda activa conviene refrescar MUY seguido (500ms) para
    // que se vea la metralleta continua del auto-ataque; si no, el intervalo
    // normal alcanza.
    const active = battle.active;
    const intervalMs = connected ? (active ? 500 : 15000) : active ? 500 : 2500;
    load();
    const i = window.setInterval(load, intervalMs);
    return () => window.clearInterval(i);
  }, [load, connected, battle.active]);

  // Desbloqueo de audio (mismo patrón que OverlayCanvasClient): en OBS suele
  // arrancar solo; en un navegador de prueba queda bloqueado hasta el primer
  // gesto. Esta ruta antes no tenía NINGÚN manejo de audio.
  const [audioReady, setAudioReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    ensureOverlayAudio().then((ready) => mounted && setAudioReady(ready));
    const unlock = async () => {
      const ready = await ensureOverlayAudio();
      if (mounted) setAudioReady(ready);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      mounted = false;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <div className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-neutral-900">
      <div className="relative h-[1265px] w-[710px] shrink-0 overflow-hidden">
        <BattleArena config={battle} roster={roster} variant="dedicated" />
        {!audioReady ? (
          <div className="absolute bottom-4 left-1/2 z-[70] -translate-x-1/2 animate-pulse rounded-full bg-black/85 px-5 py-2.5 text-base font-bold text-white shadow-lg">
            🔊 Clic para activar sonido
          </div>
        ) : null}
      </div>
    </div>
  );
}
