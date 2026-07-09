import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { CardWithCollectionData, Card, Deck } from "@/types";
import {
  CardInstance,
  ReplayMetadata,
  Side,
  SimulationState,
  Snapshot,
  ZoneId,
  ZoneState,
  ZONE_BLUEPRINT,
} from "@/types/simulator";

type SimulatorStore = SimulationState & {
  snapshots: Snapshot[];
  spawnCard: (
    card: CardWithCollectionData | Card | null,
    zoneId: ZoneId,
    owner?: Side
  ) => void;
  moveCard: (uid: string, targetZoneId: ZoneId, position?: number) => void;
  toggleRest: (uid: string) => void;
  updateCounters: (uid: string, delta: number) => void;
  removeCard: (uid: string) => void;
  cloneCard: (uid: string) => void;
  resetBoard: (options?: { keepLeaders?: boolean }) => void;
  setPerspective: (side: Side) => void;
  swapPerspective: () => void;
  setTurnOwner: (side: Side) => void;
  nextTurn: () => void;
  updateLife: (side: Side, delta: number) => void;
  setDon: (side: Side, value: number) => void;
  createSnapshot: (label?: string, note?: string) => Snapshot | null;
  loadSnapshot: (snapshotId: string) => void;
  deleteSnapshot: (snapshotId: string) => void;
  importDeck: (deckId: number, owner?: Side) => Promise<void>;
  importGameLog: (logId: number) => Promise<void>;
  updateZoneNote: (zoneId: ZoneId, value: string) => void;
  loadReplayFrame: (frame: SimulationState) => void;
};

const createZoneMap = (): Record<ZoneId, ZoneState> => {
  return ZONE_BLUEPRINT.reduce<Record<ZoneId, ZoneState>>((acc, zone) => {
    acc[zone.id] = {
      ...zone,
      cardUids: [],
      metadata: {},
    };
    return acc;
  }, {} as Record<ZoneId, ZoneState>);
};

const createBaseState = (): SimulationState => ({
  zones: createZoneMap(),
  cards: {},
  life: {
    player: 5,
    opponent: 5,
  },
  donAvailable: {
    player: 0,
    opponent: 0,
  },
  donRested: {
    player: 0,
    opponent: 0,
  },
  turn: 1,
  turnOwner: "player",
  activePerspective: "player",
  importedDeckId: undefined,
  importedGameLogId: undefined,
  replayMetadata: undefined,
});

const cloneZoneState = (zone: ZoneState): ZoneState => ({
  ...zone,
  cardUids: [...zone.cardUids],
  metadata: zone.metadata ? { ...zone.metadata } : {},
});

const cloneZones = (zones: Record<ZoneId, ZoneState>) => {
  const entries = Object.entries(zones).map(([id, zone]) => [
    id,
    cloneZoneState(zone),
  ]);
  return Object.fromEntries(entries) as Record<ZoneId, ZoneState>;
};

const cloneCards = (cards: Record<string, CardInstance>) => {
  const entries = Object.entries(cards).map(([uid, card]) => [
    uid,
    { ...card },
  ]);
  return Object.fromEntries(entries) as Record<string, CardInstance>;
};

