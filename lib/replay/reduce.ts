// Reducer del replay: pliega ReplayEvent[] a un SimulationState.
//
// Estrategia HÍBRIDA (la clave de un replay 1:1):
//   1. Los eventos incrementales (draw, deploy, attack, counter, destroy…)
//      construyen una animación plausible turno a turno.
//   2. Los checkpoints de fin de turno (Hand:/Board:/Trash:/Life:) RECONCILIAN
//      las zonas al estado exacto que dejó OPTCGSim → auto-sanado. Aunque un
//      evento intermedio se nos escape, cada frontera de turno vuelve a la verdad.
//
// La función es determinista: mismos eventos → mismo estado (uids incluidos),
// así que la UI puede re-plegar hasta cualquier índice sin cache.

import {
  CardInstance,
  Side,
  SimulationState,
  ZoneId,
  ZoneState,
  ZONE_BLUEPRINT,
} from "@/types/simulator";
import {
  ParsedReplay,
  PlayerRef,
  ReplayEvent,
  ReplayHeader,
} from "@/types/replay";

export type SideMap = Record<PlayerRef, Side>;

/** player1 (primer conectado) → "player", player2 → "opponent". */
export function deriveSideMap(header: ReplayHeader): SideMap {
  const map: SideMap = {};
  const [p1, p2] = header.players;
  if (p1) map[p1] = "player";
  if (p2) map[p2] = "opponent";
  return map;
}

type ReduceContext = {
  sideMap: SideMap;
  /** código de líder → lado dueño (para resolver daño). */
  leaderSide: Record<string, Side>;
  /** código de carta → costo en DON (para restear al bajar personajes). */
  cardCost?: Record<string, number>;
  /** número de jugador RZ1 (1|2) → lado. */
  rzSide?: Record<number, Side>;
  counter: number;
};

const other = (s: Side): Side => (s === "player" ? "opponent" : "player");

const zoneKey = (side: Side, kind: string): ZoneId =>
  `${side}-${kind}` as ZoneId;

function makeZones(): Record<ZoneId, ZoneState> {
  return ZONE_BLUEPRINT.reduce((acc, z) => {
    acc[z.id] = { ...z, cardUids: [], metadata: {} };
    return acc;
  }, {} as Record<ZoneId, ZoneState>);
}

// Tamaño estándar del deck en One Piece TCG (50 cartas, líder aparte).
const DECK_SIZE = 50;

function createInitialState(
  header: ReplayHeader,
  sideMap: SideMap,
  initialLife?: Partial<Record<Side, number>>
): SimulationState {
  const zones = makeZones();
  const cards: Record<string, CardInstance> = {};

  // Colocar líderes.
  for (const [player, card] of Object.entries(header.leaders)) {
    const side = sideMap[player];
    if (!side || !card) continue;
    const uid = `leader-${side}`;
    cards[uid] = {
      uid,
      cardId: card.code,
      owner: side,
      zoneId: zoneKey(side, "leader"),
      rested: false,
      counters: 0,
      attachedDon: 0,
    };
    zones[zoneKey(side, "leader")].cardUids.push(uid);
  }

  // Deck: no conocemos las cartas de arriba, así que lo representamos como una
  // pila de "reversos" (instancias sin `card` → se renderizan boca abajo).
  // El contador de la pila baja al robar. Uids deterministas para keys estables.
  for (const side of ["player", "opponent"] as Side[]) {
    const zoneId = zoneKey(side, "deck");
    for (let i = 0; i < DECK_SIZE; i += 1) {
      const uid = `deck-${side}-${i}`;
      cards[uid] = {
        uid,
        owner: side,
        zoneId,
        rested: false,
        counters: 0,
      };
      zones[zoneId].cardUids.push(uid);
    }
  }

  return {
    zones,
    cards,
    life: {
      player: initialLife?.player ?? 5,
      opponent: initialLife?.opponent ?? 5,
    },
    donAvailable: { player: 0, opponent: 0 },
    donRested: { player: 0, opponent: 0 },
    turn: 1,
    turnOwner: sideMap[header.firstPlayer ?? header.players[0]] ?? "player",
    activePerspective: "player",
  };
}

