"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  Trophy,
} from "lucide-react";
import { useSimulatorStore } from "@/store/simulatorStore";
import { parseReplayLog } from "@/lib/replay/parseLog";
import { deriveSideMap, foldEvents } from "@/lib/replay/reduce";
import { collectCodes, fetchCardMap, hydrateState, CardMap } from "@/lib/replay/hydrate";
import { extractMulligans } from "@/lib/replay/mulligan";
import { getPhase } from "@/lib/replay/phases";
import { getActiveCombat } from "@/lib/replay/combat";
import { ParsedReplay, ReplayEvent } from "@/types/replay";
import { Side } from "@/types/simulator";
import ReplayBoard from "./ReplayBoard";
import ReplayLibrary from "./ReplayLibrary";
import MulliganIntro from "./MulliganIntro";
import { cn } from "@/lib/utils";

/** Traduce un evento a una línea legible para el panel de historial. */
function describeEvent(ev: ReplayEvent): string {
  switch (ev.kind) {
    case "draw":
      if (ev.drawType === "deck") return `roba ${ev.card?.name ?? "una carta"}`;
      if (ev.drawType === "don") return `+${ev.count ?? 1} DON!!`;
      return `roba ${ev.count ?? 1} carta(s)`;
    case "attachDon":
      return `adhiere ${ev.amount} DON!! a ${ev.target.name} (${ev.total})`;
    case "deploy":
      return `juega ${ev.card.name}`;
    case "ability":
      return `${ev.source.name}: ${ev.text.replace(/<[^>]+>/g, "").slice(0, 60)}`;
    case "attackDeclare":
      return `⚔️ ${ev.attacker.name} ataca a ${ev.defender.name}`;
    case "combatResult":
      return `${ev.attackerPower} vs ${ev.defenderPower}`;
    case "attackFail":
      return `el ataque falla`;
    case "damage":
      return `💥 ${ev.target.name} recibe ${ev.amount} de daño`;
    case "block":
      return `🛡️ ${ev.blocker.name} bloquea`;
    case "destroy":
      return `☠️ ${ev.card.name} destruida`;
    case "counter":
      return `descarta ${ev.card.name} por +${ev.value} counter`;
    case "deckManip":
      return ev.text.replace(/<[^>]+>/g, "").slice(0, 60);
    case "endTurn":
      return `— fin del turno —`;
    case "life":
      return `vida = ${ev.value}`;
    case "checkpoint":
      return `(estado ${ev.zone}: ${ev.cards.length})`;
    case "concede":
      return `🏳️ se rinde`;
    case "mulligan":
      return `mulligan`;
    case "handReveal":
      return `mano (${ev.cards.length})`;
    case "leader":
      return `líder ${ev.card.name}`;
    default:
      return ev.kind;
  }
}

// Solo JUGADAS reales en el historial. Se excluyen los robos (inundan la lista,
// sobre todo los de habilidades) y el ruido (rz1, raw, version, checkpoints…).
const ACTION_KINDS = new Set<ReplayEvent["kind"]>([
  "deploy",
  "ability",
  "attachDon",
  "attackDeclare",
  "attackFail",
  "damage",
  "block",
  "destroy",
  "counter",
  "endTurn",
  "concede",
]);

// Eventos "significativos" para el playback: los que CAMBIAN el tablero. El
// autoplay y los botones de evento saltan de uno a otro (nunca al ruido rz1/raw/
// setup), así cada paso mueve algo y no hay tiempo muerto.
const PLAYBACK_KINDS = new Set<ReplayEvent["kind"]>([
  "draw",
  "deploy",
  "ability",
  "attachDon",
  "attackDeclare",
  "combatResult",
  "attackFail",
  "damage",
  "block",
  "destroy",
  "counter",
  "deckManip",
  "endTurn",
  "life",
  "concede",
]);

// Pasos de la fase de batalla → van más lentos en autoplay para digerirlos.
const COMBAT_KINDS = new Set<ReplayEvent["kind"]>([
  "attackDeclare",
  "counter",
  "combatResult",
  "attackFail",
  "damage",
  "block",
  "destroy",
]);

const shortName = (p?: string) => (p ? p.split("#")[0] : "");
const stripTags = (s: string) => s.replace(/<[^>]*>/g, "");

export interface HistoryItem {
  idx: number;
  tone: "turn" | "draw" | "don" | "play";
  icon?: string;
  player?: string;
  side?: Side | null;
  text: string;
}

