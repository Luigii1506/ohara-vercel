"use client";

import React, { useEffect, useRef, useState } from "react";
import { SkipForward } from "lucide-react";
import { MulliganInfo } from "@/lib/replay/mulligan";
import { CardMap } from "@/lib/replay/hydrate";
import { SIMULATOR_CARD_FALLBACK } from "@/store/simulatorStore";
import { Side } from "@/types/simulator";
import { cn } from "@/lib/utils";

type Phase = "deal" | "hold" | "discard" | "redraw" | "done";

interface Props {
  mulligans: MulliganInfo[];
  cardMap: CardMap;
  onDone: () => void;
}

const MiniCard: React.FC<{ code?: string; cardMap: CardMap; i: number; anim: string }> = ({
  code,
  cardMap,
  i,
  anim,
}) => {
  const src = code ? cardMap[code]?.src : undefined;
  return (
    <div
      className="relative w-[8vw] max-w-[92px] shrink-0 overflow-hidden rounded-md shadow-lg ring-1 ring-black/50"
      style={{ aspectRatio: "5 / 7", animation: anim, animationDelay: `${i * 80}ms` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src || SIMULATOR_CARD_FALLBACK}
        alt=""
        className="h-full w-full object-cover object-top"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = SIMULATOR_CARD_FALLBACK;
        }}
      />
    </div>
  );
};

const PlayerHand: React.FC<{ m: MulliganInfo; cardMap: CardMap; phase: Phase }> = ({
  m,
  cardMap,
  phase,
}) => {
  // Etapa de este jugador según la fase global.
  const stage: "in" | "out" | "new" = !m.mulliganed
    ? "in"
    : phase === "deal" || phase === "hold"
    ? "in"
    : phase === "discard"
    ? "out"
    : "new";

  const cards = stage === "new" ? m.final : m.opening;
  const anim =
    stage === "out"
      ? "mulliFlyOut 0.45s ease forwards"
      : "mulliDealIn 0.5s cubic-bezier(.2,.8,.2,1) both";

  const showStatus = phase !== "deal";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-sm font-semibold",
            m.side === "player" ? "text-emerald-300" : "text-rose-300"
          )}
        >
          {m.player.split("#")[0]}
        </span>
        {showStatus && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
              m.mulliganed
                ? "bg-amber-400/20 text-amber-300"
                : "bg-emerald-400/20 text-emerald-300"
            )}
          >
            {m.mulliganed ? "Mulligan" : "Se queda"}
          </span>
        )}
      </div>
      {/* key: fuerza remount al cambiar de mano vieja → nueva (dispara deal-in) */}
      <div key={stage === "new" ? "new" : "old"} className="flex gap-2">
        {cards.map((code, i) => (
          <MiniCard key={i} code={code} cardMap={cardMap} i={i} anim={anim} />
        ))}
      </div>
    </div>
  );
};

const MulliganIntro: React.FC<Props> = ({ mulligans, cardMap, onDone }) => {
  const [phase, setPhase] = useState<Phase>("deal");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const anyMulligan = mulligans.some((m) => m.mulliganed);

  useEffect(() => {
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    at(1500, () => setPhase("hold"));
    if (anyMulligan) {
      at(2500, () => setPhase("discard"));
      at(3300, () => setPhase("redraw"));
      at(5200, () => setPhase("done"));
      at(5900, onDone);
    } else {
      at(2800, () => setPhase("done"));
      at(3400, onDone);
    }
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    onDone();
  };

  const heading =
    phase === "discard"
      ? "Mulligan…"
      : phase === "redraw" || (phase === "done" && anyMulligan)
      ? "Nueva mano"
      : "Mano inicial";

  // Oponente arriba, tú abajo.
  const ordered = [...mulligans].sort((a, b) =>
    a.side === "opponent" ? -1 : b.side === "opponent" ? 1 : 0
  );

  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center gap-8 rounded-xl bg-slate-950/85 backdrop-blur-sm transition-opacity duration-500",
        phase === "done" && "pointer-events-none opacity-0"
      )}
    >
      <style>{`
        @keyframes mulliDealIn {
          0%   { opacity: 0; transform: translate(45%, -70%) scale(.55) rotate(14deg); }
          100% { opacity: 1; transform: none; }
        }
        @keyframes mulliFlyOut {
          0%   { opacity: 1; transform: none; }
          100% { opacity: 0; transform: translateY(-90px) scale(.75) rotate(-10deg); }
        }
      `}</style>

      <div className="text-center">
        <div className="text-lg font-bold tracking-wide text-white">{heading}</div>
        <div className="text-xs text-white/40">Fase de mulligan</div>
      </div>

      {ordered.map((m) => (
        <PlayerHand key={m.player} m={m} cardMap={cardMap} phase={phase} />
      ))}

      <button
        onClick={skip}
        className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
      >
        <SkipForward className="h-3.5 w-3.5" /> Saltar
      </button>
    </div>
  );
};

export default MulliganIntro;
