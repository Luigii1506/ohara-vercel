// Parser de logs de combate de OPTCGSim, formato v1.40 ("AutoSaved/*.log").
//
// Convierte el texto crudo del log en un ParsedReplay: cabecera + array ordenado
// de ReplayEvent + agrupación por turnos. No muta nada ni conoce el tablero:
// solo traduce texto → eventos. La derivación a SimulationState vive en el reducer.

import {
  CardRef,
  ParsedReplay,
  PlayerRef,
  ReplayEvent,
  ReplayHeader,
  ReplayTurn,
} from "@/types/replay";

// Un token de carta puede venir en dos formas:
//   v1.40:  [<mark><link="OP11-040">OP11-040</link></mark>]
//   v1.30:  ["OP11-040">OP11-040]
// En ambas, el código es lo que sigue a link=" o a la primera comilla.
const CARD_LINK_RE = /\[(?:<mark>)?<link="([A-Z0-9-]+)">[^\]]*?\]/g;
const CARD_LINK_LEGACY_RE = /\["([A-Z0-9-]+)">[A-Z0-9-]+\]/g;

/** Extrae todas las cartas (nombre + código) mencionadas en una línea, en orden. */
export function parseCardRefs(line: string): CardRef[] {
  const refs: CardRef[] = [];
  const tokenRe = /\[(?:<mark>)?<link="([A-Z0-9-]+)">[^\]]*?\]|\["([A-Z0-9-]+)">[A-Z0-9-]+\]/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  while ((match = tokenRe.exec(line)) !== null) {
    const code = match[1] ?? match[2] ?? "";
    // El nombre es el texto entre el token anterior y éste, sin corchetes.
    const between = line.slice(lastIndex, match.index);
    const name = cleanName(between);
    refs.push({ name, code });
    lastIndex = tokenRe.lastIndex;
  }
  return refs;
}

/** Limpia el fragmento de texto para quedarnos con un nombre de carta plausible. */
function cleanName(fragment: string): string {
  // Quita conectores comunes que aparecen entre cartas en una misma línea.
  const cleaned = fragment
    .replace(/\[[0-9]+\]/g, "") // anotaciones de poder [9000]
    .replace(/\b(vs|attacking|Blocks|Destroy|Trash|Rest|to|for|from|Deploy|Discard)\b/gi, "")
    .replace(/[:\-]/g, " ")
    .trim();
  // Nos quedamos con la cola (el nombre suele estar pegado al token).
  return cleaned;
}

/** Devuelve [player, resto] si la línea empieza con "[player] ...". */
function splitPlayerPrefix(line: string): [PlayerRef, string] | null {
  const m = line.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
  if (!m) return null;
  return [normalizePlayer(m[1]), m[2]];
}

/** Normaliza el nombre del jugador quitando los zero-width que mete OPTCGSim. */
export function normalizePlayer(raw: string): PlayerRef {
  // Zero-width space/non-joiner/joiner/BOM (OPTCGSim los mete en los nombres).
  return raw.replace(/[\u200B\u200C\u200D\uFEFF]/g, "").trim();
}

/** Parsea una lista "[A,B,C]" a array de códigos. */
function parseCodeList(text: string): string[] {
  const m = text.match(/\[([^\]]*)\]/);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parsea una línea estructurada RZ1|seq|player|token|... */
function parseRz1(text: string, line: number): ReplayEvent | null {
  const parts = text.split("|");
  // RZ1|<seq>|<player>|<token>|<n>|<n>|...
  if (parts.length < 4) return null;
  const seq = Number(parts[1]);
  const player = Number(parts[2]);
  const token = parts[3];
  if (!Number.isFinite(seq) || (player !== 1 && player !== 2)) {
    // Cabecera tipo "RZ1|HDR|1.40a|1|RZ1" u otras variantes: ignorar como raw.
    return { kind: "raw", line, text };
  }
  const fields = parts.slice(4).map((n) => Number(n));
  return { kind: "rz1", line, seq, player: player as 1 | 2, token, fields };
}

