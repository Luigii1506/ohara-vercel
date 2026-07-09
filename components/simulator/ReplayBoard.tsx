"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Heart } from "lucide-react";
import { useSimulatorStore, SIMULATOR_CARD_FALLBACK } from "@/store/simulatorStore";
import LazyImage from "@/components/LazyImage";
import { CardInstance, Side, ZoneId } from "@/types/simulator";
import { cn } from "@/lib/utils";

// Board de SOLO LECTURA para el replay, estilo simulador oficial.
//
// IMPORTANTE: todos los subcomponentes viven a NIVEL DE MÓDULO (no dentro de
// ReplayBoard). Definirlos dentro haría que en cada paso React los viera como
// tipos nuevos → desmontaría/re-montaría el árbol → LazyImage reiniciaría y las
// imágenes parpadearían. BoardCard está memoizado para no recargar cuando sus
// datos no cambian.
//
// Ajuste de tamaño: ancho de carta topado por conteo (no se encima) + alto por
// flex + aspect-ratio global → cabe siempre en pantalla con proporción estándar.

const CARD =
  "h-full max-w-full aspect-[5/7] rounded-[5px] overflow-hidden shadow ring-1 ring-black/40";

// Imagen de la carta DON!! estándar (teal) desde el catálogo.
const DON_IMG =
  "https://ohara-image-worker.luis-encinas1506.workers.dev/cards/Promotional-don-teal.webp";

// Contexto de hover: expone una función estable para mostrar la carta en grande.
type HoverInfo = { src?: string; name?: string } | null;
const HoverCtx = createContext<(info: HoverInfo) => void>(() => {});

