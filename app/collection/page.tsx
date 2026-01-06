"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DropdownSearch from "@/components/DropdownSearch";
import {
  LogIn,
  ChevronLeft,
  ChevronRight,
  Package,
  Trash2,
  Plus,
  Minus,
  X,
  FolderOpen,
  ZoomIn,
  SlidersHorizontal,
  MoreHorizontal,
  GripVertical,
  Info,
  Share2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DndContext,
  closestCenter,
  pointerWithin,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Oswald } from "next/font/google";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});
import { signIn } from "next-auth/react";
import { toast } from "react-toastify";
import Logo from "@/public/assets/images/new_logo.png";
import FAB from "@/components/Fab";
import BaseDrawer from "@/components/ui/BaseDrawer";
import SearchFilters from "@/components/home/SearchFilters";
import MobileFiltersDrawer from "@/components/deckbuilder/MobileFiltersDrawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useToast } from "@/components/ui/MobileToast";
import { useI18n } from "@/components/i18n/I18nProvider";

interface CollectionCard {
  id: number;
  cardId: number;
  quantity: number;
  notes: string | null;
  condition: string | null;
  customPrice: number | null;
  customCurrency: string | null;
  card: {
    id: number;
    name: string;
    code: string;
    src: string;
    category: string;
    rarity: string | null;
    cost: string | null;
    power: string | null;
    counter: string | null;
    marketPrice: number | null;
    priceCurrency: string | null;
    colors: { color: string }[];
    types: { type: string }[];
  };
}

interface CollectionSlot {
  id: number;
  collectionCardId: number;
  sortOrder: number;
  cardId: number;
  card: CollectionCard["card"];
}

interface Collection {
  id: number;
  userId: number;
  isPublic: boolean;
  stats: {
    totalUniqueCards: number;
    totalCardsCount: number;
    rarityDistribution: Record<string, number>;
  };
}

interface CollectionResponse {
  collection: Collection;
  cards: CollectionCard[];
  slots?: CollectionSlot[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCards: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const CollectionPage = () => {
  const { t, lang } = useI18n();
  const { data: session, status } = useSession();
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { showToast, showCollectionToast } = useToast();

  // States
  const [collection, setCollection] = useState<Collection | null>(null);
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [slots, setSlots] = useState<CollectionSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const pageLimit = 60;
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCards: 0,
    limit: pageLimit,
    hasNext: false,
    hasPrev: false,
  });