/** Parsea una sola línea (ya con nº de línea) a un ReplayEvent, o null si se ignora. */
function parseLine(
  raw: string,
  line: number,
  header: ReplayHeader
): ReplayEvent | null {
  const text = raw.trim();
  if (!text) return null;

  // --- Líneas estructuradas RZ1 ---
  if (text.startsWith("RZ1|")) return parseRz1(text, line);

  // --- Líneas de infraestructura / ruido que no aportan al replay ---
  if (
    /^(Setting up a Relay Room|Connected to Server|MainMenu|Attempting to connect|PlayerTurn_StartWait)/.test(
      text
    )
  ) {
    return null;
  }

  // Room ID (cabecera)
  const roomMatch = text.match(/Room ID:\s*([A-Z0-9]+)/i);
  if (roomMatch) {
    header.roomId ??= roomMatch[1];
    return null;
  }

  // "X Has Connected" (sin corchetes)
  const connMatch = text.match(/^(.+?)\s+Has Connected$/);
  if (connMatch) {
    const player = normalizePlayer(connMatch[1]);
    if (!header.players.includes(player)) header.players.push(player);
    return { kind: "connect", line, player };
  }

  // "Version is 1.40a.60"
  const verMatch = text.match(/^Version is\s+(.+)$/);
  if (verMatch) {
    header.version ??= verMatch[1];
    return { kind: "version", line, version: verMatch[1] };
  }

  // --- Resultado de combate (sin prefijo de jugador): "A [p] vs B [p]" ---
  if (/\svs\s/.test(text) && /\[\d+\]/.test(text)) {
    const powers = Array.from(text.matchAll(/\[(\d+)\]/g), (m) => Number(m[1]));
    const cards = parseCardRefs(text);
    if (cards.length >= 2 && powers.length >= 2) {
      return {
        kind: "combatResult",
        line,
        attacker: cards[0],
        attackerPower: powers[0],
        defender: cards[1],
        defenderPower: powers[1],
      };
    }
  }

  // "Attack Fails" (sin prefijo)
  if (/^Attack Fails$/.test(text)) return { kind: "attackFail", line };

  // Chat / rematch / ruido con formato: ignorar.
  if (
    /^(<b>|<size|Opponent is Ready)/.test(text) ||
    /^RZ1\|HDR/.test(text)
  ) {
    return null;
  }

  // Habilidad SIN prefijo de jugador (p.ej. la del líder): "Enel [CODE]: Draw 1 Don".
  // El dueño se resuelve luego por el código de la carta fuente.
  if (!text.startsWith("[")) {
    const abil = text.match(/^(.+?\])\s*:\s*(.+)$/);
    if (abil) {
      const src = parseCardRefs(abil[1]);
      if (src.length > 0) {
        return {
          kind: "ability",
          line,
          player: "",
          source: src[0],
          text: abil[2],
          targets: parseCardRefs(abil[2]),
        };
      }
    }
  }

  // "X hit for N damage" (puede venir sin prefijo)
  const dmgNoPrefix = text.match(/^(.+?)\s+hit for (\d+) damage$/);
  if (dmgNoPrefix && !text.startsWith("[")) {
    const cards = parseCardRefs(dmgNoPrefix[1]);
    return {
      kind: "damage",
      line,
      target: cards[0] ?? { name: dmgNoPrefix[1].trim(), code: "" },
      amount: Number(dmgNoPrefix[2]),
    };
  }

  // --- Líneas con prefijo de jugador "[player] ..." ---
  const withPlayer = splitPlayerPrefix(text);
  if (!withPlayer) return { kind: "raw", line, text };
  const [player, rest] = withPlayer;

  return parsePlayerLine(player, rest, line, header) ?? {
    kind: "raw",
    line,
    text,
  };
}

