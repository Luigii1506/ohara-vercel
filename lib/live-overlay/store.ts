import type {
  LiveOverlayCard,
  LiveOverlayRarityCounterKey,
  LiveOverlayRarityCounters,
  LiveOverlayState,
} from "@/lib/live-overlay/types";
import { LIVE_OVERLAY_RARITY_COUNTER_KEYS } from "@/lib/live-overlay/types";

type OverlayListener = (state: LiveOverlayState) => void;

type OverlayStore = {
  stateByToken: Map<string, LiveOverlayState>;
  listenersByToken: Map<string, Set<OverlayListener>>;
};

const createDefaultRarityCounters = (): LiveOverlayRarityCounters =>
  LIVE_OVERLAY_RARITY_COUNTER_KEYS.reduce((accumulator, key) => {
    accumulator[key] = 0;
    return accumulator;
  }, {} as LiveOverlayRarityCounters);

const createDefaultState = (): LiveOverlayState => ({
  currentCard: null,
  rarityCounters: createDefaultRarityCounters(),
  updatedAt: new Date().toISOString(),
});

const getGlobalStore = () => {
  const globalKey = "__ohara_live_overlay_store__";
  const globalObject = globalThis as typeof globalThis & {
    [globalKey]?: OverlayStore;
  };

  if (!globalObject[globalKey]) {
    globalObject[globalKey] = {
      stateByToken: new Map<string, LiveOverlayState>(),
      listenersByToken: new Map<string, Set<OverlayListener>>(),
    };
  }

  return globalObject[globalKey]!;
};

export const getLiveOverlayState = (token: string): LiveOverlayState => {
  const store = getGlobalStore();
  const existing = store.stateByToken.get(token);
  if (existing) return existing;

  const nextState = createDefaultState();
  store.stateByToken.set(token, nextState);
  return nextState;
};

const emitState = (token: string, state: LiveOverlayState) => {
  const store = getGlobalStore();
  const listeners = store.listenersByToken.get(token);
  if (!listeners?.size) return;

  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (error) {
      console.error("[live-overlay] listener failed:", error);
    }
  });
};

const updateState = (
  token: string,
  updater: (state: LiveOverlayState) => LiveOverlayState
) => {
  const store = getGlobalStore();
  const currentState = getLiveOverlayState(token);
  const nextState = {
    ...updater(currentState),
    updatedAt: new Date().toISOString(),
  };

  store.stateByToken.set(token, nextState);
  emitState(token, nextState);

  return nextState;
};

export const subscribeToLiveOverlay = (
  token: string,
  listener: OverlayListener
) => {
  const store = getGlobalStore();
  const listeners = store.listenersByToken.get(token) ?? new Set<OverlayListener>();
  listeners.add(listener);
  store.listenersByToken.set(token, listeners);

  return () => {
    const current = store.listenersByToken.get(token);
    if (!current) return;

    current.delete(listener);
    if (current.size === 0) {
      store.listenersByToken.delete(token);
    }
  };
};

export const setLiveOverlayCard = (token: string, card: LiveOverlayCard) =>
  updateState(token, (state) => ({
    ...state,
    currentCard: card,
  }));

export const clearLiveOverlayCard = (token: string) =>
  updateState(token, (state) => ({
    ...state,
    currentCard: null,
  }));

export const setLiveOverlayCounter = (token: string, value: number) =>
  updateState(token, (state) => ({
    ...state,
    rarityCounters: {
      ...state.rarityCounters,
      C: Math.max(0, Math.trunc(value)),
    },
  }));

export const incrementLiveOverlayCounter = (token: string, amount: number) =>
  updateState(token, (state) => ({
    ...state,
    rarityCounters: {
      ...state.rarityCounters,
      C: Math.max(0, state.rarityCounters.C + Math.trunc(amount)),
    },
  }));

export const setLiveOverlayRarityCounter = (
  token: string,
  rarity: LiveOverlayRarityCounterKey,
  value: number
) =>
  updateState(token, (state) => ({
    ...state,
    rarityCounters: {
      ...state.rarityCounters,
      [rarity]: Math.max(0, Math.trunc(value)),
    },
  }));

export const incrementLiveOverlayRarityCounter = (
  token: string,
  rarity: LiveOverlayRarityCounterKey,
  amount: number
) =>
  updateState(token, (state) => ({
    ...state,
    rarityCounters: {
      ...state.rarityCounters,
      [rarity]: Math.max(0, state.rarityCounters[rarity] + Math.trunc(amount)),
    },
  }));

export const resetLiveOverlayRarityCounters = (token: string) =>
  updateState(token, (state) => ({
    ...state,
    rarityCounters: createDefaultRarityCounters(),
  }));