  // Filters
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);

  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCounter, setSelectedCounter] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState("");
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [selectedCosts, setSelectedCosts] = useState<string[]>([]);
  const [selectedPower, setSelectedPower] = useState<string[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [selectedAltArts, setSelectedAltArts] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState("");

  // Selected card for modal
  const [selectedCard, setSelectedCard] = useState<CollectionCard | null>(null);
  const [showFab, setShowFab] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const isDesktopViewport = useMediaQuery("(min-width: 768px)");
  const [selectedSlotIds, setSelectedSlotIds] = useState<number[]>([]);
  const [showMoveInput, setShowMoveInput] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CollectionSlot | null>(null);
  const lastOverRef = useRef<{
    id: number | null;
    position: "before" | "after" | null;
  }>({ id: null, position: null });
  const shareInFlightRef = useRef(false);

  // Card preview states (like CardPreviewDialog)
  const [showLargeImage, setShowLargeImage] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Binder view drawer
  const [showBinderDrawer, setShowBinderDrawer] = useState(false);
  const [selectedGridOption, setSelectedGridOption] = useState<{
    rows: number;
    cols: number;
  } | null>(null);
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 8 },
  });
  const sensors = useSensors(
    ...(isTouchDevice ? [touchSensor] : [pointerSensor])
  );
  const collectionValue = React.useMemo(() => {
    return cards.reduce((sum, item) => {
      const price = item.card.marketPrice ?? 0;
      return sum + price * item.quantity;
    }, 0);
  }, [cards]);

  const sortOptions = React.useMemo(
    () => [
      { value: "collection", label: t("collection.sort.collectionOrder") },
      {
        value: "name-asc",
        label: t("collection.sort.nameAsc"),
        sortBy: "name",
        sortOrder: "asc",
      },
      {
        value: "name-desc",
        label: t("collection.sort.nameDesc"),
        sortBy: "name",
        sortOrder: "desc",
      },
      {
        value: "cost-asc",
        label: t("collection.sort.costAsc"),
        sortBy: "cost",
        sortOrder: "asc",
      },
      {
        value: "cost-desc",
        label: t("collection.sort.costDesc"),
        sortBy: "cost",
        sortOrder: "desc",
      },
      {
        value: "rarity-asc",
        label: t("collection.sort.rarityAsc"),
        sortBy: "rarity",
        sortOrder: "asc",
      },
      {
        value: "rarity-desc",
        label: t("collection.sort.rarityDesc"),
        sortBy: "rarity",
        sortOrder: "desc",
      },
      {
        value: "quantity-desc",
        label: t("collection.sort.quantityDesc"),
        sortBy: "quantity",
        sortOrder: "desc",
      },
      {
        value: "quantity-asc",
        label: t("collection.sort.quantityAsc"),
        sortBy: "quantity",
        sortOrder: "asc",
      },
      {
        value: "createdAt-desc",
        label: t("collection.sort.addedNew"),
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      {
        value: "createdAt-asc",
        label: t("collection.sort.addedOld"),
        sortBy: "createdAt",
        sortOrder: "asc",
      },
    ],
    [t]
  );
  const selectedSortValue = React.useMemo(() => {
    if (!sortBy) return "collection";
    const normalizedOrder = sortOrder || "asc";
    const match = sortOptions.find(
      (option) =>
        option.sortBy === sortBy && option.sortOrder === normalizedOrder
    );
    return match?.value ?? "collection";
  }, [sortBy, sortOrder, sortOptions]);
  const handleSortChange = (value: string) => {
    const option = sortOptions.find((item) => item.value === value);
    if (!option || option.value === "collection") {
      setSortBy("");
      setSortOrder("");
      return;
    }
    setSortBy(option.sortBy || "");
    setSortOrder(option.sortOrder || "asc");
  };

  // Grid options for binder view
  const gridOptions = [
    { rows: 2, cols: 2, label: "2×2", perPage: 4 },
    { rows: 3, cols: 3, label: "3×3", perPage: 9 },
    { rows: 3, cols: 4, label: "3×4", perPage: 12 },
    { rows: 4, cols: 4, label: "4×4", perPage: 16 },
  ];

  const handleOpenBinder = (rows: number, cols: number) => {
    setShowBinderDrawer(false);
    setSelectedGridOption(null);
    router.push(`/collection/binder?rows=${rows}&cols=${cols}`);
  };

  const handleShareBinder = async () => {
    if (!selectedGridOption) {
      toast.error(t("collection.binder.shareSelectGrid"));
      return;
    }
    if (shareInFlightRef.current) return;
    shareInFlightRef.current = true;

    try {
      const response = await fetch("/api/collection/share", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to create share token");
      }
      const data = await response.json();
      const shareUrl = `${window.location.origin}/collection/shared/${data.token}?rows=${selectedGridOption.rows}&cols=${selectedGridOption.cols}`;

      if (navigator.share) {
        await navigator.share({
          title: t("collection.binder.shareTitle"),
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      toast.success(t("collection.binder.shareCopied"));
    } catch (error) {
      console.error("Share failed:", error);
      const errorName = error instanceof Error ? error.name : "";
      if (errorName === "AbortError" || errorName === "InvalidStateError") {
        return;
      }
      toast.error(t("collection.binder.shareError"));
    } finally {
      shareInFlightRef.current = false;
    }
  };
  const handleReorder = async (nextSlots: CollectionSlot[]) => {
    setSlots(nextSlots);
    try {
      await fetch("/api/collection/cards/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderedIds: nextSlots.map((item) => item.id),
        }),
      });
    } catch (error) {
      console.error("Error saving collection order:", error);
      toast.error(t("collection.errors.orderSave"));
    }
  };

  const collisionDetectionStrategy = useCallback((args: any) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    return closestCenter(args);
  }, []);

  const handleDragOver = (event: any) => {
    if (!isReorderMode || slots.length === 0 || isMoveMode) return;
    if (!event.over?.rect || !event.active?.rect?.current?.translated) return;
    const activeRect = event.active.rect.current.translated;
    const overRect = event.over.rect;
    const activeCenterY = activeRect.top + activeRect.height / 2;
    const overCenterY = overRect.top + overRect.height / 2;
    const position = activeCenterY > overCenterY ? "after" : "before";
    lastOverRef.current = {
      id: Number(event.over.id),
      position,
    };
  };

  const handleDragEnd = (event: any) => {
    if (!isReorderMode || slots.length === 0 || isMoveMode) return;
    const { active, over } = event;
    if (!over || active.id === over.id) {
      lastOverRef.current = { id: null, position: null };
      return;
    }
    const oldIndex = slots.findIndex((item) => item.id === active.id);
    const newIndex = slots.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    if (selectedSlotIds.includes(active.id) && selectedSlotIds.length > 0) {
      const overId = lastOverRef.current.id ?? Number(over.id);
      const position = lastOverRef.current.position ?? "before";
      if (selectedSlotIds.includes(overId)) return;
      const selectedSet = new Set(selectedSlotIdsOrdered);
      const selectedOrdered = selectedSlotIdsOrdered
        .map((id) => slots.find((slot) => slot.id === id))
        .filter(Boolean) as CollectionSlot[];
      const remaining = slots.filter((slot) => !selectedSet.has(slot.id));
      const insertIndexRaw = remaining.findIndex((slot) => slot.id === overId);
      if (insertIndexRaw === -1) return;
      const insertIndex = insertIndexRaw;
      const nextSlots = [
        ...remaining.slice(0, insertIndex),
        ...selectedOrdered,
        ...remaining.slice(insertIndex),
      ];
      handleReorder(nextSlots);
      clearSelection();
      lastOverRef.current = { id: null, position: null };
      return;
    }

    const reordered = arrayMove(slots, oldIndex, newIndex);
    handleReorder(reordered);
    lastOverRef.current = { id: null, position: null };
  };

  const SortableGridCard = ({
    item,
    onSelect,
    quantity,
    onDelete,
    selectionOrder,
    isSelected,
    hasSelection,
    isMoveMode,
    onMoveHere,
    onToggleSelect,
    showSelection,
  }: {
    item: {
      id: number;
      card: CollectionCard["card"];
      cardId: number;
    };
    onSelect: () => void;
    quantity?: number;
    onDelete?: () => void;
    selectionOrder?: number | null;
    isSelected?: boolean;
    hasSelection?: boolean;
    isMoveMode?: boolean;
    onMoveHere?: () => void;
    onToggleSelect?: () => void;
    showSelection?: boolean;
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: item.id,
      disabled: !isReorderMode || slots.length === 0 || isMoveMode,
    });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`w-full cursor-pointer max-w-[450px] card-stable ${
          isDragging ? "opacity-70" : ""
        }`}
      >
        <div
          className={`border rounded-lg shadow bg-white justify-center items-center flex flex-col relative group card-stable ${
            isReorderMode ? "animate-card-wiggle" : ""
          }`}
          onClick={(event) => {
            if (isReorderMode) {
              event.preventDefault();
            }
            if (isReorderMode) {
              if (isMoveMode && hasSelection && !isSelected && onMoveHere) {
                onMoveHere();
                return;
              }
              onToggleSelect?.();
              return;
            }
            onSelect();
          }}
          onMouseDown={(event) => {
            if (isReorderMode) {
              event.preventDefault();
            }
          }}
          onTouchStart={(event) => {
            if (isReorderMode) {
              event.preventDefault();
            }
          }}
          onPointerDown={(event) => {
            if (isReorderMode) {
              event.preventDefault();
            }
          }}
          style={{ touchAction: isReorderMode ? "pan-y" : "auto" }}
          {...(isReorderMode ? attributes : {})}
          {...(isReorderMode ? listeners : {})}
          tabIndex={-1}
        >
          <img
            src={item.card.src}
            alt={item.card.name}
            className="w-full rounded-t-lg"
            loading="lazy"
          />

          {quantity !== undefined && quantity > 1 && (
            <div className="absolute bottom-2 right-2 rounded-lg bg-gray-900 px-2 py-1 text-xs font-bold text-white shadow-lg">
              x{quantity}
            </div>
          )}

          <div className="w-full px-2 py-1.5 flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-gray-800 truncate">
              {item.card.code}
            </span>
            {item.card.marketPrice !== null && (
              <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">
                {formatPrice(item.card.marketPrice, item.card.priceCurrency)}
              </span>
            )}
          </div>

          {isReorderMode && (
            <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-700 shadow">
              {slots.length === 0
                ? t("collection.configure")
                : isMoveMode
                ? t("collection.move.target")
                : t("collection.drag")}
            </div>
          )}
          {isReorderMode && onDelete && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-rose-700 shadow-sm hover:bg-rose-50"
            >
              <Trash2 className="h-3 w-3" />
              <span>{t("collection.delete")}</span>
            </button>
          )}
          {isReorderMode && showSelection && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleSelect?.();
              }}
              className={`absolute left-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold shadow ${
                selectionOrder
                  ? "border-white/70 bg-white text-slate-900"
                  : "border-white/70 bg-black/60 text-white"
              }`}
            >
              {selectionOrder ?? ""}
            </button>
          )}
          {isReorderMode && selectionOrder && (
            <div className="absolute inset-0 rounded-lg bg-emerald-500/20 ring-2 ring-emerald-300/80">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full bg-emerald-600/90 px-3 py-1 text-sm font-bold text-white shadow-lg">
                  {selectionOrder}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const SimpleGridCard = ({
    item,
    quantity,
    onSelect,
    onIncrement,
    onDecrement,
  }: {
    item: {
      id: number;
      card: CollectionCard["card"];
      cardId: number;
    };
    quantity?: number;
    onSelect: () => void;
    onIncrement?: () => void;
    onDecrement?: () => void;
  }) => {
    return (
      <div className="w-full cursor-pointer max-w-[450px] card-stable">
        <div
          className="border rounded-lg shadow bg-white justify-center items-center flex flex-col relative group card-stable"
          onClick={onSelect}
        >
          <img
            src={item.card.src}
            alt={item.card.name}
            className="w-full rounded-t-lg"
            loading="lazy"
          />

          {quantity !== undefined && (
            <div className="w-full px-2 pb-2 pt-1">
              <div className="flex items-center justify-between rounded-lg bg-gray-900 px-2 py-1 text-white">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (quantity > 1) {
                      onDecrement?.();
                    }
                  }}
                  disabled={quantity <= 1}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 text-white transition-all hover:bg-white/25 active:scale-95 disabled:opacity-60"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="flex items-center justify-center">
                  <span className="text-base font-bold text-white">
                    {quantity}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onIncrement?.();
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15 text-white transition-all hover:bg-white/25 active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="w-full px-2 py-1.5 flex items-center justify-between gap-1">
            <span className="text-xs font-bold text-gray-800 truncate">
              {item.card.code}
            </span>
            {item.card.marketPrice !== null && (
              <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">
                {formatPrice(item.card.marketPrice, item.card.priceCurrency)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleDeleteSlot = async (slot: CollectionSlot) => {
    try {
      await fetch(`/api/collection/slots/${slot.id}`, { method: "DELETE" });
      setSlots((prev) => prev.filter((item) => item.id !== slot.id));
      setCards((prev) => {
        const next = prev
          .map((item) =>
            item.id === slot.collectionCardId
              ? { ...item, quantity: item.quantity - 1 }
              : item
          )
          .filter((item) => item.quantity > 0);
        return next;
      });
      showToast("-1", "info", 1500);
    } catch (error) {
      console.error("Error removing slot:", error);
      toast.error(t("collection.errors.slotRemove"));
    }
  };

  const confirmDeleteSlot = async () => {
    if (!deleteTarget) return;
    const slotToDelete =
      [...slots]
        .reverse()
        .find(
          (slot) => slot.collectionCardId === deleteTarget.collectionCardId
        ) ?? deleteTarget;
    await handleDeleteSlot(slotToDelete);
    setDeleteTarget(null);
  };

  const toggleSlotSelection = (slotId: number) => {
    setSelectedSlotIds((prev) => {
      if (prev.includes(slotId)) {
        return prev.filter((id) => id !== slotId);
      }
      return [...prev, slotId];
    });
  };

  const clearSelection = () => {
    setSelectedSlotIds([]);
    setShowMoveDialog(false);
  };

  const selectedSlotIdsOrdered = React.useMemo(() => {
    if (!selectedSlotIds.length) return [];
    const slotIds = new Set(slots.map((slot) => slot.id));
    return selectedSlotIds.filter((id) => slotIds.has(id));
  }, [selectedSlotIds, slots]);

  const selectedSlotOrderMap = React.useMemo(() => {
    const map = new Map<number, number>();
    selectedSlotIdsOrdered.forEach((id, index) => {
      map.set(id, index + 1);
    });
    return map;
  }, [selectedSlotIdsOrdered]);

  const moveMaxIndex = React.useMemo(() => {
    if (!slots.length || !selectedSlotIds.length) return 0;
    return Math.max(1, slots.length - selectedSlotIds.length + 1);
  }, [slots.length, selectedSlotIds.length]);

  const moveSelectedSlotsTo = (targetIndex: number) => {
    if (!selectedSlotIds.length) return;
    const maxIndex = slots.length - selectedSlotIds.length + 1;
    if (targetIndex < 1 || targetIndex > maxIndex) {
      toast.error(t("collection.positionRange", { max: maxIndex }));
      return;
    }
    const selectedSet = new Set(selectedSlotIdsOrdered);
    const selectedOrdered = selectedSlotIdsOrdered
      .map((id) => slots.find((slot) => slot.id === id))
      .filter(Boolean) as CollectionSlot[];
    const remaining = slots.filter((slot) => !selectedSet.has(slot.id));
    const insertIndex = targetIndex - 1;
    const nextSlots = [
      ...remaining.slice(0, insertIndex),
      ...selectedOrdered,
      ...remaining.slice(insertIndex),
    ];
    handleReorder(nextSlots);
    clearSelection();
    setShowMoveInput(false);
    setShowMoveDialog(false);
    setMoveTarget("");
  };

  const moveSelectedSlotsToTarget = (targetSlotId: number) => {
    if (!selectedSlotIds.length) return;
    const selectedSet = new Set(selectedSlotIdsOrdered);
    if (selectedSet.has(targetSlotId)) return;
    const selectedOrdered = selectedSlotIdsOrdered
      .map((id) => slots.find((slot) => slot.id === id))
      .filter(Boolean) as CollectionSlot[];
    const remaining = slots.filter((slot) => !selectedSet.has(slot.id));
    const insertIndexRaw = remaining.findIndex(
      (slot) => slot.id === targetSlotId
    );
    if (insertIndexRaw === -1) return;
    const insertIndex = insertIndexRaw;
    const nextSlots = [
      ...remaining.slice(0, insertIndex),
      ...selectedOrdered,
      ...remaining.slice(insertIndex),
    ];
    handleReorder(nextSlots);
    clearSelection();
  };

  // 3D tilt effect handlers (like CardPreviewDialog)
  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const tiltX = ((clientY - centerY) / (rect.height / 2)) * -15;
    const tiltY = ((clientX - centerX) / (rect.width / 2)) * 15;

    const glareX = ((clientX - rect.left) / rect.width) * 100;
    const glareY = ((clientY - rect.top) / rect.height) * 100;

    setTilt({ x: tiltX, y: tiltY });
    setGlarePosition({ x: glareX, y: glareY });
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    },
    [handleMove]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [handleMove]
  );

  const handleEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  const handleLeave = useCallback(() => {
    setIsHovering(false);
    setTilt({ x: 0, y: 0 });
    setGlarePosition({ x: 50, y: 50 });
  }, []);

  const fetchCollection = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const effectiveLimit = isReorderMode ? 0 : pageLimit;
        const params = new URLSearchParams({
          page: page.toString(),
          limit: effectiveLimit.toString(),
          search,
        });
        if (sortBy) params.set("sortBy", sortBy);
        if (sortOrder) params.set("sortOrder", sortOrder);
        if (selectedSets.length) params.set("sets", selectedSets.join(","));
        if (selectedCodes.length)
          params.set("setCodes", selectedCodes.join(","));
        if (selectedColors.length)
          params.set("colors", selectedColors.join(","));
        if (selectedRarities.length)
          params.set("rarities", selectedRarities.join(","));
        if (selectedCategories.length)
          params.set("categories", selectedCategories.join(","));
        if (selectedEffects.length)
          params.set("effects", selectedEffects.join(","));
        if (selectedTypes.length) params.set("types", selectedTypes.join(","));
        if (selectedCosts.length) params.set("costs", selectedCosts.join(","));
        if (selectedPower.length) params.set("power", selectedPower.join(","));
        if (selectedAttributes.length)
          params.set("attributes", selectedAttributes.join(","));
        if (selectedAltArts.length)
          params.set("altArts", selectedAltArts.join(","));
        if (selectedRegion) params.set("region", selectedRegion);
        if (selectedCounter) params.set("counter", selectedCounter);
        if (selectedTrigger) params.set("trigger", selectedTrigger);
        if (isReorderMode) params.set("includeSlots", "1");

        const response = await fetch(`/api/collection?${params}`);
        if (!response.ok) throw new Error("Failed to fetch collection");

        const data: CollectionResponse = await response.json();

        setCollection(data.collection);
        setCards(data.cards);
        setSlots(data.slots ?? []);
        setPagination(data.pagination);
      } catch (error) {
        console.error("Error fetching collection:", error);
        toast.error(t("collection.errors.collectionLoad"));
      } finally {
        setLoading(false);
      }
    },
    [
      search,
      sortBy,
      sortOrder,
      pageLimit,
      selectedSets,
      selectedCodes,
      selectedColors,
      selectedRarities,
      selectedCategories,
      selectedEffects,
      selectedTypes,
      selectedCosts,
      selectedPower,
      selectedAttributes,
      selectedAltArts,
      selectedRegion,
      selectedCounter,
      selectedTrigger,
      isReorderMode,
    ]
  );

  // Fetch on mount and when filters change
  useEffect(() => {
    if (status === "authenticated") {
      fetchCollection(1);
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [
    status,
    search,
    sortBy,
    sortOrder,
    selectedSets,
    selectedCodes,
    selectedColors,
    selectedRarities,
    selectedCategories,
    selectedEffects,
    selectedTypes,
    selectedCosts,
    selectedPower,
    selectedAttributes,
    selectedAltArts,
    selectedRegion,
    selectedCounter,
    selectedTrigger,
    isReorderMode,
  ]);

  useEffect(() => {
    if (!isReorderMode) {
      clearSelection();
      setShowMoveInput(false);
      setShowMoveDialog(false);
      setMoveTarget("");
      setIsMoveMode(false);
    }
  }, [isReorderMode]);

  useEffect(() => {
    if (!selectedSlotIds.length) {
      setIsMoveMode(false);
    }
  }, [selectedSlotIds]);

  useEffect(() => {
    if (isMoveMode) {
      setShowMoveInput(false);
      setShowMoveDialog(false);
    }
  }, [isMoveMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasTouch =
      navigator.maxTouchPoints > 0 ||
      window.matchMedia?.("(pointer: coarse)")?.matches;
    setIsTouchDevice(Boolean(hasTouch));
  }, []);

  // Update quantity
  const updateQuantity = async (cardId: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    const previousQuantity =
      cards.find((c) => c.cardId === cardId)?.quantity ?? newQuantity;

    try {
      const response = await fetch(`/api/collection/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQuantity }),
      });

      if (!response.ok) throw new Error("Failed to update quantity");

      // Update local state
      setCards((prev) =>
        prev.map((c) =>
          c.cardId === cardId ? { ...c, quantity: newQuantity } : c
        )
      );

      // Update stats
      if (collection) {
        const diff =
          newQuantity - (cards.find((c) => c.cardId === cardId)?.quantity || 0);
        setCollection({
          ...collection,
          stats: {
            ...collection.stats,
            totalCardsCount: collection.stats.totalCardsCount + diff,
          },
        });
      }
      if (newQuantity > previousQuantity) {
        showCollectionToast(newQuantity, previousQuantity === 0);
      } else if (newQuantity < previousQuantity) {
        showToast("-1", "info", 1500);
      }
    } catch (error) {
      console.error("Error updating quantity:", error);
      toast.error(t("collection.errors.quantityUpdate"));
    }
  };

  // Remove card from collection
  const removeCard = async (cardId: number) => {
    try {
      const response = await fetch(`/api/collection/cards/${cardId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to remove card");

      // Update local state
      setCards((prev) => prev.filter((c) => c.cardId !== cardId));

      // Update stats
      if (collection) {
        const removedCard = cards.find((c) => c.cardId === cardId);
        setCollection({
          ...collection,
          stats: {
            ...collection.stats,
            totalUniqueCards: collection.stats.totalUniqueCards - 1,
            totalCardsCount:
              collection.stats.totalCardsCount - (removedCard?.quantity || 0),
          },
        });
      }

      toast.success(t("collection.success.removedFromCollection"));
      showToast(t("collection.toast.removed"), "info", 1500);
    } catch (error) {
      console.error("Error removing card:", error);
      toast.error(t("collection.errors.removeCard"));
    }
  };

  const numberFormatLocale = lang === "es" ? "es-ES" : "en-US";

  const formatPrice = (price: number | null, currency: string | null) => {
    if (price === null) return null;
    return new Intl.NumberFormat(numberFormatLocale, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(price);
  };

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const { scrollTop } = target;
    setShowFab(scrollTop > 100);
  }, []);

  const handleScrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const closeSelectedCard = () => {
    setSelectedCard(null);
    setIsHovering(false);
    setTilt({ x: 0, y: 0 });
  };

  const actionsPanel = (
    <div className="p-5 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
          <MoreHorizontal className="h-6 w-6 text-slate-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {t("collection.actions.title")}
          </h2>
          <p className="text-xs text-slate-500">
            {t("collection.actions.subtitle")}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <p className="text-xs text-slate-500">
              {t("collection.stats.estimatedValue")}
            </p>
            <p className="text-lg font-semibold text-emerald-600">
              {formatPrice(collectionValue, "USD") || "—"}
            </p>
          </div>
          <div className="text-right flex flex-col">
            <p className="text-xs text-slate-500">
              {t("collection.stats.totalCards")}
            </p>
            <p className="text-lg font-semibold text-slate-900">
              {collection?.stats.totalCardsCount ?? 0}
            </p>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          {t("collection.stats.uniqueCards")}:{" "}
          {collection?.stats.totalUniqueCards ?? 0}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
        <p className="text-xs text-slate-500">{t("collection.sort.label")}</p>
        <Select
          value={selectedSortValue}
          onValueChange={handleSortChange}
          disabled={isReorderMode}
        >
          <SelectTrigger className="h-10">
            <SelectValue placeholder={t("collection.sort.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isReorderMode && (
          <p className="text-[11px] text-slate-500">
            {t("collection.reorder.disableHint")}
          </p>
        )}
      </div>

      <div className="grid gap-3">
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => {
            setIsActionsOpen(false);
            setShowBinderDrawer(true);
          }}
          disabled={!collection || collection.stats.totalUniqueCards === 0}
        >
          <span>{t("collection.viewBinder")}</span>
          <FolderOpen className="h-4 w-4" />
        </Button>
        <Button
          variant={isReorderMode ? "default" : "outline"}
          className="w-full justify-between"
          onClick={() => setIsReorderMode((prev) => !prev)}
        >
          <span>
            {isReorderMode
              ? t("collection.reorder.reordering")
              : t("collection.reorder.cards")}
          </span>
          <GripVertical className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        {t("collection.reorder.hint")}
      </div>
    </div>
  );

  const binderPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <FolderOpen className="h-7 w-7 text-slate-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {t("collection.binder.title")}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {t("collection.binder.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {gridOptions.map((option) => {
            const isSelected =
              selectedGridOption?.rows === option.rows &&
              selectedGridOption?.cols === option.cols;
            return (
              <button
                key={option.label}
                onClick={() =>
                  setSelectedGridOption({
                    rows: option.rows,
                    cols: option.cols,
                  })
                }
                className={`p-4 rounded-xl border-2 transition-all duration-200 text-left group ${
                  isSelected
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-blue-500 hover:bg-blue-50"
                }`}
              >
                {/* Grid preview */}
                <div className="mb-3 flex justify-center">
                  <div
                    className={`grid gap-1 p-2 rounded-lg transition-colors ${
                      isSelected
                        ? "bg-blue-100"
                        : "bg-slate-100 group-hover:bg-blue-100"
                    }`}
                    style={{
                      gridTemplateColumns: `repeat(${option.cols}, 1fr)`,
                      width: `${
                        option.cols * 16 + (option.cols - 1) * 4 + 16
                      }px`,
                    }}
                  >
                    {Array.from({ length: option.rows * option.cols }).map(
                      (_, i) => (
                        <div
                          key={i}
                          className={`w-4 h-5 rounded-sm transition-colors ${
                            isSelected
                              ? "bg-blue-300"
                              : "bg-slate-300 group-hover:bg-blue-300"
                          }`}
                        />
                      )
                    )}
                  </div>
                </div>
                <div className="text-center flex flex-col">
                  <p className="font-bold text-lg text-slate-900">
                    {option.label}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t("collection.cardsPerPage", { count: option.perPage })}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
        <div className="grid gap-3">
          <Button
            variant="outline"
            onClick={handleShareBinder}
            disabled={!selectedGridOption || !collection}
            className="gap-2"
          >
            <Share2 className="h-4 w-4" />
            {t("collection.binder.share")}
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedGridOption(null);
                setShowBinderDrawer(false);
              }}
            >
              {t("collection.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (!selectedGridOption) return;
                handleOpenBinder(
                  selectedGridOption.rows,
                  selectedGridOption.cols
                );
              }}
              disabled={!selectedGridOption}
            >
              {t("collection.accept")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const cardDetailPanel = selectedCard && (
    <>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-3 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <span
                className={`${oswald.className} font-medium text-slate-700`}
              >
                {selectedCard.card.code}
              </span>
              <span className="text-slate-300">•</span>
              <span>{selectedCard.card.rarity || "-"}</span>
              <span className="text-slate-300">•</span>
              <span>{selectedCard.card.category}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              {selectedCard.card.name}
            </h2>
          </div>
          <button
            onClick={closeSelectedCard}
            className="flex-shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        className="overflow-y-auto flex-1 pb-4"
        style={{
          maxHeight: "calc(92vh - 100px)",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Card Image with 3D Tilt Effect */}
        <div className="p-4 flex justify-center bg-gradient-to-b from-slate-100 to-slate-50">
          <div
            ref={cardRef}
            className="relative cursor-pointer"
            style={{ perspective: "1000px", touchAction: "none" }}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            onTouchMove={handleTouchMove}
            onTouchStart={handleEnter}
            onTouchEnd={handleLeave}
            onClick={() => setShowLargeImage(true)}
          >
            <div
              className={!isHovering ? "animate-card-float" : ""}
              style={{ transformStyle: "preserve-3d" }}
            >
              <div
                className="relative transition-transform duration-150 ease-out"
                style={{
                  transform: isHovering
                    ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.02)`
                    : "rotateX(0deg) rotateY(0deg) scale(1)",
                  transformStyle: "preserve-3d",
                }}
              >
                <div
                  className="relative w-44 sm:w-52 aspect-[2.5/3.5] rounded-xl overflow-hidden"
                  style={{
                    boxShadow: isHovering
                      ? "0 30px 60px -15px rgba(0, 0, 0, 0.5), 0 15px 30px -10px rgba(0, 0, 0, 0.3)"
                      : "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 10px 25px -8px rgba(0, 0, 0, 0.2)",
                    transition: "box-shadow 0.3s ease",
                  }}
                >
                  <img
                    src={selectedCard.card.src}
                    alt={selectedCard.card.name}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />

                  {/* Quantity Badge */}
                  <div className="absolute top-0 right-0 bg-black text-white rounded-tr-xl rounded-bl-lg min-w-[28px] h-[28px] flex items-center justify-center text-sm font-bold border-2 border-white shadow-lg z-20">
                    x{selectedCard.quantity}
                  </div>

                  {/* Price Badge */}
                  {selectedCard.card.marketPrice && (
                    <div className="absolute bottom-0 left-0 bg-emerald-600 text-white rounded-bl-xl px-2 py-1 text-xs font-bold border-2 border-white shadow-lg z-20">
                      {formatPrice(
                        selectedCard.card.marketPrice,
                        selectedCard.card.priceCurrency
                      )}
                    </div>
                  )}

                  {/* Glare Effect */}
                  <div
                    className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-10"
                    style={{
                      opacity: isHovering ? 0.6 : 0,
                      background: `radial-gradient(
                        circle at ${glarePosition.x}% ${glarePosition.y}%,
                        rgba(255, 255, 255, 0.8) 0%,
                        rgba(255, 255, 255, 0.4) 20%,
                        transparent 60%
                      )`,
                    }}
                  />

                  {/* Holographic Rainbow Effect */}
                  <div
                    className="absolute inset-0 pointer-events-none transition-opacity duration-300 mix-blend-color-dodge z-10"
                    style={{
                      opacity: isHovering ? 0.15 : 0,
                      background: `linear-gradient(
                        ${45 + tilt.y * 2}deg,
                        rgba(255, 0, 0, 0.5) 0%,
                        rgba(255, 154, 0, 0.5) 10%,
                        rgba(208, 222, 33, 0.5) 20%,
                        rgba(79, 220, 74, 0.5) 30%,
                        rgba(63, 218, 216, 0.5) 40%,
                        rgba(47, 201, 226, 0.5) 50%,
                        rgba(28, 127, 238, 0.5) 60%,
                        rgba(95, 21, 242, 0.5) 70%,
                        rgba(186, 12, 248, 0.5) 80%,
                        rgba(251, 7, 217, 0.5) 90%,
                        rgba(255, 0, 0, 0.5) 100%
                      )`,
                    }}
                  />
                </div>

                {/* Zoom Hint */}
                <div
                  className={`absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 transition-opacity duration-200 ${
                    isHovering ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <ZoomIn className="h-3 w-3" />
                  <span>{t("collection.tapToExpand")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quantity Controls */}
        <div className="px-4 mt-4">
          <div className="bg-slate-50 rounded-xl p-4 mb-4">
            <p className="text-sm text-slate-600 text-center mb-3">
              {t("collection.quantityInCollection")}
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  if (selectedCard.quantity > 1) {
                    updateQuantity(
                      selectedCard.cardId,
                      selectedCard.quantity - 1
                    );
                    setSelectedCard({
                      ...selectedCard,
                      quantity: selectedCard.quantity - 1,
                    });
                  }
                }}
                disabled={selectedCard.quantity <= 1}
                className="h-12 w-12 p-0 rounded-full"
              >
                <Minus className="h-5 w-5" />
              </Button>
              <span className="text-3xl font-bold w-16 text-center">
                {selectedCard.quantity}
              </span>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  updateQuantity(
                    selectedCard.cardId,
                    selectedCard.quantity + 1
                  );
                  setSelectedCard({
                    ...selectedCard,
                    quantity: selectedCard.quantity + 1,
                  });
                }}
                className="h-12 w-12 p-0 rounded-full"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Delete button */}
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => {
              removeCard(selectedCard.cardId);
              setSelectedCard(null);
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("collection.removeFromCollection")}
          </Button>
        </div>
      </div>
    </>
  );

  // Not authenticated view
  if (status === "unauthenticated") {
    const popupCenter = (url: string, title: string) => {
      const dualScreenLeft = window.screenLeft ?? window.screenX;
      const dualScreenTop = window.screenTop ?? window.screenY;
      const width =
        window.innerWidth ??
        document.documentElement.clientWidth ??
        screen.width;
      const height =
        window.innerHeight ??
        document.documentElement.clientHeight ??
        screen.height;
      const systemZoom = width / window.screen.availWidth;
      const left = (width - 500) / 2 / systemZoom + dualScreenLeft;
      const top = (height - 550) / 2 / systemZoom + dualScreenTop;
      const newWindow = window.open(
        url,
        title,
        `width=${500 / systemZoom},height=${
          550 / systemZoom
        },top=${top},left=${left}`
      );
      newWindow?.focus();
    };

    return (
      <div className="bg-[#f2eede] flex-1 min-h-0 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-8">
          <div className="flex flex-col items-center text-center">
            <Image
              src={Logo}
              height={120}
              width={120}
              alt="logo"
              className="h-auto w-[80px] sm:w-[100px]"
            />
          </div>

          <div className="space-y-2 pt-2">
            <h1 className="text-xl font-bold text-slate-900 text-center sm:text-2xl">
              {t("collection.login.title")}
            </h1>
            <p className="text-sm text-slate-500 text-center">
              {t("collection.login.subtitle")}
            </p>
          </div>

          <div className="pt-4">
            <Button
              variant="outline"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-6 text-base font-semibold text-slate-900 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md active:scale-[0.98] flex items-center justify-center gap-3"
              onClick={() => popupCenter("/googleSignIn", "Ohara Sign In")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="24"
                viewBox="0 0 24 24"
                width="24"
                className="h-5 w-5"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
              {t("collection.login.button")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f2eede] flex-1 min-h-0 overflow-hidden flex flex-col">
      {/* Header */}
      <div
        className={`bg-white border-b border-[#e5e5e5] transition-opacity duration-300 ${
          showHeader ? "opacity-100" : "opacity-0 pointer-events-none"
        } ${isReorderMode ? "hidden md:block" : ""}`}
      >
        <div className="px-4 py-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {t("collection.title")}
              </h1>
              {collection && (
                <p className="text-slate-500 text-sm">
                  {t("collection.cardsCount", {
                    count: collection.stats.totalCardsCount,
                  })}{" "}
                  • {formatPrice(collectionValue, "USD") || "—"}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Stats badges - Desktop */}
              {collection && (
                <div className="hidden md:flex flex-wrap gap-2">
                  {Object.entries(collection.stats.rarityDistribution)
                    .slice(0, 6)
                    .map(([rarity, count]) => (
                      <Badge
                        key={rarity}
                        variant="secondary"
                        className="text-xs"
                      >
                        {rarity}: {count}
                      </Badge>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border-b border-[#e5e5e5]">
        <div className="hidden md:flex flex-col gap-3 px-4 py-3">
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
            setViewSelected={() => {}}
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
            selectedAltArts={selectedAltArts}
            setSelectedAltArts={setSelectedAltArts}
            selectedRegion={selectedRegion}
            setSelectedRegion={setSelectedRegion}
          />

          <div className="flex items-center gap-4">
            <div className="ml-auto flex items-center gap-3 justify-end flex-1">
              {/* <div>
                <p className="text-xs text-slate-500">
                  {t("collection.cardsCount", {
                    count: pagination.totalCards.toLocaleString(),
                  })}
                </p>
              </div> */}
              <div className="flex gap-2">
                {/* <div className="hidden lg:block min-w-[210px]">
                  <Select
                    value={selectedSortValue}
                    onValueChange={handleSortChange}
                    disabled={isReorderMode}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue
                        placeholder={t("collection.sort.placeholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div> */}
                <Button
                  variant={isReorderMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsReorderMode((prev) => !prev)}
                  className="gap-2"
                >
                  <GripVertical className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {isReorderMode
                      ? t("collection.reorder.reordering")
                      : t("collection.reorder.short")}
                  </span>
                </Button>
                {collection && collection.stats.totalUniqueCards > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBinderDrawer(true)}
                    className="gap-2"
                  >
                    <FolderOpen className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {t("collection.viewBinder")}
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="md:hidden p-3 flex flex-col gap-3 border-t border-[#f5f5f5]">
          {isReorderMode ? (
            <button
              type="button"
              onClick={() => setIsReorderMode((prev) => !prev)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 h-[42px] text-sm font-semibold transition-all border-blue-300 bg-blue-50 text-blue-700"
            >
              <GripVertical className="h-4 w-4" />
              {t("collection.reorder.reordering")}
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <DropdownSearch
                    search={search}
                    setSearch={setSearch}
                    placeholder={t("collection.search.placeholder")}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFiltersOpen(true)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 h-[42px] text-sm font-medium transition-all active:scale-95 ${
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
                    selectedAltArts.length > 0 ||
                    selectedRegion !== ""
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>{t("collection.filters")}</span>
                </button>
                {collection && collection.stats.totalUniqueCards > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowBinderDrawer(true)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 h-[42px] text-sm font-medium text-slate-700 bg-white transition-all active:scale-95"
                  >
                    <FolderOpen className="h-4 w-4" />
                    <span>{t("collection.binder")}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsReorderMode((prev) => !prev)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border px-3 h-[42px] text-sm font-semibold transition-all border-slate-200 bg-white text-slate-700"
                >
                  <GripVertical className="h-4 w-4" />
                  {t("collection.reorder.short")}
                </button>
              </div>
            </>
          )}
        </div>

        <div className={`md:hidden ${isReorderMode ? "hidden" : ""}`}>
          <MobileFiltersDrawer
            isOpen={isFiltersOpen}
            onClose={() => setIsFiltersOpen(false)}
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
            selectedRegion={selectedRegion}
            setSelectedRegion={setSelectedRegion}
          />
        </div>
      </div>

      {/* Content */}
      <div
        className="p-3 md:p-5 overflow-y-auto overscroll-contain flex-1 min-h-0 relative"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        {showFab && <FAB onClick={handleScrollToTop} />}

        {loading ? (
          <div className="grid gap-2 md:gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="w-full border rounded-lg shadow p-3 bg-white animate-pulse"
              >
                <div className="w-full aspect-[2.5/3.5] rounded bg-gray-200 mb-3" />
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="flex items-center justify-center text-center h-full">
            <div className="max-w-md">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow">
                <Package className="h-10 w-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                {search
                  ? t("collection.empty.title.noResults")
                  : t("collection.empty.title.noCards")}
              </h3>
              <p className="text-slate-600 mb-6">
                {search
                  ? t("collection.empty.subtitle.noResults")
                  : t("collection.empty.subtitle.noCards")}
              </p>
              {!search && (
                <Button onClick={() => router.push("/card-list")}>
                  {t("collection.empty.cta")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {isReorderMode && (
              <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                <Info className="h-3.5 w-3.5" />
                {slots.length === 0
                  ? t("collection.reorder.slotsMissing")
                  : selectedSlotIds.length
                  ? isMoveMode
                    ? t("collection.reorder.pickDestination")
                    : t("collection.reorder.tapToMove")
                  : t("collection.reorder.tapToSelect")}
              </div>
            )}
            {isReorderMode && slots.length > 0 && (
              <div className="hidden md:flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div className="text-xs text-slate-500">
                  {selectedSlotIds.length
                    ? t("collection.reorder.selectedCount", {
                        count: selectedSlotIds.length,
                      })
                    : t("collection.reorder.selectToMove")}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMoveMode((prev) => !prev)}
                    disabled={!selectedSlotIds.length}
                  >
                    {isMoveMode
                      ? t("collection.move.cancel")
                      : t("collection.reorder.moveBatch")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMoveInput((prev) => !prev)}
                    disabled={!selectedSlotIds.length || isMoveMode}
                  >
                    {t("collection.reorder.moveToPosition")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                    disabled={!selectedSlotIds.length}
                  >
                    {t("collection.reorder.clear")}
                  </Button>
                </div>
                {showMoveInput && (
                  <div className="flex items-center gap-2">
                    <input
                      value={moveTarget}
                      onChange={(event) => setMoveTarget(event.target.value)}
                      placeholder={t("collection.position")}
                      inputMode="numeric"
                      className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        const target = Number.parseInt(moveTarget, 10);
                        if (!Number.isFinite(target)) {
                          toast.error(t("collection.invalidPosition"));
                          return;
                        }
                        moveSelectedSlotsTo(target);
                      }}
                    >
                      {t("collection.move")}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {isReorderMode ? (
              <DndContext
                sensors={sensors}
                collisionDetection={collisionDetectionStrategy}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                autoScroll={{
                  enabled: true,
                  threshold: { x: 0.2, y: 0.15 },
                  acceleration: 12,
                  interval: 5,
                }}
              >
                <SortableContext
                  items={(slots.length ? slots : cards).map((item) => item.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid gap-2 md:gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 justify-items-center">
                    {slots.length
                      ? slots.map((slot) => (
                          <SortableGridCard
                            key={slot.id}
                            item={slot}
                            onSelect={() => {
                              const match = cards.find(
                                (item) => item.id === slot.collectionCardId
                              );
                              if (match) setSelectedCard(match);
                            }}
                            onDelete={() => setDeleteTarget(slot)}
                            showSelection={true}
                            selectionOrder={
                              selectedSlotOrderMap.get(slot.id) ?? null
                            }
                            isSelected={selectedSlotIds.includes(slot.id)}
                            hasSelection={selectedSlotIds.length > 0}
                            isMoveMode={isMoveMode}
                            onMoveHere={() =>
                              moveSelectedSlotsToTarget(slot.id)
                            }
                            onToggleSelect={() => toggleSlotSelection(slot.id)}
                          />
                        ))
                      : cards.map((item) => (
                          <SortableGridCard
                            key={item.id}
                            item={item}
                            quantity={item.quantity}
                            onSelect={() => setSelectedCard(item)}
                            showSelection={true}
                          />
                        ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="grid gap-2 md:gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 justify-items-center">
                {cards.map((item) => (
                  <SimpleGridCard
                    key={item.id}
                    item={item}
                    quantity={item.quantity}
                    onSelect={() => setSelectedCard(item)}
                    onIncrement={() => {
                      updateQuantity(item.cardId, item.quantity + 1);
                    }}
                    onDecrement={() => {
                      if (item.quantity <= 1) return;
                      updateQuantity(item.cardId, item.quantity - 1);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {!isReorderMode && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6 pb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCollection(pagination.currentPage - 1)}
              disabled={!pagination.hasPrev}
              className="bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-600 px-4 bg-white rounded-lg py-2 border">
              {pagination.currentPage} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCollection(pagination.currentPage + 1)}
              disabled={!pagination.hasNext}
              className="bg-white"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {isReorderMode && (
        <div className="fixed bottom-3 left-0 right-0 z-40 px-3 md:hidden">
          <div className="mx-auto rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setIsMoveMode((prev) => !prev)}
                disabled={!selectedSlotIds.length}
                className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                  isMoveMode
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-700"
                } disabled:opacity-50`}
              >
                <GripVertical className="h-4 w-4" />
                <span>
                  {isMoveMode
                    ? t("collection.move.target")
                    : t("collection.move.short")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowMoveDialog(true)}
                disabled={!selectedSlotIds.length || isMoveMode}
                className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 transition disabled:opacity-50"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>{t("collection.position")}</span>
              </button>
              <button
                type="button"
                onClick={clearSelection}
                disabled={!selectedSlotIds.length}
                className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 transition disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                <span>{t("collection.reorder.clear")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {!isDesktopViewport && (
        <Dialog
          open={showMoveDialog}
          onOpenChange={(open) => {
            if (!open) setShowMoveDialog(false);
          }}
        >
          <DialogContent className="w-[calc(100%-1.5rem)] max-w-sm rounded-2xl p-0 overflow-hidden">
            <div className="px-5 pt-4 pb-5 space-y-4">
              <DialogHeader>
                <DialogTitle>
                  {t("collection.reorder.moveToPosition")}
                </DialogTitle>
                <DialogDescription>
                  {moveMaxIndex
                    ? t("collection.positionRange", { max: moveMaxIndex })
                    : t("collection.selectCardsToMove")}
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <input
                  value={moveTarget}
                  onChange={(event) => setMoveTarget(event.target.value)}
                  placeholder={t("collection.position")}
                  inputMode="numeric"
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <Button
                  type="button"
                  disabled={!selectedSlotIds.length}
                  onClick={() => {
                    const target = Number.parseInt(moveTarget, 10);
                    if (!Number.isFinite(target)) {
                      toast.error(t("collection.invalidPosition"));
                      return;
                    }
                    moveSelectedSlotsTo(target);
                  }}
                >
                  {t("collection.move")}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedSlotIds.length}
                  onClick={() => moveSelectedSlotsTo(1)}
                >
                  {t("collection.start")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedSlotIds.length || moveMaxIndex === 0}
                  onClick={() => moveSelectedSlotsTo(moveMaxIndex)}
                >
                  {t("collection.end")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Card Detail Drawer/Modal - Like CardPreviewDialog */}
      {isDesktopViewport ? (
        <Dialog
          open={!!selectedCard}
          onOpenChange={(open) => {
            if (!open) closeSelectedCard();
          }}
        >
          <DialogContent className="max-w-lg p-0 overflow-hidden">
            {cardDetailPanel}
          </DialogContent>
        </Dialog>
      ) : (
        <BaseDrawer
          isOpen={!!selectedCard}
          onClose={closeSelectedCard}
          maxHeight="92vh"
        >
          {cardDetailPanel}
        </BaseDrawer>
      )}

      {/* Large Image Overlay */}
      {showLargeImage && selectedCard && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-[9999] px-5 cursor-pointer"
          onClick={() => setShowLargeImage(false)}
          onTouchEnd={(e) => {
            e.preventDefault();
            setShowLargeImage(false);
          }}
        >
          <div className="w-full max-w-md pointer-events-none animate-in zoom-in-95 fade-in duration-200">
            <div className="text-white/80 text-sm font-medium text-center py-3">
              {t("collection.tapToClose")}
            </div>
            <div className="flex flex-col items-center gap-4">
              <img
                src={selectedCard.card.src}
                className="max-w-full max-h-[calc(100dvh-150px)] object-contain rounded-lg shadow-2xl"
                alt={selectedCard.card.name}
              />
              <div className="text-white text-center">
                <span className={`${oswald.className} font-medium text-lg`}>
                  {selectedCard.card.code}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-2xl p-0 overflow-hidden">
          <div className="bg-rose-50 px-5 py-4">
            <DialogHeader>
              <DialogTitle className="text-lg text-rose-900">
                {t("collection.deleteCardTitle")}
              </DialogTitle>
              <DialogDescription className="text-rose-700">
                {t("collection.deleteCardDesc")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-5 py-4">
            {deleteTarget && (
              <div className="flex items-center gap-3 rounded-xl border border-rose-100 bg-white px-3 py-2">
                <img
                  src={deleteTarget.card.src}
                  alt={deleteTarget.card.name}
                  className="h-16 w-12 rounded-md object-cover"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {deleteTarget.card.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {deleteTarget.card.code}
                  </p>
                </div>
              </div>
            )}
            <div className="mt-4 grid gap-2">
              <Button
                type="button"
                variant="destructive"
                className="h-11"
                onClick={confirmDeleteSlot}
              >
                {t("collection.deleteCopy")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setDeleteTarget(null)}
              >
                {t("collection.cancel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Actions Drawer/Modal */}
      {isDesktopViewport ? (
        <Dialog
          open={isActionsOpen}
          onOpenChange={(open) => {
            if (!open) setIsActionsOpen(false);
          }}
        >
          <DialogContent className="max-w-md p-0 overflow-hidden">
            {actionsPanel}
          </DialogContent>
        </Dialog>
      ) : (
        <BaseDrawer
          isOpen={isActionsOpen}
          onClose={() => setIsActionsOpen(false)}
          maxHeight="75vh"
        >
          {actionsPanel}
        </BaseDrawer>
      )}

      {/* Binder Grid Selection Drawer/Modal */}
      {isDesktopViewport ? (
        <Dialog
          open={showBinderDrawer}
          onOpenChange={(open) => {
            if (!open) setShowBinderDrawer(false);
          }}
        >
          <DialogContent className="max-w-md p-0 overflow-hidden">
            {binderPanel}
          </DialogContent>
        </Dialog>
      ) : (
        <BaseDrawer
          isOpen={showBinderDrawer}
          onClose={() => setShowBinderDrawer(false)}
          maxHeight="92vh"
        >
          {binderPanel}
        </BaseDrawer>
      )}
    </div>
  );
};

export default CollectionPage;