// Construye un historial INTELIGENTE reconstruyendo las fases del turno que el
// log no explica bien: agrupa el marcador de robo con la carta revelada (fase de
// robo), la fase de DON, y los robos de habilidad con su carta fuente. Separa por
// turnos con una cabecera. Así se entiende el flujo del juego, no solo eventos.
function buildHistory(
  replay: ParsedReplay,
  uptoIndex: number,
  sideMap: Record<string, Side>
): HistoryItem[] {
  const items: HistoryItem[] = [];
  const ev = replay.events;

  for (const turn of replay.turns) {
    if (turn.startEvent > uptoIndex) break;
    const tside = sideMap[turn.player] ?? null;
    items.push({
      idx: turn.startEvent,
      tone: "turn",
      player: shortName(turn.player),
      side: tside,
      text: `Turno ${turn.index}`,
    });

    const end = Math.min(turn.endEvent, uptoIndex);
    let i = turn.startEvent;
    while (i <= end) {
      const e = ev[i];
      const rawPlayer =
        e.kind !== "rz1" && "player" in e ? (e.player as string) : undefined;
      const p = rawPlayer ? shortName(rawPlayer) : undefined;
      const s = rawPlayer ? sideMap[rawPlayer] ?? null : null;

      // Fase de robo: "Draw N Card" + las N cartas reveladas siguientes.
      if (e.kind === "draw" && e.drawType === "card") {
        const n = e.count ?? 1;
        const names: string[] = [];
        let j = i + 1;
        while (
          j <= end &&
          names.length < n &&
          ev[j].kind === "draw" &&
          (ev[j] as Extract<ReplayEvent, { kind: "draw" }>).drawType === "deck"
        ) {
          names.push((ev[j] as Extract<ReplayEvent, { kind: "draw" }>).card?.name ?? "?");
          j += 1;
        }
        items.push({
          idx: i,
          tone: "draw",
          icon: "🃏",
          player: p,
          side: s,
          text: names.length ? `roba ${names.join(", ")}` : `roba ${n} carta(s)`,
        });
        i = j;
        continue;
      }

      // Fase de DON.
      if (e.kind === "draw" && e.drawType === "don") {
        items.push({ idx: i, tone: "don", icon: "💎", player: p, side: s, text: `+${e.count ?? 2} DON` });
        i += 1;
        continue;
      }

      // Habilidad que da DON: "X: Draw N Don" → +N DON (no es robo de carta).
      if (e.kind === "ability" && /^\s*Draw\s+\d+\s+(Rested\s+)?Don/i.test(stripTags(e.text))) {
        const nm = stripTags(e.text).match(/Draw\s+(\d+)/i);
        items.push({ idx: i, tone: "don", icon: "💎", player: p, side: s, text: `${e.source.name}: +${nm?.[1] ?? 1} DON` });
        i += 1;
        continue;
      }

      // Habilidad que roba cartas: "X: Draw N Card" + las N cartas de esa habilidad.
      if (e.kind === "ability" && /^\s*Draw\s+\d+\s+Card/i.test(stripTags(e.text))) {
        const m = stripTags(e.text).match(/Draw\s+(\d+)/i);
        const n = m ? parseInt(m[1], 10) : 1;
        const names: string[] = [];
        let j = i + 1;
        while (
          j <= end &&
          names.length < n &&
          ev[j].kind === "draw" &&
          (ev[j] as Extract<ReplayEvent, { kind: "draw" }>).drawType === "deck"
        ) {
          names.push((ev[j] as Extract<ReplayEvent, { kind: "draw" }>).card?.name ?? "?");
          j += 1;
        }
        items.push({
          idx: i,
          tone: "draw",
          icon: "🔮",
          player: p,
          side: s,
          text: `${e.source.name} roba ${names.length ? names.join(", ") : n}`,
        });
        i = j;
        continue;
      }

      // Robo de efecto suelto (sin marcador previo).
      if (e.kind === "draw" && e.drawType === "deck") {
        items.push({ idx: i, tone: "draw", icon: "➕", player: p, side: s, text: `roba ${e.card?.name ?? "una carta"}` });
        i += 1;
        continue;
      }

      // Jugadas.
      if (ACTION_KINDS.has(e.kind) && e.kind !== "endTurn") {
        items.push({ idx: i, tone: "play", player: p, side: s, text: describeEvent(e) });
        i += 1;
        continue;
      }

      i += 1;
    }
  }

  return items;
}

const SPEEDS = [0.5, 1, 2, 4];

