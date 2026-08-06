export type LiveOverlayCard = {
  id: string;
  name: string;
  code: string;
  imageUrl: string | null;
  rarity?: string | null;
  setTitle?: string | null;
  alternateArt?: string | null;
  price?: number | null;
  priceCurrency?: string | null;
  region?: string | null;
};

export type LiveOverlayState = {
  currentCard: LiveOverlayCard | null;
  counter: number;
  updatedAt: string;
};

export type LiveOverlayMessage =
  | {
      type: "state";
      state: LiveOverlayState;
    }
  | {
      type: "connected";
      state: LiveOverlayState;
    };