/** Quita el reverso de arriba del deck (al robar). No falla si el deck está vacío. */
function popDeck(state: SimulationState, side: Side) {
  const zone = state.zones[zoneKey(side, "deck")];
  const uid = zone.cardUids.pop();
  if (uid) delete state.cards[uid];
}

/** Devuelve un reverso al deck (cartas que regresan al mazo: mulligan, fondo, etc.).
 *  Usa ctx.counter para que los uids sean deterministas en cada plegado. */
function pushDeckBack(state: SimulationState, ctx: ReduceContext, side: Side) {
  const zoneId = zoneKey(side, "deck");
  const uid = `db${ctx.counter++}`;
  state.cards[uid] = { uid, owner: side, zoneId, rested: false, counters: 0 };
  state.zones[zoneId].cardUids.push(uid);
}

function newCard(
  ctx: ReduceContext,
  code: string,
  side: Side,
  zoneId: ZoneId
): CardInstance {
  return {
    uid: `c${ctx.counter++}`,
    cardId: code,
    owner: side,
    zoneId,
    rested: false,
    counters: 0,
    attachedDon: 0,
  };
}

/** Añade una carta (por código) al final de una zona. */
function addCode(state: SimulationState, ctx: ReduceContext, side: Side, kind: string, code: string) {
  const zoneId = zoneKey(side, kind);
  const card = newCard(ctx, code, side, zoneId);
  state.cards[card.uid] = card;
  state.zones[zoneId].cardUids.push(card.uid);
  return card;
}

/** Quita UNA carta con ese código de una zona y devuelve su uid (o null). */
function removeCode(state: SimulationState, side: Side, kind: string, code: string): string | null {
  const zone = state.zones[zoneKey(side, kind)];
  const idx = zone.cardUids.findIndex((uid) => state.cards[uid]?.cardId === code);
  if (idx === -1) return null;
  const [uid] = zone.cardUids.splice(idx, 1);
  return uid;
}

/** Busca el uid de una carta por código entre varias zonas de un lado. */
function findCode(state: SimulationState, side: Side, kinds: string[], code: string): string | null {
  for (const kind of kinds) {
    const zone = state.zones[zoneKey(side, kind)];
    const uid = zone.cardUids.find((u) => state.cards[u]?.cardId === code);
    if (uid) return uid;
  }
  return null;
}

/**
 * Reconcilia una zona al multiconjunto exacto de códigos del checkpoint,
 * PRESERVANDO el estado (rested, DON) de las cartas que permanecen.
 */
function reconcileZone(
  state: SimulationState,
  ctx: ReduceContext,
  side: Side,
  kind: string,
  codes: string[]
) {
  const zoneId = zoneKey(side, kind);
  const zone = state.zones[zoneId];

  // Pool de uids actuales agrupados por código.
  const pool = new Map<string, string[]>();
  for (const uid of zone.cardUids) {
    const code = state.cards[uid]?.cardId as string;
    if (!pool.has(code)) pool.set(code, []);
    pool.get(code)!.push(uid);
  }

  const resultUids: string[] = [];
  for (const code of codes) {
    const reuse = pool.get(code)?.shift();
    if (reuse) {
      resultUids.push(reuse);
    } else {
      const card = newCard(ctx, code, side, zoneId);
      state.cards[card.uid] = card;
      resultUids.push(card.uid);
    }
  }

  // Eliminar los uids sobrantes que no entraron al resultado.
  pool.forEach((leftover) => {
    leftover.forEach((uid) => delete state.cards[uid]);
  });

  zone.cardUids = resultUids;
}

