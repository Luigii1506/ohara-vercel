import NextAuth from "next-auth";
import type { ListPurpose } from "@/lib/lists/purpose";

declare module "next-auth" {
  interface Session {
    user: {
      id: string; // Agrega id
      role: string; // Agrega role
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

export type User = {
  email: string;
};

export type CardRuling = {
  id: string; // Puedes usar string o number según convenga (en Prisma es number, pero en la API lo manejas como string)
  question: string;
  answer: string;
};

export type CardData = {
  src: string;
  imageKey?: string | null;
  name: string;
  _id: string;
  types: { type: string }[];
  colors: { color: string }[]; // Array de elementos
  cost?: string | null;
  power?: string | null;
  attribute?: string | null;
  counter?: string | null;
  category: string;
  life?: string | null;
  rarity?: string;
  set: string;
  illustrator?: string | null;
  alternateArt?: string | null;
  disclaimer?: string | null;
  status?: string | [];
  triggerCard?: string | null;
  effects?: { effect: string }[];
  texts?: { text: string }[];
  conditions?: { condition: string }[];
  code: string;
  setCode: string;
  isFirstEdition: boolean;
  price?: number;
  id: string;
  alias: string;
  order?: string | null;
  officialVariantCode?: string | null;
  tcgUrl?: string;
  tcgplayerProductId?: string | null;
  tcgplayerLinkStatus?: boolean | null;
  marketPrice?: number | string | null;
  midPrice?: number | string | null;
  lowPrice?: number | string | null;
  highPrice?: number | string | null;
  priceCurrency?: string | null;
  priceUpdatedAt?: string | Date | null;
  rulings?: CardRuling[]; // <-- Aquí agregamos los rulings
  baseCardId?: number | null;
  localizations?: {
    id?: number;
    language: string;
    contentType: "NAME" | "TRIGGER" | "EFFECT" | "TEXT";
    sourceKey: string;
    sourceRecordId?: number | null;
    sourceOrder?: number;
    translatedText: string;
    status?: string;
    translationSource?: string;
  }[];
};

// Interfaces para tipar el deck
export interface Card {
  name: string;
  id: number;
  power: string | null;
  cost: string | null;
  attribute: string | null;
  category: string; // se mantiene por si lo requieres en el futuro
  counter: string | null; // nuevo campo para el counter
  colors: { color: string }[];
  src: string;
  imageKey?: string | null;
  triggerCard?: string | null; // agregamos la propiedad triggerCard
  types?: { type: string }[]; // agregamos la propiedad types
  code: string; // agregamos la propiedad code
  rarity: string; // agregamos la propiedad rarity
  marketPrice?: number | string | null;
  midPrice?: number | string | null;
  priceCurrency?: string | null;
}

export interface DeckCard {
  cardId: number;
  name: string;
  rarity: string;
  src: string;
  quantity: number;
  code: string;
  color: string;
  cost: string;
  category: string;
  set: string;
  power: string; // ej. "3000 Power"
  counter: string; // ej. "+2000 Counter"
  attribute: string; // ej. "Ranged" o "Special"
  card?: Card;
  colors: { color: string }[];
  id: number;
  marketPrice?: number | string | null;
  midPrice?: number | string | null;
  priceCurrency?: string | null;
}

export interface CardWithCollectionData extends CardData {
  isInCollection?: boolean | undefined;
  isSelectable?: boolean | undefined;
  collectionOrder?: string | null;
  totalInCollection: {
    id: string; // ID de la carta en la colección
    quantity: number; // Cantidad de esa carta en la colección
  }[];
  sets: [
    {
      set: {
        title: string;
        id: string;
        code?: string | null;
        region?: string | null;
      };
    }
  ];
  totalQuantity: number;
  numOfVariations: number;
  isPro?: boolean;
  region?: string;
  alternates: CardWithCollectionData[];
  updatedAt: Date;
}

export interface CardWithQuantity extends CardData {
  quantity: number;
}

export type Set = {
  id?: string;
  image: string;
  title: string;
  code: string;
  releaseDate: Date;
  isEvent: Boolean;
};

export type UserCollection = {
  userId: string; // Aquí puedes usar el tipo correspondiente si tienes un tipo para el usuario
  cards: {
    cardId: CardData; // Aquí también puedes usar un tipo correspondiente para la carta si es necesario
    quantity: number;
  }[];
  createdAt?: Date; // Esto se añadirá automáticamente por Mongoose si usas timestamps
  updatedAt?: Date; // Igual que el anterior
};

export type Deck = {
  cardCount: string;
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  uniqueUrl: string;
  originalDeckId: string;
  userId: string;
  user: User;
  deckCards: DeckCard[];
  isShopDeck?: boolean;
  isPublished?: boolean;
  shopSlug?: string | null;
  shopUrl?: string | null;
};

export interface GroupedDeck {
  leaderCard: DeckCard;
  decks: Deck[];
}

export type GroupedDecks = Record<string, GroupedDeck>;

// Tipos para Game Logs
export interface GameLogCard {
  id: number;
  gameLogId: number;
  cardId: number;
  card: Card;
}

export interface GameLog {
  id: number;
  userId: number;
  deckId: number;
  opponentLeaderId: number;
  isWin: boolean;
  wentFirst: boolean;
  opponentName?: string;
  comments?: string;
  playedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  user: User;
  deck: Deck;
  opponentLeader: Card;
  finalHandCards: GameLogCard[];
}

// Interfaces para estadísticas de logs
export interface GameLogStats {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  firstPlayerGames: number;
  firstPlayerWins: number;
  firstPlayerWinRate: number;
  secondPlayerGames: number;
  secondPlayerWins: number;
  secondPlayerWinRate: number;
}

export interface LeaderStats {
  deckId: number;
  deckName: string;
  leaderId: number;
  leaderName: string;
  leaderSrc: string;
  totalGames: number;
  wins: number;
  winRate: number;
}

export interface OpponentLeaderStats {
  opponentLeaderId: number;
  opponentLeaderName: string;
  opponentLeaderSrc: string;
  totalGames: number;
  wins: number;
  winRate: number;
}

export interface CardPerformance {
  cardName: string;
  cardCode: string;
  gamesWithCard: number;
  winsWithCard: number;
  winRateWithCard: number;
}

// Interfaces para listas personalizadas del usuario
export interface UserList {
  id: number;
  userId: number;
  name: string;
  description?: string;
  isOrdered: boolean;
  isDeletable: boolean;
  isCollection: boolean;
  purpose: ListPurpose;
  maxRows?: number;
  maxColumns?: number;
  totalPages: number;
  color?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: User;
  cards?: UserListCard[];
  _count?: {
    cards: number;
  };
  totalValue?: number;
  currency?: string;
  displayCurrency?: string | null;
  exchangeRate?: number | string | null;
}

export interface UserListCard {
  id: number;
  listId: number;
  cardId: number;
  quantity: number;
  sortOrder?: number;
  page?: number;
  row?: number;
  column?: number;
  notes?: string;
  condition?: string;
  customPrice?: number | string | null;
  customCurrency?: string | null;
  isMissing?: boolean;
  isSold?: boolean;
  soldAt?: Date | string | null;
  soldPrice?: number | string | null;
  createdAt: Date;
  updatedAt: Date;
  list: UserList;
  card: Card;
}

// 📸 Snapshot congelado del estado de una carpeta de venta en un momento dado.
export interface UserListSnapshotCardEntry {
  listCardId: number;
  cardId: number;
  code: string;
  name: string;
  src: string;
  quantity: number;
  customPrice: number | null;
  customCurrency: string | null;
  marketPrice: number | null;
  priceCurrency: string | null;
  isSold: boolean;
  soldAt: string | null;
  soldPrice: number | null;
  page: number | null;
  row: number | null;
  column: number | null;
}

export interface UserListSnapshot {
  id: number;
  listId: number;
  label?: string | null;
  createdAt: Date | string;
  totalCards: number;
  totalUnique: number;
  soldCount: number;
  soldValue: number | string;
  availableValue: number | string;
  totalValue: number | string;
  currency: string;
  cardsSnapshot?: UserListSnapshotCardEntry[];
}

// Interfaces para posicionamiento en listas ordenadas
export interface CardPosition {
  page: number;
  row: number;
  column: number;
}

// Interfaces para estadísticas de colección
export interface CollectionStats {
  totalUniqueCards: number;
  totalCardsCount: number;
  rarityDistribution: {
    [rarity: string]: number;
  };
}

// Interfaces para respuestas de API de listas
export interface ListResponse {
  lists: UserList[];
}

export interface ListDetailResponse {
  list: UserList;
  cards: UserListCard[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCards: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  isOwner: boolean;
}

export interface CollectionResponse {
  collection: UserList & {
    stats: CollectionStats;
  };
  cards: UserListCard[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCards: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: {
    search: string;
    sortBy: string;
    sortOrder: string;
  };
}

// Interfaces para operaciones de listas
export interface CreateListRequest {
  name: string;
  description?: string;
  isOrdered?: boolean;
  maxRows?: number;
  maxColumns?: number;
  color?: string;
  isPublic?: boolean;
}

export interface UpdateListRequest {
  name?: string;
  description?: string;
  isOrdered?: boolean;
  maxRows?: number;
  maxColumns?: number;
  color?: string;
  isPublic?: boolean;
}

export interface AddCardToListRequest {
  cardId: number;
  quantity?: number;
  notes?: string;
  condition?: string;
  position?: CardPosition;
}

export interface UpdateCardInListRequest {
  quantity?: number;
  notes?: string;
  condition?: string;
  position?: CardPosition;
}

export interface MoveCardBetweenListsRequest {
  cardId: number;
  targetListId: number;
  quantity: number;
  position?: CardPosition;
}

export interface ReorderCardsRequest {
  reorderData: Array<{
    cardId: number;
    page?: number;
    row?: number;
    column?: number;
  }>;
}

// ============================================================================
// Collection Report Types (for TCGPlayer sales-based valuation)
// ============================================================================

/** Filtro de condición para el reporte — "Combined" no filtra (todas mezcladas, comportamiento previo). */
export type ReportConditionFilter = "Near Mint" | "Lightly Played" | "Combined";

export interface TCGSaleRecord {
  condition: string;
  variant: string;
  language: string;
  purchasePrice: number;
  orderDate: string;
  title?: string;
}

export interface CardSalesReportItem {
  cardCode: string;
  cardName: string;
  cardSrc: string;
  productId: number | null;
  quantity: number;
  /** Últimas ventas de TCGPlayer (hasta 5), la más reciente primero. */
  lastSales: TCGSaleRecord[];
  /** Promedio de las últimas 3 ventas reales. */
  top3Average: number | null;
  /** Precio más bajo actualmente listado en TCGPlayer (Card.lowPrice). */
  lowPrice: number | null;
  /** "Listed Median" (Card.midPrice). */
  midPrice: number | null;
  marketPrice: number | null;
  /**
   * (top3Average + lowPrice) / 2 — si falta uno de los dos, se usa el que
   * esté disponible en vez de promediar contra null; si faltan ambos, null.
   */
  blendedValue: number | null;
  subtotalBlended: number;
  subtotalMidPrice: number;
  subtotalMarketPrice: number;
  customPrice?: number | null;
  error?: string;
}

/** Un renglón de la tabla de referencia: los 3 totales a un % dado (120%→50%). */
export interface ReportPercentileRow {
  percent: number;
  blended: number;
  midPrice: number;
  marketPrice: number;
}

export interface CollectionReportData {
  listName: string;
  listId: number;
  generatedAt: string;
  /** Condición usada para filtrar las ventas recientes (top3Average/blendedValue). */
  condition: ReportConditionFilter;
  totalCards: number;
  totalQuantity: number;
  successfulLookups: number;
  failedLookups: number;
  cards: CardSalesReportItem[];
  totalBlended: number;
  totalMidPrice: number;
  totalMarketPrice: number;
  /** 15 filas, de 120% a 50% en pasos de 5%. */
  percentiles: ReportPercentileRow[];
}
