import { CardWithCollectionData } from "@/types";

export interface FolderDimensions {
  binderWidth: number;
  binderHeight: number;
  cardWidth: number;
  cardHeight: number;
  gap: number;
  isMobile: boolean;
  showSinglePage: boolean;
}

export interface ListCard {
  id: number;
  cardId: string;
  quantity: number;
  position: number | null;
  page: number | null;
  row: number | null;
  column: number | null;
  card: CardWithCollectionData;
}

export interface GridCard {
  card: CardWithCollectionData | null; // Permitir null para posiciones con solo backcard
  isPending?: boolean;
  change?: any;
  existing?: any;
  quantity?: number;
  hasBackcard?: boolean; // Indica si esta posición tiene una imagen de backcard
}

export interface FolderPageContent {
  pageNumber: number | string | null;
  cards: GridCard[][];
  isInteriorCover?: boolean;
  isEmpty?: boolean;
}

export interface FolderProps {
  name: string;
  color: string;
  dimensions: FolderDimensions;
  currentPage: number;
  totalPages: number;
  maxRows: number;
  maxColumns: number;
  isEditing?: boolean;
  onCardClick?: (card: CardWithCollectionData) => void;
  onPositionClick?: (row: number, col: number) => void;
  onDragHandlers?: {
    onDragOver: (e: React.DragEvent) => void;
    onDragEnter: (
      e: React.DragEvent,
      page: number,
      row: number,
      column: number
    ) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (
      e: React.DragEvent,
      page: number,
      row: number,
      column: number
    ) => void;
  };
  dragOverPosition?: { page: number; row: number; column: number } | null;
  selectedCardForPlacement?: CardWithCollectionData | null;
}

export interface NavigationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isMobile: boolean;
  showSinglePage: boolean;
}
