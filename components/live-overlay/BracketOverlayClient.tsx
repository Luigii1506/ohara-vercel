"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveOverlayBracket, LiveOverlayState } from "@/lib/live-overlay/types";
import { createEmptyBracket } from "@/lib/live-overlay/types";
import { useOverlaySocket } from "@/lib/live-overlay/useOverlaySocket";
import BracketView from "@/components/live-overlay/BracketView";

type Props = { token: string };

/**
 * Ruta dedicada del bracket (Browser Source aparte, opcional). El overlay
 * principal también puede mostrar el bracket como escena — ver OverlayCanvasClient.
 */
export default function BracketOverlayClient({ token }: Props) {
  const [bracket, setBracket] = useState<LiveOverlayBracket>(
    createEmptyBracket()
  );
  const lastUpdatedAt = useRef<string | null>(null);

  const apply = useCallback((s: LiveOverlayState) => {
    lastUpdatedAt.current = s?.updatedAt ?? lastUpdatedAt.current;
    setBracket(s?.bracket ?? createEmptyBracket());
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
    load();
    const i = window.setInterval(load, connected ? 15000 : 1500);
    return () => window.clearInterval(i);
  }, [load, connected]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-neutral-900">
      <div className="relative h-[1265px] w-[710px] shrink-0 overflow-hidden">
        <BracketView bracket={bracket} />
      </div>
    </div>
  );
}
