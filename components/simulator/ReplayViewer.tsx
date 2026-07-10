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
import { getActiveCombat } from "@/lib/replay/combat";
import { getPhase } from "@/lib/replay/phases";
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

  // Combate activo (para el panel de combate claro).
  const combat = useMemo(
    () => (replay ? getActiveCombat(replay, index, sideMap) : null),
    [replay, index, sideMap]
  );

  // Fase del turno actual (para el banner que hace todo entendible).
  const phase = useMemo(
    () => (replay ? getPhase(replay, index, sideMap) : null),
    [replay, index, sideMap]
  );

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
          {/* Tablero (izquierda, llena la altura) */}
          <div className="relative h-full min-w-0 flex-1">
            <style>{`
              @keyframes phaseIn { 0%{opacity:0; transform:translateY(-8px) scale(.92);} 100%{opacity:1; transform:none;} }
            `}</style>
            <ReplayBoard />

            {/* Banner de FASE: siempre sabes en qué turno y fase vas. */}
            {phase && !showMulligan && (
              <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center">
                <div
                  key={`${phase.turn}-${phase.phase}`}
                  className="flex items-center gap-2.5 rounded-full border border-white/15 bg-slate-950/90 px-4 py-1.5 shadow-xl backdrop-blur"
                  style={{ animation: "phaseIn .4s cubic-bezier(.2,.8,.2,1)" }}
                >
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide",
                      phase.side === "player"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-rose-500/20 text-rose-300"
                    )}
                  >
                    Turno {phase.turn} · {phase.player}
                  </span>
                  <span className="text-base leading-none">{phase.icon}</span>
                  <span className="text-sm font-bold text-white">{phase.label}</span>
                </div>
              </div>
            )}

            {/* Panel de combate: quién ataca a quién, poder, counters, resultado */}
            {combat && !showMulligan && (
              <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex justify-center px-2">
                <div className="flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-slate-950/90 px-4 py-2 shadow-2xl backdrop-blur">
                  <div className="flex items-center gap-3">
                    <Combatant info={combat.attacker} cardMap={cardMap} role="attacker" />
                    <div className="flex flex-col items-center text-rose-400">
                      <span className="text-xl leading-none">⚔️</span>
                      <span className="text-[9px] font-bold uppercase tracking-wide">ataca</span>
                    </div>
                    <Combatant info={combat.defender} cardMap={cardMap} role="defender" />
                  </div>

                  {combat.counters.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <span className="text-[11px] text-white/50">counter:</span>
                      {combat.counters.map((c, i) => (
                        <div key={i} className="flex items-center gap-1">
                          {cardMap[c.code]?.src && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={cardMap[c.code].src}
                              alt={c.name}
                              title={`${cardMap[c.code]?.name ?? c.name} (+${c.value})`}
                              className="h-9 w-[26px] rounded object-cover object-top ring-1 ring-sky-400/40"
                            />
                          )}
                          <span className="rounded bg-sky-500/20 px-1 text-[10px] font-semibold text-sky-300">
                            +{c.value}
                          </span>
                        </div>
                      ))}
                      <span className="text-xs font-bold text-sky-300">= +{combat.counterTotal}</span>
                    </div>
                  )}

                  {combat.result && (
                    <div
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-bold",
                        combat.result === "fail"
                          ? "bg-white/10 text-white/70"
                          : "bg-rose-500/20 text-rose-300"
                      )}
                    >
                      {combat.result === "fail"
                        ? "✖ El ataque falla"
                        : combat.result === "destroyed"
                        ? "☠️ Personaje destruido"
                        : `💥 ${combat.damage ?? 1} de daño`}
                    </div>
                  )}
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

const Combatant: React.FC<{
  info: { name: string; code: string; side: Side | null; power?: number };
  cardMap: CardMap;
  role: "attacker" | "defender";
}> = ({ info, cardMap, role }) => {
  const src = cardMap[info.code]?.src;
  const name = cardMap[info.code]?.name ?? info.name;
  return (
    <div className="flex items-center gap-2">
      {role === "defender" && src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-12 w-9 rounded object-cover object-top ring-1 ring-white/20" />
      )}
      <div className={cn("flex flex-col", role === "attacker" ? "items-end text-right" : "items-start")}>
        <span className="max-w-[110px] truncate text-xs font-semibold text-white">{name}</span>
        <span
          className={cn(
            "text-lg font-black leading-none",
            info.side === "player" ? "text-emerald-300" : "text-rose-300"
          )}
        >
          {info.power ?? "—"}
        </span>
      </div>
      {role === "attacker" && src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-12 w-9 rounded object-cover object-top ring-1 ring-white/20" />
      )}
    </div>
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