/** Parsea el cuerpo de una línea que ya sabemos pertenece a `player`. */
function parsePlayerLine(
  player: PlayerRef,
  rest: string,
  line: number,
  header: ReplayHeader
): ReplayEvent | null {
  // Checkpoints de zona (fuente de verdad)
  let m: RegExpMatchArray | null;
  if ((m = rest.match(/^Hand before Mulligan:\s*(\[.*\])/))) {
    return { kind: "handReveal", line, player, phase: "before", cards: parseCodeList(m[1]) };
  }
  if ((m = rest.match(/^Hand after Mulligan:\s*(\[.*\])/))) {
    return { kind: "handReveal", line, player, phase: "after", cards: parseCodeList(m[1]) };
  }
  if ((m = rest.match(/^Hand:\s*(\[.*\])/))) {
    return { kind: "checkpoint", line, player, zone: "hand", cards: parseCodeList(m[1]) };
  }
  if ((m = rest.match(/^Board:\s*(\[.*\])/))) {
    return { kind: "checkpoint", line, player, zone: "board", cards: parseCodeList(m[1]) };
  }
  if ((m = rest.match(/^Trash:\s*(\[.*\])/))) {
    return { kind: "checkpoint", line, player, zone: "trash", cards: parseCodeList(m[1]) };
  }
  if ((m = rest.match(/^Life:\s*(\d+)/))) {
    return { kind: "life", line, player, value: Number(m[1]) };
  }

  // Setup
  if ((m = rest.match(/^Leader is\s+(.+)$/))) {
    const card = parseCardRefs(rest)[0];
    if (card) card.name = card.name.replace(/^Leader is\s+/i, "").trim();
    if (card) header.leaders[player] = card;
    return { kind: "leader", line, player, card: card ?? { name: m[1].trim(), code: "" } };
  }
  if (/^Will select turn order/.test(rest)) {
    return { kind: "turnOrder", line, player, choice: "select" };
  }
  if (/^Chose to go First/.test(rest)) {
    header.firstPlayer ??= player;
    return { kind: "turnOrder", line, player, choice: "first" };
  }
  if (/^Chose to go Second/.test(rest)) {
    return { kind: "turnOrder", line, player, choice: "second" };
  }
  if (/^Mulligan$/.test(rest)) return { kind: "mulligan", line, player };

  // Robos
  if ((m = rest.match(/^Drew card from deck:\s*(.+)$/))) {
    const card = parseCardRefs(rest)[0];
    if (card) card.name = card.name.replace(/^Drew card\s*(from)?\s*deck\s*/i, "").trim();
    return { kind: "draw", line, player, drawType: "deck", card };
  }
  if ((m = rest.match(/^Draw (\d+) Card$/))) {
    return { kind: "draw", line, player, drawType: "card", count: Number(m[1]) };
  }
  if ((m = rest.match(/^Draw (\d+) (?:Rested )?Don$/))) {
    return { kind: "draw", line, player, drawType: "don", count: Number(m[1]) };
  }

  // DON!!: "Attach N Don to NAME [CODE] (M Total)"
  if ((m = rest.match(/^Attach (\d+) Don to .+?\((\d+) Total\)/))) {
    const target = parseCardRefs(rest)[0];
    if (target) target.name = target.name.replace(/^Attach\s*\d*\s*Don\s*(to)?\s*/i, "").trim();
    return {
      kind: "attachDon",
      line,
      player,
      target: target ?? { name: "", code: "" },
      amount: Number(m[1]),
      total: Number(m[2]),
    };
  }

  // Deploy
  if (/^Deploy\s/.test(rest)) {
    const card = parseCardRefs(rest)[0];
    if (card) return { kind: "deploy", line, player, card };
  }

  // Ataque declarado: "NAME [CODE] attacking NAME2 [CODE2]"
  if (/\sattacking\s/.test(rest)) {
    const cards = parseCardRefs(rest);
    if (cards.length >= 2) {
      return { kind: "attackDeclare", line, player, attacker: cards[0], defender: cards[1] };
    }
  }

  // Bloqueo: "NAME [CODE] Blocks"
  if (/\sBlocks$/.test(rest)) {
    const card = parseCardRefs(rest)[0];
    if (card) return { kind: "block", line, player, blocker: card };
  }

  // Destrucción: "NAME [CODE] Destroyed"
  if (/\sDestroyed$/.test(rest)) {
    const card = parseCardRefs(rest)[0];
    if (card) return { kind: "destroy", line, player, card };
  }

  // Counter: "Discard NAME [CODE] for Counter N"
  if ((m = rest.match(/for Counter (\d+)/))) {
    const card = parseCardRefs(rest)[0];
    return {
      kind: "counter",
      line,
      player,
      card: card ?? { name: "", code: "" },
      value: Number(m[1]),
    };
  }

  // Daño con prefijo: "NAME [CODE] hit for N damage"
  if ((m = rest.match(/hit for (\d+) damage/))) {
    const card = parseCardRefs(rest)[0];
    return {
      kind: "damage",
      line,
      target: card ?? { name: "", code: "" },
      amount: Number(m[1]),
    };
  }

  // Fin de turno
  if (/^End Turn$/.test(rest)) return { kind: "endTurn", line, player };

  // Concede
  if (/^Concedes!?$/.test(rest)) return { kind: "concede", line, player };

  // Manipulación de deck / zonas (incluye recuperar de Trash, quitar de Life, y
  // "X is no longer blocked" que puede venir con la carta al inicio del texto).
  const restNoBold = rest.replace(/<\/?b>/g, "");
  if (
    /^(Sent a Card to Deck|Placing Cards on|Reveal and Draw|Draw .+ from Trash|Trash .+ from Life)/.test(
      restNoBold
    ) ||
    /is no longer blocked from attacking$/.test(restNoBold)
  ) {
    const card = parseCardRefs(rest)[0];
    return { kind: "deckManip", line, player, text: rest, card };
  }

  // Habilidad: "NAME [CODE]: <efecto>"
  const abilityMatch = rest.match(/^(.+?\])\s*:\s*(.+)$/);
  if (abilityMatch) {
    const sourceCards = parseCardRefs(abilityMatch[1]);
    if (sourceCards.length > 0) {
      const effectText = abilityMatch[2];
      return {
        kind: "ability",
        line,
        player,
        source: sourceCards[0],
        text: effectText,
        targets: parseCardRefs(effectText),
      };
    }
  }

  return null;
}

