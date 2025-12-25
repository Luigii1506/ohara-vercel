import { CardWithCollectionData, Card } from "@/types";

export type Side = "player" | "opponent";

export type ZoneId =
  | "player-leader"
  | "player-stage"
  | "player-front-row"
  | "player-back-row"
  | "player-don"
  | "player-hand"
  | "player-deck"
  | "player-trash"
  | "player-life"
  | "player-notes"
  | "opponent-leader"
  | "opponent-stage"
  | "opponent-front-row"
  | "opponent-back-row"
  | "opponent-don"
  | "opponent-hand"
  | "opponent-deck"
  | "opponent-trash"
  | "opponent-life"
  | "opponent-notes";

export type ZoneLayout = "stack" | "grid" | "list" | "notes";

export interface ZoneDefinition {
  id: ZoneId;
  label: string;
  owner: Side;
  layout: ZoneLayout;
  capacity?: number;
  allowDuplicates?: boolean;
  description?: string;
}

export interface ZoneState extends ZoneDefinition {
  cardUids: string[];
  metadata?: Record<string, unknown>;
}

export interface CardInstance {
  uid: string;
  cardId?: number | string;
  card?: CardWithCollectionData | Card;
  owner: Side;
  zoneId: ZoneId;
  rested: boolean;
  counters: number;
  notes?: string;
  customLabel?: string;
}

export interface SimulationState {
  zones: Record<ZoneId, ZoneState>;
  cards: Record<string, CardInstance>;
  life: Record<Side, number>;
  donAvailable: Record<Side, number>;
  turnOwner: Side;
  activePerspective: Side;
  importedDeckId?: number;
  importedGameLogId?: number;
  replayMetadata?: ReplayMetadata;
}

export interface Snapshot {
  id: string;
  label: string;
  createdAt: number;
  note?: string;
  state: SimulationState;
}

export interface ReplayMetadata {
  opponentLeaderName?: string;
  opponentLeaderSrc?: string;
  opponentName?: string;
  deckName?: string;
  comments?: string;
  playedAt?: string;
  result?: "win" | "loss";
  wentFirst?: boolean;
}

export const ZONE_BLUEPRINT: ZoneDefinition[] = [
  {
    id: "opponent-life",
    label: "Vida",
    owner: "opponent",
    layout: "stack",
  },
  {
    id: "opponent-hand",
    label: "Mano",
    owner: "opponent",
    layout: "list",
  },
  {
    id: "opponent-front-row",
    label: "Frente",
    owner: "opponent",
    layout: "grid",
    capacity: 5,
  },
  {
    id: "opponent-back-row",
    label: "Soporte",
    owner: "opponent",
    layout: "grid",
    capacity: 5,
  },
  {
    id: "opponent-don",
    label: "DON!!",
    owner: "opponent",
    layout: "stack",
  },
  {
    id: "opponent-deck",
    label: "Deck",
    owner: "opponent",
    layout: "stack",
  },
  {
    id: "opponent-trash",
    label: "Cementerio",
    owner: "opponent",
    layout: "stack",
  },
  {
    id: "opponent-leader",
    label: "Líder",
    owner: "opponent",
    layout: "stack",
    capacity: 1,
  },
  {
    id: "opponent-stage",
    label: "Stage",
    owner: "opponent",
    layout: "stack",
    capacity: 1,
  },
  {
    id: "opponent-notes",
    label: "Notas",
    owner: "opponent",
    layout: "notes",
  },
  {
    id: "player-life",
    label: "Vida",
    owner: "player",
    layout: "stack",
  },
  {
    id: "player-hand",
    label: "Mano",
    owner: "player",
    layout: "list",
  },
  {
    id: "player-front-row",
    label: "Frente",
    owner: "player",
    layout: "grid",
    capacity: 5,
  },
  {
    id: "player-back-row",
    label: "Soporte",
    owner: "player",
    layout: "grid",
    capacity: 5,
  },
  {
    id: "player-don",
    label: "DON!!",
    owner: "player",
    layout: "stack",
  },
  {
    id: "player-deck",
    label: "Deck",
    owner: "player",
    layout: "stack",
  },
  {
    id: "player-trash",
    label: "Cementerio",
    owner: "player",
    layout: "stack",
  },
  {
    id: "player-leader",
    label: "Líder",
    owner: "player",
    layout: "stack",
    capacity: 1,
  },
  {
    id: "player-stage",
    label: "Stage",
    owner: "player",
    layout: "stack",
    capacity: 1,
  },
  {
    id: "player-notes",
    label: "Notas",
    owner: "player",
    layout: "notes",
  },
];

export const getZonesBySide = (owner: Side) =>
  ZONE_BLUEPRINT.filter((zone) => zone.owner === owner);
