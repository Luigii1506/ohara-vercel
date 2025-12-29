"use client";

import React, { useState, useEffect, Fragment, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Grid3X3,
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
  RotateCcw,
  RefreshCw,
  Save,
  Eye,
  Trash2,
  Edit3,
  Layout,
  Package,
  AlertCircle,
  Info,
  FolderOpen,
  BookOpen,
  Layers,
  Filter,
  SortAsc,
  Share2,
  Cog,
  MoreVertical,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  MainContentSkeleton,
  CardsSidebarSkeleton,
} from "@/components/skeletons";
import { CardWithCollectionData } from "@/types";
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
import SearchFilters from "@/components/home/SearchFilters";
import DropdownSearch from "@/components/DropdownSearch";
import FiltersSidebar from "@/components/FiltersSidebar";
import ViewSwitch from "@/components/ViewSwitch";
import { Option } from "@/components/MultiSelect";
import ClearFiltersButton from "@/components/ClearFiltersButton";
import { useRegion } from "@/components/region/RegionProvider";
import FAB from "@/components/Fab";
import StoreCard from "@/components/StoreCard";
import { DON_CATEGORY } from "@/helpers/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { highlightText } from "@/helpers/functions";
import { rarityFormatter } from "@/helpers/formatters";
import Alternates from "@/public/assets/images/variantsICON_VERTICAL.svg";
import { sortByCollectionOrder } from "@/lib/cards/sort";
import LazyImage from "@/components/LazyImage";