/** Aplica UN evento al estado (mutándolo). */
export function applyEvent(state: SimulationState, ev: ReplayEvent, ctx: ReduceContext) {
  switch (ev.kind) {
    case "draw": {
      const side = ctx.sideMap[ev.player];
      if (!side) return;
      if (ev.drawType === "deck" && ev.card) {
        addCode(state, ctx, side, "hand", ev.card.code);
        popDeck(state, side);
      } else if (ev.drawType === "card") {
        // Formato viejo sin identidad: sólo quitamos del deck.
        for (let i = 0; i < (ev.count ?? 1); i += 1) popDeck(state, side);
      }
      // "Draw N Don": NO tocamos el DON aquí — el conteo activo/rested lo fija de
      // forma EXACTA la reconciliación RZ1|CHK (el stream ya incluye estos DON).
      return;
    }

    case "attachDon": {
      const side = ctx.sideMap[ev.player];
      if (!side) return;
      // Solo fijamos el DON adherido por carta (RZ1|CHK no lo desglosa). El
      // activo/rested de la cost area lo maneja la reconciliación.
      const uid = findCode(state, side, ["leader", "front-row", "stage"], ev.target.code);
      if (uid) {
        state.cards[uid] = { ...state.cards[uid], attachedDon: ev.total };
      }
      return;
    }

    case "deploy": {
      const side = ctx.sideMap[ev.player];
      if (!side) return;
      // Sacar de la mano si está; da igual si no (reconcile arregla).
      removeCode(state, side, "hand", ev.card.code);
      addCode(state, ctx, side, "front-row", ev.card.code);
      // Costo: bajar un personaje MUEVE DON de activo a rested = su costo (los
      // deploys por efecto "from Deck/Trash" son gratis). El total lo fija
      // RZ1|CHK; aquí llevamos el split activo/rested al instante.
      if (!ev.fromEffect) {
        const cost = ctx.cardCost?.[ev.card.code] ?? 0;
        const n = Math.min(cost, state.donAvailable[side]);
        state.donAvailable[side] -= n;
        state.donRested[side] += n;
      }
      return;
    }

    case "attackDeclare": {
      const side = ctx.sideMap[ev.player];
      if (!side) return;
      const uid = findCode(state, side, ["leader", "front-row"], ev.attacker.code);
      if (uid) state.cards[uid] = { ...state.cards[uid], rested: true };
      return;
    }

    case "block": {
      const side = ctx.sideMap[ev.player];
      if (!side) return;
      const uid = findCode(state, side, ["front-row", "leader"], ev.blocker.code);
      if (uid) state.cards[uid] = { ...state.cards[uid], rested: true };
      return;
    }

    case "destroy": {
      // Buscar la carta en cualquiera de los dos lados y mandarla al trash de su dueño.
      for (const side of ["player", "opponent"] as Side[]) {
        const uid = removeCode(state, side, "front-row", ev.card.code) ??
          removeCode(state, side, "stage", ev.card.code);
        if (uid) {
          state.cards[uid] = {
            ...state.cards[uid],
            zoneId: zoneKey(side, "trash"),
            rested: false,
            attachedDon: 0,
          };
          state.zones[zoneKey(side, "trash")].cardUids.push(uid);
          return;
        }
      }
      return;
    }

    case "counter": {
      const side = ctx.sideMap[ev.player];
      if (!side) return;
      const uid = removeCode(state, side, "hand", ev.card.code);
      if (uid) {
        state.cards[uid] = { ...state.cards[uid], zoneId: zoneKey(side, "trash") };
        state.zones[zoneKey(side, "trash")].cardUids.push(uid);
      }
      return;
    }

    case "damage": {
      // El daño baja la vida del dueño del líder golpeado.
      const side = ctx.leaderSide[ev.target.code];
      if (side) state.life[side] = Math.max(0, state.life[side] - ev.amount);
      return;
    }

    case "endTurn": {
      const p = ctx.sideMap[ev.player];
      const next = p ? other(p) : other(state.turnOwner);
      const endingTurn = state.turn; // turno que termina (antes de incrementar)
      state.turn += 1;
      state.turnOwner = next;

      // FIN del turno de p: su DON adherido vuelve a la cost area RESTED.
      if (p) {
        let returned = 0;
        for (const uid of Object.keys(state.cards)) {
          const c = state.cards[uid];
          if (c.owner === p && c.attachedDon) {
            returned += c.attachedDon;
            state.cards[uid] = { ...c, attachedDon: 0 };
          }
        }
        state.donRested[p] += returned;
      }

      // FIN del turno de p: se levanta la restricción "no puede atacar/bloquear"
      // de SUS cartas, pero SOLO si no se aplicó en este mismo turno (así dura
      // durante el "next turn" del dueño y no se limpia antes de tiempo).
      if (p) {
        for (const uid of Object.keys(state.cards)) {
          const c = state.cards[uid];
          if (c.status && c.owner === p && c.statusTurn !== endingTurn) {
            state.cards[uid] = { ...c, status: undefined, statusTurn: undefined };
          }
        }
      }

      // INICIO del turno de next (refresh): sus DON rested vuelven a activos,
      // sus cartas se enderezan, y se limpian los buffs temporales.
      state.donAvailable[next] += state.donRested[next];
      state.donRested[next] = 0;
      for (const uid of Object.keys(state.cards)) {
        const c = state.cards[uid];
        if ((c.owner === next && c.rested) || c.tempPower) {
          state.cards[uid] = {
            ...c,
            rested: c.owner === next ? false : c.rested,
            tempPower: 0,
          };
        }
      }
      return;
    }

    case "life": {
      const side = ctx.sideMap[ev.player];
      if (side) state.life[side] = ev.value;
      return;
    }

    case "rzCheck": {
      // Reconciliación con el estado EXACTO del log: vida y DON. Esto elimina
      // cualquier drift de la inferencia por eventos (el dato real manda).
      const side = ctx.rzSide?.[ev.rzPlayer];
      if (!side || ev.fields.length < 6) return;
      state.life[side] = ev.fields[3];
      // f5 = 10 - f4 = TOTAL de DON en juego (exacto). El split activo/rested/
      // adherido lo llevan los eventos; aquí solo fijamos el total.
      const total = Math.max(0, ev.fields[5]);
      let attachedSum = 0;
      for (const uid of Object.keys(state.cards)) {
        const c = state.cards[uid];
        if (c.owner === side) attachedSum += c.attachedDon ?? 0;
      }
      // Rested no puede exceder el total menos lo adherido; activo = resto.
      state.donRested[side] = Math.min(state.donRested[side], Math.max(0, total - attachedSum));
      state.donAvailable[side] = Math.max(0, total - state.donRested[side] - attachedSum);
      return;
    }

    case "checkpoint": {
      const side = ctx.sideMap[ev.player];
      if (!side) return;
      const kind = ev.zone === "board" ? "front-row" : ev.zone; // board → personajes
      reconcileZone(state, ctx, side, kind, ev.cards);
      return;
    }

    case "deckManip": {
      // Cartas que regresan al mazo: reponer un reverso para mantener la pila.
      const side = ctx.sideMap[ev.player];
      if (side && /(Bottom|Top) of Deck|Deck (Bottom|Top)/i.test(ev.text)) {
        pushDeckBack(state, ctx, side);
      }
      return;
    }

    case "ability": {
      // Si la habilidad viene sin prefijo de jugador (player=""), resolvemos el
      // lado por el dueño de la carta fuente (líder/personaje/stage).
      let side = ctx.sideMap[ev.player];
      if (!side && ev.source?.code) {
        for (const s of ["player", "opponent"] as Side[]) {
          if (findCode(state, s, ["leader", "front-row", "stage"], ev.source.code)) {
            side = s;
            break;
          }
        }
      }
      if (side) {
        const t = ev.text;
        // Vida por efectos (al instante):
        if (/to top of Life/i.test(t)) {
          state.life[side] += 1;
        } else if (/Takes? Top Life/i.test(t)) {
          state.life[side] = Math.max(0, state.life[side] - 1);
        }

        // DON adherido a un personaje por efecto (Edward Newgate, Enel…). El
        // activo/rested de la cost area (Rest/Activate Don) lo maneja RZ1|CHK.
        let mm: RegExpMatchArray | null;
        if ((mm = t.match(/Attach (\d+) Rested Don to/i))) {
          const n = Number(mm[1]);
          const tg = ev.targets[0];
          const uid = tg
            ? findCode(state, side, ["leader", "front-row", "stage"], tg.code)
            : null;
          if (uid) {
            const c = state.cards[uid];
            state.cards[uid] = { ...c, attachedDon: (c.attachedDon ?? 0) + n };
          }
        } else if ((mm = t.match(/^Rest (\d+) Don/i))) {
          // Restear DON: mueve activo → rested.
          const n = Math.min(Number(mm[1]), state.donAvailable[side]);
          state.donAvailable[side] -= n;
          state.donRested[side] += n;
        } else if ((mm = t.match(/Activate (\d+) Don/i))) {
          // Parar/stand-up: mueve rested → activo.
          const n = Math.min(Number(mm[1]), state.donRested[side]);
          state.donRested[side] -= n;
          state.donAvailable[side] += n;
        }

        // Restear un PERSONAJE por efecto (p.ej. "Sugar: Rest Sugar").
        const target = ev.targets[0];
        if (/^Rest\s/i.test(t) && !/^Rest\s+\d+\s+Don/i.test(t) && target) {
          const uid = findCode(state, side, ["front-row", "stage", "leader"], target.code);
          if (uid) state.cards[uid] = { ...state.cards[uid], rested: true };
        }
        // Enderezar/activar un personaje por efecto.
        if (/^(Set .+ as Active|Activate)\s/i.test(t) && !/Activate \d+ Don/i.test(t) && target) {
          const uid = findCode(state, side, ["front-row", "stage", "leader"], target.code);
          if (uid) state.cards[uid] = { ...state.cards[uid], rested: false };
        }
        // "Reveal and Draw X" → la carta revelada entra a la mano.
        if (/Reveal and Draw/i.test(t) && target?.code) {
          addCode(state, ctx, side, "hand", target.code);
        }
        // ("Draw N Don" por efecto lo cubre la reconciliación RZ1|CHK.)

        // "Buff <objetivo> N" → poder temporal (+N). "Buff Self N" = a la fuente.
        if (/^Buff /i.test(t)) {
          const clean = t.replace(/\[[^\]]*\]/g, "").replace(/<[^>]*>/g, "");
          const amt = parseInt(clean.match(/(\d+)/)?.[1] ?? "0", 10);
          const tgtCode = /^Buff Self/i.test(t) ? ev.source.code : target?.code;
          const uid = tgtCode
            ? findCode(state, side, ["leader", "front-row", "stage"], tgtCode)
            : null;
          if (uid && amt) {
            const c = state.cards[uid];
            state.cards[uid] = { ...c, tempPower: (c.tempPower ?? 0) + amt };
          }
        }

        // "Trash X" por efecto (costo desde la mano, o mill del deck) → cementerio.
        if (/^Trash\s/i.test(t) && target?.code) {
          const uid =
            removeCode(state, side, "hand", target.code) ??
            removeCode(state, side, "front-row", target.code) ??
            removeCode(state, side, "stage", target.code);
          if (uid) {
            state.cards[uid] = {
              ...state.cards[uid],
              zoneId: zoneKey(side, "trash"),
              rested: false,
              attachedDon: 0,
            };
            state.zones[zoneKey(side, "trash")].cardUids.push(uid);
          } else {
            // No estaba en mano/board → vino del deck: materializar en el trash.
            addCode(state, ctx, side, "trash", target.code);
            popDeck(state, side);
          }
        }

        // "Destroy X" por efecto (p.ej. "Zeus: Destroy Zorojuro") → al cementerio.
        // El objetivo suele ser del rival; lo buscamos en AMBOS lados.
        if (/\bDestroy\b/i.test(t)) {
          for (const tg of ev.targets) {
            if (!tg?.code) continue;
            for (const s of ["player", "opponent"] as Side[]) {
              const uid =
                removeCode(state, s, "front-row", tg.code) ??
                removeCode(state, s, "stage", tg.code);
              if (uid) {
                state.cards[uid] = {
                  ...state.cards[uid],
                  zoneId: zoneKey(s, "trash"),
                  rested: false,
                  attachedDon: 0,
                };
                state.zones[zoneKey(s, "trash")].cardUids.push(uid);
                break;
              }
            }
          }
        }

        // Restricciones tipo "X can't attack/block next turn" → ficha de estado en
        // el objetivo (puede ser de cualquier lado). Se limpia en el fin de turno
        // del dueño (ver case "endTurn").
        if (/can'?t\s+(attack|block)|cannot\s+(attack|block)/i.test(t)) {
          const label = /block/i.test(t) ? "🚫 No bloquea" : "🚫 No ataca";
          for (const tg of ev.targets) {
            if (!tg?.code) continue;
            for (const s of ["player", "opponent"] as Side[]) {
              const uid = findCode(state, s, ["leader", "front-row", "stage"], tg.code);
              if (uid) {
                state.cards[uid] = { ...state.cards[uid], status: label, statusTurn: state.turn };
                break;
              }
            }
          }
        }
      }
      return;
    }

    // La revelación de mano trae el contenido EXACTO de la mano de un jugador
    // (mulligan / reveal). Reconciliamos esa mano para que se vea desde el inicio,
    // en vez de esperar a un checkpoint tardío (el stream RZ1 va por delante).
    case "handReveal": {
      const side = ctx.sideMap[ev.player];
      if (side) reconcileZone(state, ctx, side, "hand", ev.cards);
      return;
    }

    // Eventos informativos o ya cubiertos por reconcile: no mutan el tablero.
    case "combatResult":
    case "attackFail":
    case "mulligan":
    case "turnOrder":
    case "leader":
    case "connect":
    case "version":
    case "concede":
    case "rz1":
    case "raw":
    default:
      return;
  }
}