const ReplayViewer: React.FC = () => {
  const loadReplayFrame = useSimulatorStore((s) => s.loadReplayFrame);

  const [replay, setReplay] = useState<ParsedReplay | null>(null);
  const [cardMap, setCardMap] = useState<CardMap>({});
  const [fileName, setFileName] = useState<string>("");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [perspective, setPerspective] = useState<Side>("player");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMulligan, setShowMulligan] = useState(false);

  const total = replay ? replay.events.length : 0;
  const sideMap = useMemo(
    () => (replay ? deriveSideMap(replay.header) : {}),
    [replay]
  );
  const mulligans = useMemo(
    () => (replay ? extractMulligans(replay, sideMap) : []),
    [replay, sideMap]
  );
  // Vida inicial de cada lado, tomada del stat de vida del líder.
  const initialLife = useMemo(() => {
    const out: Partial<Record<Side, number>> = {};
    if (!replay) return out;
    for (const [player, card] of Object.entries(replay.header.leaders)) {
      const side = (sideMap as Record<string, Side>)[player];
      const raw = card?.code ? cardMap[card.code]?.life : undefined;
      const n = raw ? parseInt(String(raw), 10) : NaN;
      if (side && !Number.isNaN(n)) out[side] = n;
    }
    return out;
  }, [replay, sideMap, cardMap]);
  // Costo en DON de cada carta (para restear al bajar personajes).
  const cardCost = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [code, c] of Object.entries(cardMap)) {
      const n = c.cost ? parseInt(String(c.cost), 10) : NaN;
      if (!Number.isNaN(n)) out[code] = n;
    }
    return out;
  }, [cardMap]);

  // Cargar y parsear un archivo de log.
  const loadFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseReplayLog(text);
      if (parsed.events.length === 0) {
        throw new Error("El archivo no parece un log de OPTCGSim válido.");
      }
      const codes = collectCodes(parsed);
      const map = await fetchCardMap(codes);
      setCardMap(map);
      setReplay(parsed);
      setFileName(file.name);
      // Arrancar tras el setup: los draws de apertura del oponente se loguean
      // primero y los del jugador mucho después, así que empezar en el primer
      // draw dejaría la mano propia vacía. Anclamos al 2º handReveal (ambas manos
      // de apertura ya reveladas) y de ahí al primer evento que mueve el tablero.
      const revealIdxs = parsed.events
        .map((e, i) => (e.kind === "handReveal" ? i : -1))
        .filter((i) => i >= 0);
      const setupEnd =
        revealIdxs.length >= 2 ? revealIdxs[1] : revealIdxs[0] ?? -1;
      const first = parsed.events.findIndex(
        (e, i) => i > setupEnd && PLAYBACK_KINDS.has(e.kind)
      );
      setIndex(first >= 0 ? first : 0);
      setPlaying(false);
      setShowMulligan(true); // reproduce la animación de mulligan al abrir
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando el log");
    } finally {
      setLoading(false);
    }
  }, []);

  // Renderizar el frame actual: plegar → hidratar → empujar al board.
  useEffect(() => {
    if (!replay) return;
    const state = foldEvents(replay, index, sideMap, perspective, initialLife, cardCost);
    loadReplayFrame(hydrateState(state, cardMap));
  }, [replay, index, perspective, cardMap, sideMap, initialLife, cardCost, loadReplayFrame]);

  // Busca el siguiente/anterior evento significativo (que mueve el tablero).
  const findMeaningful = useCallback(
    (from: number, dir: 1 | -1): number => {
      if (!replay) return -1;
      for (let i = from + dir; i >= 0 && i < replay.events.length; i += dir) {
        if (PLAYBACK_KINDS.has(replay.events[i].kind)) return i;
      }
      return -1;
    },
    [replay]
  );

  // Autoplay: avanza de evento significativo en evento significativo, con PAUSAS
  // al cambiar de fase/turno para que se entienda el flujo del juego.
  useEffect(() => {
    if (!playing || !replay) return;
    const next = findMeaningful(index, 1);
    if (next === -1) {
      setPlaying(false);
      return;
    }
    const kind = replay.events[next].kind;
    const cur = getPhase(replay, index, sideMap);
    const nxt = getPhase(replay, next, sideMap);
    const turnChanged = cur?.turn !== nxt?.turn;
    const phaseChanged = turnChanged || cur?.phase !== nxt?.phase;
    let base = COMBAT_KINDS.has(kind) ? 1400 : 800;
    if (turnChanged) base = 2400; // pausa al empezar un turno nuevo
    else if (phaseChanged) base = 1600; // pausa al cambiar de fase
    const t = setTimeout(() => setIndex(next), base / speed);
    return () => clearTimeout(t);
  }, [playing, index, replay, speed, sideMap, findMeaningful]);

  // Fronteras de turno (fin de cada turno) para navegar.
  const boundaries = useMemo(
    () => (replay ? replay.turns.map((t) => t.endEvent) : []),
    [replay]
  );

  const currentTurn = useMemo(() => {
    if (!replay) return null;
    return (
      replay.turns.find((t) => index >= t.startEvent && index <= t.endEvent) ??
      replay.turns[replay.turns.length - 1] ??
      null
    );
  }, [replay, index]);

  const nextTurn = () => {
    const b = boundaries.find((bi) => bi > index);
    setIndex(b ?? total - 1);
  };
  const prevTurn = () => {
    const prev = [...boundaries].reverse().find((bi) => bi < index);
    // Ir al inicio del turno actual si estamos lejos; si no, al boundary anterior.
    setIndex(prev ?? 0);
  };

  // Historial inteligente completo (fases del turno + robos agrupados).
  const history = useMemo(() => {
    if (!replay) return [];
    return buildHistory(replay, index, sideMap as Record<string, Side>);
  }, [replay, index, sideMap]);

  // Auto-scroll del historial al paso actual (lo último).
  const historyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = historyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history]);

  // Fase del turno actual (para el banner que hace todo entendible).
  const phase = useMemo(
    () => (replay ? getPhase(replay, index, sideMap) : null),
    [replay, index, sideMap]
  );

  // Cola COMPLETA de acciones (se calcula una vez por partida). En pantalla solo
  // mostramos las que ya ocurrieron (index del item <= index actual): la cola
  // "crece" como una película y nunca se borra.
  const feed = useMemo(
    () => (replay ? buildFeed(replay, sideMap as Record<string, Side>) : []),
    [replay, sideMap]
  );
  // Combate activo (para el aviso central de ataque con flecha roja).
  const combat = useMemo(
    () => (replay ? getActiveCombat(replay, index, sideMap) : null),
    [replay, index, sideMap]
  );
  // Evento actual: para el aviso central de "fin del turno".
  const atTurnEnd = replay?.events[index]?.kind === "endTurn";
  // Línea de tiempo COMPLETA: el feed siempre muestra TODAS las acciones (no se
  // borra el futuro al retroceder). Solo resaltamos la acción actual = la última
  // cuyo índice ya ocurrió (<= index). El feed está ordenado por índice.
  const currentActionIndex = useMemo(() => {
    let last = -1;
    for (const f of feed) {
      if (f.index <= index) last = f.index;
      else break;
    }
    return last;
  }, [feed, index]);
  // Auto-scroll: llevar la acción actual a la vista (sin saltos bruscos).
  const currentRowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    currentRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentActionIndex]);
  const onFeedClick = useCallback((item: FeedItem) => {
    // Las tarjetas de setup (mano inicial / mulligan) reproducen la animación de
    // mulligan, como al abrir la partida.
    if (item.kind === "action" && item.setup) {
      setIndex(0);
      setPlaying(false);
      setShowMulligan(true);
      return;
    }
    setIndex(item.index);
    setPlaying(true);
  }, []);

  const header = replay?.header;
  const p1 = header?.players[0];
  const p2 = header?.players[1];
  const sideOf = (player?: string): Side | null =>
    player ? (sideMap as Record<string, Side>)[player] ?? null : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Biblioteca de partidas (abrir carpeta / archivo) */}
      {!replay && <ReplayLibrary onPick={loadFile} />}

      {loading && (
        <div className="flex items-center gap-2 rounded-lg bg-white/5 p-3 text-sm text-white/70">
          <RefreshCw className="h-4 w-4 animate-spin" /> Cargando y resolviendo cartas…
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {replay && (
        <div className="flex h-[calc(100vh-158px)] gap-3">
          {/* Columna IZQUIERDA: cola de acciones (tipo película). Crece hacia
              abajo, nunca se borra; clic en una acción salta a ese punto y sigue. */}
          <div className="flex h-full w-[248px] shrink-0 flex-col gap-2 rounded-xl border border-white/10 bg-slate-900/50 p-2">
            <style>{`
              @keyframes phaseIn { 0%{opacity:0; transform:translateY(-8px) scale(.92);} 100%{opacity:1; transform:none;} }
            `}</style>
            {phase && !showMulligan && (
              <div
                key={`${phase.turn}-${phase.phase}`}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-white/15 bg-slate-950/90 px-2.5 py-1.5 shadow"
                style={{ animation: "phaseIn .4s cubic-bezier(.2,.8,.2,1)" }}
              >
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                    phase.side === "player"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-rose-500/20 text-rose-300"
                  )}
                >
                  T{phase.turn} · {phase.player}
                </span>
                <span className="text-sm leading-none">{phase.icon}</span>
                <span className="truncate text-xs font-bold text-white">{phase.label}</span>
              </div>
            )}
            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
              {feed.length === 0 ? (
                <div className="p-2 text-[11px] text-white/40">
                  Las acciones aparecerán aquí…
                </div>
              ) : (
                feed.map((it) => {
                  const isCur = it.index === currentActionIndex;
                  const isFuture = it.index > index;
                  return (
                    <div
                      key={`${it.kind}-${it.index}`}
                      ref={isCur ? currentRowRef : null}
                      className={cn("transition-opacity", isFuture && "opacity-45")}
                    >
                      <FeedRow
                        item={it}
                        cardMap={cardMap}
                        current={isCur}
                        onSeek={onFeedClick}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Tablero (centro, llena la altura) */}
          <div className="relative h-full min-w-0 flex-1">
            <style>{`
              @keyframes centerPop { 0%{opacity:0; transform:scale(.7);} 15%{opacity:1; transform:scale(1);} 80%{opacity:1;} 100%{opacity:0; transform:scale(1.05);} }
              @keyframes atkArrow { 0%{opacity:.15; transform:scaleX(.7);} 50%{opacity:1; transform:scaleX(1);} 100%{opacity:.15; transform:scaleX(.7);} }
              @keyframes atkGlow { 0%,100%{box-shadow:0 0 0 0 rgba(244,63,94,.0);} 50%{box-shadow:0 0 18px 3px rgba(244,63,94,.55);} }
            `}</style>
            <ReplayBoard />

            {/* Aviso central de FIN DE TURNO */}
            {atTurnEnd && !showMulligan && (
              <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
                <div
                  key={`end-${index}`}
                  className="rounded-2xl border border-white/15 bg-slate-950/85 px-8 py-4 text-center shadow-2xl backdrop-blur"
                  style={{ animation: "centerPop 1.6s ease-in-out" }}
                >
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">Fin del turno</div>
                  <div className="text-2xl font-black text-white">Turno {phase?.turn ?? currentTurn?.index ?? ""}</div>
                </div>
              </div>
            )}

            {/* Aviso central de ATAQUE: flecha roja atacante → defensor */}
            {combat && !atTurnEnd && !showMulligan && (
              <div className="pointer-events-none absolute inset-x-0 top-1/2 z-40 flex -translate-y-1/2 justify-center px-4">
                <div
                  key={`atk-${combat.attacker.code}-${combat.defender.code}`}
                  className="flex items-center gap-2 rounded-2xl border border-rose-500/40 bg-slate-950/85 px-4 py-2.5 shadow-2xl backdrop-blur"
                  style={{ animation: "atkGlow 1.1s ease-in-out infinite" }}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    {cardMap[combat.attacker.code]?.src && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cardMap[combat.attacker.code].src} alt="" className={cn("h-16 w-[46px] rounded object-cover object-top ring-2", combat.attacker.side === "player" ? "ring-emerald-400/70" : "ring-rose-400/70")} />
                    )}
                    <span className={cn("text-sm font-black leading-none", combat.attacker.side === "player" ? "text-emerald-300" : "text-rose-300")}>{combat.attacker.power ?? "—"}</span>
                  </div>
                  <div className="flex flex-col items-center px-1">
                    <span className="text-3xl font-black leading-none text-rose-500" style={{ animation: "atkArrow 1s ease-in-out infinite" }}>➜</span>
                    <span className="text-[9px] font-black uppercase tracking-wide text-rose-400">ataca</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    {cardMap[combat.defender.code]?.src && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cardMap[combat.defender.code].src} alt="" className="h-16 w-[46px] rounded object-cover object-top ring-2 ring-rose-500 animate-pulse" />
                    )}
                    <span className={cn("text-sm font-black leading-none", combat.defender.side === "player" ? "text-emerald-300" : "text-rose-300")}>{combat.defender.power ?? "—"}</span>
                  </div>
                </div>
              </div>
            )}

            {showMulligan && mulligans.length > 0 && (
              <MulliganIntro
                mulligans={mulligans}
                cardMap={cardMap}
                onDone={() => setShowMulligan(false)}
              />
            )}
          </div>

          {/* Panel de control (derecha) */}
          <div className="flex h-full w-[300px] shrink-0 flex-col gap-2 rounded-xl border border-white/10 bg-slate-900/50 p-3">
            {/* Cabecera compacta de la partida */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col gap-1.5">
                {[p1, p2].map((p) => {
                  const leader = p ? header?.leaders[p] : undefined;
                  const isWinner = header?.winner === p;
                  const s = sideOf(p);
                  return (
                    <div key={p} className="flex items-center gap-1.5">
                      {leader && cardMap[leader.code] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cardMap[leader.code].src}
                          alt={leader.name}
                          className="h-7 w-7 rounded object-cover object-top ring-1 ring-white/20"
                        />
                      )}
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          s === "player" ? "bg-emerald-400" : "bg-rose-400"
                        )}
                      />
                      <span className="truncate text-xs font-semibold text-white">
                        {p?.split("#")[0]}
                      </span>
                      {isWinner && <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setPerspective((v) => (v === "player" ? "opponent" : "player"))}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/20"
                  title="Cambiar perspectiva"
                >
                  <Repeat className="h-3 w-3" /> Girar
                </button>
                <button
                  onClick={() => {
                    setIndex(0);
                    setPlaying(false);
                    setShowMulligan(true);
                  }}
                  className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/20"
                  title="Ver mulligan"
                >
                  Mulligan
                </button>
                <button
                  onClick={() => {
                    setReplay(null);
                    setFileName("");
                    setIndex(0);
                    setPlaying(false);
                  }}
                  className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/20"
                >
                  Otro
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-white/50">
              <span>Turno {currentTurn?.index ?? "—"}</span>
              <span>
                evento {index + 1}/{total}
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={0}
              max={Math.max(0, total - 1)}
              value={index}
              onChange={(e) => {
                setPlaying(false);
                setIndex(Number(e.target.value));
              }}
              className="w-full accent-emerald-400"
            />

            {/* Botonera */}
            <div className="flex items-center justify-center gap-1">
              <CtrlBtn onClick={() => setIndex(0)} title="Inicio">
                <ChevronFirst className="h-4 w-4" />
              </CtrlBtn>
              <CtrlBtn onClick={prevTurn} title="Turno anterior">
                <ChevronLeft className="h-4 w-4" />
              </CtrlBtn>
              <button
                onClick={() => setPlaying((p) => !p)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/90 px-3 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <CtrlBtn onClick={nextTurn} title="Turno siguiente">
                <ChevronRight className="h-4 w-4" />
              </CtrlBtn>
              <CtrlBtn onClick={() => setIndex(total - 1)} title="Final">
                <ChevronLast className="h-4 w-4" />
              </CtrlBtn>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CtrlBtn
                onClick={() => {
                  const n = findMeaningful(index, -1);
                  if (n !== -1) setIndex(n);
                }}
                title="Evento anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> ev
              </CtrlBtn>
              <CtrlBtn
                onClick={() => {
                  const n = findMeaningful(index, 1);
                  if (n !== -1) setIndex(n);
                }}
                title="Siguiente evento"
              >
                ev <ChevronRight className="h-3.5 w-3.5" />
              </CtrlBtn>
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="rounded-lg bg-white/10 px-2 py-1.5 text-xs text-white"
              >
                {SPEEDS.map((s) => (
                  <option key={s} value={s} className="bg-slate-800">
                    {s}×
                  </option>
                ))}
              </select>
            </div>

            {/* Historial inteligente (fases del turno + robos), llena el resto */}
            <div
              ref={historyRef}
              className="mt-1 min-h-0 flex-1 overflow-y-auto rounded-lg bg-black/30 p-1.5 text-xs"
            >
              {history.map((it, k) => {
                const isCurrent = k === history.length - 1;
                if (it.tone === "turn") {
                  return (
                    <div key={k} className="my-1 flex items-center gap-2 first:mt-0">
                      <div className="h-px flex-1 bg-white/10" />
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          it.side === "player"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-rose-500/15 text-rose-300"
                        )}
                      >
                        {it.text} · {it.player}
                      </span>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>
                  );
                }
                return (
                  <div
                    key={k}
                    className={cn(
                      "flex items-baseline gap-1.5 rounded px-1 py-[3px]",
                      isCurrent ? "bg-emerald-400/15 text-white" : "text-white/55"
                    )}
                  >
                    {it.icon && <span className="shrink-0">{it.icon}</span>}
                    {it.player && (
                      <span
                        className={cn(
                          "shrink-0 font-medium",
                          it.side === "player" ? "text-emerald-300" : "text-rose-300"
                        )}
                      >
                        {it.player}
                      </span>
                    )}
                    <span className="min-w-0 break-words">{it.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Miniatura de carta por código (null si no hay imagen).
const Thumb: React.FC<{
  code?: string;
  name?: string;
  cardMap: CardMap;
  className?: string;
  ring?: string;
}> = ({ code, name, cardMap, className, ring }) => {
  const src = code ? cardMap[code]?.src : undefined;
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name ?? ""}
      title={cardMap[code!]?.name ?? name}
      className={cn("rounded object-cover object-top ring-1", ring ?? "ring-white/20", className)}
    />
  );
};

type ActionCard = { code: string; name: string };
type ActionView = {
  icon: string;
  title: string;
  player: string;
  source?: ActionCard;
  cards: ActionCard[];
};

// Describe el evento ACTUAL (no-combate) para el panel de "última acción".
function describeAction(
  replay: ParsedReplay,
  index: number,
  sideMap: Record<string, Side>
): ActionView | null {
  const ev = replay.events[index];
  if (!ev) return null;
  const who = (p?: string) => (p ? p.split("#")[0] : "");
  const clean = (t: string) =>
    t.replace(/\[[^\]]*\]/g, "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  switch (ev.kind) {
    case "deploy":
      return {
        icon: ev.fromEffect ? "✨" : "🃏",
        title: ev.fromEffect ? "Aparece en juego" : "Juega carta",
        player: who(ev.player),
        cards: [ev.card],
      };
    case "destroy":
      return { icon: "☠️", title: "KO", player: "", cards: [ev.card] };
    case "counter":
      return { icon: "🛡️", title: "Counter", player: who(ev.player), cards: [ev.card] };
    case "attachDon":
      return {
        icon: "🔶",
        title: `Da ${ev.total} DON`,
        player: who(ev.player),
        cards: [ev.target],
      };
    case "draw":
      return {
        icon: "🃏",
        title: "Roba",
        player: who(ev.player),
        cards: ev.card ? [ev.card] : [],
      };
    case "ability": {
      const t = ev.text || "";
      let icon = "✨";
      if (/reveal|look/i.test(t)) icon = "🔍";
      else if (/destroy/i.test(t)) icon = "☠️";
      else if (/buff/i.test(t)) icon = "⬆️";
      else if (/\brest\b/i.test(t)) icon = "↻";
      else if (/draw/i.test(t)) icon = "🃏";
      else if (/trash/i.test(t)) icon = "🗑️";
      else if (/can'?t|cannot/i.test(t)) icon = "🚫";
      return {
        icon,
        title: clean(t).slice(0, 48) || "Efecto",
        player: who(ev.player),
        source: ev.source?.code ? ev.source : undefined,
        cards: (ev.targets ?? []).filter((c) => c?.code) as ActionCard[],
      };
    }
    default:
      return null;
  }
}

// Panel de "última acción": ataque tipo simulador (flecha roja + poder) o el
// evento actual (jugar carta, revelar, KO, counter, efecto On Play…).
// ── Feed de acciones (cola tipo película): una entrada por jugada. ──
type FeedItem =
  | { kind: "turn"; index: number; turnLabel: string; player: string; side: Side | null }
  | {
      kind: "attack";
      index: number;
      attacker: ActionCard & { side: Side | null; power?: number };
      defender: ActionCard & { side: Side | null; power?: number };
      counters: { code: string; name: string; value: number }[];
      result?: "fail" | "hit" | "destroyed";
      damage?: number;
    }
  | ({ kind: "action"; index: number; side: Side | null; setup?: boolean } & ActionView);

// Construye la cola COMPLETA de acciones del replay (fusiona los ataques en una
// sola entrada e inserta separadores de turno). Se calcula una vez por partida.
function buildFeed(replay: ParsedReplay, sideMap: Record<string, Side>): FeedItem[] {
  const items: FeedItem[] = [];
  const side = (p?: string) => (p ? sideMap[p] ?? null : null);
  const who = (p?: string) => (p ? p.split("#")[0] : "");
  const other = (s: Side | null): Side | null =>
    s === "player" ? "opponent" : s === "opponent" ? "player" : null;

  const turnStart = new Map<number, { label: string; player: string; side: Side | null }>();
  for (const t of replay.turns ?? []) {
    turnStart.set(t.startEvent, {
      label: `Turno ${t.index}`,
      player: who(t.player),
      side: (t as { side?: Side }).side ?? side(t.player),
    });
  }

  let atk: Extract<FeedItem, { kind: "attack" }> | null = null;
  const evs = replay.events;

  // ── Fase inicial: colapsar los robos de apertura + mulligan en 1-2 tarjetas
  //    por jugador (en vez de ~10 "Roba" sueltos). Los robos del setup se saltan
  //    en el bucle; aquí emitimos "Mano inicial" y "Mulligan" (clic → animación). ──
  const mulls = extractMulligans(replay, sideMap);
  const nick = (p?: string, s?: Side | null) =>
    p && p !== "Null" ? who(p) : s === "player" ? "Tú" : "Rival";
  let setupEnd = evs.findIndex((e) => e.kind === "deploy" || e.kind === "attackDeclare");
  if (setupEnd < 0) setupEnd = -1;
  for (const m of mulls) {
    items.push({
      kind: "action",
      index: 0,
      setup: true,
      side: m.side,
      icon: "🖐️",
      title: "Mano inicial",
      player: nick(m.player, m.side),
      cards: (m.opening ?? []).map((c) => ({ code: c, name: c })),
    });
    if (m.mulliganed) {
      items.push({
        kind: "action",
        index: 0,
        setup: true,
        side: m.side,
        icon: "🔄",
        title: "Mulligan",
        player: nick(m.player, m.side),
        cards: (m.final ?? []).map((c) => ({ code: c, name: c })),
      });
    }
  }

  for (let i = 0; i < evs.length; i += 1) {
    if (turnStart.has(i)) {
      const ts = turnStart.get(i)!;
      items.push({ kind: "turn", index: i, turnLabel: ts.label, player: ts.player, side: ts.side });
      atk = null;
    }
    const e = evs[i];
    switch (e.kind) {
      case "attackDeclare": {
        const aSide = side(e.player);
        atk = {
          kind: "attack",
          index: i,
          attacker: { ...e.attacker, side: aSide },
          defender: { ...e.defender, side: other(aSide) },
          counters: [],
        };
        items.push(atk);
        break;
      }
      case "combatResult":
        if (atk) {
          atk.attacker.power = e.attackerPower;
          atk.defender.power = e.defenderPower;
        }
        break;
      case "attackFail":
        if (atk) atk.result = "fail";
        break;
      case "damage":
        if (atk) {
          atk.result = "hit";
          atk.damage = e.amount;
        } else {
          items.push({ kind: "action", index: i, side: null, icon: "💥", title: `${e.amount} de daño`, player: "", cards: [] });
        }
        break;
      case "counter":
        if (atk) atk.counters.push({ code: e.card.code, name: e.card.name, value: e.value });
        else {
          const a = describeAction(replay, i, sideMap);
          if (a) items.push({ kind: "action", index: i, side: side(e.player), ...a });
        }
        break;
      case "destroy":
        if (atk && e.card.code === atk.defender.code) atk.result = "destroyed";
        else {
          const a = describeAction(replay, i, sideMap);
          if (a) items.push({ kind: "action", index: i, side: null, ...a });
        }
        break;
      case "endTurn":
        atk = null;
        break;
      case "draw": {
        // Los robos de apertura (mano inicial / mulligan) NO se listan uno por
        // uno: ya están resumidos en las tarjetas de setup.
        if (setupEnd >= 0 && i <= setupEnd) break;
        const a = describeAction(replay, i, sideMap);
        if (a) items.push({ kind: "action", index: i, side: side(e.player), ...a });
        break;
      }
      default: {
        const a = describeAction(replay, i, sideMap);
        if (a) items.push({ kind: "action", index: i, side: side((e as { player?: string }).player), ...a });
      }
    }
  }
  // Orden cronológico estable (las tarjetas de setup quedan al inicio, index 0).
  items.sort((a, b) => a.index - b.index);
  return items;
}

const accentRing = (s: Side | null) =>
  s === "player" ? "ring-emerald-400/60" : s === "opponent" ? "ring-rose-400/60" : "ring-white/20";
const accentText = (s: Side | null) =>
  s === "player" ? "text-emerald-300" : s === "opponent" ? "text-rose-300" : "text-white/70";

// Una tarjeta del feed. Clickable → salta a ese evento.
const FeedRow: React.FC<{
  item: FeedItem;
  cardMap: CardMap;
  current: boolean;
  onSeek: (item: FeedItem) => void;
}> = ({ item, cardMap, current, onSeek }) => {
  if (item.kind === "turn") {
    return (
      <button onClick={() => onSeek(item)} className="my-1.5 flex w-full items-center gap-2 first:mt-0">
        <div className="h-px flex-1 bg-white/10" />
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
            item.side === "player" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
          )}
        >
          {item.turnLabel} · {item.player}
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </button>
    );
  }

  const base = cn(
    "group w-full rounded-xl border p-2 text-left transition-all",
    current
      ? "border-emerald-400/60 bg-emerald-400/10 shadow-lg ring-1 ring-emerald-400/40"
      : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
  );

  if (item.kind === "attack") {
    return (
      <button onClick={() => onSeek(item)} className={base}>
        <div className="mb-1 text-[9px] font-black uppercase tracking-wide text-rose-300/80">⚔️ Ataque</div>
        <div className="flex items-center justify-between gap-1">
          <div className="flex flex-col items-center gap-0.5">
            <Thumb code={item.attacker.code} name={item.attacker.name} cardMap={cardMap} className="h-[56px] w-[40px]" ring={accentRing(item.attacker.side)} />
            <span className={cn("text-xs font-black leading-none", accentText(item.attacker.side))}>{item.attacker.power ?? "—"}</span>
          </div>
          <span className="flex-1 text-center text-xl font-black leading-none text-rose-500">→</span>
          <div className="flex flex-col items-center gap-0.5">
            <Thumb code={item.defender.code} name={item.defender.name} cardMap={cardMap} className="h-[56px] w-[40px]" ring={accentRing(item.defender.side)} />
            <span className={cn("text-xs font-black leading-none", accentText(item.defender.side))}>{item.defender.power ?? "—"}</span>
          </div>
        </div>
        {item.counters.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {item.counters.map((c, i) => (
              <div key={i} className="flex items-center gap-0.5">
                <Thumb code={c.code} name={c.name} cardMap={cardMap} className="h-7 w-[20px]" ring="ring-sky-400/40" />
                <span className="text-[9px] font-semibold text-sky-300">+{c.value}</span>
              </div>
            ))}
          </div>
        )}
        {item.result && (
          <div
            className={cn(
              "mt-1 rounded-full px-2 py-0.5 text-center text-[10px] font-bold",
              item.result === "fail" ? "bg-white/10 text-white/70" : "bg-rose-500/20 text-rose-300"
            )}
          >
            {item.result === "fail" ? "✖ Falla" : item.result === "destroyed" ? "☠️ KO" : `💥 ${item.damage ?? 1} de daño`}
          </div>
        )}
      </button>
    );
  }

  // acción genérica
  return (
    <button onClick={() => onSeek(item)} className={base}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/85">
        <span className="text-sm leading-none">{item.icon}</span>
        <span className="truncate">
          {item.title}
          {item.player ? <span className={cn("font-semibold", accentText(item.side))}> · {item.player}</span> : null}
        </span>
      </div>
      {(item.source || item.cards.length > 0) && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {item.source && (
            <Thumb code={item.source.code} name={item.source.name} cardMap={cardMap} className="h-[48px] w-[34px]" ring="ring-amber-400/50" />
          )}
          {item.source && item.cards.length > 0 && <span className="text-sm font-black text-rose-500">→</span>}
          {item.cards.slice(0, 6).map((c, i) => (
            <Thumb key={i} code={c.code} name={c.name} cardMap={cardMap} className="h-[44px] w-[31px]" />
          ))}
        </div>
      )}
    </button>
  );
};

const CtrlBtn: React.FC<{
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className="inline-flex items-center gap-0.5 rounded-lg bg-white/10 px-2.5 py-2 text-xs font-medium text-white hover:bg-white/20"
  >
    {children}
  </button>
);

export default ReplayViewer;
