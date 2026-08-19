"use client";

import React, { useState, useEffect, Fragment, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  List,
  Plus,
  Search,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  Home,
  ChevronRight as ChevronRightBreadcrumb,
  Minus,
  RefreshCw,
  Eye,
  Trash2,
  Package,
  AlertCircle,
  Info,
  Layers,
  Filter,
  Share2,
  Download,
  Cog,
  MoreVertical,
  AlertTriangle,
  Loader2,
  DollarSign,
  Tag,
  FilePlus2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import { useSession } from "next-auth/react";
import {
  MainContentSkeleton,
  CardsSidebarSkeleton,
} from "@/components/skeletons";
import { CardWithCollectionData } from "@/types";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Dialog as HeadlessDialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import BaseDrawer from "@/components/ui/BaseDrawer";
import CardModal from "@/components/CardModal";
import DonModal from "@/components/DonModal";
import { useAllCards } from "@/hooks/useCards";
import { useQueryClient } from "@tanstack/react-query";
import { useCardStore } from "@/store/cardStore";
import type { CardsFilters } from "@/lib/cards/types";
import { Oswald } from "next/font/google";
import { BookFlipContainer } from "@/components/folder";
import { GridCard } from "@/components/folder/types";
import { useFolderDimensions } from "@/hooks/useFolderDimensions";
import { convertForListDisplay } from "@/lib/lists/currency";
import SearchFilters from "@/components/home/SearchFilters";
import DropdownSearch from "@/components/DropdownSearch";
import FiltersSidebar from "@/components/FiltersSidebar";
import MobileFiltersDrawer from "@/components/deckbuilder/MobileFiltersDrawer";
import ViewSwitch from "@/components/ViewSwitch";
import { Option } from "@/components/MultiSelect";
import { useRegion } from "@/components/region/RegionProvider";
import FAB from "@/components/Fab";
import StoreCard from "@/components/StoreCard";
import { DON_CATEGORY, setOptions } from "@/helpers/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { highlightText } from "@/helpers/functions";
import { rarityFormatter } from "@/helpers/formatters";
import Alternates from "@/public/assets/images/variantsICON_VERTICAL.svg";
import {
  sortByCollectionOrder,
  compareByVariantThenCollectionOrder,
} from "@/lib/cards/sort";
import LazyImage from "@/components/LazyImage";
import {
  matchesCardCode,
  baseCardMatches,
  getFilteredAlternates,
  cardMatchesActiveFilters,
} from "@/lib/cardFilters";

const oswald = Oswald({
  weight: ["200", "300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

const NO_COUNTER_LABEL = "No counter";
const NO_TRIGGER_LABEL = "No trigger";

const sortOptions: Option[] = [
  { value: "Most variants", label: "Most variants" },
  { value: "Less variants", label: "Less variant" },
  { value: "Ascending code", label: "Ascending code" },
  { value: "Descending code", label: "Descending code" },
];

interface UserList {
  id: number;
  name: string;
  description: string | null;
  userId?: number;
  isOrdered: boolean;
  isCollection: boolean;
  maxRows: number | null;
  maxColumns: number | null;
  totalPages: number;
  color: string | null;
  displayCurrency?: string | null;
  exchangeRate?: number | string | null;
}

interface SimpleListCard {
  card: CardWithCollectionData;
  quantity: number;
  customPrice?: number | string | null;
  customCurrency?: string | null;
}

// Un ítem del carrito del modal "Agregar cartas": una carta o un sleeve.
// Es un solo arreglo (no dos separados) para preservar el ORDEN en que el
// usuario los fue agregando — ese orden es el que se respeta al colocarlos.
type CartItem =
  | { kind: "card"; card: CardWithCollectionData; quantity: number }
  | { kind: "sleeve"; id: number; name: string; imageUrl: string; quantity: number };

interface OrderedListChange {
  id: string;
  type: "add" | "remove" | "change";
  position: { page: number; row: number; column: number };
  card?: CardWithCollectionData;
  previousCard?: any;
}

// Menú "Opciones" de la carpeta/lista: un solo componente reusado en las 4
// variantes de header (desktop/mobile × carpeta/lista simple) en vez de que
// cada una repita sus propios botones sueltos.
const FolderOptionsMenu = ({
  listId,
  router,
  onExportCsv,
  onExportZip,
  zipLoading,
  onDeleteClick,
  onRefresh,
  isRefreshing,
  pageTools,
  variant = "labeled",
}: {
  listId: string;
  router: any;
  onExportCsv: () => void;
  onExportZip: () => void;
  zipLoading: boolean;
  onDeleteClick: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  /** Solo para carpetas (isOrdered): ir a una página + insertar página en blanco. */
  pageTools?: {
    jumpToPageInput: string;
    onJumpToPageInputChange: (value: string) => void;
    onJumpToPage: () => void;
    onInsertPage: () => void;
    canInsertPage: boolean;
  };
  variant?: "labeled" | "icon";
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const items: Array<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    hoverClass: string;
    disabled?: boolean;
  }> = [
    {
      label: "Ver lista",
      icon: <Eye className="h-4 w-4" />,
      onClick: () => router.push(`/lists/${listId}`),
      hoverClass: "hover:bg-green-50 hover:text-green-700",
    },
    {
      label: "Configurar",
      icon: <Cog className="h-4 w-4" />,
      onClick: () => router.push(`/lists/${listId}/edit`),
      hoverClass: "hover:bg-amber-50 hover:text-amber-700",
    },
    {
      label: "Compartir",
      icon: <Share2 className="h-4 w-4" />,
      onClick: () => {
        const url = window.location.href.replace("/add-cards", "");
        navigator.clipboard.writeText(url);
        toast.success("Enlace copiado");
      },
      hoverClass: "hover:bg-purple-50 hover:text-purple-700",
    },
    ...(onRefresh
      ? [
          {
            label: isRefreshing ? "Actualizando…" : "Actualizar cartas",
            icon: isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            ),
            onClick: onRefresh,
            hoverClass: "hover:bg-slate-100 hover:text-slate-900",
            disabled: isRefreshing,
          },
        ]
      : []),
    {
      label: "Exportar CSV",
      icon: <Download className="h-4 w-4" />,
      onClick: onExportCsv,
      hoverClass: "hover:bg-blue-50 hover:text-blue-700",
    },
    {
      label: zipLoading ? "Generando ZIP…" : "Imágenes ZIP",
      icon: zipLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      ),
      onClick: onExportZip,
      hoverClass: "hover:bg-blue-50 hover:text-blue-700",
      disabled: zipLoading,
    },
  ];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {variant === "icon" ? (
          <Button
            size="sm"
            variant="outline"
            className="h-9 w-9 p-0 bg-white"
            title="Opciones"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="lg"
            variant="outline"
            className="h-11 px-4 bg-white hover:bg-gray-50 font-medium text-base flex items-center gap-2"
          >
            Opciones
            <MoreVertical className="h-5 w-5" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        {items.map((item) => (
          <div
            key={item.label}
            onClick={() => {
              if (item.disabled) return;
              item.onClick();
              setIsOpen(false);
            }}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 transition-colors cursor-pointer",
              item.disabled ? "opacity-60 cursor-not-allowed" : item.hoverClass
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
        ))}

        {pageTools && (
          <>
            <div className="border-t border-gray-100 my-1" />
            <div className="px-3 py-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Ir a la página
              </label>
              <div className="flex items-center gap-1.5">
                <Input
                  value={pageTools.jumpToPageInput}
                  onChange={(e) => pageTools.onJumpToPageInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") pageTools.onJumpToPage();
                  }}
                  placeholder="Página #"
                  inputMode="numeric"
                  className="h-8 text-xs"
                />
                <Button
                  onClick={pageTools.onJumpToPage}
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs shrink-0"
                >
                  Ir
                </Button>
              </div>
            </div>
            {pageTools.canInsertPage && (
              <div
                onClick={() => {
                  pageTools.onInsertPage();
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <FilePlus2 className="h-4 w-4" />
                <span>Insertar página en blanco</span>
              </div>
            )}
          </>
        )}

        <div className="border-t border-gray-100 my-1" />
        <div
          onClick={() => {
            onDeleteClick();
            setIsOpen(false);
          }}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
        >
          <Trash2 className="h-4 w-4" />
          <span>Eliminar</span>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Botón de filtros: un solo control (ícono + contador) en vez de un botón
// "Filters" con texto más un botón separado para limpiar. La zona de
// limpiar solo aparece, pegada al icono, cuando hay filtros activos.
const FiltersButton = ({
  totalFilters,
  onOpenFilters,
  isTouchable,
  onClearFilters,
}: {
  totalFilters: number;
  onOpenFilters: () => void;
  isTouchable: boolean;
  onClearFilters: () => void;
}) => {
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onOpenFilters}
        className={cn(
          "relative flex items-center justify-center h-9 w-9 transition-colors",
          totalFilters > 0
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "text-gray-600 hover:bg-gray-50"
        )}
        title="Filtros"
      >
        <Filter className="h-4 w-4" />
        {totalFilters > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-blue-600 ring-2 ring-blue-600">
            {totalFilters}
          </span>
        )}
      </button>
      {isTouchable && (
        <>
          <div className="h-5 w-px bg-gray-200" />
          <button
            type="button"
            onClick={onClearFilters}
            className="flex items-center justify-center h-9 w-9 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Limpiar filtros"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
};

// Delete List Modal Component
const DeleteListModal = ({
  list,
  isOpen,
  setIsOpen,
  onConfirm,
  isDeleting,
}: {
  list: UserList | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) => {
  const [confirmText, setConfirmText] = useState("");

  const handleConfirm = () => {
    if (confirmText === list?.name) {
      onConfirm();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setConfirmText("");
    }
  }, [isOpen]);

  if (!list) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shadow-sm">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-gray-900">
                Eliminar Lista
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                Esta acción no se puede deshacer
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-semibold text-red-800 mb-2">
              ¿Qué se eliminará?
            </h4>
            <ul className="text-sm text-red-700 space-y-1">
              <li>
                • La lista "<span className="font-medium">{list.name}</span>"
              </li>
              <li>• Todas las cartas de la lista</li>
              {list.isOrdered && (
                <li>
                  • Configuración de páginas ({list.maxRows}×{list.maxColumns})
                </li>
              )}
              <li>• Descripción y metadatos</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Para confirmar, escribe el nombre de la lista:
            </label>
            <Input
              type="text"
              placeholder={`Escribe "${list.name}" para confirmar`}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full"
              disabled={isDeleting}
              autoComplete="off"
            />
            {confirmText && confirmText !== list.name && (
              <p className="text-sm text-red-600 mt-1">El nombre no coincide</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={confirmText !== list.name || isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar Definitivamente
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface DraggedCard {
  card: CardWithCollectionData;
  sourceType: "sidebar" | "grid";
  sourcePosition?: { page: number; row: number; column: number };
}

const AddCardsPage = () => {
  const params = (useParams() ?? {}) as Record<string, string>;
  const router = useRouter();
  const listId = params.id as string;
  const { region } = useRegion();

  // Core state
  const [list, setList] = useState<UserList | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwnerFromApi, setIsOwnerFromApi] = useState<boolean | null>(null);
  const [availableCards, setAvailableCards] = useState<
    CardWithCollectionData[]
  >([]);
  const [currentPage, setCurrentPage] = useState(0); // Sync with BookFlipContainer initial state
  const currentPageRef = useRef(0);

  const [simpleListCards, setSimpleListCards] = useState<SimpleListCard[]>([]);
  const [zipLoading, setZipLoading] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<OrderedListChange[]>([]);
  const [existingCards, setExistingCards] = useState<any>({});
  const existingCardsRef = useRef(existingCards);
  const [draggedCard, setDraggedCard] = useState<DraggedCard | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<{
    page: number;
    row: number;
    column: number;
  } | null>(null);
  // Cartas "levantadas" para mover (tap-to-move o drag-and-drop), en el
  // orden en que se seleccionaron. Una sola carta se mueve/intercambia con
  // el destino; varias se acomodan en orden a partir del destino, saltando
  // casillas ya ocupadas por otras cartas.
  const [movingCards, setMovingCards] = useState<
    Array<{
      card: CardWithCollectionData;
      from: { page: number; row: number; column: number };
    }>
  >([]);
  const movingCardIds = useMemo(
    () => new Set(movingCards.map((m) => m.card.id)),
    [movingCards]
  );

  // 🎴 Backcard state - Almacena las posiciones que tienen imagen de backcard,
  // mapeadas a la URL de imagen de sleeve elegida (null = reverso genérico).
  const [backcardPositions, setBackcardPositions] = useState<
    Map<string, string | null>
  >(new Map());

  // List/Folder state
  const [windowSize, setWindowSize] = useState({ width: 1920, height: 1080 });
  const [shareUrl, setShareUrl] = useState("");

  // Drag and drop state
  const [selectedCard, setSelectedCard] =
    useState<CardWithCollectionData | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [alternatesCards, setAlternatesCards] = useState<
    CardWithCollectionData[]
  >([]);
  const addQueueRef = useRef<
    Map<
      string,
      { cardId: number | string; page: number; row: number; column: number }
    >
  >(new Map());
  const pendingDeleteRef = useRef<Map<string, number>>(new Map());
  const addFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addSaveInFlightRef = useRef(false);
  const addFlushRequestedRef = useRef(false);

  // Mobile card selection modal
  const [showMobileCardModal, setShowMobileCardModal] = useState(false);

  // Carrito del modal "Agregar cartas": cartas y sleeves mezclados, en el
  // orden en que se fueron agregando. Se acomodan desde `targetPosition` en
  // ese mismo orden, saltando casillas ocupadas.
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isAddingBatch, setIsAddingBatch] = useState(false);
  // Pestañas del modal de Agregar cartas: Cartas individuales / Sets / Sleeves.
  const [addModalTab, setAddModalTab] = useState<"cards" | "sets" | "sleeves">(
    "cards"
  );
  const [setsTabQuery, setSetsTabQuery] = useState("");
  const [sleevesTabQuery, setSleevesTabQuery] = useState("");
  const [sleeveProducts, setSleeveProducts] = useState<
    Array<{ id: number; name: string; imageUrl: string | null }>
  >([]);
  const [isLoadingSleeves, setIsLoadingSleeves] = useState(false);
  const [isApplyingSleeve, setIsApplyingSleeve] = useState(false);

  // Mobile price drawer state
  const [priceDrawerOpen, setPriceDrawerOpen] = useState(false);
  const [priceDraft, setPriceDraft] = useState<{
    card: CardWithCollectionData;
    position?: { page: number; row: number; column: number };
    quantity: number;
    replaceCardId?: number;
  } | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("USD");
  const [isPriceSaving, setIsPriceSaving] = useState(false);

  // Delete modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Position where user clicked to add a card (mobile)
  const [targetPosition, setTargetPosition] = useState<{
    page: number;
    row: number;
    column: number;
  } | null>(null);

  // Navigation functions from BookFlipContainer (like in page.tsx)
  const [navigationFunctions, setNavigationFunctions] = useState<{
    flipNext: () => void;
    flipPrev: () => void;
  } | null>(null);

  // Touch state for mobile navigation (like in page.tsx)
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(
    null
  );

  // Card-list style filters and view state
  const [search, setSearch] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedCosts, setSelectedCosts] = useState<string[]>([]);
  const [selectedPower, setSelectedPower] = useState<string[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedCounter, setSelectedCounter] = useState<string>("");
  const [selectedTrigger, setSelectedTrigger] = useState<string>("");
  const [selectedSort, setSelectedSort] = useState<string>("");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [selectedAltArts, setSelectedAltArts] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Estado independiente para el drawer de filtros en mobile DENTRO del
  // modal de Agregar cartas — antes compartía isModalOpen con el overlay de
  // filtros del panel de escritorio, así que abrir uno abría el otro.
  const [showAddCardsFiltersDrawer, setShowAddCardsFiltersDrawer] =
    useState(false);
  const [viewSelected, setViewSelected] = useState<
    "grid" | "list" | "alternate" | "text"
  >("list");
  const [showFab, setShowFab] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);
  const [showLargeImage, setShowLargeImage] = useState(false);
  const [isCardFetching, setIsCardFetching] = useState(false);
  const [baseCard, setBaseCard] = useState<CardWithCollectionData>();
  const [isOpen, setIsOpen] = useState(false);
  const simpleModalBaseCard = selectedCard ?? null;
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  // Listed Median (midPrice) se muestra por default; admin puede alternar a Market Price.
  const [showListedMedian, setShowListedMedian] = useState(true);
  const isSimpleModalDon = simpleModalBaseCard?.category === DON_CATEGORY;
  const primaryModalBaseCard =
    baseCard ?? simpleModalBaseCard ?? undefined;
  const isPrimaryModalDon =
    primaryModalBaseCard?.category === DON_CATEGORY;
  const primaryModalKey = `${isPrimaryModalDon ? "don" : "card"}-${
    primaryModalBaseCard?.id ?? "modal"
  }`;
  const handleSelectedCardChange = (card: CardWithCollectionData) => {
    setSelectedCard(card);
  };

  const [insertPageOpen, setInsertPageOpen] = useState(false);
  const [insertAfterPageInput, setInsertAfterPageInput] = useState("");
  const [isInsertingPage, setIsInsertingPage] = useState(false);
  const [jumpToPageInput, setJumpToPageInput] = useState("");

  const [priceEditOpen, setPriceEditOpen] = useState(false);
  const [priceEditCard, setPriceEditCard] =
    useState<CardWithCollectionData | null>(null);
  const [priceEditListCard, setPriceEditListCard] = useState<any>(null);
  const [priceEditInput, setPriceEditInput] = useState("");
  const [priceEditCurrency, setPriceEditCurrency] = useState("USD");
  const [isPriceEditSaving, setIsPriceEditSaving] = useState(false);

  const [soldEditOpen, setSoldEditOpen] = useState(false);
  const [soldEditCard, setSoldEditCard] =
    useState<CardWithCollectionData | null>(null);
  const [soldEditListCard, setSoldEditListCard] = useState<any>(null);
  const [soldEditPriceInput, setSoldEditPriceInput] = useState("");
  const [isSoldEditSaving, setIsSoldEditSaving] = useState(false);

  // Refs for card-list functionality
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mobileModalScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    existingCardsRef.current = existingCards;
  }, [existingCards]);

  // ✅ Obtener todas las cartas usando el mismo sistema que deckbuilder y proxies
  const cachedCards = useCardStore((state) => state.allCards);
  const setAllCards = useCardStore((state) => state.setAllCards);
  const isFullyLoaded = useCardStore((state) => state.isFullyLoaded);
  const setIsFullyLoaded = useCardStore((state) => state.setIsFullyLoaded);
  const allCardsSignatureRef = useRef<string | null>(null);

  // Filtros vacíos para traer TODAS las cartas
  // Búsqueda con debounce que se manda al SERVIDOR (misma búsqueda compuesta
  // estricta que /card-list: nombre + color + poder + rareza en AND).
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const fullQueryFilters = useMemo<CardsFilters>(
    () => ({ region, search: debouncedSearch.trim() || undefined }),
    [region, debouncedSearch]
  );

  const {
    data: allCardsData,
    isLoading: isLoadingAllCards,
    isFetching: isFetchingAllCards,
  } = useAllCards(fullQueryFilters, {
    includeRelations: true,
    includeAlternates: true,
    includeCounts: true,
  });

  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ✅ Guardar en Zustand cuando lleguen las cartas — SOLO sin búsqueda activa.
  // Este store es global (lo comparten /simulator, /admin/edit-card,
  // /admin/tcg-linker, ShopDeckBuilder) y esas pantallas asumen que contiene
  // el catálogo COMPLETO; si hay una búsqueda activa aquí, `allCardsData` es
  // el subconjunto filtrado por el servidor y NO debe pisar ese cache global.
  const hasActiveSearch = debouncedSearch.trim().length > 0;
  useEffect(() => {
    if (hasActiveSearch) return;
    if (!allCardsData) return;

    if (!allCardsData.length) {
      if (allCardsSignatureRef.current !== "empty") {
        allCardsSignatureRef.current = "empty";
        setAllCards([]);
      }
      return;
    }

    const firstCard = allCardsData[0];
    const lastCard = allCardsData[allCardsData.length - 1];

    const normalizeTimestamp = (value: Date | string | undefined) => {
      if (!value) return "";
      if (value instanceof Date) return value.getTime().toString();
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? String(value) : parsed.toString();
    };

    const signature = [
      allCardsData.length,
      firstCard?.id ?? "",
      lastCard?.id ?? "",
      normalizeTimestamp(firstCard?.updatedAt),
      normalizeTimestamp(lastCard?.updatedAt),
    ].join("-");

    if (allCardsSignatureRef.current !== signature) {
      allCardsSignatureRef.current = signature;
      setAllCards(allCardsData);
    }

    if (!isFetchingAllCards) {
      setIsFullyLoaded(true);
    }
  }, [allCardsData, hasActiveSearch, isFetchingAllCards, setAllCards, setIsFullyLoaded]);

  // ✅ Con búsqueda activa, usar el resultado del servidor (ya filtrado);
  // sin búsqueda, usar el catálogo completo cacheado si ya existe.
  const cards = hasActiveSearch
    ? allCardsData ?? []
    : cachedCards.length > 0
      ? cachedCards
      : allCardsData ?? [];
  const isLoading = isLoadingAllCards;

  // 🔄 Handle refresh with visual feedback
  const handleRefreshCards = async () => {
    if (isRefreshing) return; // Prevent multiple simultaneous refreshes

    setIsRefreshing(true);
    toast.info("🔄 Actualizando cartas...", {
      position: "top-right",
      autoClose: 1000,
    });

    try {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      toast.success("✅ Cartas actualizadas correctamente!", {
        position: "top-right",
        autoClose: 2000,
      });
    } catch (error) {
      console.error("Error refreshing cards:", error);
      toast.error("❌ Error al actualizar cartas", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Track if we already tried to refresh to prevent infinite loops
  const hasTriedRefresh = useRef(false);

  // Auto-navigate to first content page only on initial load (not on manual navigation)
  const hasUserNavigated = useRef(false);

  // useEffect(() => {
  //   // Auto-navigation disabled for proper synchronization with BookFlipContainer
  //   // Users now always start at page 0 (Interior Cover + Page 1)
  //   if (
  //     currentPage === 0 &&
  //     Object.keys(existingCards || {}).length > 0 &&
  //     !hasUserNavigated.current
  //   ) {
  //     setCurrentPage(0); // This would cause infinite loop
  //   }
  // }, [existingCards, currentPage]);

  // Use the shared hook for folder dimensions
  const folderDimensions = useFolderDimensions(
    list?.maxRows || 3,
    list?.maxColumns || 3,
    windowSize,
    false // TWO PAGE VIEW: Enable double page layout for editing
  );

  // Check if mobile
  const isMobile = windowSize.width < 768;

  // Window resize handler for responsive calculations (same as page.tsx)
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Set initial size
    if (typeof window !== "undefined") {
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Calculate max page based on actual content
  const getMaxUsedPage = () => {
    if (!existingCards || Object.keys(existingCards).length === 0) return 0;

    const pages = Object.keys(existingCards).map((key) => {
      const parts = key.split("-");
      return parseInt(parts[0]);
    });

    return Math.max(...pages, 0);
  };

  // Calculate dynamic max page: highest page with content + 1 (for adding new content)
  const getMaxNavigablePage = () => {
    const maxUsedPage = getMaxUsedPage();
    const hasPendingChanges = pendingChanges.some(
      (change) => change.position.page > maxUsedPage
    );

    // Allow navigation to:
    // - All pages with existing content
    // - One page beyond the highest used page (for adding new content)
    // - Any page with pending changes
    return Math.max(
      maxUsedPage + 1,
      hasPendingChanges
        ? Math.max(...pendingChanges.map((c) => c.position.page))
        : 0
    );
  };

  // Keyboard navigation for folders (same logic as page.tsx)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard navigation for ordered lists (folders)
      if (!list || !list.isOrdered) return;

      // Don't handle if user is typing in an input field
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.tagName === "SELECT" ||
          (activeElement as HTMLElement).contentEditable === "true")
      ) {
        return;
      }

      const maxNavigablePage = getMaxNavigablePage();
      const safePage = Math.max(0, Math.min(currentPage, maxNavigablePage));

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          if (navigationFunctions && safePage > 0) {
            navigatePrev();
          }
          break;
        case "ArrowRight":
          event.preventDefault();
          if (navigationFunctions && safePage < maxNavigablePage) {
            navigateNext();
          }
          break;
        case "Home":
          event.preventDefault();
          hasUserNavigated.current = true; // Mark that user has manually navigated
          setCurrentPage(0); // Go to cover page
          break;
        case "End":
          event.preventDefault();
          hasUserNavigated.current = true; // Mark that user has manually navigated
          setCurrentPage(getMaxUsedPage()); // Go to last page with content
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [list, currentPage, existingCards, pendingChanges]);

  // Swipe detection functions (same logic as page.tsx)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!list?.isOrdered || windowSize.width >= 768) return; // Only on mobile and folders

    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !list?.isOrdered || windowSize.width >= 768) return;

    const touch = e.touches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || !list?.isOrdered || windowSize.width >= 768)
      return;

    const deltaX = touchStart.x - touchEnd.x;
    const deltaY = touchStart.y - touchEnd.y;
    const minSwipeDistance = 50; // Minimum distance for a valid swipe
    const maxVerticalDistance = 100; // Maximum vertical movement allowed

    // Check if it's a horizontal swipe (more horizontal than vertical movement)
    if (
      Math.abs(deltaX) > minSwipeDistance &&
      Math.abs(deltaX) > Math.abs(deltaY) &&
      Math.abs(deltaY) < maxVerticalDistance
    ) {
      const maxNavigablePage = getMaxNavigablePage();

      hasUserNavigated.current = true; // Mark that user has manually navigated

      if (deltaX > 0) {
        // Swipe left (go to next page)
        if (currentPage < maxNavigablePage) {
          setCurrentPage(currentPage + 1);
        }
      } else {
        // Swipe right (go to previous page)
        if (currentPage > 0) {
          setCurrentPage(currentPage - 1);
        }
      }
    }

    // Reset
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Helper functions for mobile-aware navigation (same as page.tsx)
  const navigateNext = () => {
    if (!navigationFunctions) return;
    hasUserNavigated.current = true; // Mark that user has manually navigated
    navigationFunctions.flipNext(); // This now internally handles mobile vs desktop
  };

  const navigatePrev = () => {
    if (!navigationFunctions) return;
    hasUserNavigated.current = true; // Mark that user has manually navigated
    navigationFunctions.flipPrev(); // This now internally handles mobile vs desktop
  };

  // Helper functions for FolderContainer
  const createGrid = (pageCards: any[], pageNumber?: number): GridCard[][] => {
    const maxRows = list?.maxRows || 3;
    const maxColumns = list?.maxColumns || 3;
    const grid = Array(maxRows)
      .fill(null)
      .map(() => Array(maxColumns).fill(null));

    // Determinar el número de página: desde parámetro, desde primera carta, o página actual
    const currentPageNum = pageNumber || pageCards[0]?.page || currentPage;

    // Primero, colocar todas las cartas reales
    pageCards.forEach((listCard) => {
      if (!listCard || !listCard.card) return;
      const row = Math.max(0, Math.min((listCard.row || 1) - 1, maxRows - 1));
      const col = Math.max(
        0,
        Math.min((listCard.column || 1) - 1, maxColumns - 1)
      );

      // Convert to GridCard format
      const gridCard: GridCard = {
        card: listCard.card,
        isPending: listCard.isPending,
        change: listCard.change,
        existing: listCard.existing,
        quantity: listCard.quantity,
      };

      grid[row][col] = gridCard;
    });

    // 🎴 Luego, agregar posiciones con backcard donde no hay cartas
    for (let row = 0; row < maxRows; row++) {
      for (let col = 0; col < maxColumns; col++) {
        if (!grid[row][col]) {
          // Solo si la posición está vacía
          const positionKey = `${currentPageNum}-${row + 1}-${col + 1}`;

          if (backcardPositions.has(positionKey)) {
            // Crear un GridCard especial para backcard
            grid[row][col] = {
              card: null as any, // Será null pero con hasBackcard: true
              hasBackcard: true,
              backcardImageUrl: backcardPositions.get(positionKey) ?? null,
            };
          }
        }
      }
    }

    return grid;
  };

  const getCardsForPage = (pageNumber: number) => {
    if (pageNumber === 0) return []; // Cover page has no cards

    const cards: any[] = [];
    const maxRows = list?.maxRows || 3;
    const maxColumns = list?.maxColumns || 3;

    // Get all cards for this specific page
    for (let row = 1; row <= maxRows; row++) {
      for (let col = 1; col <= maxColumns; col++) {
        // Create the key for this position
        const key = `${pageNumber}-${row}-${col}`;
        const existingCard = existingCards[key];

        // Check for pending changes at this position
        const pendingChange = pendingChanges.find(
          (change) =>
            change.position.page === pageNumber &&
            change.position.row === row &&
            change.position.column === col
        );

        if (pendingChange) {
          cards.push({
            card: pendingChange.card!,
            page: pageNumber,
            row,
            column: col,
            isPending: true,
            change: pendingChange,
          });
        } else if (existingCard) {
          cards.push({
            card: existingCard.card,
            page: pageNumber,
            row,
            column: col,
            isPending: false,
            existing: existingCard,
          });
        }
      }
    }

    return cards;
  };

  useEffect(() => {
    if (cards && cards.length > 0) {
      setAvailableCards(cards);
      hasTriedRefresh.current = false; // Reset flag when cards are loaded successfully
    } else if (!hasTriedRefresh.current) {
      // Si no hay cartas cargadas y no hemos intentado refresh, forzar refresh
      hasTriedRefresh.current = true;
      queryClient.invalidateQueries({ queryKey: ["cards"] });
    }
  }, [cards, queryClient]);

  useEffect(() => {
    if (listId) {
      fetchList();
      fetchExistingCards();
      fetchBackcards(); // 🎴 Cargar backcards desde DB
      // Reset refresh flag when changing lists
      hasTriedRefresh.current = false;
    }
  }, [listId]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = window.location.href.replace("/add-cards", "");
    setShareUrl(url);
  }, [listId]);

  const fetchList = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/lists/${listId}?limit=0`);
      if (response.ok) {
        const data = await response.json();
        setList(data.list || data); // Handle both data.list and data formats
        if (typeof data.isOwner === "boolean") {
          setIsOwnerFromApi(data.isOwner);
        }
      } else {
        toast.error("Error al cargar la lista");
      }
    } catch (error) {
      console.error("Error fetching list:", error);
      toast.error("Error al cargar la lista");
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingCards = async () => {
    try {
      const response = await fetch(`/api/lists/${listId}?limit=0`);
      if (response.ok) {
        const data = await response.json();
        const list = data.list || data; // Handle both data.list and data formats
        const cardsMap: any = {};

        if (list.cards) {
          if (list.isOrdered) {
            // For ordered lists (folders), populate existingCards
            list.cards.forEach((listCard: any) => {
              const key = `${listCard.page}-${listCard.row}-${listCard.column}`;
              cardsMap[key] = listCard;
            });
            setExistingCards(cardsMap);
          } else {
            // For simple lists, populate simpleListCards
            const simpleCards: SimpleListCard[] = list.cards.map(
              (listCard: any) => ({
                card: listCard.card,
                quantity: listCard.quantity || 1,
                customPrice: listCard.customPrice ?? null,
                customCurrency: listCard.customCurrency ?? null,
              })
            );
            setSimpleListCards(simpleCards);
          }
        } else {
          // If no cards, set appropriate empty state
          if (list.isOrdered) {
            setExistingCards({});
          } else {
            setSimpleListCards([]);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching existing cards:", error);
    }
  };

  // 📤 Exporta las cartas de la lista a CSV (Excel). Columnas: nombre, code,
  // region (US → "EN"), rareza, alterna, market/mid/diferencia (USD) y precio de
  // subasta sugerido en MXN (80% del market a 18 MXN/USD).
  const exportListToCsv = () => {
    const MXN_RATE = 18;
    const cards = (
      list?.isOrdered
        ? Object.values(existingCards).map((lc: any) => lc?.card)
        : simpleListCards.map((s) => s.card)
    ).filter(Boolean) as CardWithCollectionData[];

    if (!cards.length) {
      toast.info("No hay cartas para exportar");
      return;
    }

    const num = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const regionOf = (r?: string | null) => (!r || r === "US" ? "EN" : r);
    // Región para el título TikTok (US → ENG).
    const regionTag = (r?: string | null) =>
      !r || r === "US" ? "ENG" : r.toUpperCase();
    // Tag de tipo para el título TikTok: solo las especiales que importan.
    // SEC/TR/SP salen de la rareza; Manga y AA del arte alterno (AA no es una
    // rareza, es "arte alterno"). Rarezas normales (C/UC/R/SR/L/PR) → sin tag.
    const typeTag = (c: any) => {
      const r = (c.rarity ?? "").toLowerCase().trim();
      const alt = (c.alternateArt ?? "").toLowerCase().trim();
      if (/secret|^sec$/.test(r)) return "SEC";
      if (/treasure|^tr$/.test(r)) return "TR";
      if (/special|^sp$|^spc$/.test(r)) return "SP";
      if (/manga/.test(alt)) return "Manga";
      if (alt) return "AA";
      return "";
    };
    // Título para copiar/pegar en TikTok: "(ENG) (SEC) OP01-120" o, sin tag
    // especial, "(ENG) OP01-120".
    const tiktokName = (c: any) => {
      const tag = typeTag(c);
      return `(${regionTag(c.region)})${tag ? ` (${tag})` : ""} ${
        c.code ?? ""
      }`.trim();
    };

    const esc = (val: any) => {
      const s = val === null || val === undefined ? "" : String(val);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const headers = [
      "Nombre",
      "Code",
      "Region",
      "Rareza",
      "Alterna",
      "Market Price (USD)",
      "Mid Price (USD)",
      "Diferencia (USD)",
      "Listado Median (MXN)",
      "Subasta sugerida (MXN)",
    ];

    const rows = cards.map((c) => {
      const market = num(c.marketPrice);
      const mid = num((c as any).midPrice);
      const diff =
        market != null && mid != null
          ? Math.round((market - mid) * 100) / 100
          : "";
      const listedMedianMxn =
        mid != null ? Math.round(mid * MXN_RATE * 100) / 100 : "";
      // Subasta sugerida = 80% del MID price convertido a pesos.
      const suggestedMxn =
        mid != null ? Math.round(mid * MXN_RATE * 0.8 * 100) / 100 : "";
      return [
        tiktokName(c),
        c.code ?? "",
        regionOf(c.region),
        c.rarity ?? "",
        c.alternateArt ?? "",
        market ?? "",
        mid ?? "",
        diff,
        listedMedianMxn,
        suggestedMxn,
      ]
        .map(esc)
        .join(",");
    });

    const csv = "﻿" + [headers.map(esc).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lista-${listId}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success(`${cards.length} cartas exportadas`);
  };

  // 🖼️ Descarga un ZIP con todas las imágenes de las cartas de la lista.
  const downloadImagesZip = async () => {
    if (zipLoading) return;
    setZipLoading(true);
    const toastId = toast.loading("Generando ZIP de imágenes…");
    try {
      const res = await fetch(`/api/lists/${listId}/images-zip`);
      if (!res.ok) throw new Error("zip failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `lista-${listId}-imagenes.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.update(toastId, {
        render: "ZIP de imágenes listo",
        type: "success",
        isLoading: false,
        autoClose: 2000,
      });
    } catch {
      toast.update(toastId, {
        render: "No se pudo generar el ZIP",
        type: "error",
        isLoading: false,
        autoClose: 3000,
      });
    } finally {
      setZipLoading(false);
    }
  };

  // 🎴 Función para cargar backcards desde la base de datos
  const fetchBackcards = async () => {
    try {
      const response = await fetch(`/api/lists/${listId}/backcards`);
      if (response.ok) {
        const backcards = await response.json();
        // Convertir array de backcards a Map de posición -> imageUrl (o null)
        const backcardsMap = new Map<string, string | null>(
          backcards.map((b: any) => [
            `${b.page}-${b.row}-${b.column}`,
            b.imageUrl ?? null,
          ])
        );
        setBackcardPositions(backcardsMap);
      }
    } catch (error) {
      console.error("Error loading backcards:", error);
      // No mostrar error al usuario, los backcards son opcionales
    }
  };

  // Delete functions
  const handleDeleteClick = () => {
    if (list) {
      setDeleteModalOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!list) return;

    setDeletingId(list.id);
    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Lista eliminada exitosamente");
        // Redirect to lists page after successful deletion
        router.push("/lists");
      } else {
        const error = await response.text();
        toast.error(`Error al eliminar la lista: ${error}`);
      }
    } catch (error) {
      console.error("Error deleting list:", error);
      toast.error("Error al eliminar la lista");
    } finally {
      setDeletingId(null);
      setDeleteModalOpen(false);
    }
  };

  // Helper functions for card-list functionality
  const handleScrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setVisibleCount(50);
  };

  const totalFilters =
    selectedColors?.length +
    selectedRarities?.length +
    selectedCategories?.length +
    (selectedCounter !== "" ? 1 : 0) +
    (selectedTrigger !== "" ? 1 : 0) +
    selectedEffects?.length +
    selectedTypes?.length +
    selectedSets?.length +
    selectedCosts?.length +
    selectedPower?.length +
    selectedAttributes?.length +
    selectedCodes?.length +
    selectedAltArts?.length;

  // Limpia todos los filtros de cartas de una vez (usado por FiltersButton
  // en el panel de escritorio y dentro del modal de Agregar cartas).
  const clearAllFilters = () => {
    setSelectedColors([]);
    setSelectedRarities([]);
    setSelectedCategories([]);
    setSelectedCounter("");
    setSelectedTrigger("");
    setSelectedEffects([]);
    setSelectedTypes([]);
    setSelectedSets([]);
    setSelectedCosts([]);
    setSelectedPower([]);
    setSelectedAttributes([]);
    setSelectedCodes([]);
    setSelectedAltArts([]);
  };

  // Estado actual del backcard en la casilla apuntada por el modal:
  // undefined = no hay backcard, null = reverso genérico (en blanco),
  // string = sleeve temático con esa imagen.
  const targetBackcardImageUrl = targetPosition
    ? backcardPositions.get(
        `${targetPosition.page}-${targetPosition.row}-${targetPosition.column}`
      )
    : undefined;

  // Vistas derivadas del carrito unificado, por tipo — el ORDEN real (el que
  // importa al confirmar) vive únicamente en `cartItems`.
  const cartCardItems = cartItems.filter(
    (i): i is Extract<CartItem, { kind: "card" }> => i.kind === "card"
  );
  const cartSleeveItems = cartItems.filter(
    (i): i is Extract<CartItem, { kind: "sleeve" }> => i.kind === "sleeve"
  );

  // Helper functions for price handling
  const getNumericPrice = (value: any) => {
    if (value === null || value === undefined || value === "") return null;
    const numberValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  };

  const getCardPriceValue = (card: CardWithCollectionData) => {
    // Listed Median (midPrice) es el default para todos; solo un admin puede
    // alternar a Market Price con el toggle.
    if (isAdmin && !showListedMedian) {
      return (
        getNumericPrice(card.marketPrice) ??
        getNumericPrice(card.alternates?.[0]?.marketPrice) ??
        null
      );
    }
    return (
      getNumericPrice((card as any).midPrice) ??
      getNumericPrice((card.alternates?.[0] as any)?.midPrice) ??
      getNumericPrice(card.marketPrice) ??
      getNumericPrice(card.alternates?.[0]?.marketPrice) ??
      null
    );
  };

  const getListCardPriceValue = (listCard: {
    customPrice?: number | string | null;
    card: CardWithCollectionData;
  }) => {
    return (
      getNumericPrice(listCard.customPrice) ?? getCardPriceValue(listCard.card)
    );
  };

  const formatCurrency = (value: number, currency?: string | null) => {
    const sourceCurrency = currency || "USD";
    const { value: displayValue, currency: displayCurrencyCode } =
      sourceCurrency === "USD"
        ? convertForListDisplay(value, list)
        : { value, currency: sourceCurrency };

    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: displayCurrencyCode,
      minimumFractionDigits: 2,
    }).format(displayValue);
  };


  const isOwner =
    isOwnerFromApi ??
    (list &&
      session?.user?.id &&
      Number(session.user.id) === Number(list.userId));

  const openPriceEdit = (entry: {
    card: CardWithCollectionData;
    listCard: any;
  }) => {
    const initialCustomPrice = entry.listCard?.customPrice ?? null;
    const initialCurrency =
      entry.listCard?.customCurrency ??
      entry.card.priceCurrency ??
      "USD";
    setPriceEditCard(entry.card);
    setPriceEditListCard(entry.listCard);
    setPriceEditInput(
      initialCustomPrice !== null && initialCustomPrice !== undefined
        ? Number(initialCustomPrice).toFixed(2)
        : ""
    );
    setPriceEditCurrency(initialCurrency);
    setPriceEditOpen(true);
  };

  const openPriceDrawer = (
    card: CardWithCollectionData,
    options?: {
      position?: { page: number; row: number; column: number };
      quantity?: number;
      replaceCardId?: number;
    }
  ) => {
    const defaultPrice = getCardPriceValue(card);
    setPriceDraft({
      card,
      position: options?.position,
      quantity: options?.quantity ?? 1,
      replaceCardId: options?.replaceCardId,
    });
    setPriceInput(
      defaultPrice !== null && defaultPrice !== undefined
        ? defaultPrice.toFixed(2)
        : ""
    );
    setPriceCurrency(card.priceCurrency || "USD");
    setPriceDrawerOpen(true);
  };

  // Tocar una carta en el modal de agregar la suma a la selección (carrito)
  // en vez de colocarla de inmediato — "Agregar N cartas" las acomoda todas
  // juntas al confirmar.
  const handleMobileCardPick = (card: CardWithCollectionData) => {
    setCartItems((prev) => {
      const idx = prev.findIndex(
        (i) => i.kind === "card" && i.card.id === card.id
      );
      if (idx >= 0) {
        const next = [...prev];
        const item = next[idx];
        next[idx] = { ...item, quantity: item.quantity + 1 };
        return next;
      }
      return [...prev, { kind: "card", card, quantity: 1 }];
    });
  };

  const updateAddSelectionQuantity = (cardId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((i) =>
          i.kind === "card" && i.card.id === cardId
            ? { ...i, quantity: i.quantity + delta }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const removeFromAddSelection = (cardId: string) => {
    setCartItems((prev) =>
      prev.filter((i) => !(i.kind === "card" && i.card.id === cardId))
    );
  };

  const clearAddSelection = () => setCartItems([]);

  // Agrega de golpe todas las cartas de un set al carrito (pestaña "Sets"),
  // sumando cantidad si alguna ya estaba seleccionada.
  const handleAddAllFromSet = (setCards: CardWithCollectionData[]) => {
    setCartItems((prev) => {
      const next = [...prev];
      for (const card of setCards) {
        const idx = next.findIndex(
          (i) => i.kind === "card" && i.card.id === card.id
        );
        if (idx >= 0) {
          const item = next[idx];
          next[idx] = { ...item, quantity: item.quantity + 1 };
        } else {
          next.push({ kind: "card", card, quantity: 1 });
        }
      }
      return next;
    });
  };

  // Agrega/incrementa un sleeve en el mismo carrito que las cartas.
  const handleSleevePick = (sleeve: { id: number; name: string; imageUrl: string }) => {
    setCartItems((prev) => {
      const idx = prev.findIndex((i) => i.kind === "sleeve" && i.id === sleeve.id);
      if (idx >= 0) {
        const next = [...prev];
        const item = next[idx];
        next[idx] = { ...item, quantity: item.quantity + 1 };
        return next;
      }
      return [...prev, { kind: "sleeve", ...sleeve, quantity: 1 }];
    });
  };

  const updateStagedSleeveQuantity = (sleeveId: number, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((i) =>
          i.kind === "sleeve" && i.id === sleeveId
            ? { ...i, quantity: i.quantity + delta }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const removeStagedSleeve = (sleeveId: number) => {
    setCartItems((prev) =>
      prev.filter((i) => !(i.kind === "sleeve" && i.id === sleeveId))
    );
  };

  // Carga el catálogo de sleeves la primera vez que se abre la pestaña
  // "Sleeves" del modal. Una sola consulta (el filtrado de "Sleeved Booster
  // Pack" ya pasa server-side en /api/products/sleeves).
  useEffect(() => {
    if (addModalTab !== "sleeves" || sleeveProducts.length > 0) return;
    let cancelled = false;
    setIsLoadingSleeves(true);
    fetch("/api/products/sleeves")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setSleeveProducts(
          (data.items ?? []).map((p: any) => ({
            id: p.id,
            name: p.name,
            imageUrl: p.imageUrl ?? p.thumbnailUrl ?? null,
          }))
        );
      })
      .catch((error) => {
        console.error("Error cargando sleeves:", error);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSleeves(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addModalTab, sleeveProducts.length]);

  // Alterna el reverso decorativo de carta en una casilla vacía. Antes esto
  // pasaba automáticamente al tocar cualquier casilla vacía; ahora vive como
  // acción explícita dentro del modal de agregar cartas.
  const toggleBackcardAt = async (position: {
    page: number;
    row: number;
    column: number;
  }) => {
    const positionKey = `${position.page}-${position.row}-${position.column}`;
    try {
      const response = await fetch(`/api/lists/${listId}/backcards/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: position.page,
          row: position.row,
          column: position.column,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setBackcardPositions((prev) => {
          const next = new Map(prev);
          if (result.action === "added") {
            next.set(positionKey, null);
          } else if (result.action === "removed") {
            next.delete(positionKey);
          }
          return next;
        });
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Error al modificar reverso");
      }
    } catch (error) {
      console.error("Error en toggle de backcard:", error);
      toast.error("Error de conexión");
    }
  };

  // Avanza una posición en orden de lectura (fila por fila, luego página).
  const advancePosition = (
    position: { page: number; row: number; column: number },
    maxRows: number,
    maxColumns: number
  ) => {
    let { page, row, column } = position;
    column++;
    if (column > maxColumns) {
      column = 1;
      row++;
    }
    if (row > maxRows) {
      row = 1;
      page++;
    }
    return { page, row, column };
  };

  // Confirma TODO el carrito de una vez, respetando el ORDEN en que se
  // agregaron las cartas y los sleeves (no "primero todas las cartas"): se
  // agrupa en corridas consecutivas del mismo tipo y se colocan en secuencia,
  // cada corrida arrancando justo donde terminó la anterior.
  const handleConfirmCart = async () => {
    if (!list?.isOrdered || cartItems.length === 0) return;

    const to =
      targetPosition ??
      findFirstAvailablePosition(getVisiblePageNumbers()) ?? {
        page: getMaxUsedPage() + 1,
        row: 1,
        column: 1,
      };
    const maxRows = list.maxRows || 3;
    const maxColumns = list.maxColumns || 3;

    const runs: Array<{ kind: CartItem["kind"]; items: CartItem[] }> = [];
    for (const item of cartItems) {
      const last = runs[runs.length - 1];
      if (last && last.kind === item.kind) {
        last.items.push(item);
      } else {
        runs.push({ kind: item.kind, items: [item] });
      }
    }

    setIsAddingBatch(true);
    setIsApplyingSleeve(true);
    try {
      let cursor = to;
      let cardCount = 0;
      let sleeveCount = 0;

      for (const run of runs) {
        if (run.kind === "card") {
          const cardItemsInRun = run.items.filter(
            (i): i is Extract<CartItem, { kind: "card" }> => i.kind === "card"
          );
          const response = await fetch(`/api/lists/${listId}/cards/add-batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cards: cardItemsInRun.map((i) => ({
                cardId: i.card.id,
                quantity: i.quantity,
              })),
              toPage: cursor.page,
              toRow: cursor.row,
              toColumn: cursor.column,
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || "Error al agregar las cartas");
          }

          const cardById = new Map(
            cardItemsInRun.map((i) => [String(i.card.id), i.card])
          );
          const assignments: Array<{
            cardId: number;
            page: number;
            row: number;
            column: number;
          }> = data.assignments || [];
          updateExistingCards((prev) => {
            const next = { ...prev };
            assignments.forEach((a) => {
              const cardObj = cardById.get(String(a.cardId));
              if (!cardObj) return;
              const key = `${a.page}-${a.row}-${a.column}`;
              next[key] = {
                card: cardObj,
                cardId: a.cardId,
                page: a.page,
                row: a.row,
                column: a.column,
                quantity: 1,
              };
            });
            return next;
          });

          if (list && data.totalPages > (list.totalPages || 1)) {
            setList((prev: any) =>
              prev ? { ...prev, totalPages: data.totalPages } : prev
            );
          }

          cardCount += data.count || 0;

          const lastAssignment = assignments.reduce(
            (max: typeof assignments[number] | null, a) => {
              if (!max) return a;
              if (a.page !== max.page) return a.page > max.page ? a : max;
              if (a.row !== max.row) return a.row > max.row ? a : max;
              return a.column > max.column ? a : max;
            },
            null
          );
          if (lastAssignment) {
            cursor = advancePosition(lastAssignment, maxRows, maxColumns);
          }
        } else {
          const sleeveItemsInRun = run.items.filter(
            (i): i is Extract<CartItem, { kind: "sleeve" }> =>
              i.kind === "sleeve"
          );
          const response = await fetch(
            `/api/lists/${listId}/backcards/set-image-batch`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sleeves: sleeveItemsInRun.map((i) => ({
                  imageUrl: i.imageUrl,
                  quantity: i.quantity,
                })),
                toPage: cursor.page,
                toRow: cursor.row,
                toColumn: cursor.column,
              }),
            }
          );

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || "Error al colocar los sleeves");
          }

          const assignments: Array<{
            imageUrl: string;
            page: number;
            row: number;
            column: number;
          }> = data.assignments || [];
          setBackcardPositions((prev) => {
            const next = new Map(prev);
            assignments.forEach((a) => {
              next.set(`${a.page}-${a.row}-${a.column}`, a.imageUrl);
            });
            return next;
          });

          if (list && data.totalPages > (list.totalPages || 1)) {
            setList((prev: any) =>
              prev ? { ...prev, totalPages: data.totalPages } : prev
            );
          }

          sleeveCount += data.count || 0;

          const lastSleeveAssignment = assignments.reduce(
            (max: typeof assignments[number] | null, a) => {
              if (!max) return a;
              if (a.page !== max.page) return a.page > max.page ? a : max;
              if (a.row !== max.row) return a.row > max.row ? a : max;
              return a.column > max.column ? a : max;
            },
            null
          );
          if (lastSleeveAssignment) {
            cursor = advancePosition(lastSleeveAssignment, maxRows, maxColumns);
          }
        }
      }

      if (cardCount > 0) toast.success(`${cardCount} carta(s) agregada(s)`);
      if (sleeveCount > 0) {
        toast.success(
          `${sleeveCount} sleeve${sleeveCount !== 1 ? "s" : ""} colocado${
            sleeveCount !== 1 ? "s" : ""
          }`
        );
      }

      clearAddSelection();
      setShowMobileCardModal(false);
      setTargetPosition(null);
    } catch (error: any) {
      console.error("Error confirmando carrito:", error);
      toast.error(error.message || "Error al agregar");
    } finally {
      setIsAddingBatch(false);
      setIsApplyingSleeve(false);
    }
  };

  const parsePriceValue = (value: string) => {
    const cleaned = value.replace(/,/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleSaveCustomPrice = async () => {
    if (!list || !priceEditListCard || !priceEditCard) return;
    if (!isOwner) return;

    setIsPriceEditSaving(true);
    try {
      const customPrice = parsePriceValue(priceEditInput);
      const customCurrency =
        customPrice !== null ? priceEditCurrency || "USD" : null;

      const response = await fetch(
        `/api/lists/${listId}/cards/${priceEditListCard.cardId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listCardId: priceEditListCard.id,
            customPrice,
            customCurrency,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar precio");
      }

      if (priceEditListCard.page && priceEditListCard.row && priceEditListCard.column) {
        const key = `${priceEditListCard.page}-${priceEditListCard.row}-${priceEditListCard.column}`;
        updateExistingCards((prev) => {
          if (!prev[key]) return prev;
          return {
            ...prev,
            [key]: {
              ...prev[key],
              customPrice,
              customCurrency,
            },
          };
        });
      }

      toast.success("Precio actualizado");
      setPriceEditOpen(false);
      setPriceEditCard(null);
      setPriceEditListCard(null);
    } catch (error) {
      console.error("Error guardando precio:", error);
      toast.error("Error al guardar el precio");
    } finally {
      setIsPriceEditSaving(false);
    }
  };

  const openSoldEdit = (entry: {
    card: CardWithCollectionData;
    listCard: any;
  }) => {
    const alreadySold = Boolean(entry.listCard?.isSold);
    const existingSoldPrice = entry.listCard?.soldPrice ?? null;
    const suggestedPrice =
      entry.listCard?.customPrice ?? getCardPriceValue(entry.card) ?? null;
    setSoldEditCard(entry.card);
    setSoldEditListCard(entry.listCard);
    setSoldEditPriceInput(
      alreadySold && existingSoldPrice !== null
        ? Number(existingSoldPrice).toFixed(2)
        : suggestedPrice !== null
          ? Number(suggestedPrice).toFixed(2)
          : ""
    );
    setSoldEditOpen(true);
  };

  const handleToggleSoldStatus = async (nextIsSold: boolean) => {
    if (!list || !soldEditListCard || !soldEditCard) return;
    if (!isOwner) return;

    setIsSoldEditSaving(true);
    try {
      const soldPrice = nextIsSold ? parsePriceValue(soldEditPriceInput) : null;

      const response = await fetch(
        `/api/lists/${listId}/cards/${soldEditListCard.cardId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listCardId: soldEditListCard.id,
            isSold: nextIsSold,
            ...(nextIsSold ? { soldPrice } : {}),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Error al actualizar el estado de venta"
        );
      }

      if (
        soldEditListCard.page &&
        soldEditListCard.row &&
        soldEditListCard.column
      ) {
        const key = `${soldEditListCard.page}-${soldEditListCard.row}-${soldEditListCard.column}`;
        updateExistingCards((prev) => {
          if (!prev[key]) return prev;
          return {
            ...prev,
            [key]: {
              ...prev[key],
              isSold: nextIsSold,
              soldPrice: nextIsSold ? soldPrice : null,
              soldAt: nextIsSold ? new Date().toISOString() : null,
            },
          };
        });
      }

      toast.success(
        nextIsSold ? "Carta marcada como vendida" : "Carta marcada como disponible"
      );
      setSoldEditOpen(false);
      setSoldEditCard(null);
      setSoldEditListCard(null);
    } catch (error) {
      console.error("Error actualizando estado de venta:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al actualizar el estado de venta"
      );
    } finally {
      setIsSoldEditSaving(false);
    }
  };

  const addCardWithPrice = async ({
    card,
    quantity,
    position,
    replaceCardId,
    customPrice,
    customCurrency,
  }: {
    card: CardWithCollectionData;
    quantity: number;
    position?: { page: number; row: number; column: number };
    replaceCardId?: number;
    customPrice: number | null;
    customCurrency: string | null;
  }) => {
    if (!list) return;

    if (list.isOrdered) {
      if (!position) return;
      if (replaceCardId) {
        await fetch(`/api/lists/${listId}/cards/${replaceCardId}`, {
          method: "DELETE",
        });
      }

      const cardToAdd = {
        cardId: card.id,
        page: position.page,
        row: position.row,
        column: position.column,
        customPrice,
        customCurrency,
      };

      const response = await fetch(`/api/lists/${listId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([cardToAdd]),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error agregando carta: ${errorData.error}`);
      }

      const data = await response.json();
      const savedCard = data.cards?.[0] || data.card;
      const key = `${position.page}-${position.row}-${position.column}`;
      setExistingCards((prev: any) => ({
        ...prev,
        [key]: savedCard,
      }));
      setPendingChanges((prev) =>
        prev.filter(
          (p) =>
            !(
              p.position.page === position.page &&
              p.position.row === position.row &&
              p.position.column === position.column
            )
        )
      );
      setTargetPosition(null);
      return;
    }

    const existing = simpleListCards.find((item) => item.card.id === card.id);
    if (existing) {
      await handleSimpleQuantityChange(
        card.id,
        existing.quantity + quantity,
        customPrice,
        customCurrency
      );
      return;
    }

    const response = await fetch(`/api/lists/${listId}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId: card.id,
        quantity,
        customPrice,
        customCurrency,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Error agregando carta: ${errorData.error}`);
    }

    const data = await response.json();
    const savedCard = data.card || data.cards?.[0];

    setSimpleListCards((prev) => [
      ...prev,
      {
        card,
        quantity,
        customPrice: savedCard?.customPrice ?? customPrice,
        customCurrency: savedCard?.customCurrency ?? customCurrency,
      },
    ]);
  };

  const handleConfirmPrice = async () => {
    if (!priceDraft) return;
    setIsPriceSaving(true);
    try {
      const customPrice = parsePriceValue(priceInput);
      const customCurrencyValue = priceCurrency || "USD";
      await addCardWithPrice({
        card: priceDraft.card,
        quantity: priceDraft.quantity,
        position: priceDraft.position,
        replaceCardId: priceDraft.replaceCardId,
        customPrice,
        customCurrency: customPrice !== null ? customCurrencyValue : null,
      });
      setPriceDrawerOpen(false);
      setPriceDraft(null);
    } catch (error) {
      console.error("Error guardando precio:", error);
      toast.error("Error al guardar el precio");
    } finally {
      setIsPriceSaving(false);
    }
  };

  // Calculate total value of the folder/list
  const folderTotalValue = useMemo(() => {
    let totalValue = 0;
    let currency = "USD";

    if (list?.isOrdered) {
      // For ordered lists (folders)
      Object.values(existingCards).forEach((listCard: any) => {
        if (listCard?.card) {
          const priceValue = getListCardPriceValue(listCard);
          const quantity = listCard.quantity || 1;
          if (priceValue !== null) {
            totalValue += priceValue * quantity;
            currency =
              listCard.customCurrency ||
              listCard.card.priceCurrency ||
              currency;
          }
        }
      });
    } else {
      // For simple lists
      simpleListCards.forEach((simpleCard) => {
        if (simpleCard?.card) {
          const priceValue = getListCardPriceValue(simpleCard);
          const quantity = simpleCard.quantity || 1;
          if (priceValue !== null) {
            totalValue += priceValue * quantity;
            currency =
              simpleCard.customCurrency ||
              simpleCard.card.priceCurrency ||
              currency;
          }
        }
      });
    }

    return { totalValue, currency };
  }, [existingCards, simpleListCards, list?.isOrdered, showListedMedian, isAdmin]);

  const folderTotalLabel = formatCurrency(
    folderTotalValue.totalValue,
    folderTotalValue.currency
  );

  // Card-list style filtered cards (for sidebar display)
  const allFilteredCards = useMemo(() => {
    if (!cards || cards.length === 0) return [];

    return cards
      .filter((card) => {
        const matchesWithAlternates = (
          predicate: (target: CardWithCollectionData) => boolean
        ) =>
          predicate(card) ||
          (card.alternates ?? []).some((alt) => predicate(alt));

        const matchesSearch =
          cardMatchesActiveFilters(card, {
            search,
            selectedSets,
            selectedCodes,
            selectedAltArts,
          }) ||
          (card.alternates ?? []).some((alt) =>
            cardMatchesActiveFilters(alt, {
              search,
              selectedSets,
              selectedCodes,
              selectedAltArts,
            })
          ) ||
          matchesCardCode(card.code, search) ||
          (card.alternates ?? []).some((alt) => matchesCardCode(alt.code, search));

        const matchesColors =
          selectedColors?.length === 0 ||
          matchesWithAlternates((target) =>
            target.colors.some((col) =>
              selectedColors.includes(col.color.toLowerCase())
            )
          );

        const baseMatches = baseCardMatches(card, selectedSets, []);
        const altMatches =
          getFilteredAlternates(card, selectedSets, []).length > 0;
        const matchesSets =
          selectedSets?.length === 0 ? true : baseMatches || altMatches;

        const matchesAltArts =
          selectedAltArts?.length === 0 ||
          matchesWithAlternates((target) =>
            selectedAltArts.includes(target.alternateArt ?? "")
          );

        const matchesTypes =
          selectedTypes?.length === 0 ||
          matchesWithAlternates((target) =>
            target.types.some((type) => selectedTypes.includes(type.type))
          );

        const matchesEffects =
          selectedEffects?.length === 0 ||
          matchesWithAlternates((target) =>
            (target.effects ?? []).some((effect) =>
              selectedEffects.includes(effect.effect)
            )
          );

        const matchesRarities =
          selectedRarities?.length === 0 ||
          matchesWithAlternates((target) =>
            selectedRarities.includes(target.rarity || "")
          );

        const matchesCategories =
          selectedCategories?.length === 0 ||
          matchesWithAlternates((target) =>
            selectedCategories.includes(target.category || "")
          );

        const matchesCounter =
          selectedCounter === "" ||
          matchesWithAlternates((target) =>
            selectedCounter === NO_COUNTER_LABEL
              ? !target.counter
              : (target.counter?.toString() ?? "") === selectedCounter
          );

        const matchesTrigger =
          selectedTrigger === "" ||
          matchesWithAlternates((target) =>
            selectedTrigger === NO_TRIGGER_LABEL
              ? !target.triggerCard
              : (target.triggerCard ?? "") === selectedTrigger
          );

        const matchesCosts =
          selectedCosts?.length === 0 ||
          matchesWithAlternates((target) =>
            selectedCosts.includes(target.cost || "")
          );

        const matchesPower =
          selectedPower?.length === 0 ||
          matchesWithAlternates((target) =>
            selectedPower.includes(target.power || "")
          );

        const matchesAttributes =
          selectedAttributes?.length === 0 ||
          matchesWithAlternates((target) =>
            selectedAttributes.includes(target.attribute || "")
          );

        const matchesCodes =
          selectedCodes?.length === 0 ||
          matchesWithAlternates((target) =>
            selectedCodes.some((code) => target.code.includes(code))
          );

        return (
          matchesSearch &&
          matchesColors &&
          matchesSets &&
          matchesAltArts &&
          matchesRarities &&
          matchesTypes &&
          matchesCategories &&
          matchesCounter &&
          matchesTrigger &&
          matchesEffects &&
          matchesCosts &&
          matchesPower &&
          matchesAttributes &&
          matchesCodes
        );
      })
      .sort(
        selectedSort === "Most variants"
          ? compareByVariantThenCollectionOrder("most")
          : selectedSort === "Less variants"
            ? compareByVariantThenCollectionOrder("less")
            : sortByCollectionOrder
      );
  }, [
    cards,
    search,
    selectedColors,
    selectedSets,
    selectedTypes,
    selectedEffects,
    selectedRarities,
    selectedCategories,
    selectedCounter,
    selectedTrigger,
    selectedCosts,
    selectedPower,
    selectedAttributes,
    selectedCodes,
    selectedAltArts,
    selectedSort,
  ]);

  // Sliced version for display
  const cardListFilteredCards = useMemo(
    () => allFilteredCards.slice(0, visibleCount),
    [allFilteredCards, visibleCount]
  );

  // Infinite scroll para el sidebar de cartas (desktop)
  useEffect(() => {
    if (loading || isMobile) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const BATCH_SIZE = 50;
    const LOAD_THRESHOLD_PX = 800;
    const isLoadingMoreRef = { current: false };

    const handleScroll = () => {
      const { scrollTop, clientHeight, scrollHeight } = container;
      const remaining = scrollHeight - (scrollTop + clientHeight);

      if (
        remaining <= LOAD_THRESHOLD_PX &&
        !isLoadingMoreRef.current &&
        visibleCount < (allFilteredCards?.length ?? 0)
      ) {
        isLoadingMoreRef.current = true;
        setVisibleCount((prev) =>
          Math.min(prev + BATCH_SIZE, allFilteredCards?.length ?? 0)
        );
        setTimeout(() => {
          isLoadingMoreRef.current = false;
        }, 100);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [loading, isMobile, visibleCount, allFilteredCards?.length]);

  // Infinite scroll para el modal mobile
  useEffect(() => {
    if (!showMobileCardModal) return;

    const container = mobileModalScrollRef.current;
    if (!container) return;

    const BATCH_SIZE = 50;
    const LOAD_THRESHOLD_PX = 800;
    const isLoadingMoreRef = { current: false };

    const handleScroll = () => {
      const { scrollTop, clientHeight, scrollHeight } = container;
      const remaining = scrollHeight - (scrollTop + clientHeight);

      if (
        remaining <= LOAD_THRESHOLD_PX &&
        !isLoadingMoreRef.current &&
        visibleCount < (allFilteredCards?.length ?? 0)
      ) {
        isLoadingMoreRef.current = true;
        setVisibleCount((prev) =>
          Math.min(prev + BATCH_SIZE, allFilteredCards?.length ?? 0)
        );
        setTimeout(() => {
          isLoadingMoreRef.current = false;
        }, 100);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [showMobileCardModal, visibleCount, allFilteredCards?.length]);

  // Drag and Drop handlers
  const handleDragStart = (
    e: React.DragEvent,
    card: CardWithCollectionData,
    sourceType: "sidebar" | "grid",
    sourcePosition?: { page: number; row: number; column: number }
  ) => {
    const dragData: DraggedCard = {
      card,
      sourceType,
      sourcePosition,
    };
    setDraggedCard(dragData);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleGridCardDragStart = (
    e: React.DragEvent,
    card: CardWithCollectionData,
    position: { page: number; row: number; column: number }
  ) => {
    handleDragStart(e, card, "grid", position);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (
    e: React.DragEvent,
    page: number,
    row: number,
    column: number
  ) => {
    e.preventDefault();
    setDragOverPosition({ page, row, column });
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're leaving the drop zone completely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverPosition(null);
    }
  };

  const handleDrop = async (
    e: React.DragEvent,
    page: number,
    row: number,
    column: number
  ) => {
    e.preventDefault();
    setDragOverPosition(null);

    if (!draggedCard) return;

    // Arrastre de una carta YA colocada: mover/swap, no agregar de nuevo.
    if (draggedCard.sourceType === "grid" && draggedCard.sourcePosition) {
      const from = draggedCard.sourcePosition;
      const card = draggedCard.card;
      setDraggedCard(null);
      await handleMoveCardWithinFolder(card, from, { page, row, column });
      return;
    }

    if (list?.isOrdered) {
      // Handle ordered list (folder) drop
      const existingCardKey = `${page}-${row}-${column}`;
      const existingCard = existingCards[existingCardKey];

      const changeId = `${Date.now()}-${Math.random()}`;
      let newChange;

      if (existingCard) {
        // Replace existing card
        newChange = {
          id: changeId,
          type: "change" as const,
          position: { page, row, column },
          card: draggedCard.card,
          previousCard: existingCard,
        };
      } else {
        // Add to empty position
        newChange = {
          id: changeId,
          type: "add" as const,
          position: { page, row, column },
          card: draggedCard.card,
        };
      }

      // Update pending changes
      const newPendingChanges = [
        ...pendingChanges.filter(
          (c) =>
            !(
              c.position.page === page &&
              c.position.row === row &&
              c.position.column === column
            )
        ),
        newChange,
      ];

      setPendingChanges(newPendingChanges);

      // Auto-save immediately
      try {
        // Process the change immediately
        const cardToAdd = {
          cardId: newChange.card.id,
          page: newChange.position.page,
          row: newChange.position.row,
          column: newChange.position.column,
        };

        // If it's a change, first remove the previous card
        if (newChange.type === "change" && existingCard?.cardId) {
          await fetch(`/api/lists/${listId}/cards/${existingCard.cardId}`, {
            method: "DELETE",
          });
        }

        // Add the new card
        const response = await fetch(`/api/lists/${listId}/cards`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([cardToAdd]),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Error agregando carta: ${errorData.error}`);
        }

        // Update local state to reflect the save
        const newExistingCards = { ...existingCards };
        const key = `${newChange.position.page}-${newChange.position.row}-${newChange.position.column}`;
        newExistingCards[key] = {
          card: newChange.card,
          cardId: newChange.card.id,
          page: newChange.position.page,
          row: newChange.position.row,
          column: newChange.position.column,
        };
        setExistingCards(newExistingCards);

        // Remove the processed change from pending changes
        setPendingChanges((prev) => prev.filter((p) => p.id !== newChange.id));
      } catch (error) {
        console.error("Error en auto-guardado:", error);
        toast.error("Error al guardar automáticamente");
      }
    } else {
      // Handle simple list drop
      await handleSimpleCardAdd(draggedCard.card);
    }

    setDraggedCard(null);
  };

  const handleSimpleCardAdd = async (card: CardWithCollectionData) => {
    // First check if card already exists
    const existing = simpleListCards.find((item) => item.card.id === card.id);

    if (existing) {
      // If card exists, increment quantity using the existing function
      await handleSimpleQuantityChange(card.id, existing.quantity + 1);
    } else {
      if (isMobile) {
        openPriceDrawer(card, { quantity: 1 });
        return;
      }
      // If card doesn't exist, add it with quantity 1
      const newCards = [...simpleListCards, { card, quantity: 1 }];
      setSimpleListCards(newCards);

      // Auto-save new card using POST (only for new cards)
      try {
        const response = await fetch(`/api/lists/${listId}/cards`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cardId: card.id,
            quantity: 1,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Error agregando carta:", errorData);
          toast.error("Error al agregar carta automáticamente");
        } else {
          console.log("Carta agregada automáticamente");
        }
      } catch (error) {
        console.error("Error en auto-guardado:", error);
        toast.error("Error al guardar automáticamente");
      }
    }
  };

  const handleSimpleQuantityChange = async (
    cardId: string,
    quantity: number,
    customPrice?: number | null,
    customCurrency?: string | null
  ) => {
    // First update the local state
    const newCards =
      quantity <= 0
        ? simpleListCards.filter((item) => item.card.id !== cardId)
        : simpleListCards.map((item) =>
            item.card.id === cardId
              ? {
                  ...item,
                  quantity,
                  customPrice:
                    customPrice !== undefined ? customPrice : item.customPrice,
                  customCurrency:
                    customCurrency !== undefined
                      ? customCurrency
                      : item.customCurrency,
                }
              : item
          );

    setSimpleListCards(newCards);

    // Then auto-save immediately using correct endpoints
    try {
      if (quantity <= 0) {
        // For deletion, use DELETE endpoint
        const response = await fetch(`/api/lists/${listId}/cards/${cardId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Error eliminando carta:", errorData);
          toast.error("Error al eliminar carta automáticamente");
        } else {
          console.log("Carta eliminada automáticamente");
        }
      } else {
        // For quantity update, use PUT endpoint
        const response = await fetch(`/api/lists/${listId}/cards/${cardId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity,
            customPrice,
            customCurrency,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Error actualizando cantidad:", errorData);
          toast.error("Error al actualizar cantidad automáticamente");
        } else {
          console.log("Cantidad actualizada automáticamente");
        }
      }
    } catch (error) {
      console.error("Error en auto-guardado:", error);
      toast.error("Error al guardar automáticamente");
    }
  };

  const getCardAtPosition = (row: number, col: number, page?: number) => {
    // Use the specific page provided, fallback to currentPage if not provided
    const targetPage = page ?? currentPage;
    const key = `${targetPage}-${row}-${col}`;
    const existingCard = existingCardsRef.current[key];
    const pendingChange = pendingChanges.find(
      (change) =>
        change.position.page === targetPage &&
        change.position.row === row &&
        change.position.column === col
    );

    if (pendingChange) {
      return {
        card: pendingChange.card!,
        isPending: true,
        change: pendingChange,
      };
    }

    if (existingCard) {
      return {
        card: existingCard.card,
        isPending: false,
        existing: existingCard,
      };
    }

    return null;
  };

  const updateExistingCards = (
    updater: (prev: typeof existingCards) => typeof existingCards
  ) => {
    const next = updater(existingCardsRef.current);
    existingCardsRef.current = next;
    setExistingCards(next);
  };

  // Mueve una carta YA colocada de `from` a `to` dentro de la misma carpeta.
  // Si `to` está ocupada por otra carta, el backend hace swap; reflejamos ese
  // mismo intercambio en el estado local para no tener que re-fetch.
  const handleMoveCardWithinFolder = async (
    card: CardWithCollectionData,
    from: { page: number; row: number; column: number },
    to: { page: number; row: number; column: number }
  ) => {
    if (!list?.isOrdered || !isOwner) return;
    if (
      from.page === to.page &&
      from.row === to.row &&
      from.column === to.column
    ) {
      return;
    }

    const fromKey = `${from.page}-${from.row}-${from.column}`;
    const toKey = `${to.page}-${to.row}-${to.column}`;
    const destinationEntry = existingCardsRef.current[toKey];

    try {
      const response = await fetch(
        `/api/lists/${listId}/cards/${card.id}/reposition`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toPage: to.page,
            toRow: to.row,
            toColumn: to.column,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Error al mover la carta");
      }

      updateExistingCards((prev) => {
        const next = { ...prev };
        const sourceEntry = next[fromKey];
        if (!sourceEntry) return prev;

        if (destinationEntry) {
          next[fromKey] = {
            ...destinationEntry,
            page: from.page,
            row: from.row,
            column: from.column,
          };
        } else {
          delete next[fromKey];
        }

        next[toKey] = {
          ...sourceEntry,
          page: to.page,
          row: to.row,
          column: to.column,
        };
        return next;
      });

      if (list && to.page > (list.totalPages || 1)) {
        setList((prev: any) => (prev ? { ...prev, totalPages: to.page } : prev));
      }
    } catch (error: any) {
      console.error("Error moviendo carta:", error);
      toast.error(error.message || "Error al mover la carta");
    }
  };

  // Botón "Mover": agrega/quita una carta de la selección múltiple (toggle).
  // Funciona con toques en cualquier dispositivo — el siguiente toque en una
  // casilla (vacía u ocupada) completa el movimiento vía handlePositionClick.
  const toggleMovingCard = (entry: { card: CardWithCollectionData; listCard: any }) => {
    if (!entry.listCard || entry.listCard.page == null) return;
    setMovingCards((prev) => {
      if (prev.some((m) => m.card.id === entry.card.id)) {
        return prev.filter((m) => m.card.id !== entry.card.id);
      }
      return [
        ...prev,
        {
          card: entry.card,
          from: {
            page: entry.listCard.page,
            row: entry.listCard.row,
            column: entry.listCard.column,
          },
        },
      ];
    });
  };

  const cancelMovingCards = () => {
    setMovingCards([]);
  };

  // Mueve varias cartas ya colocadas a la vez: se acomodan en `to` y en
  // adelante (orden de lectura), en el orden en que se seleccionaron,
  // saltando cualquier casilla ocupada por OTRA carta sin eliminarla. Para
  // una sola carta reusamos el flujo existente (mueve o intercambia).
  const handleMoveCardsBatch = async (
    cards: Array<{
      card: CardWithCollectionData;
      from: { page: number; row: number; column: number };
    }>,
    to: { page: number; row: number; column: number }
  ) => {
    if (!list?.isOrdered || !isOwner || cards.length === 0) return;

    if (cards.length === 1) {
      await handleMoveCardWithinFolder(cards[0].card, cards[0].from, to);
      return;
    }

    try {
      const response = await fetch(`/api/lists/${listId}/cards/move-batch`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardIds: cards.map((c) => c.card.id),
          toPage: to.page,
          toRow: to.row,
          toColumn: to.column,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Error al mover las cartas");
      }

      // Reubicar cada carta directo en el estado local (sin refetch: evita
      // el parpadeo/skeleton de toda la página). Conservamos todos los
      // campos de cada carta (precio custom, vendida, etc.), solo cambia
      // su posición.
      const entryByCardId = new Map<string, any>();
      updateExistingCards((prev) => {
        const next = { ...prev };
        cards.forEach((c) => {
          const fromKey = `${c.from.page}-${c.from.row}-${c.from.column}`;
          const entry = next[fromKey];
          if (entry) entryByCardId.set(String(c.card.id), entry);
          delete next[fromKey];
        });

        (data.assignments || []).forEach(
          (a: { cardId: number; page: number; row: number; column: number }) => {
            const entry = entryByCardId.get(String(a.cardId));
            if (!entry) return;
            const toKey = `${a.page}-${a.row}-${a.column}`;
            next[toKey] = { ...entry, page: a.page, row: a.row, column: a.column };
          }
        );

        return next;
      });

      if (list && data.totalPages > (list.totalPages || 1)) {
        setList((prev: any) =>
          prev ? { ...prev, totalPages: data.totalPages } : prev
        );
      }

      toast.success(`${cards.length} cartas movidas`);
    } catch (error: any) {
      console.error("Error moviendo cartas:", error);
      toast.error(error.message || "Error al mover las cartas");
    }
  };

  // Salto directo a una página (ej. para ir a mover una carta lejos sin dar
  // "siguiente" decenas de veces). Usa el mismo patrón que el atajo de
  // teclado "End" (setCurrentPage con el número de página real).
  const handleJumpToPage = () => {
    const target = parseInt(jumpToPageInput, 10);
    const maxNavigablePage = getMaxNavigablePage();
    if (!Number.isInteger(target) || target < 0 || target > maxNavigablePage) {
      toast.error(`Ingresa una página entre 0 y ${maxNavigablePage}`);
      return;
    }
    hasUserNavigated.current = true;
    setCurrentPage(target);
    currentPageRef.current = target;
    setJumpToPageInput("");
  };

  const openInsertPageDialog = () => {
    setInsertAfterPageInput(String(getMaxUsedPage()));
    setInsertPageOpen(true);
  };

  const handleConfirmInsertPage = async () => {
    if (!list?.isOrdered || !isOwner) return;

    const afterPage = parseInt(insertAfterPageInput, 10);
    if (!Number.isInteger(afterPage) || afterPage < 0) {
      toast.error("Ingresa un número de página válido");
      return;
    }

    setIsInsertingPage(true);
    try {
      const response = await fetch(`/api/lists/${listId}/pages/insert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ afterPage }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Error al insertar la página");
      }

      toast.success(`Página en blanco insertada como página ${data.insertedPage}`);
      setInsertPageOpen(false);

      // Muchas cartas pueden haber cambiado de página, así que sí hace falta
      // releer las cartas — pero sin pasar por fetchList (que prende
      // `loading` y muestra el skeleton de toda la página).
      if (list) {
        setList((prev: any) =>
          prev ? { ...prev, totalPages: data.totalPages } : prev
        );
      }
      await fetchExistingCards();
    } catch (error: any) {
      console.error("Error insertando página:", error);
      toast.error(error.message || "Error al insertar la página en blanco");
    } finally {
      setIsInsertingPage(false);
    }
  };

  const scheduleAddFlush = () => {
    if (addFlushTimerRef.current) {
      clearTimeout(addFlushTimerRef.current);
    }
    addFlushTimerRef.current = setTimeout(() => {
      flushAddQueue();
    }, 600);
  };

  const flushAddQueue = async () => {
    if (addSaveInFlightRef.current) {
      addFlushRequestedRef.current = true;
      return;
    }

    const entries = Array.from(addQueueRef.current.values());
    if (entries.length === 0) return;

    addSaveInFlightRef.current = true;
    addQueueRef.current.clear();

    try {
      const response = await fetch(`/api/lists/${listId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entries),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error agregando carta: ${errorData.error}`);
      }

      updateExistingCards((prev) => {
        const next = { ...prev };
        entries.forEach((entry) => {
          const key = `${entry.page}-${entry.row}-${entry.column}`;
          if (next[key]) {
            next[key] = { ...next[key], isOptimistic: false };
          }
        });
        return next;
      });
    } catch (error) {
      console.error("Error en auto-guardado:", error);
      toast.error("Error al guardar automáticamente");
      entries.forEach((entry) => {
        const key = `${entry.page}-${entry.row}-${entry.column}`;
        addQueueRef.current.set(key, entry);
      });
    } finally {
      addSaveInFlightRef.current = false;
      if (addFlushRequestedRef.current) {
        addFlushRequestedRef.current = false;
        if (addQueueRef.current.size) {
          flushAddQueue();
        }
      }

      if (!addQueueRef.current.size && pendingDeleteRef.current.size) {
        const pendingDeletes = Array.from(pendingDeleteRef.current.values());
        pendingDeleteRef.current.clear();
        await Promise.all(
          pendingDeletes.map((cardId) =>
            fetch(`/api/lists/${listId}/cards/${cardId}`, {
              method: "DELETE",
            }).catch((deleteError) => {
              console.error("Error eliminando carta en diferido:", deleteError);
            })
          )
        );
      }
    }
  };

  const enqueueAdd = (
    card: CardWithCollectionData,
    position: { page: number; row: number; column: number }
  ) => {
    const key = `${position.page}-${position.row}-${position.column}`;
    addQueueRef.current.set(key, {
      cardId: card.id,
      page: position.page,
      row: position.row,
      column: position.column,
    });
    scheduleAddFlush();
  };

  const getVisiblePageNumbers = () => {
    const pageIndex = currentPageRef.current;
    const totalPages = Math.max(getMaxNavigablePage(), pageIndex + 1);

    if (folderDimensions.showSinglePage) {
      console.log("[add-cards] visible pages (single)", {
        pageIndex,
        pages: pageIndex === 0 ? [1] : [pageIndex],
      });
      return pageIndex === 0 ? [1] : [pageIndex];
    }

    if (pageIndex === 0) return [1];

    const pages = [pageIndex, pageIndex + 1].filter(
      (page) => page >= 1 && page <= totalPages
    );
    console.log("[add-cards] visible pages (spread)", {
      pageIndex,
      pages,
    });
    return pages;
  };

  const findFirstAvailablePosition = (pages: number[]) => {
    const maxRows = list?.maxRows || 3;
    const maxColumns = list?.maxColumns || 3;

    for (const page of pages) {
      for (let row = 1; row <= maxRows; row++) {
        for (let col = 1; col <= maxColumns; col++) {
          const key = `${page}-${row}-${col}`;
          if (backcardPositions.has(key)) continue;
          if (getCardAtPosition(row, col, page)) continue;
          return { page, row, column: col };
        }
      }
    }

    return null;
  };

  const addOrderedCardAtPosition = async (
    card: CardWithCollectionData,
    position: { page: number; row: number; column: number }
  ) => {
    if (!list?.isOrdered) return;

    if (isMobile) {
      openPriceDrawer(card, { position });
      return;
    }
    const key = `${position.page}-${position.row}-${position.column}`;

    updateExistingCards((prev) => ({
      ...prev,
      [key]: {
        card,
        cardId: card.id,
        page: position.page,
        row: position.row,
        column: position.column,
        isOptimistic: true,
      },
    }));

    enqueueAdd(card, position);
  };

  const addCardToFirstAvailablePosition = async (
    card: CardWithCollectionData
  ) => {
    if (!list) return;

    if (!list.isOrdered) {
      await handleSimpleCardAdd(card);
      return;
    }

    const visiblePages = getVisiblePageNumbers();
    const pagesToCheck = visiblePages.length ? visiblePages : [1];
    const position = findFirstAvailablePosition(pagesToCheck);

    if (!position) {
      toast.info("No hay espacios disponibles en esta hoja");
      return;
    }

    await addOrderedCardAtPosition(card, position);
  };

  const handleSidebarCardClick = async (card: CardWithCollectionData) => {
    await addCardToFirstAvailablePosition(card);
  };

  const handlePositionClick = async (
    row: number,
    col: number,
    page?: number
  ) => {
    // Use the specific page provided, fallback to currentPage if not provided
    const targetPage = page ?? currentPage;
    const cardAtPosition = getCardAtPosition(row, col, targetPage);

    // Hay una o varias cartas "levantadas" para mover (botón Mover o
    // arrastre desde el grid): esta casilla es el destino de la primera.
    // Una sola carta se mueve o intercambia (si está ocupada); varias se
    // acomodan en orden a partir de aquí, saltando cualquier casilla ya
    // ocupada por OTRA carta sin eliminarla. Funciona en cualquier
    // dispositivo porque solo depende de toques/clics, no de drag nativo.
    if (movingCards.length > 0) {
      const to = { page: targetPage, row, column: col };
      const cardsToMove = movingCards;
      cancelMovingCards();

      if (
        cardsToMove.length === 1 &&
        cardsToMove[0].from.page === to.page &&
        cardsToMove[0].from.row === to.row &&
        cardsToMove[0].from.column === to.column
      ) {
        return; // Tocó la misma casilla de origen: cancelar sin hacer nada
      }

      await handleMoveCardsBatch(cardsToMove, to);
      return;
    }

    // Casilla vacía y sin cartas seleccionadas: abrir el modal de agregar
    // cartas apuntando a esta posición (en cualquier dispositivo). Alternar
    // el reverso decorativo se movió a un botón dentro de ese mismo modal.
    if (!cardAtPosition) {
      setTargetPosition({ page: targetPage, row, column: col });
      setShowMobileCardModal(true);
      return;
    }

    // If no selected card, handle removal as before
    if (cardAtPosition) {
      const positionKey = `${targetPage}-${row}-${col}`;

      if (addQueueRef.current.has(positionKey)) {
        addQueueRef.current.delete(positionKey);
        updateExistingCards((prev) => {
          const next = { ...prev };
          delete next[positionKey];
          return next;
        });
        return;
      }

      if (cardAtPosition.existing?.isOptimistic) {
        if (addSaveInFlightRef.current) {
          pendingDeleteRef.current.set(
            positionKey,
            cardAtPosition.existing.cardId
          );
        }
        updateExistingCards((prev) => {
          const next = { ...prev };
          delete next[positionKey];
          return next;
        });
        return;
      }

      // Remove card from position
      if (cardAtPosition.isPending) {
        setPendingChanges((prev) =>
          prev.filter(
            (change) =>
              !(
                change.position.page === targetPage &&
                change.position.row === row &&
                change.position.column === col
              )
          )
        );
      } else {
        // Mark existing card for removal and auto-save
        try {
          // Remove from server
          if (cardAtPosition.existing?.cardId) {
            const response = await fetch(
              `/api/lists/${listId}/cards/${cardAtPosition.existing.cardId}`,
              {
                method: "DELETE",
              }
            );

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(`Error eliminando carta: ${errorData.error}`);
            }

            // Update local state
            updateExistingCards((prev) => {
              const next = { ...prev };
              delete next[positionKey];
              return next;
            });
          }
        } catch (error) {
          console.error("Error eliminando carta:", error);
          toast.error("Error al eliminar carta automáticamente");
        }
      }
    }
  };

  const handleCardClick = (card: CardWithCollectionData) => {
    setSelectedCard(card);
    setShowLargeImage(true);
  };

  if (loading) {
    return (
      <div className="h-screen flex bg-white w-full">
        {/* Sidebar Skeleton */}
        <div className="bg-white w-[300px] md:w-[350px] lg:w-[400px] flex-shrink-0 border-r border-[#f5f5f5] min-h-0">
          <CardsSidebarSkeleton />
        </div>

        {/* Main Content Skeleton */}
        <div className="flex-1 min-h-0 bg-gradient-to-br from-blue-50 via-white to-purple-50">
          <div className="container mx-auto px-4 py-6 h-full">
            <MainContentSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="h-full flex items-center justify-center p-4 w-full">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="text-center py-16">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Lista no encontrada
            </h2>
            <p className="text-slate-600 mb-6">
              La lista que buscas no existe o no tienes permisos para verla.
            </p>
            <Link href="/lists">
              <Button>Volver a las listas</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (list && isOwner === false) {
    return (
      <div className="h-full flex items-center justify-center p-4 w-full">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="text-center py-16">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              No tienes permisos
            </h2>
            <p className="text-slate-600 mb-6">
              Solo el propietario puede editar esta lista.
            </p>
            <Link href="/lists">
              <Button>Volver a las listas</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 w-full">
      <div className="flex-1 flex overflow-hidden">
        {!isMobile && (
          <div className="bg-white w-[300px] md:w-[300px] lg:w-[400px] xl:w-[450px] flex-shrink-0 border-r border-slate-200 min-h-0 flex flex-col">
            <div className="justify-center border-b border-[#f5f5f5] py-3 px-5 hidden  gap-5">
              <SearchFilters
                search={search}
                setSearch={setSearch}
                selectedColors={selectedColors}
                setSelectedColors={setSelectedColors}
                selectedRarities={selectedRarities}
                setSelectedRarities={setSelectedRarities}
                selectedCategories={selectedCategories}
                setSelectedCategories={setSelectedCategories}
                selectedCounter={selectedCounter}
                setSelectedCounter={setSelectedCounter}
                selectedTrigger={selectedTrigger}
                setSelectedTrigger={setSelectedTrigger}
                selectedEffects={selectedEffects}
                setSelectedEffects={setSelectedEffects}
                selectedTypes={selectedTypes}
                setSelectedTypes={setSelectedTypes}
                setViewSelected={setViewSelected}
                selectedSets={selectedSets}
                setSelectedSets={setSelectedSets}
                selectedCosts={selectedCosts}
                setSelectedCosts={setSelectedCosts}
                selectedPower={selectedPower}
                setSelectedPower={setSelectedPower}
                selectedAttributes={selectedAttributes}
                setSelectedAttributes={setSelectedAttributes}
                selectedCodes={selectedCodes}
                setSelectedCodes={setSelectedCodes}
                setSelectedAltArts={setSelectedAltArts}
                selectedAltArts={selectedAltArts}
                suggestionsEndpoint="/api/cards/search-suggestions"
              />
            </div>

            <div className="flex p-3 flex-col gap-3 border-b border-[#f5f5f5]">
              <div className="flex items-center gap-2">
                <FiltersButton
                  totalFilters={totalFilters}
                  onOpenFilters={() => setIsModalOpen(true)}
                  isTouchable={
                    selectedColors.length > 0 ||
                    selectedRarities.length > 0 ||
                    selectedCategories.length > 0 ||
                    selectedCounter !== "" ||
                    selectedTrigger !== "" ||
                    selectedEffects.length > 0 ||
                    selectedTypes.length > 0 ||
                    selectedSets.length > 0 ||
                    selectedCosts.length > 0 ||
                    selectedPower.length > 0 ||
                    selectedAttributes.length > 0 ||
                    selectedCodes.length > 0 ||
                    selectedAltArts.length > 0
                  }
                  onClearFilters={clearAllFilters}
                />
                <div className="flex-1 min-w-0">
                  <DropdownSearch
                    search={search}
                    setSearch={setSearch}
                    placeholder="Search..."
                    suggestionsEndpoint="/api/cards/search-suggestions"
                  />
                </div>
              </div>
            </div>
            <Transition
              show={isModalOpen}
              enter="transition transform duration-300"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition transform duration-200"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <FiltersSidebar
                isOpen={isModalOpen}
                setIsOpen={setIsModalOpen}
                search={search}
                setSearch={setSearch}
                selectedColors={selectedColors}
                setSelectedColors={setSelectedColors}
                selectedRarities={selectedRarities}
                setSelectedRarities={setSelectedRarities}
                selectedCategories={selectedCategories}
                setSelectedCategories={setSelectedCategories}
                selectedCounter={selectedCounter}
                setSelectedCounter={setSelectedCounter}
                selectedTrigger={selectedTrigger}
                setSelectedTrigger={setSelectedTrigger}
                selectedEffects={selectedEffects}
                setSelectedEffects={setSelectedEffects}
                selectedTypes={selectedTypes}
                setSelectedTypes={setSelectedTypes}
                selectedSets={selectedSets}
                setSelectedSets={setSelectedSets}
                selectedCosts={selectedCosts}
                setSelectedCosts={setSelectedCosts}
                selectedPower={selectedPower}
                setSelectedPower={setSelectedPower}
                selectedAttributes={selectedAttributes}
                setSelectedAttributes={setSelectedAttributes}
                selectedAltArts={selectedAltArts}
                setSelectedAltArts={setSelectedAltArts}
                selectedCodes={selectedCodes}
                setSelectedCodes={setSelectedCodes}
              />
            </Transition>

            <div
              className="p-3 overflow-y-auto flex-1 min-h-0"
              ref={scrollContainerRef}
              onScroll={(e) => {
                const scrollTop = (e.target as HTMLDivElement).scrollTop;

                if (scrollTop > 100) {
                  setShowFab(true);
                } else {
                  setShowFab(false);
                }
              }}
            >
              {showFab && <FAB onClick={handleScrollToTop} />}

              {/* Selected Card(s) Indicator */}
              {movingCards.length > 0 && !isMobile && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    {movingCards.length === 1 ? (
                      <div className="w-8 h-11 flex-shrink-0">
                        <LazyImage
                          src={movingCards[0].card.src}
                          fallbackSrc="/assets/images/backcard.webp"
                          alt={movingCards[0].card.name}
                          className="w-full rounded border"
                          priority={true}
                          size="small"
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-11 flex-shrink-0 rounded border border-blue-300 bg-blue-100 flex items-center justify-center text-blue-800 font-bold text-sm">
                        {movingCards.length}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-900 truncate">
                        {movingCards.length === 1
                          ? movingCards[0].card.name
                          : `${movingCards.length} cartas seleccionadas`}
                      </p>
                      <p className="text-xs text-blue-700">
                        {movingCards.length === 1
                          ? "Moviendo esta carta — toca la casilla destino"
                          : "Toca la casilla inicial: se acomodan en ese orden"}
                      </p>
                    </div>
                    <button
                      onClick={cancelMovingCards}
                      className="p-1 hover:bg-blue-100 rounded-full"
                    >
                      <X className="h-4 w-4 text-blue-600" />
                    </button>
                  </div>
                </div>
              )}

              {viewSelected === "alternate" && (
                <div className="flex flex-col gap-5">
                  {cardListFilteredCards?.map((card) => {
                    const baseMatches = baseCardMatches(
                      card,
                      selectedSets,
                      selectedAltArts
                    );
                    const filteredAlts = getFilteredAlternates(
                      card,
                      selectedSets,
                      selectedAltArts
                    );

                    if (!baseMatches && filteredAlts.length === 0)
                      return null;

                    return (
                      <div className="flex flex-col gap-5" key={card._id}>
                        <div className="grid gap-3 grid-cols-2  mb-3">
                          <Card>
                            <CardContent className="p-5 h-full">
                              <div className="h-full flex flex-col justify-around items-center relative">
                                <div className="flex items-center justify-between flex-col mt-4">
                                  <h2 className="text-lg font-black break-normal mb-2 text-center leading-tight line-clamp-2">
                                    {highlightText(card?.name, search)}
                                  </h2>
                                  <p
                                    className={`${oswald.className} text-md text-black leading-[16px] mb-4 font-[400]`}
                                  >
                                    {highlightText(card?.code, search)}
                                  </p>
                                  <div className="flex justify-between items-end flex-col gap-1 mb-1 mr-1">
                                    <Badge
                                      variant="secondary"
                                      className="text-sm !bg-white text-black rounded-full min-w-[41px] text-center border border-[#000]"
                                    >
                                      <span className="text-center w-full font-black leading-[16px] mb-[2px]">
                                        {card?.rarity
                                          ? rarityFormatter(card.rarity)
                                          : ""}
                                      </span>
                                    </Badge>
                                  </div>
                                  <div className="flex flex-col mt-2">
                                    {card?.types.map((type) => (
                                      <span
                                        key={type.type}
                                        className="text-[13px] leading-[15px] font-[200] text-center"
                                      >
                                        {highlightText(type.type, search)}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 mt-3">
                                  <img
                                    src={Alternates.src}
                                    alt="eye"
                                    className="w-[35px] h-[35px] mt-1"
                                  />
                                  <div className="flex items-center flex-col">
                                    <span className="font-bold text-2xl text-black leading-[30px]">
                                      {(card?.alternates?.length ?? 0) + 1}
                                    </span>
                                    <span className="text-sm text-black leading-[13px]">
                                      {card?.alternates?.length === 0
                                        ? "variant"
                                        : "variants"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {baseMatches && (
                            <Card
                              onClick={() => handleSidebarCardClick(card)}
                              draggable
                              onDragStart={(e) =>
                                handleDragStart(e, card, "sidebar")
                              }
                              className={`cursor-pointer transition-all duration-200 relative group ${
                                movingCardIds.has(card.id)
                                  ? "ring-2 ring-blue-500 bg-blue-50"
                                  : "hover:shadow-md"
                              }`}
                            >
                              <CardContent className="flex justify-center items-center p-4 flex-col h-full">
                                <div className="flex justify-center items-center w-full relative">
                                  <div className="w-[80%] m-auto cursor-pointer">
                                    <LazyImage
                                      src={card?.src}
                                      fallbackSrc="/assets/images/backcard.webp"
                                      alt={card?.name}
                                      className="w-full"
                                      size="small"
                                    />
                                  </div>
                                  {/* Botón de ver carta en grande */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCardClick(card);
                                    }}
                                    className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center opacity-100 transition-opacity duration-200 z-10"
                                    title="Ver carta en grande"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </button>
                                </div>
                                <div>
                                  <div className="text-center font-bold mt-2">
                                    Base
                                  </div>
                                  {card.sets?.map((set) => (
                                    <p
                                      key={set.set.title}
                                      className="text-[13px] leading-[15px] font-[200] text-center line-clamp-2"
                                    >
                                      {highlightText(set.set.title, search)}
                                    </p>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {filteredAlts.map((alt) => {
                            const setsArray: string[] | undefined =
                              alt?.sets?.map((item: any) =>
                                typeof item === "object" ? item.set.title : item
                              );
                            return (
                              <Card
                                key={alt._id}
                                onClick={() => handleSidebarCardClick(alt)}
                                draggable
                                onDragStart={(e) =>
                                  handleDragStart(e, alt, "sidebar")
                                }
                                className={`cursor-pointer transition-all duration-200 relative group ${
                                  movingCardIds.has(alt.id)
                                    ? "ring-2 ring-blue-500 bg-blue-50"
                                    : "hover:shadow-md"
                                }`}
                              >
                                <CardContent className="flex justify-center items-center p-4 flex-col h-full">
                                  <div className="flex justify-center items-center w-full relative">
                                    <div className="w-[80%] m-auto cursor-pointer">
                                      <LazyImage
                                        src={alt?.src}
                                        fallbackSrc="/assets/images/backcard.webp"
                                        alt={alt?.name}
                                        className="w-full"
                                        size="small"
                                      />
                                    </div>
                                    {/* Botón de ver carta en grande */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCardClick(alt);
                                      }}
                                      className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center opacity-100 transition-opacity duration-200 z-10"
                                      title="Ver carta en grande"
                                    >
                                      <Eye className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div>
                                    <div className="text-center font-bold mt-2">
                                      {alt?.alternateArt}
                                    </div>
                                    {setsArray?.map((set) => (
                                      <p
                                        key={set}
                                        className="text-[13px] leading-[15px] font-[200] text-center line-clamp-2"
                                      >
                                        {highlightText(set, search)}
                                      </p>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {viewSelected === "list" && (
                <div className="grid gap-3 grid-cols-3 justify-items-center">
                  {cardListFilteredCards?.map((card) => {
                    const baseMatches = baseCardMatches(
                      card,
                      selectedSets,
                      selectedAltArts
                    );
                    const filteredAlts = getFilteredAlternates(
                      card,
                      selectedSets,
                      selectedAltArts
                    );

                    // Si ni la carta base ni alguna alterna coinciden, no renderizamos nada
                    if (!baseMatches && filteredAlts.length === 0)
                      return null;

                    return (
                      <Fragment key={card._id}>
                        {baseMatches && (
                          <div
                            onClick={() => handleSidebarCardClick(card)}
                            draggable
                            onDragStart={(e) =>
                              handleDragStart(e, card, "sidebar")
                            }
                            className={`w-full cursor-pointer max-w-[450px] transition-all duration-200 rounded-lg relative group ${
                              movingCardIds.has(card.id)
                                ? "ring-2 ring-blue-500 bg-blue-50"
                                : ""
                            }`}
                          >
                            <div className="border rounded-lg shadow pb-3 bg-white justify-center items-center flex flex-col relative">
                              <div className="w-full cursor-pointer">
                                <LazyImage
                                  src={card.src}
                                  fallbackSrc="/assets/images/backcard.webp"
                                  alt={card.name}
                                  className="w-full"
                                  size="small"
                                />
                              </div>
                              {/* Botón de ver carta en grande */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCardClick(card);
                                }}
                                className="absolute top-2 right-2 w-6 h-6 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center opacity-100 transition-opacity duration-200 z-10"
                                title="Ver carta en grande"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex justify-center items-center w-full flex-col">
                                      <span
                                        className={`${oswald.className} text-[13px] font-bold mt-2`}
                                      >
                                        {highlightText(card?.code, search)}
                                      </span>
                                      {(() => {
                                        const priceValue = getCardPriceValue(card);
                                        if (priceValue !== null) {
                                          return (
                                            <span className="text-xs font-semibold text-emerald-600 mt-0.5">
                                              {formatCurrency(priceValue)}
                                            </span>
                                          );
                                        }
                                        return (
                                          <span className="text-[10px] font-medium text-gray-400 mt-0.5">
                                            No price
                                          </span>
                                        );
                                      })()}
                                      <span className="text-center text-[13px] line-clamp-1 mt-1">
                                        {highlightText(
                                          card?.sets?.[0]?.set?.title ||
                                            "Sin set",
                                          search
                                        )}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {highlightText(
                                        card?.sets?.[0]?.set?.title ||
                                          "Sin set",
                                        search
                                      )}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        )}

                        {filteredAlts.length > 0 &&
                          filteredAlts.map((alt) => (
                            <div
                              key={alt._id}
                              onClick={() => handleSidebarCardClick(alt)}
                              draggable
                              onDragStart={(e) =>
                                handleDragStart(e, alt, "sidebar")
                              }
                              className={`w-full cursor-pointer max-w-[450px] transition-all duration-200 rounded-lg relative group ${
                                movingCardIds.has(alt.id)
                                  ? "ring-2 ring-blue-500 bg-blue-50"
                                  : ""
                              }`}
                            >
                              <div className="border rounded-lg shadow pb-3 bg-white justify-center items-center flex flex-col relative">
                                <div className="w-full cursor-pointer">
                                  <LazyImage
                                    src={alt.src}
                                    fallbackSrc="/assets/images/backcard.webp"
                                    alt={alt.alias}
                                    className="w-full"
                                    size="small"
                                  />
                                </div>
                                {/* Botón de ver carta en grande */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCardClick(alt);
                                  }}
                                  className="absolute top-2 right-2 w-6 h-6 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center opacity-100 transition-opacity duration-200 z-10"
                                  title="Ver carta en grande"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex justify-center items-center w-full flex-col">
                                        <span
                                          className={`${oswald.className} text-[13px] font-bold mt-2`}
                                        >
                                          {highlightText(card?.code, search)}
                                        </span>
                                        {(() => {
                                          const priceValue = getCardPriceValue(alt);
                                          if (priceValue !== null) {
                                            return (
                                              <span className="text-xs font-semibold text-emerald-600 mt-0.5">
                                                {formatCurrency(priceValue)}
                                              </span>
                                            );
                                          }
                                          return (
                                            <span className="text-[10px] font-medium text-gray-400 mt-0.5">
                                              No price
                                            </span>
                                          );
                                        })()}
                                        <span className="text-center text-[13px] line-clamp-1 mt-1">
                                          {highlightText(
                                            alt?.sets?.[0]?.set?.title ||
                                              "Sin set",
                                            search
                                          )}
                                        </span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        {alt?.sets?.[0]?.set?.title ||
                                          "Sin set"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          ))}
                      </Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {list.isOrdered ? (
            <div className="p-2 sm:p-4 sm:pt-0 sm:pl-0 sm:pr-0 sm:pb-4 h-full">
              <div className="h-full flex flex-col">
                {/* Header con navegación y acciones - Una sola fila */}
                {!isMobile && (
                  <div className="flex items-center justify-between gap-4 flex-shrink-0 mb-4 px-4 pt-4">
                    {/* Botón de regresar y título */}
                    <Button
                      variant="outline"
                      size={isMobile ? "sm" : "lg"}
                      onClick={() => router.push("/lists")}
                      className={`shrink-0 h-11 px-4 text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 border border-input hover:border-gray-300 rounded-md transition-all duration-200 active:scale-95 font-medium flex items-center gap-2 ${
                        isMobile ? "h-11 px-4" : "h-9 px-3"
                      }`}
                    >
                      <ArrowLeft className="h-5 w-5 transition-transform duration-200 hover:-translate-x-1" />
                      {!isMobile && <span>Volver</span>}
                    </Button>

                    {/* Navegación de páginas (centro) */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={navigatePrev}
                        disabled={currentPage <= 0}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      <div className="text-center px-3">
                        <div className="text-sm font-semibold text-slate-900">
                          {currentPage === 0
                            ? "Portada"
                            : `Página ${currentPage}`}
                        </div>
                        <div className="text-xs text-slate-600">
                          {currentPage === 0
                            ? "Cover"
                            : currentPage > getMaxUsedPage()
                            ? "Nueva"
                            : "Existente"}
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={navigateNext}
                        disabled={currentPage >= getMaxNavigablePage()}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Total Folder Value */}
                    {folderTotalValue.totalValue > 0 && (
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-gray-500 font-medium">Valor Total</span>
                        <span className="text-lg font-bold text-emerald-600">
                          {formatCurrency(folderTotalValue.totalValue, folderTotalValue.currency)}
                        </span>
                      </div>
                    )}

                    {/* Listed Median + Menú de opciones */}
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <Button
                          onClick={() => setShowListedMedian((v) => !v)}
                          variant={showListedMedian ? "default" : "outline"}
                          size="sm"
                          className="h-9 gap-1.5 px-2.5 text-xs font-semibold"
                          title="Solo admin: alternar entre Listed Median y Market Price"
                        >
                          {showListedMedian ? "Listed Median" : "Market Price"}
                        </Button>
                      )}
                      <FolderOptionsMenu
                        listId={listId}
                        router={router}
                        onExportCsv={exportListToCsv}
                        onExportZip={downloadImagesZip}
                        zipLoading={zipLoading}
                        onDeleteClick={handleDeleteClick}
                        onRefresh={handleRefreshCards}
                        isRefreshing={isRefreshing}
                        pageTools={{
                          jumpToPageInput,
                          onJumpToPageInputChange: setJumpToPageInput,
                          onJumpToPage: handleJumpToPage,
                          onInsertPage: openInsertPageDialog,
                          canInsertPage: Boolean(isOwner),
                        }}
                        variant="labeled"
                      />
                    </div>
                  </div>
                )}

                {/* New TopBar similar to lists/page.tsx */}
                {isMobile && (
                  <div className="flex items-center justify-between mb-4 p-3 bg-white min-h-0">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => router.push("/lists")}
                      className="shrink-0 h-11 px-4 text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-md transition-all duration-200 active:scale-95 shadow-sm hover:shadow-md font-medium flex items-center gap-2"
                    >
                      <ArrowLeft className="h-5 w-5 transition-transform duration-200 hover:-translate-x-1" />
                    </Button>

                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <h1 className="font-bold text-gray-900 text-xl leading-tight">
                          {list?.name || "Cargando..."}
                        </h1>
                        {/* Total Folder Value for mobile */}
                        {folderTotalValue.totalValue > 0 && (
                          <p className="text-sm font-bold text-emerald-600 mt-1">
                            {formatCurrency(folderTotalValue.totalValue, folderTotalValue.currency)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <Button
                          onClick={() => setShowListedMedian((v) => !v)}
                          variant={showListedMedian ? "default" : "outline"}
                          size="sm"
                          className="h-9 px-2 text-xs font-semibold"
                          title="Solo admin: alternar entre Listed Median y Market Price"
                        >
                          {showListedMedian ? "Listed Median" : "Market Price"}
                        </Button>
                      )}
                      <FolderOptionsMenu
                        listId={listId}
                        router={router}
                        onExportCsv={exportListToCsv}
                        onExportZip={downloadImagesZip}
                        zipLoading={zipLoading}
                        onDeleteClick={handleDeleteClick}
                        onRefresh={handleRefreshCards}
                        isRefreshing={isRefreshing}
                        pageTools={{
                          jumpToPageInput,
                          onJumpToPageInputChange: setJumpToPageInput,
                          onJumpToPage: handleJumpToPage,
                          onInsertPage: openInsertPageDialog,
                          canInsertPage: Boolean(isOwner),
                        }}
                        variant="icon"
                      />
                    </div>
                  </div>
                )}

                {/* Folder Container with navigation logic from page.tsx */}
                {list.isOrdered && (
                  <div
                    className="h-full overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col relative w-full"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    {/* Navigation buttons are now inside BookFlipContainer */}

                    {/* Mobile Page Info - Top (same as page.tsx) */}
                    {folderDimensions.showSinglePage && (
                      <div className="absolute top-4 left-4 right-4 flex justify-center z-10">
                        <div className="bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                          {currentPage === 0
                            ? "Cubierta Interior"
                            : `Página ${currentPage} de ${Math.max(
                                getMaxNavigablePage(),
                                getMaxUsedPage() || 1
                              )}`}
                        </div>
                      </div>
                    )}

                    {/* Mobile navigation buttons are now inside BookFlipContainer */}

                    {/* Folder Container (same structure as page.tsx) */}
                    <div className="flex-1 flex items-center justify-center p-2 sm:p-4 relative min-h-0">
                      <BookFlipContainer
                        name={list.name}
                        color={list.color || "white"}
                        dimensions={folderDimensions}
                        currentPage={currentPage}
                        totalPages={Math.max(
                          getMaxNavigablePage(),
                          getMaxUsedPage() || 1
                        )}
                        maxRows={list.maxRows || 3}
                        maxColumns={list.maxColumns || 3}
                        cardCount={
                          existingCards ? Object.keys(existingCards).length : 0
                        }
                        totalValueLabel={folderTotalLabel || undefined}
                        shareUrl={shareUrl || undefined}
                        createGrid={createGrid}
                        getCardsForPage={getCardsForPage}
                        isEditing={true}
                        onCardClick={handleCardClick}
                        onPositionClick={handlePositionClick}
                        onDragHandlers={{
                          onDragOver: handleDragOver,
                          onDragEnter: handleDragEnter,
                          onDragLeave: handleDragLeave,
                          onDrop: handleDrop,
                        }}
                        onCardDragStart={handleGridCardDragStart}
                        dragOverPosition={dragOverPosition}
                        movingCardIds={movingCardIds}
                        canEditPrice={Boolean(isOwner)}
                        onEditPrice={openPriceEdit}
                        onToggleSold={openSoldEdit}
                        onToggleMove={toggleMovingCard}
                        onRemoveBackcard={toggleBackcardAt}
                        priceField={
                          isAdmin && !showListedMedian ? "marketPrice" : "midPrice"
                        }
                        displayCurrency={list.displayCurrency}
                        exchangeRate={list.exchangeRate}
                        showInteriorPage={true} // add-cards shows interior page for proper synchronization
                        onPageChange={(pageIndex) => {
                          hasUserNavigated.current = true; // Mark that user has manually navigated
                          setCurrentPage(pageIndex);
                          currentPageRef.current = pageIndex;
                        }}
                        onNavigationReady={setNavigationFunctions}
                        // 🔄 Navigation inside folder
                        showNavigationButtons={true}
                        onNavigatePrev={navigatePrev}
                        onNavigateNext={navigateNext}
                        maxNavigablePage={getMaxNavigablePage()}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Clean List Design */
            <div className="p-6 min-h-full bg-gradient-to-br from-slate-50 to-slate-100">
              <div className="max-w-4xl mx-auto">
                {/* Header con navegación y acciones para listas simples - Una sola fila */}
                <div className="flex flex-col gap-3 mb-6">
                  {/* Versión Desktop */}
                  {!isMobile && (
                    <div className="flex items-center justify-between gap-4">
                      {/* Botón de regresar y título */}
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push("/lists")}
                          className="flex items-center gap-2"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Mis Listas
                        </Button>
                        <div className="flex items-center gap-2">
                          <List className="h-5 w-5 text-blue-600" />
                          <h1 className="text-xl font-bold text-slate-900">
                            {list.name}
                          </h1>
                        </div>
                      </div>

                      {/* Información de la lista (centro) */}
                      <div className="text-center">
                        <p className="text-slate-600 font-medium">
                          {simpleListCards.length} cartas en tu lista
                        </p>
                        {/* Total Value for simple lists on desktop */}
                        {folderTotalValue.totalValue > 0 && (
                          <p className="text-lg font-bold text-emerald-600 mt-1">
                            {formatCurrency(folderTotalValue.totalValue, folderTotalValue.currency)}
                          </p>
                        )}
                      </div>

                      {/* Menú de opciones */}
                      <FolderOptionsMenu
                        listId={listId}
                        router={router}
                        onExportCsv={exportListToCsv}
                        onExportZip={downloadImagesZip}
                        zipLoading={zipLoading}
                        onDeleteClick={handleDeleteClick}
                        onRefresh={handleRefreshCards}
                        isRefreshing={isRefreshing}
                        variant="labeled"
                      />
                    </div>
                  )}

                  {/* Versión Móvil - Una sola fila */}
                  {isMobile && (
                    <div className="flex flex-col gap-2">
                      {/* Fila móvil: Todo en una línea */}
                      <div className="flex items-center justify-between gap-1 px-1">
                        {/* Botón de regresar */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push("/lists")}
                          className="p-1"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>

                        {/* Título centrado */}
                        <div className="flex items-center gap-1 flex-1 justify-center">
                          <List className="h-4 w-4 text-blue-600" />
                          <h1 className="text-sm font-bold text-slate-900 truncate">
                            {list.name}
                          </h1>
                        </div>

                        {/* Menú de opciones */}
                        <FolderOptionsMenu
                          listId={listId}
                          router={router}
                          onExportCsv={exportListToCsv}
                          onExportZip={downloadImagesZip}
                          zipLoading={zipLoading}
                          onDeleteClick={handleDeleteClick}
                          onRefresh={handleRefreshCards}
                          isRefreshing={isRefreshing}
                          variant="icon"
                        />
                      </div>

                      {/* Información de la lista en segunda línea móvil */}
                      <div className="text-center">
                        <p className="text-xs text-slate-600">
                          {simpleListCards.length} cartas en tu lista
                        </p>
                        {/* Total Value for simple lists on mobile */}
                        {folderTotalValue.totalValue > 0 && (
                          <p className="text-sm font-bold text-emerald-600 mt-1">
                            {formatCurrency(folderTotalValue.totalValue, folderTotalValue.currency)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Drop Zone / List Container */}
                <div
                  className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-96"
                  onDragOver={handleDragOver}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedCard) {
                      handleSimpleCardAdd(draggedCard.card);
                      setDraggedCard(null);
                    }
                  }}
                >
                  {simpleListCards.length === 0 ? (
                    <div className="flex items-center justify-center min-h-96 text-center">
                      <div className="max-w-md">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Plus className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                          Lista vacía
                        </h3>
                        <p className="text-slate-600 mb-4">
                          Agrega cartas arrastrándolas desde la barra lateral o
                          haciendo click en ellas
                        </p>
                        <div className="text-sm text-slate-500 space-y-1">
                          <p>
                            💡 <strong>Arrastra</strong> una carta aquí
                          </p>
                          <p>
                            📋 <strong>Click</strong> en cartas del sidebar
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6">
                      {/* List Header */}
                      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
                        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                          <Layers className="h-5 w-5 text-blue-600" />
                          Cartas en la lista
                        </h3>
                        <div className="text-sm text-slate-600">
                          Total:{" "}
                          {simpleListCards.reduce(
                            (sum, item) => sum + item.quantity,
                            0
                          )}{" "}
                          cartas
                        </div>
                      </div>

                      {/* Cards Grid */}
                      <div className="grid gap-4">
                        {simpleListCards.map((item) => (
                          <div
                            key={item.card.id}
                            className="group relative flex items-center gap-4 p-4 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                          >
                            {/* Card Image */}
                            <div
                              className="w-20 h-28 flex-shrink-0 cursor-pointer"
                              onClick={() => handleCardClick(item.card)}
                            >
                              <LazyImage
                                src={item.card.src}
                                fallbackSrc="/assets/images/backcard.webp"
                                alt={item.card.name}
                                className="w-full rounded-lg shadow-sm"
                                size="small"
                              />
                            </div>

                            {/* Card Info */}
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => handleCardClick(item.card)}
                            >
                              <h4 className="font-semibold text-slate-900 mb-1 truncate">
                                {item.card.name}
                              </h4>
                              <p className="text-sm text-slate-600 mb-1">
                                {item.card.code}
                              </p>
                              <p className="text-xs text-slate-500">
                                {item.card.set}
                              </p>
                              {item.card.types &&
                                item.card.types.length > 0 && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    {item.card.types
                                      .map((t) => t.type)
                                      .join(", ")}
                                  </p>
                                )}

                              {/* Price Display */}
                              {(() => {
                                const priceValue = getListCardPriceValue(item);
                                if (priceValue !== null) {
                                  return (
                                    <p className="text-sm font-bold text-emerald-600 mt-2">
                                      {formatCurrency(
                                        priceValue,
                                        item.customCurrency ||
                                          item.card.priceCurrency
                                      )}
                                    </p>
                                  );
                                }
                                return null;
                              })()}
                            </div>

                            {/* Quantity Controls */}
                            <div className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 p-2">
                              <button
                                onClick={() =>
                                  handleSimpleQuantityChange(
                                    item.card.id,
                                    item.quantity - 1
                                  )
                                }
                                className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-md text-slate-700 transition-colors"
                              >
                                <Minus className="h-4 w-4" />
                              </button>

                              <span className="w-8 text-center font-semibold text-slate-900">
                                {item.quantity}
                              </span>

                              <button
                                onClick={() =>
                                  handleSimpleQuantityChange(
                                    item.card.id,
                                    item.quantity + 1
                                  )
                                }
                                className="w-8 h-8 flex items-center justify-center bg-blue-50 hover:bg-blue-100 rounded-md text-blue-700 transition-colors"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>

                            {/* Delete Button (appears on hover) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSimpleQuantityChange(item.card.id, 0);
                              }}
                              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                              title="Eliminar carta"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card Modal */}
      {showCardModal && selectedCard && (
        isSimpleModalDon ? (
          <DonModal
            selectedCard={selectedCard}
            setIsOpen={setShowCardModal}
            alternatesCards={alternatesCards}
            setSelectedCard={handleSelectedCardChange}
            baseCard={selectedCard}
          />
        ) : (
          <CardModal
            selectedCard={selectedCard}
            setIsOpen={setShowCardModal}
            alternatesCards={alternatesCards}
            setSelectedCard={handleSelectedCardChange}
            baseCard={selectedCard}
          />
        )
      )}

      {/* Mobile Card Selection Modal */}
      {showMobileCardModal && (
        <Dialog
          open={showMobileCardModal}
          onOpenChange={(open) => {
            setShowMobileCardModal(open);
            if (!open) {
              setTargetPosition(null); // Clear target position on modal close
              clearAddSelection();
              setAddModalTab("cards");
              setSetsTabQuery("");
              setShowAddCardsFiltersDrawer(false);
            }
          }}
        >
          <DialogContent className="w-full h-full sm:w-[1400px] sm:max-w-[95vw] sm:h-[90vh] sm:max-h-[900px] p-0 flex flex-col rounded-none sm:rounded-lg overflow-hidden">
            <DialogHeader className="px-5 py-3 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center justify-between gap-2 pr-6">
                <DialogTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Agregar cartas
                </DialogTitle>
                {targetPosition && typeof targetBackcardImageUrl === "string" && (
                  <button
                    type="button"
                    onClick={async () => {
                      await toggleBackcardAt(targetPosition);
                      setShowMobileCardModal(false);
                    }}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600"
                    title="Quitar el sleeve colocado en esta casilla"
                  >
                    <X className="h-3.5 w-3.5" />
                    Quitar sleeve
                  </button>
                )}
              </div>
            </DialogHeader>

            {/* Filtros en mobile: bottom sheet con pastillas (mismo componente que Card List/Collection/Deck Builder), en desktop viven en la columna izquierda persistente */}
            <MobileFiltersDrawer
              isOpen={showAddCardsFiltersDrawer}
              onClose={() => setShowAddCardsFiltersDrawer(false)}
              selectedColors={selectedColors}
              setSelectedColors={setSelectedColors}
              selectedRarities={selectedRarities}
              setSelectedRarities={setSelectedRarities}
              selectedCategories={selectedCategories}
              setSelectedCategories={setSelectedCategories}
              selectedCounter={selectedCounter}
              setSelectedCounter={setSelectedCounter}
              selectedTrigger={selectedTrigger}
              setSelectedTrigger={setSelectedTrigger}
              selectedEffects={selectedEffects}
              setSelectedEffects={setSelectedEffects}
              selectedTypes={selectedTypes}
              setSelectedTypes={setSelectedTypes}
              selectedSets={selectedSets}
              setSelectedSets={setSelectedSets}
              selectedCosts={selectedCosts}
              setSelectedCosts={setSelectedCosts}
              selectedPower={selectedPower}
              setSelectedPower={setSelectedPower}
              selectedAttributes={selectedAttributes}
              setSelectedAttributes={setSelectedAttributes}
              selectedAltArts={selectedAltArts}
              setSelectedAltArts={setSelectedAltArts}
              selectedCodes={selectedCodes}
              setSelectedCodes={setSelectedCodes}
            />

            {/* Body: filtros (columna izquierda, solo desktop) + grid (centro) + carrito "Seleccionadas" (columna derecha, solo desktop) */}
            <div className="flex flex-1 min-h-0">
              <div className="hidden sm:flex w-64 flex-shrink-0 min-h-0 flex-col">
                <div className="flex border-b border-slate-200 bg-white flex-shrink-0">
                  {(
                    [
                      { key: "cards", label: "Cartas" },
                      { key: "sets", label: "Sets" },
                      { key: "sleeves", label: "Sleeves" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setAddModalTab(tab.key)}
                      className={`flex-1 px-2 py-2 text-xs font-semibold border-b-2 transition-colors ${
                        addModalTab === tab.key
                          ? "border-indigo-500 text-indigo-600"
                          : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 min-h-0 flex">
                  {addModalTab === "cards" && (
                    <FiltersSidebar
                      variant="inline"
                      isOpen={isModalOpen}
                      setIsOpen={setIsModalOpen}
                      search={search}
                      setSearch={setSearch}
                      selectedColors={selectedColors}
                      setSelectedColors={setSelectedColors}
                      selectedRarities={selectedRarities}
                      setSelectedRarities={setSelectedRarities}
                      selectedCategories={selectedCategories}
                      setSelectedCategories={setSelectedCategories}
                      selectedCounter={selectedCounter}
                      setSelectedCounter={setSelectedCounter}
                      selectedTrigger={selectedTrigger}
                      setSelectedTrigger={setSelectedTrigger}
                      selectedEffects={selectedEffects}
                      setSelectedEffects={setSelectedEffects}
                      selectedTypes={selectedTypes}
                      setSelectedTypes={setSelectedTypes}
                      selectedSets={selectedSets}
                      setSelectedSets={setSelectedSets}
                      selectedCosts={selectedCosts}
                      setSelectedCosts={setSelectedCosts}
                      selectedPower={selectedPower}
                      setSelectedPower={setSelectedPower}
                      selectedAttributes={selectedAttributes}
                      setSelectedAttributes={setSelectedAttributes}
                      selectedAltArts={selectedAltArts}
                      setSelectedAltArts={setSelectedAltArts}
                      selectedCodes={selectedCodes}
                      setSelectedCodes={setSelectedCodes}
                    />
                  )}
                  {addModalTab === "sets" && (
                    <div className="flex h-full w-full flex-col bg-white border-r border-slate-200">
                      <div className="px-3 py-2.5 border-b border-slate-200 flex-shrink-0">
                        <input
                          type="text"
                          value={setsTabQuery}
                          onChange={(e) => setSetsTabQuery(e.target.value)}
                          placeholder="Buscar set..."
                          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                        {setOptions
                          .filter((opt) =>
                            opt.label
                              .toLowerCase()
                              .includes(setsTabQuery.toLowerCase())
                          )
                          .map((opt) => {
                            const isActive =
                              selectedSets.length === 1 &&
                              selectedSets[0] === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() =>
                                  setSelectedSets(isActive ? [] : [opt.value])
                                }
                                className={`text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                  isActive
                                    ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300"
                                    : "text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                  {addModalTab === "sleeves" && (
                    <div className="flex h-full w-full flex-col bg-white border-r border-slate-200">
                      <div className="px-3 py-2.5 border-b border-slate-200 flex-shrink-0">
                        <input
                          type="text"
                          value={sleevesTabQuery}
                          onChange={(e) => setSleevesTabQuery(e.target.value)}
                          placeholder="Buscar sleeve..."
                          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 text-xs text-slate-400">
                        Elige un reverso temático para colocarlo en la casilla
                        seleccionada.
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                {addModalTab === "sleeves" ? (
                  <div className="flex-1 overflow-y-auto p-4 min-h-0">
                    {typeof targetBackcardImageUrl === "string" && (
                      <div className="mb-3 flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                        <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded">
                          <LazyImage
                            src={targetBackcardImageUrl}
                            fallbackSrc="/assets/images/backcard.webp"
                            alt="Sleeve actual"
                            className="w-full h-full object-cover"
                            size="small"
                          />
                        </div>
                        <p className="flex-1 text-sm text-indigo-900">
                          Esta casilla ya tiene un sleeve colocado.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-shrink-0 gap-1.5 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={isApplyingSleeve || !targetPosition}
                          onClick={async () => {
                            if (!targetPosition) return;
                            await toggleBackcardAt(targetPosition);
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                          Quitar
                        </Button>
                      </div>
                    )}
                    {isLoadingSleeves ? (
                      <div className="flex items-center justify-center h-full gap-2 text-sm text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando sleeves...
                      </div>
                    ) : sleeveProducts.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-sm text-slate-400">
                        No hay sleeves disponibles
                      </div>
                    ) : (
                      <div className="grid gap-3 grid-cols-3 sm:grid-cols-3 lg:grid-cols-5">
                        {sleeveProducts
                          .filter((p) =>
                            p.name
                              .toLowerCase()
                              .includes(sleevesTabQuery.toLowerCase())
                          )
                          .map((p) => {
                            const qty = cartSleeveItems.find((s) => s.id === p.id)
                              ?.quantity;
                            const canAdd = Boolean(targetPosition && p.imageUrl);
                            return (
                              <div
                                key={p.id}
                                className={cn(
                                  "w-full rounded-lg border overflow-hidden bg-white transition-colors",
                                  qty
                                    ? "border-indigo-500 ring-1 ring-indigo-500"
                                    : "border-slate-200 hover:border-slate-300"
                                )}
                              >
                                <div className="relative p-1.5">
                                  <LazyImage
                                    src={p.imageUrl ?? "/assets/images/backcard.webp"}
                                    fallbackSrc="/assets/images/backcard.webp"
                                    alt={p.name}
                                    className="w-full rounded-md"
                                    size="small"
                                  />
                                  {qty ? (
                                    <>
                                      <div className="absolute inset-1.5 bg-black/30 rounded-md pointer-events-none" />
                                      <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[11px] font-bold min-w-[1.375rem] h-[1.375rem] px-1 rounded-full shadow flex items-center justify-center">
                                        {qty}
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                                <div className="px-2 pb-2 flex flex-col gap-1.5">
                                  <p className="text-xs font-medium text-zinc-700 truncate">
                                    {p.name}
                                  </p>
                                  {qty ? (
                                    <div className="flex items-stretch rounded-md overflow-hidden border border-zinc-300">
                                      <button
                                        onClick={() =>
                                          updateStagedSleeveQuantity(p.id, -1)
                                        }
                                        className="flex-1 flex items-center justify-center py-1.5 hover:bg-zinc-100 transition-colors"
                                      >
                                        <Minus className="h-3.5 w-3.5 text-zinc-600" />
                                      </button>
                                      <span className="flex items-center justify-center min-w-[1.75rem] text-xs font-semibold text-zinc-800">
                                        {qty}
                                      </span>
                                      <button
                                        onClick={() =>
                                          updateStagedSleeveQuantity(p.id, 1)
                                        }
                                        className="flex-1 flex items-center justify-center py-1.5 hover:bg-zinc-100 transition-colors"
                                      >
                                        <Plus className="h-3.5 w-3.5 text-zinc-600" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      disabled={!canAdd}
                                      onClick={() =>
                                        canAdd &&
                                        handleSleevePick({
                                          id: p.id,
                                          name: p.name,
                                          imageUrl: p.imageUrl!,
                                        })
                                      }
                                      className="flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-[11px] font-medium py-1.5 rounded-md transition-colors disabled:opacity-50"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      Agregar
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                <div className="px-4 py-3 border-b border-[#f5f5f5] bg-white flex items-center gap-2 flex-shrink-0">
                  <div className="sm:hidden">
                    <FiltersButton
                      totalFilters={totalFilters}
                      onOpenFilters={() => setShowAddCardsFiltersDrawer(true)}
                      isTouchable={
                        selectedColors.length > 0 ||
                        selectedRarities.length > 0 ||
                        selectedCategories.length > 0 ||
                        selectedCounter !== "" ||
                        selectedTrigger !== "" ||
                        selectedEffects.length > 0 ||
                        selectedTypes.length > 0 ||
                        selectedSets.length > 0 ||
                        selectedCosts.length > 0 ||
                        selectedPower.length > 0 ||
                        selectedAttributes.length > 0 ||
                        selectedCodes.length > 0 ||
                        selectedAltArts.length > 0
                      }
                      onClearFilters={clearAllFilters}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <DropdownSearch
                      search={search}
                      setSearch={setSearch}
                      placeholder="Search..."
                      suggestionsEndpoint="/api/cards/search-suggestions"
                    />
                  </div>
                  <ViewSwitch
                    viewSelected={viewSelected}
                    setViewSelected={setViewSelected}
                    isImages={false}
                  />
                </div>

                {addModalTab === "sets" && selectedSets.length > 0 && (
                  <div className="px-4 py-2 border-b border-[#f5f5f5] bg-indigo-50 flex items-center justify-between flex-shrink-0 gap-2">
                    <p className="text-sm text-indigo-900 min-w-0 truncate">
                      <span className="font-semibold">
                        {setOptions.find((o) => o.value === selectedSets[0])
                          ?.label ?? selectedSets[0]}
                      </span>
                      {" — "}
                      {allFilteredCards.length} carta
                      {allFilteredCards.length !== 1 ? "s" : ""}
                    </p>
                    <Button
                      size="sm"
                      className="flex-shrink-0"
                      disabled={allFilteredCards.length === 0}
                      onClick={() => handleAddAllFromSet(allFilteredCards)}
                    >
                      Agregar todas
                    </Button>
                  </div>
                )}

                {/* Content area */}
                <div
                  className="flex-1 overflow-y-auto p-4 min-h-0"
                  ref={mobileModalScrollRef}
                >
                  {/* Carrito inline: solo en mobile, en desktop vive en la columna derecha */}
                  {cartCardItems.length > 0 && (
                    <div className="sm:hidden mb-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-indigo-900">
                          Seleccionadas (
                          {cartCardItems.reduce((sum, s) => sum + s.quantity, 0)})
                        </p>
                        <button
                          onClick={clearAddSelection}
                          className="text-xs font-medium text-indigo-600 hover:underline"
                        >
                          Limpiar
                        </button>
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {cartCardItems.map((s) => (
                          <div
                            key={s.card.id}
                            className="flex items-center gap-2 bg-white rounded-md p-1.5 border border-indigo-100"
                          >
                            <div className="w-6 h-8 flex-shrink-0">
                              <LazyImage
                                src={s.card.src}
                                fallbackSrc="/assets/images/backcard.webp"
                                alt={s.card.name}
                                className="w-full rounded"
                                size="small"
                              />
                            </div>
                            <span className="flex-1 min-w-0 text-xs font-medium text-gray-800 truncate">
                              {s.card.name}
                            </span>
                            <button
                              onClick={() => updateAddSelectionQuantity(s.card.id, -1)}
                              className="h-6 w-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-5 text-center text-xs font-semibold">
                              {s.quantity}
                            </span>
                            <button
                              onClick={() => updateAddSelectionQuantity(s.card.id, 1)}
                              className="h-6 w-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => removeFromAddSelection(s.card.id)}
                              className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Selected Card(s) Indicator */}
              {movingCards.length > 0 && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    {movingCards.length === 1 ? (
                      <div className="w-8 h-11 flex-shrink-0">
                        <LazyImage
                          src={movingCards[0].card.src}
                          fallbackSrc="/assets/images/backcard.webp"
                          alt={movingCards[0].card.name}
                          className="w-full rounded border"
                          priority={true}
                          size="small"
                        />
                      </div>
                    ) : (
                      <div className="w-8 h-11 flex-shrink-0 rounded border border-blue-300 bg-blue-100 flex items-center justify-center text-blue-800 font-bold text-sm">
                        {movingCards.length}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-900 truncate">
                        {movingCards.length === 1
                          ? movingCards[0].card.name
                          : `${movingCards.length} cartas seleccionadas`}
                      </p>
                      <p className="text-xs text-blue-700">
                        {movingCards.length === 1
                          ? "Moviendo esta carta — toca la casilla destino"
                          : "Toca la casilla inicial: se acomodan en ese orden"}
                      </p>
                    </div>
                    <button
                      onClick={cancelMovingCards}
                      className="p-1 hover:bg-blue-100 rounded-full"
                    >
                      <X className="h-4 w-4 text-blue-600" />
                    </button>
                  </div>
                </div>
              )}


                  {addModalTab === "sets" && selectedSets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-sm text-slate-400 gap-2 py-16">
                      <Package className="h-8 w-8 text-slate-300" />
                      Elige un set a la izquierda para ver sus cartas
                    </div>
                  ) : (
                    <>
                  {viewSelected === "text" && (
                    <div className="grid gap-3 grid-cols-1 justify-items-center">
                      {cardListFilteredCards?.map((card) => (
                        <Fragment key={card._id}>
                          <div
                            className={`w-full cursor-pointer max-w-[450px] transition-all duration-200 rounded-lg ${
                              cartCardItems.some((s) => s.card.id === card.id)
                                ? "ring-2 ring-indigo-500"
                                : ""
                            }`}
                            onClick={() => {
                              handleMobileCardPick(card);
                            }}
                          >
                            <div onClick={(e) => e.stopPropagation()}>
                              <StoreCard
                                card={card}
                                searchTerm={search}
                                viewSelected={viewSelected}
                                selectedRarities={selectedRarities}
                                selectedSets={selectedSets}
                                setSelectedCard={setSelectedCard}
                                setBaseCard={setBaseCard}
                                setAlternatesCards={setAlternatesCards}
                                setIsOpen={setIsOpen}
                                onClick={() => {
                                  handleMobileCardPick(card);
                                }}
                              />
                            </div>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  )}

                  {viewSelected === "list" && (
                    <div className="grid gap-1.5 grid-cols-3 sm:grid-cols-3 lg:grid-cols-5">
                      {cardListFilteredCards?.map((card) => {
                        const baseMatches = baseCardMatches(
                          card,
                          selectedSets,
                          selectedAltArts
                        );
                        const filteredAlts = getFilteredAlternates(
                          card,
                          selectedSets,
                          selectedAltArts
                        );

                        if (!baseMatches && filteredAlts.length === 0)
                          return null;

                        return (
                          <Fragment key={card._id}>
                            {baseMatches &&
                              (() => {
                                const qty = cartCardItems.find(
                                  (s) => s.card.id === card.id
                                )?.quantity;
                                return (
                                  <div
                                    className={cn(
                                      "w-full rounded-lg border overflow-hidden bg-white transition-colors",
                                      qty
                                        ? "border-indigo-500 ring-1 ring-indigo-500"
                                        : "border-slate-200 hover:border-slate-300"
                                    )}
                                  >
                                    <div
                                      className="relative p-1.5 cursor-pointer"
                                      onClick={() => handleMobileCardPick(card)}
                                    >
                                      <LazyImage
                                        src={card.src}
                                        fallbackSrc="/assets/images/backcard.webp"
                                        alt={card.name}
                                        className="w-full rounded-md"
                                        size="small"
                                      />
                                      {qty ? (
                                        <>
                                          <div className="absolute inset-1.5 bg-black/30 rounded-md pointer-events-none" />
                                          <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[11px] font-bold min-w-[1.375rem] h-[1.375rem] px-1 rounded-full shadow flex items-center justify-center">
                                            {qty}
                                          </div>
                                        </>
                                      ) : null}
                                    </div>
                                    <div className="px-2 pb-2 flex flex-col gap-1.5">
                                      <div className="min-w-0 flex flex-col">
                                        <p
                                          className={`${oswald.className} text-xs font-bold text-zinc-800 truncate`}
                                        >
                                          {highlightText(card?.code, search)}
                                        </p>
                                        <p className="text-[10px] text-zinc-500 truncate">
                                          {highlightText(
                                            card?.sets?.[0]?.set?.title ||
                                              "Sin set",
                                            search
                                          )}
                                        </p>
                                      </div>
                                      {qty ? (
                                        <div className="flex items-stretch rounded-md overflow-hidden border border-zinc-300">
                                          <button
                                            onClick={() =>
                                              updateAddSelectionQuantity(
                                                card.id,
                                                -1
                                              )
                                            }
                                            className="flex-1 flex items-center justify-center py-1.5 hover:bg-zinc-100 transition-colors"
                                          >
                                            <Minus className="h-3.5 w-3.5 text-zinc-600" />
                                          </button>
                                          <span className="flex items-center justify-center min-w-[1.75rem] text-xs font-semibold text-zinc-800">
                                            {qty}
                                          </span>
                                          <button
                                            onClick={() =>
                                              updateAddSelectionQuantity(
                                                card.id,
                                                1
                                              )
                                            }
                                            className="flex-1 flex items-center justify-center py-1.5 hover:bg-zinc-100 transition-colors"
                                          >
                                            <Plus className="h-3.5 w-3.5 text-zinc-600" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => handleMobileCardPick(card)}
                                          className="flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-[11px] font-medium py-1.5 rounded-md transition-colors"
                                        >
                                          <Plus className="h-3.5 w-3.5" />
                                          Agregar
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}

                            {filteredAlts.length > 0 &&
                              filteredAlts.map((alt) => {
                                const altQty = cartCardItems.find(
                                  (s) => s.card.id === alt.id
                                )?.quantity;
                                return (
                                  <div
                                    key={alt._id}
                                    className={cn(
                                      "w-full rounded-lg border overflow-hidden bg-white transition-colors",
                                      altQty
                                        ? "border-indigo-500 ring-1 ring-indigo-500"
                                        : "border-slate-200 hover:border-slate-300"
                                    )}
                                  >
                                    <div
                                      className="relative p-1.5 cursor-pointer"
                                      onClick={() => handleMobileCardPick(alt)}
                                    >
                                      <LazyImage
                                        src={alt.src}
                                        fallbackSrc="/assets/images/backcard.webp"
                                        alt={alt.alias}
                                        className="w-full rounded-md"
                                        size="small"
                                      />
                                      {altQty ? (
                                        <>
                                          <div className="absolute inset-1.5 bg-black/30 rounded-md pointer-events-none" />
                                          <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[11px] font-bold min-w-[1.375rem] h-[1.375rem] px-1 rounded-full shadow flex items-center justify-center">
                                            {altQty}
                                          </div>
                                        </>
                                      ) : null}
                                    </div>
                                    <div className="px-2 pb-2 flex flex-col gap-1.5">
                                      <div className="min-w-0 flex flex-col">
                                        <p
                                          className={`${oswald.className} text-xs font-bold text-zinc-800 truncate`}
                                        >
                                          {highlightText(card?.code, search)}
                                        </p>
                                        <p className="text-[10px] text-zinc-500 truncate">
                                          {alt?.sets?.[0]?.set?.title || "Sin set"}
                                        </p>
                                      </div>
                                      {altQty ? (
                                        <div className="flex items-stretch rounded-md overflow-hidden border border-zinc-300">
                                          <button
                                            onClick={() =>
                                              updateAddSelectionQuantity(alt.id, -1)
                                            }
                                            className="flex-1 flex items-center justify-center py-1.5 hover:bg-zinc-100 transition-colors"
                                          >
                                            <Minus className="h-3.5 w-3.5 text-zinc-600" />
                                          </button>
                                          <span className="flex items-center justify-center min-w-[1.75rem] text-xs font-semibold text-zinc-800">
                                            {altQty}
                                          </span>
                                          <button
                                            onClick={() =>
                                              updateAddSelectionQuantity(alt.id, 1)
                                            }
                                            className="flex-1 flex items-center justify-center py-1.5 hover:bg-zinc-100 transition-colors"
                                          >
                                            <Plus className="h-3.5 w-3.5 text-zinc-600" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => handleMobileCardPick(alt)}
                                          className="flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-[11px] font-medium py-1.5 rounded-md transition-colors"
                                        >
                                          <Plus className="h-3.5 w-3.5" />
                                          Agregar
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </Fragment>
                        );
                      })}
                    </div>
                  )}
                    </>
                  )}
                </div>
                  </>
                )}
              </div>

              {/* Columna derecha: carrito "Seleccionadas" (solo desktop) — cartas y sleeves juntos, persiste al cambiar de pestaña */}
              <div className="hidden sm:flex w-72 flex-shrink-0 border-l border-slate-200 flex-col min-h-0">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                  <p className="text-sm font-semibold text-zinc-900">
                    Seleccionadas (
                    {cartCardItems.reduce((sum, s) => sum + s.quantity, 0) +
                      cartSleeveItems.reduce((sum, s) => sum + s.quantity, 0)}
                    )
                  </p>
                  {(cartCardItems.length > 0 || cartSleeveItems.length > 0) && (
                    <button
                      onClick={clearAddSelection}
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                  {cartCardItems.length === 0 && cartSleeveItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4 py-10">
                      <Package className="h-8 w-8 text-zinc-300 mb-2" />
                      <p className="text-xs text-zinc-400">
                        Las cartas o los sleeves que elijas aparecerán aquí
                      </p>
                    </div>
                  ) : (
                    cartItems.map((item) =>
                      item.kind === "sleeve" ? (
                        <div
                          key={`sleeve-${item.id}`}
                          className="flex items-center gap-2 bg-white rounded-md p-1.5 border border-indigo-200"
                        >
                          <div className="w-8 h-11 flex-shrink-0 overflow-hidden rounded">
                            <LazyImage
                              src={item.imageUrl}
                              fallbackSrc="/assets/images/backcard.webp"
                              alt={item.name}
                              className="w-full h-full object-cover"
                              size="small"
                            />
                          </div>
                          <span className="flex-1 min-w-0 text-xs font-medium text-gray-800 truncate">
                            {item.name}
                          </span>
                          <button
                            onClick={() => updateStagedSleeveQuantity(item.id, -1)}
                            className="h-6 w-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateStagedSleeveQuantity(item.id, 1)}
                            className="h-6 w-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => removeStagedSleeve(item.id)}
                            className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div
                          key={item.card.id}
                          className="flex items-center gap-2 bg-white rounded-md p-1.5 border border-zinc-200"
                        >
                          <div className="w-8 h-11 flex-shrink-0">
                            <LazyImage
                              src={item.card.src}
                              fallbackSrc="/assets/images/backcard.webp"
                              alt={item.card.name}
                              className="w-full rounded"
                              size="small"
                            />
                          </div>
                          <span className="flex-1 min-w-0 text-xs font-medium text-gray-800 truncate">
                            {item.card.name}
                          </span>
                          <button
                            onClick={() =>
                              updateAddSelectionQuantity(item.card.id, -1)
                            }
                            className="h-6 w-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateAddSelectionQuantity(item.card.id, 1)
                            }
                            className="h-6 w-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => removeFromAddSelection(item.card.id)}
                            className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>
            </div>

            {(cartCardItems.length > 0 || cartSleeveItems.length > 0) && (
              <div className="border-t border-slate-200 p-3 bg-white flex justify-end flex-shrink-0">
                <Button
                  onClick={handleConfirmCart}
                  disabled={isAddingBatch || isApplyingSleeve}
                  className="gap-2"
                >
                  {isAddingBatch || isApplyingSleeve ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {(() => {
                    const cardQty = cartCardItems.reduce(
                      (sum, s) => sum + s.quantity,
                      0
                    );
                    const sleeveQty = cartSleeveItems.reduce(
                      (sum, s) => sum + s.quantity,
                      0
                    );
                    const parts = [];
                    if (cardQty > 0)
                      parts.push(`${cardQty} carta${cardQty !== 1 ? "s" : ""}`);
                    if (sleeveQty > 0)
                      parts.push(
                        `${sleeveQty} sleeve${sleeveQty !== 1 ? "s" : ""}`
                      );
                    return `Agregar ${parts.join(" y ")}`;
                  })()}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Mobile Price Drawer */}
      <BaseDrawer
        isOpen={priceDrawerOpen}
        onClose={() => {
          if (!isPriceSaving) {
            setPriceDrawerOpen(false);
            setPriceDraft(null);
            setTargetPosition(null);
          }
        }}
        maxHeight="85vh"
        showHandle
      >
        <div className="px-5 pb-6 pt-3">
          {priceDraft && (
            <>
              <div className="flex items-center gap-3">
                <div className="h-16 w-12 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  <LazyImage
                    src={priceDraft.card.src}
                    fallbackSrc="/assets/images/backcard.webp"
                    alt={priceDraft.card.name}
                    className="h-full w-full object-cover"
                    size="small"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {priceDraft.card.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {priceDraft.card.code}
                  </p>
                  <p className="text-xs text-emerald-600 font-semibold mt-1">
                    TCG:{" "}
                    {(() => {
                      const marketPrice = getCardPriceValue(priceDraft.card);
                      return marketPrice !== null
                        ? formatCurrency(
                            marketPrice,
                            priceDraft.card.priceCurrency
                          )
                        : "Sin precio";
                    })()}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Tu precio
                    </p>
                    <p className="text-xs text-slate-500">
                      Se mostrara en tu carpeta y venta.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[11px]">
                    {priceCurrency}
                  </Badge>
                </div>

                <div className="relative">
                  <Input
                    value={priceInput}
                    onChange={(event) => setPriceInput(event.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="h-11 text-base font-semibold pl-10"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                    $
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="text-xs"
                    onClick={() => {
                      const marketPrice = getCardPriceValue(priceDraft.card);
                      if (marketPrice !== null) {
                        setPriceInput(marketPrice.toFixed(2));
                      }
                    }}
                  >
                    Usar precio TCG
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs text-slate-500"
                    onClick={() => setPriceInput("")}
                  >
                    Sin precio
                  </Button>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPriceDrawerOpen(false);
                    setPriceDraft(null);
                    setTargetPosition(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmPrice}
                  disabled={isPriceSaving}
                  className="bg-slate-900 text-white hover:bg-slate-800"
                >
                  {isPriceSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Agregar carta"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </BaseDrawer>

      {/* Insertar página en blanco */}
      <Dialog open={insertPageOpen} onOpenChange={setInsertPageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insertar página en blanco</DialogTitle>
            <DialogDescription>
              Las páginas siguientes se recorren una posición — ninguna carta
              se pierde ni cambia de página relativa.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Insertar después de la página #
            </label>
            <Input
              value={insertAfterPageInput}
              onChange={(e) => setInsertAfterPageInput(e.target.value)}
              placeholder="Ej. 3"
              inputMode="numeric"
            />
            <p className="mt-1 text-xs text-gray-500">
              Usa 0 para insertarla antes de la página 1.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setInsertPageOpen(false)}
              disabled={isInsertingPage}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmInsertPage}
              disabled={isInsertingPage}
            >
              {isInsertingPage ? "Insertando..." : "Insertar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Custom Price */}
      {isMobile ? (
        <BaseDrawer
          isOpen={priceEditOpen}
          onClose={() => {
            if (!isPriceEditSaving) {
              setPriceEditOpen(false);
            }
          }}
          preventClose={isPriceEditSaving}
          maxHeight="70vh"
        >
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Editar precio</h3>
                <p className="text-sm text-gray-500">
                  {priceEditCard?.name ?? "Carta seleccionada"}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio personalizado
                </label>
                <Input
                  value={priceEditInput}
                  onChange={(e) => setPriceEditInput(e.target.value)}
                  placeholder="Ej. 12.50"
                  inputMode="decimal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Moneda
                </label>
                <Input
                  value={priceEditCurrency}
                  onChange={(e) => setPriceEditCurrency(e.target.value)}
                  placeholder="USD"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPriceEditOpen(false)}
                disabled={isPriceEditSaving}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
                onClick={handleSaveCustomPrice}
                disabled={isPriceEditSaving}
              >
                {isPriceEditSaving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </BaseDrawer>
      ) : (
        <Dialog open={priceEditOpen} onOpenChange={setPriceEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar precio</DialogTitle>
              <DialogDescription>
                {priceEditCard?.name ?? "Carta seleccionada"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio personalizado
                </label>
                <Input
                  value={priceEditInput}
                  onChange={(e) => setPriceEditInput(e.target.value)}
                  placeholder="Ej. 12.50"
                  inputMode="decimal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Moneda
                </label>
                <Input
                  value={priceEditCurrency}
                  onChange={(e) => setPriceEditCurrency(e.target.value)}
                  placeholder="USD"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setPriceEditOpen(false)}
                disabled={isPriceEditSaving}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveCustomPrice}
                disabled={isPriceEditSaving}
              >
                {isPriceEditSaving ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Mark as Sold / Available */}
      {isMobile ? (
        <BaseDrawer
          isOpen={soldEditOpen}
          onClose={() => {
            if (!isSoldEditSaving) {
              setSoldEditOpen(false);
            }
          }}
          preventClose={isSoldEditSaving}
          maxHeight="70vh"
        >
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <Tag className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {soldEditListCard?.isSold
                    ? "Marcar como disponible"
                    : "Marcar como vendida"}
                </h3>
                <p className="text-sm text-gray-500">
                  {soldEditCard?.name ?? "Carta seleccionada"}
                </p>
              </div>
            </div>

            {soldEditListCard?.isSold ? (
              <p className="text-sm text-gray-600">
                Esta carta se mostrará de nuevo con su color normal y
                disponible para la venta.
              </p>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio de venta
                </label>
                <Input
                  value={soldEditPriceInput}
                  onChange={(e) => setSoldEditPriceInput(e.target.value)}
                  placeholder="Ej. 12.50"
                  inputMode="decimal"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSoldEditOpen(false)}
                disabled={isSoldEditSaving}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
                onClick={() =>
                  handleToggleSoldStatus(!soldEditListCard?.isSold)
                }
                disabled={isSoldEditSaving}
              >
                {isSoldEditSaving
                  ? "Guardando..."
                  : soldEditListCard?.isSold
                    ? "Marcar disponible"
                    : "Marcar vendida"}
              </Button>
            </div>
          </div>
        </BaseDrawer>
      ) : (
        <Dialog open={soldEditOpen} onOpenChange={setSoldEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {soldEditListCard?.isSold
                  ? "Marcar como disponible"
                  : "Marcar como vendida"}
              </DialogTitle>
              <DialogDescription>
                {soldEditCard?.name ?? "Carta seleccionada"}
              </DialogDescription>
            </DialogHeader>
            {soldEditListCard?.isSold ? (
              <p className="text-sm text-gray-600">
                Esta carta se mostrará de nuevo con su color normal y
                disponible para la venta.
              </p>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio de venta
                </label>
                <Input
                  value={soldEditPriceInput}
                  onChange={(e) => setSoldEditPriceInput(e.target.value)}
                  placeholder="Ej. 12.50"
                  inputMode="decimal"
                />
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setSoldEditOpen(false)}
                disabled={isSoldEditSaving}
              >
                Cancelar
              </Button>
              <Button
                onClick={() =>
                  handleToggleSoldStatus(!soldEditListCard?.isSold)
                }
                disabled={isSoldEditSaving}
              >
                {isSoldEditSaving
                  ? "Guardando..."
                  : soldEditListCard?.isSold
                    ? "Marcar disponible"
                    : "Marcar vendida"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Card Details Modal */}
      <Transition appear show={isOpen} as={Fragment}>
        <HeadlessDialog
          as="div"
          className="relative z-50"
          onClose={() => {
            if (showLargeImage) {
            } else {
              setIsOpen(false);
            }
          }}
        >
          <div
            className={`fixed inset-0 flex w-screen items-center justify-center p-4 transition-all duration-500 ease-in-out ${
              isCardFetching ? "" : " bg-black/60"
            }`}
          >
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave=""
              leaveFrom=""
              leaveTo=""
            >
              <DialogPanel
                className={`w-full max-w-4xl space-y-4 bg-white shadow-xl border transform transition-all rounded-lg`}
              >
                {primaryModalBaseCard ? (
                  isPrimaryModalDon ? (
                    <DonModal
                      key={primaryModalKey}
                      selectedCard={selectedCard ?? undefined}
                      setIsOpen={setIsOpen}
                      alternatesCards={alternatesCards}
                      setSelectedCard={handleSelectedCardChange}
                      baseCard={primaryModalBaseCard}
                    />
                  ) : (
                    <CardModal
                      key={primaryModalKey}
                      selectedCard={selectedCard ?? undefined}
                      setIsOpen={setIsOpen}
                      alternatesCards={alternatesCards}
                      setSelectedCard={handleSelectedCardChange}
                      baseCard={primaryModalBaseCard}
                      isCardFetching={isCardFetching}
                      setShowLargeImage={setShowLargeImage}
                      showLargeImage={showLargeImage}
                    />
                  )
                ) : null}
              </DialogPanel>
            </TransitionChild>
          </div>
        </HeadlessDialog>
      </Transition>

      {/* Large Image Modal */}
      {showLargeImage && selectedCard && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-[999999] px-5 overflow-auto"
          onClick={() => {
            setShowLargeImage(false);
          }}
          onTouchEnd={() => {
            setShowLargeImage(false);
          }}
        >
          <div className="w-full max-w-3xl">
            <div className="text-white text-xl lg:text-2xl font-[400] text-center py-2 px-5">
              Tap to close
            </div>
            <div className="flex flex-col items-center gap-3 px-5 mb-3">
              <img
                src={selectedCard.src}
                className="max-w-full max-h-[calc(100dvh-200px)] object-contain rounded-lg shadow-2xl"
                alt={selectedCard.name}
              />
              <div className="text-white text-lg font-[400] text-center px-5">
                <span className={`${oswald.className} font-[500]`}>
                  {selectedCard.code}
                </span>
                <br />
                <span>{selectedCard.sets?.[0]?.set?.title || selectedCard.set}</span>
                {(() => {
                  const priceValue = getCardPriceValue(selectedCard);
                  if (priceValue !== null) {
                    return (
                      <>
                        <br />
                        <span className="inline-block mt-3 px-6 py-3 bg-emerald-600 text-white text-xl font-bold rounded-lg shadow-lg">
                          {formatCurrency(priceValue, selectedCard.priceCurrency)}
                        </span>
                      </>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete List Modal */}
      <DeleteListModal
        list={list}
        isOpen={deleteModalOpen}
        setIsOpen={setDeleteModalOpen}
        onConfirm={handleDeleteConfirm}
        isDeleting={deletingId !== null}
      />
    </div>
  );
};

export default AddCardsPage;