/** Agrupa los eventos en turnos usando los "endTurn" como delimitadores. */
function buildTurns(events: ReplayEvent[]): ReplayTurn[] {
  const turns: ReplayTurn[] = [];
  let start = 0;
  let index = 1;
  for (let i = 0; i < events.length; i += 1) {
    const ev = events[i];
    if (ev.kind === "endTurn") {
      turns.push({ index, player: ev.player, startEvent: start, endEvent: i });
      start = i + 1;
      index += 1;
    }
  }
  // Cola sin "endTurn" (fin por concede / vida): la cerramos como último turno.
  if (start < events.length) {
    const owner =
      events.slice(start).reverse().find(
        (e): e is Extract<ReplayEvent, { player: PlayerRef }> => "player" in e
      )?.player ?? turns[turns.length - 1]?.player ?? "";
    turns.push({
      index,
      player: owner,
      startEvent: start,
      endEvent: events.length - 1,
    });
  }
  return turns;
}

/** Parsea un log completo (contenido crudo del archivo) a ParsedReplay. */
export function parseReplayLog(content: string): ParsedReplay {
  const header: ReplayHeader = {
    players: [],
    leaders: {},
    endReason: "unknown",
  };
  const events: ReplayEvent[] = [];
  const warnings: string[] = [];

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const ev = parseLine(lines[i], i + 1, header);
    if (ev) events.push(ev);
  }

  // Fin de partida: concede tiene prioridad; el que concede pierde.
  const concede = events.find((e) => e.kind === "concede");
  if (concede && concede.kind === "concede") {
    header.loser = concede.player;
    header.winner = header.players.find((p) => p !== concede.player);
    header.endReason = "concede";
  } else {
    // Fin por vida: el jugador cuyo último Life es 0 pierde.
    const lastLife: Partial<Record<PlayerRef, number>> = {};
    for (const e of events) if (e.kind === "life") lastLife[e.player] = e.value;
    const dead = Object.entries(lastLife).find(([, v]) => v === 0);
    if (dead) {
      header.loser = dead[0];
      header.winner = header.players.find((p) => p !== dead[0]);
      header.endReason = "life";
    }
  }

  const turns = buildTurns(events);

  return { header, events, turns, warnings };
}