/**
 * Pliega los eventos [0..uptoIndex] (inclusive) a un SimulationState.
 * Recalcula desde cero: determinista y sin necesidad de cache.
 */
export function foldEvents(
  parsed: ParsedReplay,
  uptoIndex: number,
  sideMap: SideMap = deriveSideMap(parsed.header),
  perspective: Side = "player",
  initialLife?: Partial<Record<Side, number>>,
  cardCost?: Record<string, number>
): SimulationState {
  const leaderSide: Record<string, Side> = {};
  for (const [player, card] of Object.entries(parsed.header.leaders)) {
    const side = sideMap[player];
    if (side && card) leaderSide[card.code] = side;
  }
  const rzSide: Record<number, Side> = {};
  const [rp1, rp2] = parsed.header.players;
  if (rp1 && sideMap[rp1]) rzSide[1] = sideMap[rp1];
  if (rp2 && sideMap[rp2]) rzSide[2] = sideMap[rp2];
  const ctx: ReduceContext = { sideMap, leaderSide, cardCost, rzSide, counter: 0 };
  const state = createInitialState(parsed.header, sideMap, initialLife);
  state.activePerspective = perspective;

  const end = Math.min(uptoIndex, parsed.events.length - 1);
  for (let i = 0; i <= end; i += 1) {
    applyEvent(state, parsed.events[i], ctx);
  }
  return state;
}

/** Contexto reutilizable para plegados incrementales (test / animación fina). */
export function makeContext(parsed: ParsedReplay, sideMap = deriveSideMap(parsed.header)): {
  ctx: ReduceContext;
  state: SimulationState;
} {
  const leaderSide: Record<string, Side> = {};
  for (const [player, card] of Object.entries(parsed.header.leaders)) {
    const side = sideMap[player];
    if (side && card) leaderSide[card.code] = side;
  }
  const ctx: ReduceContext = { sideMap, leaderSide, counter: 0 };
  return { ctx, state: createInitialState(parsed.header, sideMap) };
}