const oswald = Oswald({
  weight: ["200", "300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

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
  isOrdered: boolean;
  isCollection: boolean;
  maxRows: number | null;
  maxColumns: number | null;
  totalPages: number;
  color: string | null;
}

interface SimpleListCard {
  card: CardWithCollectionData;
  quantity: number;
  customPrice?: number | string | null;
  customCurrency?: string | null;
}

interface OrderedListChange {
  id: string;
  type: "add" | "remove" | "change";
  position: { page: number; row: number; column: number };
  card?: CardWithCollectionData;
  previousCard?: any;
}

// Mobile Action Menu Component
const MobileActionMenu = ({
  list,
  listId,
  router,
  onDeleteClick,
}: {
  list: UserList | null;
  listId: string;
  router: any;
  onDeleteClick: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        size="lg"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="h-11 px-4 text-black hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-md transition-all duration-200 active:scale-95 shadow-sm hover:shadow-md font-medium text-base flex items-center gap-2"
      >
        Opciones
        <MoreVertical className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" />
      </Button>

      {isOpen && (
        <>
          {/* Overlay to close menu when clicking outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 top-12 z-50 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
            <div
              onClick={() => {
                router.push(`/lists/${listId}`);
                setIsOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors cursor-pointer"
            >
              <Eye className="h-4 w-4" />
              <span>Ver lista</span>
            </div>

            <div
              onClick={() => {
                router.push(`/lists/${listId}/edit`);
                setIsOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer"
            >
              <Cog className="h-4 w-4" />
              <span>Configurar</span>
            </div>

            <div
              onClick={() => {
                const url = window.location.href.replace("/add-cards", "");
                navigator.clipboard.writeText(url);
                toast.success("Enlace copiado");
                setIsOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors cursor-pointer"
            >
              <Share2 className="h-4 w-4" />
              <span>Compartir</span>
            </div>

            <div className="border-t border-gray-100 my-1" />
            <div
              onClick={() => {
                onDeleteClick();
                setIsOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Eliminar</span>
            </div>
          </div>
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
  const params = useParams();
  const router = useRouter();
  const listId = params.id as string;
  const { region } = useRegion();

  // Core state
  const [list, setList] = useState<UserList | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableCards, setAvailableCards] = useState<
    CardWithCollectionData[]
  >([]);
  const [currentPage, setCurrentPage] = useState(0); // Sync with BookFlipContainer initial state

  const [simpleListCards, setSimpleListCards] = useState<SimpleListCard[]>([]);
  const [pendingChanges, setPendingChanges] = useState<OrderedListChange[]>([]);
  const [existingCards, setExistingCards] = useState<any>({});
  const [draggedCard, setDraggedCard] = useState<DraggedCard | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<{
    page: number;
    row: number;
    column: number;
  } | null>(null);
  const [selectedCardForPlacement, setSelectedCardForPlacement] =
    useState<CardWithCollectionData | null>(null);

  // 🎴 Backcard state - Almacena las posiciones que tienen imagen de backcard
  const [backcardPositions, setBackcardPositions] = useState<Set<string>>(
    new Set()
  );

  // List/Folder state
  const [windowSize, setWindowSize] = useState({ width: 1920, height: 1080 });

  // Drag and drop state
  const [selectedCard, setSelectedCard] =
    useState<CardWithCollectionData | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [alternatesCards, setAlternatesCards] = useState<
    CardWithCollectionData[]
  >([]);

  // Mobile card selection modal
  const [showMobileCardModal, setShowMobileCardModal] = useState(false);

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

  // Refs for card-list functionality
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mobileModalScrollRef = useRef<HTMLDivElement>(null);

  // ✅ Obtener todas las cartas usando el mismo sistema que deckbuilder y proxies
  const cachedCards = useCardStore((state) => state.allCards);
  const setAllCards = useCardStore((state) => state.setAllCards);
  const isFullyLoaded = useCardStore((state) => state.isFullyLoaded);
  const setIsFullyLoaded = useCardStore((state) => state.setIsFullyLoaded);
  const allCardsSignatureRef = useRef<string | null>(null);

  // Filtros vacíos para traer TODAS las cartas
  const fullQueryFilters = useMemo<CardsFilters>(
    () => ({ region }),
    [region]
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

  // ✅ Guardar en Zustand cuando lleguen las cartas
  useEffect(() => {
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
  }, [allCardsData, isFetchingAllCards, setAllCards, setIsFullyLoaded]);

  // ✅ Usar cachedCards si existen, sino allCardsData
  const cards = cachedCards.length > 0 ? cachedCards : allCardsData ?? [];
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

  const fetchList = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/lists/${listId}?limit=0`);
      if (response.ok) {
        const data = await response.json();
        setList(data.list || data); // Handle both data.list and data formats
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

  // 🎴 Función para cargar backcards desde la base de datos
  const fetchBackcards = async () => {
    try {
      const response = await fetch(`/api/lists/${listId}/backcards`);
      if (response.ok) {
        const backcards = await response.json();
        // Convertir array de backcards a Set de strings
        const backcardsSet = new Set<string>(
          backcards.map((b: any) => `${b.page}-${b.row}-${b.column}`)
        );
        setBackcardPositions(backcardsSet);
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

  // Helper functions for price handling
  const getNumericPrice = (value: any) => {
    if (value === null || value === undefined || value === "") return null;
    const numberValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  };

  const getCardPriceValue = (card: CardWithCollectionData) => {
    return (
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

  const formatCurrency = (value: number, currency?: string | null) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(value);

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

  const handleMobileCardPick = (card: CardWithCollectionData) => {
    if (targetPosition) {
      openPriceDrawer(card, { position: targetPosition });
    } else {
      setSelectedCardForPlacement(card);
    }
    setShowMobileCardModal(false);
  };

  const parsePriceValue = (value: string) => {
    const cleaned = value.replace(/,/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
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
  }, [existingCards, simpleListCards, list?.isOrdered]);

  const matchesCardCode = (code: string, search: string) => {
    const query = search.toLowerCase().trim();
    const fullCode = code.toLowerCase();

    // Si el query incluye un guión, se busca de forma literal.
    if (query.includes("-")) {
      return fullCode.includes(query);
    }

    // Separamos el código en partes usando el guión.
    const parts = code.split("-");

    // Si el query es numérico.
    if (/^\d+$/.test(query)) {
      if (query[0] === "0") {
        // Si inicia con cero, se compara la cadena exacta.
        return parts.some((part) => {
          const matchDigits = part.match(/\d+/);
          return matchDigits ? matchDigits[0] === query : false;
        });
      } else {
        // Si no inicia con cero, se compara numéricamente.
        const queryNumber = parseInt(query, 10);
        return parts.some((part) => {
          const matchDigits = part.match(/\d+/);
          return matchDigits
            ? parseInt(matchDigits[0], 10) === queryNumber
            : false;
        });
      }
    }

    // Si el query no es numérico, se busca por subcadena en cada parte.
    return parts.some((part) => part.toLowerCase().includes(query));
  };

  // Card-list style filtered cards (for sidebar display)
  const allFilteredCards = useMemo(() => {
    if (!cards || cards.length === 0) return [];

    return cards
      .filter((card) => {
        const searchLower = search.trim().toLowerCase();
        const matchesSearch =
          card.name.toLowerCase().includes(searchLower) ||
          (card.power ?? "").toLowerCase().includes(searchLower) ||
          (card.cost ?? "").toLowerCase().includes(searchLower) ||
          (card.attribute ?? "").toLowerCase().includes(searchLower) ||
          (card.rarity ?? "").toLowerCase().includes(searchLower) ||
          matchesCardCode(card.code, search) ||
          (card.texts ?? []).some((item) =>
            item.text.toLowerCase().includes(searchLower)
          ) ||
          (card.types ?? []).some((item) =>
            item.type.toLowerCase().includes(searchLower)
          ) ||
          (card.sets ?? []).some((item) =>
            item.set.title.toLowerCase().includes(searchLower)
          );

        const matchesColors =
          selectedColors?.length === 0 ||
          card.colors.some((col) =>
            selectedColors.includes(col.color.toLowerCase())
          );

        const matchesSets =
          selectedSets?.length === 0 ||
          card.sets.some((set) => selectedSets.includes(set.set.title)) ||
          (card.alternates ?? []).some((alt) =>
            alt.sets.some((set) => selectedSets.includes(set.set.title))
          );

        const matchesTypes =
          selectedTypes?.length === 0 ||
          card.types.some((type) => selectedTypes.includes(type.type));

        const matchesEffects =
          selectedEffects?.length === 0 ||
          (card.effects ?? []).some((effect) =>
            selectedEffects.includes(effect.effect)
          );

        const matchesRarities =
          selectedRarities?.length === 0 ||
          selectedRarities.includes(card.rarity || "");

        const matchesCategories =
          selectedCategories?.length === 0 ||
          selectedCategories.includes(card.category || "");

        const matchesCounter =
          selectedCounter === "" ||
          (card.counter?.toString() ?? "") === selectedCounter;

        const matchesTrigger = selectedTrigger === "";

        const matchesCosts =
          selectedCosts?.length === 0 ||
          selectedCosts.includes(card.cost || "");

        const matchesPower =
          selectedPower?.length === 0 ||
          selectedPower.includes(card.power || "");

        const matchesAttributes =
          selectedAttributes?.length === 0 ||
          selectedAttributes.includes(card.attribute || "");

        const matchesCodes =
          selectedCodes?.length === 0 ||
          selectedCodes.some((code) => card.code.includes(code));

        return (
          matchesSearch &&
          matchesColors &&
          matchesSets &&
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
      .sort((a, b) => {
        // Primero ordenar por el sort seleccionado si existe
        if (selectedSort === "Most variants") {
          const variantDiff =
            (b.alternates?.length ?? 0) - (a.alternates?.length ?? 0);
          if (variantDiff !== 0) return variantDiff;
        } else if (selectedSort === "Less variants") {
          const variantDiff =
            (a.alternates?.length ?? 0) - (b.alternates?.length ?? 0);
          if (variantDiff !== 0) return variantDiff;
        }

        // Luego aplicar orden estándar de colección (OP → EB → ST → P → otros)
        return sortByCollectionOrder(a, b);
      });
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

  // Handler para click en cartas del sidebar
  const handleSidebarCardClick = (card: CardWithCollectionData) => {
    if (isMobile) {
      // En mobile, siempre selecciona la carta para placement
      setSelectedCardForPlacement(card);
    } else {
      // En desktop, alternar entre selección y abrir modal
      if (selectedCardForPlacement?.id === card.id) {
        // Si ya está seleccionada, abrir modal
        setSelectedCard(card);
        setBaseCard(card);
        setAlternatesCards(card.alternates);
        setIsOpen(true);
      } else {
        // Si no está seleccionada, seleccionar para placement
        setSelectedCardForPlacement(card);
      }
    }
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
    const existingCard = existingCards[key];
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

  const handlePositionClick = async (
    row: number,
    col: number,
    page?: number
  ) => {
    // Use the specific page provided, fallback to currentPage if not provided
    const targetPage = page ?? currentPage;
    const cardAtPosition = getCardAtPosition(row, col, targetPage);

    // If there's a selected card for placement, place it here
    if (selectedCardForPlacement && !cardAtPosition) {
      if (isMobile) {
        openPriceDrawer(selectedCardForPlacement, {
          position: { page: targetPage, row, column: col },
        });
        setSelectedCardForPlacement(null);
        return;
      }
      const changeId = `${Date.now()}-${Math.random()}`;
      const newChange = {
        id: changeId,
        type: "add" as const,
        position: { page: targetPage, row, column: col },
        card: selectedCardForPlacement,
      };

      setPendingChanges((prev) => [
        ...prev.filter(
          (c) =>
            !(
              c.position.page === targetPage &&
              c.position.row === row &&
              c.position.column === col
            )
        ),
        newChange,
      ]);

      // Auto-save immediately
      try {
        const cardToAdd = {
          cardId: newChange.card.id,
          page: newChange.position.page,
          row: newChange.position.row,
          column: newChange.position.column,
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

      setSelectedCardForPlacement(null); // Clear selection after placing
      return;
    }

    // If there's a selected card and position is occupied, replace it
    if (selectedCardForPlacement && cardAtPosition) {
      const changeId = `${Date.now()}-${Math.random()}`;
      const existingCard = cardAtPosition.isPending
        ? cardAtPosition.change
        : cardAtPosition.existing;
      const newChange = {
        id: changeId,
        type: "change" as const,
        position: { page: targetPage, row, column: col },
        card: selectedCardForPlacement,
        previousCard: existingCard,
      };

      setPendingChanges((prev) => [
        ...prev.filter(
          (c) =>
            !(
              c.position.page === targetPage &&
              c.position.row === row &&
              c.position.column === col
            )
        ),
        newChange,
      ]);

      // Auto-save immediately
      try {
        // If it's a change, first remove the previous card
        if (existingCard?.cardId) {
          await fetch(`/api/lists/${listId}/cards/${existingCard.cardId}`, {
            method: "DELETE",
          });
        }

        // Add the new card
        const cardToAdd = {
          cardId: newChange.card.id,
          page: newChange.position.page,
          row: newChange.position.row,
          column: newChange.position.column,
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

      setSelectedCardForPlacement(null); // Clear selection after placing
      return;
    }

    // 🎴 Backcard Toggle: Si no hay carta seleccionada, manejar backcard
    if (!selectedCardForPlacement) {
      const positionKey = `${targetPage}-${row}-${col}`;

      // Si la posición está vacía (sin carta real), alternar backcard
      if (!cardAtPosition) {
        // Llamada a la API para toggle backcard
        try {
          const response = await fetch(
            `/api/lists/${listId}/backcards/toggle`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                page: targetPage,
                row: row,
                column: col,
              }),
            }
          );

          if (response.ok) {
            const result = await response.json();

            // Actualizar estado local basado en la respuesta de la API
            setBackcardPositions((prev) => {
              const newSet = new Set(prev);
              if (result.action === "added") {
                newSet.add(positionKey);
              } else if (result.action === "removed") {
                newSet.delete(positionKey);
              }
              return newSet;
            });
          } else {
            const errorData = await response.json();
            toast.error(errorData.error || "Error al modificar backcard");
          }
        } catch (error) {
          console.error("Error en toggle de backcard:", error);
          toast.error("Error de conexión");
        }

        return; // No continuar con otras acciones
      }

      // Si hay backcard en esta posición (sin carta real), quitar el backcard al hacer click
      if (backcardPositions.has(positionKey) && !cardAtPosition) {
        // Esta lógica ya se maneja en el bloque de arriba
        return; // No continuar con otras acciones
      }
    }

    // Mobile: If no selected card and position is empty, open card selection modal
    if (isMobile && !selectedCardForPlacement && !cardAtPosition) {
      setTargetPosition({ page: targetPage, row, column: col });
      setShowMobileCardModal(true);
      return;
    }

    // If no selected card, handle removal as before
    if (cardAtPosition) {
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
            const newExistingCards = { ...existingCards };
            const key = `${targetPage}-${row}-${col}`;
            delete newExistingCards[key];
            setExistingCards(newExistingCards);
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

  console.log("cardListFilteredCards", cardListFilteredCards);

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
              />
            </div>

            <div className="flex p-3 flex-col gap-3 border-b border-[#f5f5f5]">
              <DropdownSearch
                search={search}
                setSearch={setSearch}
                placeholder="Search..."
              />

              <div className="flex justify-between items-center gap-2">
                <div className="flex gap-2 justify-center items-center">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className={`
                  ${
                    totalFilters > 0
                      ? "bg-[#2463eb] !text-white"
                      : "bg-gray-100 !text-black"
                  }
                  px-4 py-2 text-black font-bold border rounded-lg
                    `}
                  >
                    Filters
                    {totalFilters > 0 && (
                      <Badge className="ml-2 !bg-white !text-[#2463eb] font-bold">
                        {totalFilters}
                      </Badge>
                    )}
                  </button>
                  <ClearFiltersButton
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
                    clearFilters={() => {
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
                    }}
                    isMobile={true}
                  />
                </div>

                <div className="flex justify-center items-center gap-2">
                  <div id="refresh" className="flex items-center">
                    <Button
                      onClick={handleRefreshCards}
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="Actualizar cartas"
                      disabled={isRefreshing}
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${
                          isRefreshing ? "animate-spin" : ""
                        }`}
                      />
                    </Button>
                  </div>
                  <ViewSwitch
                    viewSelected={viewSelected}
                    setViewSelected={setViewSelected}
                    isText={false}
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

              {/* Selected Card Indicator */}
              {selectedCardForPlacement && !isMobile && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-11 flex-shrink-0">
                      <LazyImage
                        src={selectedCardForPlacement.src}
                        fallbackSrc="/assets/images/backcard.webp"
                        alt={selectedCardForPlacement.name}
                        className="w-full rounded border"
                        priority={true}
                        size="small"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-900 truncate">
                        {selectedCardForPlacement.name}
                      </p>
                      <p className="text-xs text-blue-700">
                        Lista para colocar - Click en posición o arrastra
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedCardForPlacement(null)}
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
                    // Función que verifica si la carta base cumple con los filtros
                    const baseCardMatches = (): boolean => {
                      if (!card) return false;
                      let matches = true;
                      if (selectedSets.length > 0) {
                        matches =
                          card.sets?.some((s) =>
                            selectedSets.includes(s.set.title)
                          ) || false;
                      }
                      if (selectedAltArts.length > 0) {
                        matches =
                          matches &&
                          selectedAltArts.includes(card?.rarity ?? "");
                      }
                      return matches;
                    };

                    const getFilteredAlternates = () => {
                      if (!card?.alternates) return [];
                      return card.alternates.filter((alt) => {
                        let matches = true;
                        if (selectedSets.length > 0) {
                          matches =
                            alt.sets?.some((s) =>
                              selectedSets.includes(s.set.title)
                            ) || false;
                        }
                        if (selectedAltArts.length > 0) {
                          matches =
                            matches &&
                            selectedAltArts.includes(alt.alternateArt ?? "");
                        }
                        return matches;
                      });
                    };

                    const filteredAlts = getFilteredAlternates();

                    if (!baseCardMatches() && filteredAlts.length === 0)
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

                          {baseCardMatches() && (
                            <Card
                              onClick={() => handleSidebarCardClick(card)}
                              draggable
                              onDragStart={(e) =>
                                handleDragStart(e, card, "sidebar")
                              }
                              className={`cursor-pointer transition-all duration-200 relative group ${
                                selectedCardForPlacement?.id === card.id
                                  ? "ring-2 ring-blue-500 bg-blue-50"
                                  : "hover:shadow-md"
                              }`}
                            >
                              <CardContent className="flex justify-center items-center p-4 flex-col h-full">
                                <div className="flex justify-center items-center w-full relative">
                                  <div
                                    className="w-[80%] m-auto cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCard(card);
                                      setShowLargeImage(true);
                                    }}
                                  >
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
                                      setSelectedCard(card);
                                      setShowLargeImage(true);
                                    }}
                                    className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
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
                                  selectedCardForPlacement?.id === alt.id
                                    ? "ring-2 ring-blue-500 bg-blue-50"
                                    : "hover:shadow-md"
                                }`}
                              >
                                <CardContent className="flex justify-center items-center p-4 flex-col h-full">
                                  <div className="flex justify-center items-center w-full relative">
                                    <div
                                      className="w-[80%] m-auto cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedCard(alt);
                                        setShowLargeImage(true);
                                      }}
                                    >
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
                                        setSelectedCard(alt);
                                        setShowLargeImage(true);
                                      }}
                                      className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
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
                    // Función que determina si la carta base coincide con los filtros
                    const baseCardMatches = (): boolean => {
                      if (!card) return false;
                      let matches = true;
                      if (selectedSets.length > 0) {
                        matches =
                          card.sets?.some((s) =>
                            selectedSets.includes(s.set.title)
                          ) || false;
                      }
                      if (selectedAltArts.length > 0) {
                        matches =
                          matches &&
                          selectedAltArts.includes(card?.rarity ?? "");
                      }
                      return matches;
                    };

                    // Función que filtra las alternates según set y rareza
                    const getFilteredAlternates = () => {
                      if (!card?.alternates) return [];
                      return card.alternates.filter((alt) => {
                        let matches = true;
                        if (selectedSets.length > 0) {
                          matches = alt.sets.some((s) =>
                            selectedSets.includes(s.set.title)
                          );
                        }
                        if (selectedAltArts.length > 0) {
                          matches =
                            matches &&
                            selectedAltArts.includes(alt.alternateArt ?? "");
                        }
                        return matches;
                      });
                    };

                    const filteredAlts = getFilteredAlternates();

                    // Si ni la carta base ni alguna alterna coinciden, no renderizamos nada
                    if (!baseCardMatches() && filteredAlts.length === 0)
                      return null;

                    return (
                      <Fragment key={card._id}>
                        {baseCardMatches() && (
                          <div
                            onClick={() => handleSidebarCardClick(card)}
                            draggable
                            onDragStart={(e) =>
                              handleDragStart(e, card, "sidebar")
                            }
                            className={`w-full cursor-pointer max-w-[450px] transition-all duration-200 rounded-lg relative group ${
                              selectedCardForPlacement?.id === card.id
                                ? "ring-2 ring-blue-500 bg-blue-50"
                                : ""
                            }`}
                          >
                            <div className="border rounded-lg shadow pb-3 bg-white justify-center items-center flex flex-col relative">
                              <div
                                className="w-full cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCard(card);
                                  setShowLargeImage(true);
                                }}
                              >
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
                                  setSelectedCard(card);
                                  setShowLargeImage(true);
                                }}
                                className="absolute top-2 right-2 w-6 h-6 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
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
                                selectedCardForPlacement?.id === alt.id
                                  ? "ring-2 ring-blue-500 bg-blue-50"
                                  : ""
                              }`}
                            >
                              <div className="border rounded-lg shadow pb-3 bg-white justify-center items-center flex flex-col relative">
                                <div
                                  className="w-full cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCard(alt);
                                    setShowLargeImage(true);
                                  }}
                                >
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
                                    setSelectedCard(alt);
                                    setShowLargeImage(true);
                                  }}
                                  className="absolute top-2 right-2 w-6 h-6 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
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

                    {/* Botones de acción */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/lists/${listId}`)}
                        className="flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Ver
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/lists/${listId}/edit`)}
                        className="flex items-center gap-2"
                      >
                        <Cog className="h-4 w-4" />
                        Configurar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = window.location.href.replace(
                            "/add-cards",
                            ""
                          );
                          navigator.clipboard.writeText(url);
                          toast.success("Enlace copiado al portapapeles");
                        }}
                        className="flex items-center gap-2"
                      >
                        <Share2 className="h-4 w-4" />
                        Compartir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(
                              "¿Estás seguro de que quieres eliminar esta lista?"
                            )
                          ) {
                            toast.info("Función de eliminar en desarrollo");
                          }
                        }}
                        className="flex items-center gap-2 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </Button>
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
                      <MobileActionMenu
                        list={list}
                        listId={listId}
                        router={router}
                        onDeleteClick={handleDeleteClick}
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
                        dragOverPosition={dragOverPosition}
                        selectedCardForPlacement={selectedCardForPlacement}
                        showInteriorPage={true} // add-cards shows interior page for proper synchronization
                        onPageChange={(pageIndex) => {
                          hasUserNavigated.current = true; // Mark that user has manually navigated
                          setCurrentPage(pageIndex);
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

                      {/* Botones de acción */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/lists/${listId}`)}
                          className="flex items-center gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Ver
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/lists/${listId}/edit`)}
                          className="flex items-center gap-2"
                        >
                          <Edit3 className="h-4 w-4" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const url = window.location.href.replace(
                              "/add-cards",
                              ""
                            );
                            navigator.clipboard.writeText(url);
                            toast.success("Enlace copiado al portapapeles");
                          }}
                          className="flex items-center gap-2"
                        >
                          <Share2 className="h-4 w-4" />
                          Compartir
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (
                              confirm(
                                "¿Estás seguro de que quieres eliminar esta lista?"
                              )
                            ) {
                              toast.info("Función de eliminar en desarrollo");
                            }
                          }}
                          className="flex items-center gap-2 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </Button>
                      </div>
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

                        {/* Botones de acción compactos */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/lists/${listId}`)}
                            className="p-1"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/lists/${listId}/edit`)}
                            className="p-1"
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const url = window.location.href.replace(
                                "/add-cards",
                                ""
                              );
                              navigator.clipboard.writeText(url);
                              toast.success("Enlace copiado");
                            }}
                            className="p-1"
                          >
                            <Share2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm("¿Eliminar esta lista?")) {
                                toast.info("Función de eliminar en desarrollo");
                              }
                            }}
                            className="p-1 text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
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
            }
          }}
        >
          <DialogContent className="max-w-[90vw] max-h-[85vh] px-4 flex flex-col rounded-lg">
            <DialogHeader className="p-4 border-b border-slate-200">
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Seleccionar Carta
              </DialogTitle>
            </DialogHeader>

            {/* FiltersSidebar Modal */}
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

            <div className="p-3 flex flex-col gap-3 border-t border-[#f5f5f5] bg-white">
              <DropdownSearch
                search={search}
                setSearch={setSearch}
                placeholder="Search..."
              />

              <div className="flex justify-between items-center gap-2">
                <div className="flex gap-2 justify-center items-center">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className={`
                      ${
                        totalFilters > 0
                          ? "bg-[#2463eb] !text-white"
                          : "bg-gray-100 !text-black"
                      }
                      px-4 py-2 text-black font-bold border rounded-lg
                    `}
                  >
                    Filters
                    {totalFilters > 0 && (
                      <Badge className="ml-2 !bg-white !text-[#2463eb] font-bold">
                        {totalFilters}
                      </Badge>
                    )}
                  </button>
                  <ClearFiltersButton
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
                    clearFilters={() => {
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
                    }}
                    isMobile={true}
                  />
                </div>

                <div className="flex justify-center items-center gap-2">
                  <ViewSwitch
                    viewSelected={viewSelected}
                    setViewSelected={setViewSelected}
                  />
                </div>
              </div>
            </div>

            {/* Content area */}
            <div
              className="flex-1 overflow-y-auto p-3 min-h-0"
              ref={mobileModalScrollRef}
            >
              {/* Selected Card Indicator */}
              {selectedCardForPlacement && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-11 flex-shrink-0">
                      <LazyImage
                        src={selectedCardForPlacement.src}
                        fallbackSrc="/assets/images/backcard.webp"
                        alt={selectedCardForPlacement.name}
                        className="w-full rounded border"
                        priority={true}
                        size="small"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-900 truncate">
                        {selectedCardForPlacement.name}
                      </p>
                      <p className="text-xs text-blue-700">
                        Lista para colocar - Toca una posición
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedCardForPlacement(null)}
                      className="p-1 hover:bg-blue-100 rounded-full"
                    >
                      <X className="h-4 w-4 text-blue-600" />
                    </button>
                  </div>
                </div>
              )}

              {viewSelected === "text" && (
                <div className="grid gap-3 grid-cols-1 justify-items-center">
                  {cardListFilteredCards?.map((card) => (
                    <Fragment key={card._id}>
                      <div
                        className={`w-full cursor-pointer max-w-[450px] transition-all duration-200 rounded-lg ${
                          selectedCardForPlacement?.id === card.id
                            ? "ring-2 ring-blue-500 bg-blue-50"
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
                            selectedRarities={selectedAltArts}
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
                <div className="grid gap-3 grid-cols-2 justify-items-center">
                  {cardListFilteredCards?.map((card) => {
                    const baseCardMatches = (): boolean => {
                      if (!card) return false;
                      let matches = true;
                      if (selectedSets.length > 0) {
                        matches =
                          card.sets?.some((s) =>
                            selectedSets.includes(s.set.title)
                          ) || false;
                      }
                      if (selectedAltArts.length > 0) {
                        matches =
                          matches &&
                          selectedAltArts.includes(card?.rarity ?? "");
                      }
                      return matches;
                    };

                    const getFilteredAlternates = () => {
                      if (!card?.alternates) return [];
                      return card.alternates.filter((alt) => {
                        let matches = true;
                        if (selectedSets.length > 0) {
                          matches = alt.sets.some((s) =>
                            selectedSets.includes(s.set.title)
                          );
                        }
                        if (selectedAltArts.length > 0) {
                          matches =
                            matches &&
                            selectedAltArts.includes(alt.alternateArt ?? "");
                        }
                        return matches;
                      });
                    };

                    const filteredAlts = getFilteredAlternates();

                    if (!baseCardMatches() && filteredAlts.length === 0)
                      return null;

                    return (
                      <Fragment key={card._id}>
                        {baseCardMatches() && (
                          <div
                            onClick={() => {
                              handleMobileCardPick(card);
                            }}
                            className={`w-full cursor-pointer max-w-[450px] transition-all duration-200 rounded-lg ${
                              selectedCardForPlacement?.id === card.id
                                ? "ring-2 ring-blue-500 bg-blue-50"
                                : ""
                            }`}
                          >
                            <div className="border rounded-lg shadow p-3 bg-white justify-center items-center flex flex-col">
                              <LazyImage
                                src={card.src}
                                fallbackSrc="/assets/images/backcard.webp"
                                alt={card.name}
                                className="w-full"
                                size="small"
                              />
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex justify-center items-center w-full flex-col">
                                      <span
                                        className={`${oswald.className} text-xs font-bold mt-2`}
                                      >
                                        {highlightText(card?.code, search)}
                                      </span>
                                      <span className="text-center text-xs line-clamp-1">
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
                              onClick={() => {
                                handleMobileCardPick(alt);
                              }}
                              className={`w-full cursor-pointer max-w-[450px] transition-all duration-200 rounded-lg ${
                                selectedCardForPlacement?.id === alt.id
                                  ? "ring-2 ring-blue-500 bg-blue-50"
                                  : ""
                              }`}
                            >
                              <div className="border rounded-lg shadow p-3 bg-white justify-center items-center flex flex-col">
                                <LazyImage
                                  src={alt.src}
                                  fallbackSrc="/assets/images/backcard.webp"
                                  alt={alt.alias}
                                  className="w-full"
                                  size="small"
                                />
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex justify-center items-center w-full flex-col">
                                        <span
                                          className={`${oswald.className} text-xs font-bold mt-2`}
                                        >
                                          {highlightText(card?.code, search)}
                                        </span>
                                        <span className="text-center text-xs line-clamp-1">
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

            {/* Mobile filters - moved to bottom */}
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