const buildUid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `card-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const removeFromZone = (
  zones: Record<ZoneId, ZoneState>,
  zoneId: ZoneId,
  uid: string
) => {
  const zone = zones[zoneId];
  if (!zone) return;
  zone.cardUids = zone.cardUids.filter((cardUid) => cardUid !== uid);
};

const clearZoneCards = (
  cards: Record<string, CardInstance>,
  zones: Record<ZoneId, ZoneState>,
  zoneId: ZoneId
) => {
  const zone = zones[zoneId];
  if (!zone) return;
  zone.cardUids.forEach((uid) => {
    delete cards[uid];
  });
  zone.cardUids = [];
};

const collectStateForSnapshot = (state: SimulationState): SimulationState => ({
  zones: cloneZones(state.zones),
  cards: cloneCards(state.cards),
  life: { ...state.life },
  donAvailable: { ...state.donAvailable },
  donRested: { ...(state.donRested ?? { player: 0, opponent: 0 }) },
  turn: state.turn,
  turnOwner: state.turnOwner,
  activePerspective: state.activePerspective,
  importedDeckId: state.importedDeckId,
  importedGameLogId: state.importedGameLogId,
  replayMetadata: state.replayMetadata ? { ...state.replayMetadata } : undefined,
});

const SIMULATOR_FALLBACK_IMAGE = "/assets/images/backcard.webp";

// Persistencia en IndexedDB (idb-keyval) para no perder el tablero al recargar.
const idbStorage: StateStorage = {
  getItem: async (name) => ((await idbGet(name)) as string) ?? null,
  setItem: async (name, value) => {
    await idbSet(name, value);
  },
  removeItem: async (name) => {
    await idbDel(name);
  },
};

export const useSimulatorStore = create<SimulatorStore>()(
  persist(
    (set, get) => ({
  ...createBaseState(),
  snapshots: [],

  spawnCard: (card, zoneId, owner) => {
  set((state) => {
    const zone = state.zones[zoneId];
    if (!zone) return state;
    const zones = cloneZones(state.zones);
    const zoneState = zones[zoneId];
    if (!zoneState) return state;

    const resolvedOwner = owner ?? zoneState.owner ?? "player";
    const uid = buildUid();
    const cards = { ...state.cards };
    const resolvedCardId =
      (card as CardWithCollectionData)?.id ||
      (card as Card)?.id ||
      undefined;

    cards[uid] = {
      uid,
      cardId: resolvedCardId,
      card: card ?? undefined,
      owner: resolvedOwner,
      zoneId,
      rested: false,
      counters: 0,
    };

    zoneState.cardUids = [...zoneState.cardUids, uid];

    return {
      ...state,
      cards,
      zones,
    };
  });
  },

  moveCard: (uid, targetZoneId, position) => {
    set((state) => {
      const card = state.cards[uid];
      const targetZone = state.zones[targetZoneId];
      if (!card || !targetZone) return state;

      const zones = cloneZones(state.zones);
      const cards = { ...state.cards };

      removeFromZone(zones, card.zoneId, uid);

      const nextOwner = targetZone.owner ?? card.owner;
      const updatedCard: CardInstance = {
        ...card,
        zoneId: targetZoneId,
        owner: nextOwner,
      };

      cards[uid] = updatedCard;

      const targetZoneState = zones[targetZoneId];
      const insertPosition =
        typeof position === "number" && position >= 0
          ? Math.min(position, targetZoneState.cardUids.length)
          : targetZoneState.cardUids.length;

      const updatedUids = [...targetZoneState.cardUids];
      updatedUids.splice(insertPosition, 0, uid);
      targetZoneState.cardUids = updatedUids;

      return {
        ...state,
        cards,
        zones,
      };
    });
  },

  toggleRest: (uid) => {
    set((state) => {
      const card = state.cards[uid];
      if (!card) return state;
      const cards = {
        ...state.cards,
        [uid]: {
          ...card,
          rested: !card.rested,
        },
      };
      return {
        ...state,
        cards,
      };
    });
  },

  updateCounters: (uid, delta) => {
    set((state) => {
      const card = state.cards[uid];
      if (!card) return state;
      const nextCounters = Math.max(0, card.counters + delta);
      const cards = {
        ...state.cards,
        [uid]: {
          ...card,
          counters: nextCounters,
        },
      };
      return {
        ...state,
        cards,
      };
    });
  },

  removeCard: (uid) => {
    set((state) => {
      const card = state.cards[uid];
      if (!card) return state;
      const cards = { ...state.cards };
      delete cards[uid];
      const zones = cloneZones(state.zones);
      removeFromZone(zones, card.zoneId, uid);
      return {
        ...state,
        cards,
        zones,
      };
    });
  },

  cloneCard: (uid) => {
    const { cards } = get();
    const source = cards[uid];
    if (!source) return;
    set((state) => {
      const zone = state.zones[source.zoneId];
      if (!zone) return state;
      const newUid = buildUid();
      const cards = {
        ...state.cards,
        [newUid]: {
          ...source,
          uid: newUid,
        },
      };
      const zones = cloneZones(state.zones);
      zones[source.zoneId] = {
        ...zones[source.zoneId],
        cardUids: [...zones[source.zoneId].cardUids, newUid],
      };
      return {
        ...state,
        cards,
        zones,
      };
    });
  },

  resetBoard: (options) => {
    set((state) => {
      const keepLeaders = options?.keepLeaders;
      if (!keepLeaders) {
        return {
          ...createBaseState(),
          snapshots: [],
        };
      }

      const leaderZones: ZoneId[] = ["player-leader", "opponent-leader"];
      const preservedCards: Record<string, CardInstance> = {};
      const preservedAssignments: Array<{
        uid: string;
        zoneId: ZoneId;
      }> = [];

      leaderZones.forEach((zoneId) => {
        const zone = state.zones[zoneId];
        if (!zone) return;
        zone.cardUids.forEach((uid) => {
          const card = state.cards[uid];
          if (card) {
            preservedCards[uid] = { ...card };
            preservedAssignments.push({ uid, zoneId });
          }
        });
      });

      const base = createBaseState();
      const zones = base.zones;
      const cards = base.cards;

      preservedAssignments.forEach(({ uid, zoneId }) => {
        zones[zoneId].cardUids.push(uid);
        cards[uid] = preservedCards[uid];
      });

      return {
        ...base,
        cards,
        zones,
        snapshots: state.snapshots,
      };
    });
  },

  setPerspective: (side) => {
    set((state) => ({
      ...state,
      activePerspective: side,
    }));
  },

  swapPerspective: () => {
    set((state) => ({
      ...state,
      activePerspective:
        state.activePerspective === "player" ? "opponent" : "player",
    }));
  },

  setTurnOwner: (side) => {
    set((state) => ({
      ...state,
      turnOwner: side,
    }));
  },

  nextTurn: () => {
    set((state) => {
      const newOwner: Side = state.turnOwner === "player" ? "opponent" : "player";
      // Al pasar el turno, "enderezamos" (activamos) las cartas del nuevo
      // jugador activo, como el refresh phase del juego real.
      const cards = cloneCards(state.cards);
      for (const uid of Object.keys(cards)) {
        if (cards[uid].owner === newOwner && cards[uid].rested) {
          cards[uid] = { ...cards[uid], rested: false };
        }
      }
      return {
        ...state,
        cards,
        turn: state.turn + 1,
        turnOwner: newOwner,
      };
    });
  },

  updateLife: (side, delta) => {
    set((state) => ({
      ...state,
      life: {
        ...state.life,
        [side]: Math.max(0, state.life[side] + delta),
      },
    }));
  },

  setDon: (side, value) => {
    set((state) => ({
      ...state,
      donAvailable: {
        ...state.donAvailable,
        [side]: Math.max(0, value),
      },
    }));
  },

  createSnapshot: (label, note) => {
    const currentState = get();
    const snapshotState = collectStateForSnapshot(currentState);
    const snapshot: Snapshot = {
      id: buildUid(),
      label: label || `Snapshot ${currentState.snapshots.length + 1}`,
      createdAt: Date.now(),
      note,
      state: snapshotState,
    };

    set((state) => ({
      ...state,
      snapshots: [...state.snapshots, snapshot],
    }));

    return snapshot;
  },

  loadSnapshot: (snapshotId) => {
    const snapshot = get().snapshots.find((snap) => snap.id === snapshotId);
    if (!snapshot) return;
    set((state) => ({
      ...state,
      ...collectStateForSnapshot(snapshot.state),
    }));
  },

  deleteSnapshot: (snapshotId) => {
    set((state) => ({
      ...state,
      snapshots: state.snapshots.filter((snap) => snap.id !== snapshotId),
    }));
  },

  updateZoneNote: (zoneId, value) => {
    set((state) => {
      const zone = state.zones[zoneId];
      if (!zone) return state;
      const zones = cloneZones(state.zones);
      zones[zoneId] = {
        ...zones[zoneId],
        metadata: {
          ...(zones[zoneId].metadata ?? {}),
          note: value,
        },
      };
      return {
        ...state,
        zones,
      };
    });
  },

  // Reemplaza el tablero con un frame del replay (ya hidratado). El visor de
  // replay lo llama en cada paso; el estado plegado es determinista.
  loadReplayFrame: (frame) => {
    set((state) => ({
      ...state,
      zones: frame.zones,
      cards: frame.cards,
      life: frame.life,
      donAvailable: frame.donAvailable,
      donRested: frame.donRested,
      turn: frame.turn,
      turnOwner: frame.turnOwner,
      activePerspective: frame.activePerspective,
    }));
  },

  importDeck: async (deckId, owner = "player") => {
    const response = await fetch(`/api/admin/deck/${deckId}`);
    if (!response.ok) {
      throw new Error("Error cargando deck");
    }
    const deck: Deck & { deckCards: Array<{ quantity: number; card: Card }> } =
      await response.json();

    set((state) => {
      const targetZoneId =
        owner === "player" ? "player-deck" : "opponent-deck";
      const zones = cloneZones(state.zones);
      const cards = cloneCards(state.cards);

      clearZoneCards(cards, zones, targetZoneId);

      const deckZone = zones[targetZoneId];

      deck.deckCards.forEach((deckCard) => {
        if (!deckCard.card) return;
        for (let i = 0; i < deckCard.quantity; i += 1) {
          const uid = buildUid();
          cards[uid] = {
            uid,
            cardId: deckCard.card.id,
            card: deckCard.card,
            owner,
            zoneId: targetZoneId,
            rested: false,
            counters: 0,
          };
          deckZone.cardUids.push(uid);
        }
      });

      return {
        ...state,
        zones,
        cards,
        importedDeckId: deckId,
      };
    });
  },

  importGameLog: async (logId: number) => {
    const response = await fetch(`/api/logs/${logId}`);
    if (!response.ok) {
      throw new Error("Error cargando log");
    }
    const log = await response.json();

    const metadata: ReplayMetadata = {
      opponentLeaderName: log.opponentLeader?.name,
      opponentLeaderSrc: log.opponentLeader?.src,
      opponentName: log.opponentName,
      deckName: log.deck?.name,
      comments: log.comments,
      playedAt: log.playedAt,
      result: log.isWin ? "win" : "loss",
      wentFirst: log.wentFirst,
    };

    set((state) => ({
      ...state,
      importedGameLogId: logId,
      replayMetadata: metadata,
    }));
  },
    }),
    {
      name: "ohara-simulator-v1",
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        zones: s.zones,
        cards: s.cards,
        life: s.life,
        donAvailable: s.donAvailable,
        donRested: s.donRested,
        turn: s.turn,
        turnOwner: s.turnOwner,
        activePerspective: s.activePerspective,
        importedDeckId: s.importedDeckId,
        importedGameLogId: s.importedGameLogId,
        replayMetadata: s.replayMetadata,
        snapshots: s.snapshots,
      }),
    }
  )
);

export const SIMULATOR_CARD_FALLBACK = SIMULATOR_FALLBACK_IMAGE;