const BoardCard = React.memo(
  function BoardCard({ card, className }: { card?: CardInstance; className?: string }) {
    const setHover = useContext(HoverCtx);
    const src = card?.card?.src;
    const don = card?.attachedDon ?? 0;
    return (
      <div
        className={cn("relative bg-black/30 transition-transform", CARD, card?.rested && "rotate-90", className)}
        title={card?.card?.name ?? ""}
        onMouseEnter={() => src && setHover({ src, name: card?.card?.name })}
        onMouseLeave={() => setHover(null)}
      >
        <LazyImage
          src={src}
          fallbackSrc={SIMULATOR_CARD_FALLBACK}
          alt={card?.card?.name ?? ""}
          className="h-full w-full object-cover"
          objectFit="cover"
        />
        {/* DON!! adheridos: se ven como cartas DON en la parte baja del personaje. */}
        {don > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center gap-[1px] px-0.5 pb-[3px]">
            {Array.from({ length: Math.min(don, 10) }).map((_, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={DON_IMG}
                alt=""
                className="w-auto rounded-[1px] ring-1 ring-black/50"
                style={{ height: "30%", aspectRatio: "5 / 7" }}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
  (a, b) =>
    a.className === b.className &&
    a.card?.uid === b.card?.uid &&
    a.card?.card?.src === b.card?.card?.src &&
    a.card?.rested === b.card?.rested &&
    a.card?.attachedDon === b.card?.attachedDon
);

const Pile = React.memo(function Pile({
  cards,
  label,
  faceDown,
  width,
  accent,
}: {
  cards: CardInstance[];
  label: string;
  faceDown?: boolean;
  width: string;
  accent?: string;
}) {
  const top = cards[cards.length - 1];
  const count = cards.length;
  return (
    <div className={cn("relative shrink-0", width)}>
      {count === 0 ? (
        <div
          className={cn(
            CARD,
            "flex items-center justify-center border border-white/10 bg-black/20 text-center text-[8px] font-semibold uppercase tracking-wide text-white/25"
          )}
        >
          {label}
        </div>
      ) : (
        <BoardCard card={faceDown ? undefined : top} />
      )}
      {count > 0 && (
        <span
          className={cn(
            "absolute -right-1 -top-1 z-10 rounded-full px-1 text-[9px] font-bold text-white ring-1 ring-black/50",
            accent ?? "bg-black/80"
          )}
        >
          {count}
        </span>
      )}
    </div>
  );
});

// Cost area: DON!! activos (verticales) + rested (rotados). Los rested NO
// desaparecen: se quedan girados como en el juego real.
const DonArea = React.memo(function DonArea({
  active,
  rested,
}: {
  active: number;
  rested: number;
}) {
  const total = active + rested;
  return (
    <div className="flex flex-1 items-center gap-1.5 self-stretch rounded-md border border-amber-400/20 bg-amber-400/[0.06] px-2 py-1">
      <div className="flex h-full flex-1 items-center">
        {Array.from({ length: Math.min(active, 10) }).map((_, i) => (
          <div
            key={`a${i}`}
            className="h-full overflow-hidden rounded-[3px] shadow ring-1 ring-black/30"
            style={{ aspectRatio: "5 / 7", marginLeft: i === 0 ? 0 : "-3%" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={DON_IMG} alt="DON" className="h-full w-full object-cover" />
          </div>
        ))}
        {Array.from({ length: Math.min(rested, 10) }).map((_, i) => (
          <div
            key={`r${i}`}
            className="h-full shrink-0 rotate-90 overflow-hidden rounded-[3px] opacity-70 shadow ring-1 ring-black/30"
            style={{ aspectRatio: "5 / 7", marginLeft: i === 0 && active > 0 ? "4%" : "-3%" }}
            title="DON rested"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={DON_IMG} alt="DON rested" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
      <span className="shrink-0 text-sm font-bold text-amber-300">
        {active}
        {rested > 0 && <span className="text-amber-300/50">+{rested}</span>}
      </span>
    </div>
  );
});

// Mazo de VIDA: pila de cartas boca abajo + círculo con el número. Al ganar
// vida una carta entra (deal-in); al recibir daño una carta sale (fly-out).
const LifePile = React.memo(function LifePile({ count }: { count: number }) {
  const [pulse, setPulse] = useState<null | "gain" | "loss">(null);
  const prev = useRef(count);
  useEffect(() => {
    if (count === prev.current) return;
    const dir = count > prev.current ? "gain" : "loss";
    prev.current = count;
    setPulse(dir);
    const t = setTimeout(() => setPulse(null), 650);
    return () => clearTimeout(t);
  }, [count]);

  const backs = Array.from({ length: Math.max(0, Math.min(count, 8)) });

  return (
    <div className="relative flex w-[12%] shrink-0 items-center justify-center">
      <div className="relative h-full" style={{ aspectRatio: "5 / 7" }}>
        {backs.length === 0 && (
          <div className={cn(CARD, "flex items-center justify-center border border-white/10 bg-black/20 text-[8px] font-semibold uppercase text-white/25")}>
            Life
          </div>
        )}
        {backs.map((_, i) => (
          <div
            key={i}
            className="absolute inset-x-0 top-0 overflow-hidden rounded-[5px] shadow ring-1 ring-black/40"
            style={{
              aspectRatio: "5 / 7",
              top: `${-i * 7}%`,
              zIndex: i,
              animation:
                pulse === "gain" && i === backs.length - 1
                  ? "lifeIn .45s cubic-bezier(.2,.8,.2,1) both"
                  : undefined,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SIMULATOR_CARD_FALLBACK} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
        {/* Carta que se pierde al recibir daño (fantasma que vuela). */}
        {pulse === "loss" && (
          <div
            className="absolute inset-x-0 top-0 overflow-hidden rounded-[5px] shadow ring-1 ring-rose-400"
            style={{ aspectRatio: "5 / 7", top: `${-count * 7}%`, zIndex: 50, animation: "lifeOut .55s ease forwards" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SIMULATOR_CARD_FALLBACK} alt="" className="h-full w-full object-cover" />
          </div>
        )}
      </div>
      {/* Círculo con el número de vidas. */}
      <span
        className={cn(
          "absolute -top-2 left-1/2 z-[60] -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[11px] font-black leading-none ring-1 transition-all duration-300",
          pulse === "loss"
            ? "scale-125 bg-rose-500 text-white ring-rose-200"
            : pulse === "gain"
            ? "scale-125 bg-emerald-500 text-white ring-emerald-200"
            : "bg-rose-600/90 text-white ring-black/40"
        )}
      >
        {count}
      </span>
    </div>
  );
});

/** Celda de carta con ancho topado por conteo (personajes / mano). */
const RowCard = React.memo(function RowCard({
  card,
  count,
  cap,
}: {
  card: CardInstance;
  count: number;
  cap: number;
}) {
  return (
    <div
      className="flex h-full items-center justify-center"
      style={{ maxWidth: `${Math.min(cap, 100 / count - 1)}%`, flex: "1 1 0%", minWidth: 0 }}
    >
      <BoardCard card={card} />
    </div>
  );
});

const CharacterRow = React.memo(function CharacterRow({ cards }: { cards: CardInstance[] }) {
  return (
    <div className="flex min-h-0 flex-[1.35] items-center justify-center gap-[1%]">
      {cards.length === 0 ? (
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/15">
          Character Area
        </span>
      ) : (
        cards.slice(0, 5).map((c) => <RowCard key={c.uid} card={c} count={5} cap={18} />)
      )}
    </div>
  );
});

const HandRow = React.memo(function HandRow({ cards }: { cards: CardInstance[] }) {
  return (
    <div className="flex min-h-0 flex-[1.1] items-center justify-center gap-[0.5%]">
      {cards.map((c) => (
        <RowCard key={c.uid} card={c} count={Math.max(cards.length, 8)} cap={9} />
      ))}
    </div>
  );
});

const NameBar = React.memo(function NameBar({
  side,
  active,
  life,
}: {
  side: Side;
  active: boolean;
  life: number;
}) {
  return (
    <div className="flex items-center justify-between px-1 text-[11px]">
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", side === "player" ? "bg-emerald-400" : "bg-rose-400")} />
        <span className="font-semibold text-white/80">{side === "player" ? "Tú" : "Oponente"}</span>
        {active && (
          <span className="rounded-full bg-white/15 px-1.5 text-[9px] font-semibold uppercase text-white/70">
            turno
          </span>
        )}
      </div>
      <span className="inline-flex items-center gap-1 font-bold text-rose-300">
        <Heart className="h-3 w-3 fill-rose-400/40" /> {life}
      </span>
    </div>
  );
});

interface HalfData {
  side: Side;
  active: boolean;
  life: number;
  don: number;
  donRested: number;
  chars: CardInstance[];
  lifeCards: CardInstance[];
  leader?: CardInstance;
  stage: CardInstance[];
  deck: CardInstance[];
  trash: CardInstance[];
}

const FieldRow = React.memo(function FieldRow(d: HalfData) {
  return (
    <div className="flex min-h-0 flex-1 items-stretch justify-center gap-[1.5%]">
      <LifePile count={d.life} />
      <div className="flex w-[12%] items-center justify-center">
        <BoardCard card={d.leader} />
      </div>
      <Pile cards={d.stage} label="Stage" width="w-[12%]" />
      <DonArea active={d.don} rested={d.donRested} />
      <Pile cards={d.deck} label="Deck" faceDown width="w-[12%]" />
      <Pile cards={d.trash} label="Trash" width="w-[12%]" />
    </div>
  );
});

const Half = React.memo(function Half({ data, top }: { data: HalfData; top: boolean }) {
  const name = <NameBar side={data.side} active={data.active} life={data.life} />;
  const field = <FieldRow {...data} />;
  const chars = <CharacterRow cards={data.chars} />;
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-[1%] rounded-lg p-2 ring-1 ring-inset",
        data.active ? "bg-white/[0.04] ring-white/20" : "ring-white/5"
      )}
    >
      {top ? (
        <>
          {name}
          {field}
          {chars}
        </>
      ) : (
        <>
          {chars}
          {field}
          {name}
        </>
      )}
    </div>
  );
});

const ReplayBoard: React.FC = () => {
  const { zones, cards, life, donAvailable, donRested, turn, turnOwner, activePerspective } =
    useSimulatorStore(
      useShallow((s) => ({
        zones: s.zones,
        cards: s.cards,
        life: s.life,
        donAvailable: s.donAvailable,
        donRested: s.donRested,
        turn: s.turn,
        turnOwner: s.turnOwner,
        activePerspective: s.activePerspective,
      }))
    );

  const list = (side: Side, s: string): CardInstance[] =>
    (zones[`${side}-${s}` as ZoneId]?.cardUids ?? []).map((uid) => cards[uid]).filter(Boolean);

  const buildHalf = (side: Side): HalfData => ({
    side,
    active: turnOwner === side,
    life: life[side],
    don: donAvailable[side],
    donRested: donRested?.[side] ?? 0,
    chars: list(side, "front-row"),
    lifeCards: list(side, "life"),
    leader: list(side, "leader")[0],
    stage: list(side, "stage"),
    deck: list(side, "deck"),
    trash: list(side, "trash"),
  });

  const [topSide, bottomSide]: Side[] =
    activePerspective === "player" ? ["opponent", "player"] : ["player", "opponent"];

  // Hover: carta ampliada para leerla durante el replay.
  const [hover, setHover] = useState<HoverInfo>(null);
  const setHoverCb = useCallback((info: HoverInfo) => setHover(info), []);

  return (
    <HoverCtx.Provider value={setHoverCb}>
    <div className="relative flex h-full w-full items-center justify-center">
      <style>{`
        @keyframes lifeIn {
          0%   { opacity: 0; transform: translateY(45%) scale(.8); }
          100% { opacity: 1; transform: none; }
        }
        @keyframes lifeOut {
          0%   { opacity: 1; transform: none; }
          100% { opacity: 0; transform: translateY(-120%) rotate(-8deg) scale(.85); }
        }
      `}</style>
      <div
        className="flex flex-col gap-[1%]"
        style={{ height: "100%", aspectRatio: "1000 / 1180", maxWidth: "100%" }}
      >
        <HandRow cards={list(topSide, "hand")} />

        <div className="flex min-h-0 flex-[9] flex-col gap-[1%] rounded-xl border border-white/10 bg-gradient-to-b from-sky-950/60 via-slate-900/50 to-sky-950/60 p-2">
          <Half data={buildHalf(topSide)} top />
          <div className="flex shrink-0 items-center justify-center gap-2 py-0.5">
            <div className="h-px flex-1 bg-white/10" />
            <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">
              Turno {turn}
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
          <Half data={buildHalf(bottomSide)} top={false} />
        </div>

        <HandRow cards={list(bottomSide, "hand")} />
      </div>

      {/* Preview de la carta al hacer hover (para leerla completa). */}
      {hover?.src && (
        <div className="pointer-events-none absolute left-2 top-1/2 z-30 -translate-y-1/2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hover.src}
            alt={hover.name ?? ""}
            className="h-[70vh] max-h-[620px] w-auto rounded-xl object-contain shadow-2xl ring-2 ring-white/20"
          />
        </div>
      )}
    </div>
    </HoverCtx.Provider>
  );
};

export default ReplayBoard;
