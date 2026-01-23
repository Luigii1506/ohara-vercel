"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import DropdownSearch from "@/components/DropdownSearch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Search,
  Eye,
  Trash2,
  Share2,
  Copy,
  Globe,
  Lock,
  Package,
  FolderOpen,
  List,
  RefreshCw,
  Settings,
  Filter,
  X,
  Layers,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { UserList, UserListCard } from "@/types";
import ListsFiltersSidebar from "@/components/ListsFiltersSidebar";
import BaseDrawer from "@/components/ui/BaseDrawer";
import LazyImage from "@/components/LazyImage";
import { useSession } from "next-auth/react";

interface ListsPageProps {}

const ListsPage: React.FC<ListsPageProps> = () => {
  const router = useRouter();
  const { status } = useSession();

  // Core state
  const [lists, setLists] = useState<UserList[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [isInputClear, setIsInputClear] = useState(false);
  const [selectedType, setSelectedType] = useState("all"); // "all", "folder", "list"
  const [selectedVisibility, setSelectedVisibility] = useState("all"); // "all", "public", "private"
  const [selectedStatus, setSelectedStatus] = useState("all"); // "all", "with-cards", "empty"
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedCardsRange, setSelectedCardsRange] = useState("all"); // "all", "empty", "1-10", "11-50", "51-100", "100+"
  const [sortBy, setSortBy] = useState("date-desc"); // "name-asc", "name-desc", "date-desc", "date-asc", "cards-desc", "cards-asc", etc.

  // UI State
  const [showFiltersSidebar, setShowFiltersSidebar] = useState(false);

  // Modals
  const [shareModal, setShareModal] = useState<{
    open: boolean;
    list: UserList | null;
  }>({ open: false, list: null });
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    list: UserList | null;
  }>({ open: false, list: null });
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // Preview drawer
  const [previewDrawer, setPreviewDrawer] = useState<{
    open: boolean;
    list: UserList | null;
    cards: UserListCard[];
    loading: boolean;
  }>({ open: false, list: null, cards: [], loading: false });

  // Filtered and sorted lists
  const filteredAndSortedLists = useMemo(() => {
    let filtered = lists.filter((list) => {
      // Search filter
      const matchesSearch =
        list.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (list.description || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      // Type filter
      const matchesType =
        selectedType === "all" ||
        (selectedType === "folder" && list.isOrdered) ||
        (selectedType === "list" && !list.isOrdered);

      // Visibility filter
      const matchesVisibility =
        selectedVisibility === "all" ||
        (selectedVisibility === "public" && list.isPublic) ||
        (selectedVisibility === "private" && !list.isPublic);

      // Status filter
      const cardCount = list._count?.cards || 0;
      const matchesStatus =
        selectedStatus === "all" ||
        (selectedStatus === "with-cards" && cardCount > 0) ||
        (selectedStatus === "empty" && cardCount === 0);

      // Color filter
      const matchesColor =
        selectedColors.length === 0 ||
        selectedColors.includes(list.color || "gray");

      // Cards range filter
      const matchesCardsRange =
        selectedCardsRange === "all" ||
        (selectedCardsRange === "empty" && cardCount === 0) ||
        (selectedCardsRange === "1-10" && cardCount >= 1 && cardCount <= 10) ||
        (selectedCardsRange === "11-50" &&
          cardCount >= 11 &&
          cardCount <= 50) ||
        (selectedCardsRange === "51-100" &&
          cardCount >= 51 &&
          cardCount <= 100) ||
        (selectedCardsRange === "100+" && cardCount > 100);

      return (
        matchesSearch &&
        matchesType &&
        matchesVisibility &&
        matchesStatus &&
        matchesColor &&
        matchesCardsRange
      );
    });

    // Sort
    filtered.sort((a, b) => {
      const aCards = a._count?.cards || 0;
      const bCards = b._count?.cards || 0;
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "date-asc":
          return aDate - bDate;
        case "date-desc":
          return bDate - aDate;
        case "cards-asc":
          return aCards - bCards;
        case "cards-desc":
          return bCards - aCards;
        case "pages-asc":
          return (a.totalPages || 0) - (b.totalPages || 0);
        case "pages-desc":
          return (b.totalPages || 0) - (a.totalPages || 0);
        default:
          return bDate - aDate; // default: newest first
      }
    });

    return filtered;
  }, [
    lists,
    searchTerm,
    selectedType,
    selectedVisibility,
    selectedStatus,
    selectedColors,
    selectedCardsRange,
    sortBy,
  ]);

  // Check if filters are active
  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    selectedType !== "all" ||
    selectedVisibility !== "all" ||
    selectedStatus !== "all" ||
    selectedColors.length > 0 ||
    selectedCardsRange !== "all" ||
    sortBy !== "date-desc";

  // Fetch lists
  const fetchLists = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/lists");
      if (response.ok) {
        const data = await response.json();
        setLists(data.lists || []);
      } else if (response.status === 401 || response.status === 403) {
        router.replace("/login");
      } else {
        toast.error("Error al cargar las listas");
      }
    } catch (error) {
      console.error("Error fetching lists:", error);
      toast.error("Error al cargar las listas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated") {
      fetchLists();
    }
  }, [status]);

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm("");
    setIsInputClear(true);
    setSelectedType("all");
    setSelectedVisibility("all");
    setSelectedStatus("all");
    setSelectedColors([]);
    setSelectedCardsRange("all");
    setSortBy("date-desc");
  };

  // Action handlers
  const handleView = (list: UserList) => {
    router.push(`/lists/${list.id}`);
  };

  const handleAddCards = (list: UserList) => {
    router.push(`/lists/${list.id}/add-cards`);
  };

  const handleEdit = (list: UserList) => {
    router.push(`/lists/${list.id}/edit`);
  };

  const handleShare = (list: UserList) => {
    setShareModal({ open: true, list });
  };

  const handleCopyLink = async (list: UserList) => {
    try {
      const url = `${window.location.origin}/shared-lists/${list.id}`;
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado al portapapeles");
      setShareModal({ open: false, list: null });
    } catch (error) {
      toast.error("Error al copiar el enlace");
    }
  };

  const handleDelete = (list: UserList) => {
    setDeleteModal({ open: true, list });
  };

  const confirmDelete = async () => {
    if (!deleteModal.list) return;

    try {
      const response = await fetch(`/api/lists/${deleteModal.list.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Lista eliminada exitosamente");
        setDeleteModal({ open: false, list: null });
        await fetchLists();
      } else {
        toast.error("Error al eliminar la lista");
      }
    } catch (error) {
      console.error("Error deleting list:", error);
      toast.error("Error al eliminar la lista");
    }
  };

  const handleCreateCollection = () => {
    router.push("/lists/create");
  };

  const extractListId = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      return Number.parseInt(trimmed, 10);
    }
    try {
      const url = new URL(trimmed);
      const match = url.pathname.match(/\/lists\/(\d+)/);
      return match?.[1] ? Number.parseInt(match[1], 10) : null;
    } catch {
      const match = trimmed.match(/\/lists\/(\d+)/);
      return match?.[1] ? Number.parseInt(match[1], 10) : null;
    }
  };

  const handleImportList = async () => {
    const listId = extractListId(importUrl);
    if (!listId) {
      toast.error("URL o ID de lista inválido");
      return;
    }

    setIsImporting(true);
    try {
      const response = await fetch("/api/lists/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al importar la lista");
      }

      const data = await response.json();
      toast.success("Lista importada");
      setImportModalOpen(false);
      setImportUrl("");
      await fetchLists();
      if (data.list?.id) {
        router.push(`/lists/${data.list.id}/add-cards`);
      }
    } catch (error: any) {
      console.error("Error importing list:", error);
      toast.error(error?.message || "Error al importar la lista");
    } finally {
      setIsImporting(false);
    }
  };

  // Preview drawer handlers
  const handleOpenPreview = async (list: UserList) => {
    setPreviewDrawer({ open: true, list, cards: [], loading: true });

    try {
      const response = await fetch(`/api/lists/${list.id}`);
      if (response.ok) {
        const data = await response.json();
        setPreviewDrawer((prev) => ({
          ...prev,
          cards: data.cards || [],
          loading: false,
        }));
      } else {
        toast.error("Error al cargar las cartas");
        setPreviewDrawer((prev) => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error("Error fetching list cards:", error);
      toast.error("Error al cargar las cartas");
      setPreviewDrawer((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleClosePreview = () => {
    setPreviewDrawer({ open: false, list: null, cards: [], loading: false });
  };

  // Format currency
  const formatCurrency = (value: number, currency?: string) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(value);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedType !== "all") count += 1;
    if (selectedVisibility !== "all") count += 1;
    if (selectedStatus !== "all") count += 1;
    if (selectedColors.length > 0) count += 1;
    if (selectedCardsRange !== "all") count += 1;
    if (sortBy !== "date-desc") count += 1;
    return count;
  }, [
    selectedType,
    selectedVisibility,
    selectedStatus,
    selectedColors.length,
    selectedCardsRange,
    sortBy,
  ]);

  // Render different views
  const renderCollectionsView = () => (
    <div className="space-y-4">
      {filteredAndSortedLists.map((list) => {
        const cardCount = list._count?.cards || 0;
        const hasValue = list.totalValue !== undefined && list.totalValue > 0;

        return (
          <div
            key={list.id}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden active:scale-[0.99] transition-transform touch-manipulation shadow-sm"
            onClick={() => handleView(list)}
          >
            {/* Color accent bar */}
            <div
              className="h-1.5"
              style={{ backgroundColor: list.color || "#10B981" }}
            />

            <div className="p-5">
              {/* Header: Icon + Title + Lock */}
              <div className="flex items-center gap-4 mb-3">
                <div
                  className="flex-shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center"
                  style={{
                    backgroundColor: `${list.color || "#10B981"}15`,
                  }}
                >
                  {list.isOrdered ? (
                    <FolderOpen
                      className="h-7 w-7"
                      style={{ color: list.color || "#3B82F6" }}
                    />
                  ) : (
                    <List
                      className="h-7 w-7"
                      style={{ color: list.color || "#10B981" }}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900 truncate">
                      {list.name}
                    </h3>
                    {!list.isPublic && (
                      <Lock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    )}
                  </div>
                  {list.description && (
                    <p className="text-sm text-slate-500 line-clamp-1 mt-0.5">
                      {list.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-sm text-slate-700">
                  <Package className="h-4 w-4 text-slate-500" />
                  <span className="font-medium">{cardCount}</span>
                  <span className="text-slate-500">
                    {cardCount === 1 ? "carta" : "cartas"}
                  </span>
                </div>

                {list.isOrdered && list.totalPages ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-sm text-slate-600">
                    <FolderOpen className="h-4 w-4 text-slate-500" />
                    <span>{list.totalPages} páginas</span>
                  </div>
                ) : null}

                {hasValue && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-sm">
                    <span className="text-emerald-700 font-semibold">
                      {formatCurrency(list.totalValue!, list.currency)}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions row */}
              <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Quick preview button */}
                <Button
                  onClick={() => handleOpenPreview(list)}
                  variant="outline"
                  className="h-11 w-11 p-0 rounded-xl border-slate-200 hover:bg-blue-50 hover:border-blue-200 flex-shrink-0"
                  title="Vista rápida"
                >
                  <Layers className="h-5 w-5 text-blue-500" />
                </Button>

                <Button
                  onClick={() => handleView(list)}
                  className="flex-1 h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Abrir
                </Button>

                <Button
                  onClick={() => handleAddCards(list)}
                  variant="outline"
                  className="flex-1 h-11 border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-medium"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar
                </Button>

                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleShare(list)}
                    className="h-11 w-11 p-0 rounded-xl hover:bg-slate-100"
                  >
                    <Share2 className="h-5 w-5 text-slate-500" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(list)}
                    className="h-11 w-11 p-0 rounded-xl hover:bg-slate-100"
                  >
                    <Settings className="h-5 w-5 text-slate-500" />
                  </Button>

                  {list.isDeletable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(list)}
                      className="h-11 w-11 p-0 rounded-xl hover:bg-red-50"
                    >
                      <Trash2 className="h-5 w-5 text-slate-400 hover:text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-dvh bg-slate-50 w-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-blue-100 p-2">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">
                Mis Colecciones
              </h1>
              <Badge variant="secondary">
                {filteredAndSortedLists.length}
                {hasActiveFilters && ` de ${lists.length}`}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Controls */}
      <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full lg:max-w-xl">
              <DropdownSearch
                search={searchTerm}
                setSearch={setSearchTerm}
                placeholder="Buscar por nombre o descripción..."
                isInputClear={isInputClear}
                setIsInputClear={setIsInputClear}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
              <Button
                onClick={handleCreateCollection}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Colección</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setImportModalOpen(true)}
                className="flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Package className="w-4 h-4" />
                <span>Importar</span>
              </Button>
              <Button
                variant={hasActiveFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFiltersSidebar(true)}
                className="flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Filter className="w-4 h-4" />
                <span>Filtros</span>
                {activeFilterCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-white text-slate-900 text-xs"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 w-full sm:w-auto"
                >
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card
                key={`skeleton-${index}`}
                className="border border-slate-200 bg-white shadow-sm"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3 min-w-0 flex-1">
                      <div className="w-1.5 rounded-full bg-slate-100" />
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="h-4 w-40 rounded-full bg-slate-100" />
                        <div className="flex gap-2">
                          <div className="h-4 w-16 rounded-full bg-slate-100" />
                          <div className="h-4 w-20 rounded-full bg-slate-100" />
                        </div>
                        <div className="h-3 w-64 rounded-full bg-slate-100" />
                        <div className="flex gap-3">
                          <div className="h-3 w-20 rounded-full bg-slate-100" />
                          <div className="h-3 w-20 rounded-full bg-slate-100" />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 w-8 rounded-full bg-slate-100" />
                      <div className="h-8 w-8 rounded-full bg-slate-100" />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                    <div className="h-9 rounded-md bg-slate-100" />
                    <div className="h-9 rounded-md bg-slate-100" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredAndSortedLists.length === 0 ? (
          <div className="text-center py-20">
            {hasActiveFilters ? (
              <>
                <Search className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  No se encontraron colecciones
                </h3>
                <p className="text-slate-600 mb-6">
                  Intenta ajustar tus filtros o crear una nueva colección
                </p>
                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={clearAllFilters}>
                    Limpiar Filtros
                  </Button>
                  <Button
                    onClick={handleCreateCollection}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Colección
                  </Button>
                </div>
              </>
            ) : (
              <>
                <FolderOpen className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  No tienes colecciones aún
                </h3>
                <p className="text-slate-600 mb-6">
                  Crea tu primera colección para organizar tus cartas
                </p>
                <Button
                  onClick={handleCreateCollection}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Primera Colección
                </Button>
              </>
            )}
          </div>
        ) : (
          <>{renderCollectionsView()}</>
        )}
      </div>

      {/* Filters Sidebar */}
      <ListsFiltersSidebar
        isOpen={showFiltersSidebar}
        setIsOpen={setShowFiltersSidebar}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        selectedVisibility={selectedVisibility}
        setSelectedVisibility={setSelectedVisibility}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        selectedColors={selectedColors}
        setSelectedColors={setSelectedColors}
        selectedCardsRange={selectedCardsRange}
        setSelectedCardsRange={setSelectedCardsRange}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />

      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar lista</DialogTitle>
            <DialogDescription>
              Pega el URL de una lista de Ohara para crear una copia en tu
              cuenta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={importUrl}
              onChange={(event) => setImportUrl(event.target.value)}
              placeholder="https://www.oharatcg.com/lists/34"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setImportModalOpen(false)}
              disabled={isImporting}
            >
              Cancelar
            </Button>
            <Button onClick={handleImportList} disabled={isImporting}>
              {isImporting ? "Importando..." : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      <Dialog
        open={shareModal.open}
        onOpenChange={(open) => setShareModal({ open, list: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartir colección</DialogTitle>
            <DialogDescription>
              Comparte "{shareModal.list?.name}" con otros usuarios
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              {shareModal.list?.isPublic ? (
                <>
                  <Globe className="w-4 h-4 text-green-600" />
                  <span>
                    Esta colección es pública y puede ser vista por cualquiera
                  </span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-orange-600" />
                  <span>Esta colección es privada</span>
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShareModal({ open: false, list: null })}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => shareModal.list && handleCopyLink(shareModal.list)}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar Enlace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal({ open, list: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar colección</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar "{deleteModal.list?.name}"?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteModal({ open: false, list: null })}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Drawer */}
      <BaseDrawer
        isOpen={previewDrawer.open}
        onClose={handleClosePreview}
        maxHeight="90vh"
        desktopModal
        desktopMaxWidth="max-w-3xl"
      >
        {previewDrawer.list && (
          <div className="flex h-full flex-col bg-slate-50 min-h-0">
            {/* Header - Clean and spacious */}
            <div className="shrink-0 bg-white px-6 pt-6 pb-5">
              {/* Close button - top right */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleClosePreview}
                  className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>

              {/* Collection info - centered */}
              <div className="flex flex-col items-center text-center">
                <div
                  className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
                  style={{
                    backgroundColor: `${
                      previewDrawer.list.color || "#10B981"
                    }20`,
                  }}
                >
                  {previewDrawer.list.isOrdered ? (
                    <FolderOpen
                      className="h-8 w-8"
                      style={{ color: previewDrawer.list.color || "#3B82F6" }}
                    />
                  ) : (
                    <List
                      className="h-8 w-8"
                      style={{ color: previewDrawer.list.color || "#10B981" }}
                    />
                  )}
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold text-slate-900">
                    {previewDrawer.list.name}
                  </h2>
                  {!previewDrawer.list.isPublic && (
                    <Lock className="h-4 w-4 text-slate-400" />
                  )}
                </div>

                {previewDrawer.list.description && (
                  <p className="text-sm text-slate-500 mb-4 max-w-md">
                    {previewDrawer.list.description}
                  </p>
                )}

                {/* Stats pills */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-sm">
                    <Package className="h-4 w-4 text-slate-500" />
                    <span className="font-semibold text-slate-700">
                      {previewDrawer.list._count?.cards || 0}
                    </span>
                    <span className="text-slate-500">cartas</span>
                  </div>

                  {previewDrawer.list.isOrdered &&
                  previewDrawer.list.totalPages ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-sm">
                      <FolderOpen className="h-4 w-4 text-slate-500" />
                      <span className="font-semibold text-slate-700">
                        {previewDrawer.list.totalPages}
                      </span>
                      <span className="text-slate-500">páginas</span>
                    </div>
                  ) : null}

                  {previewDrawer.list.totalValue !== undefined &&
                    previewDrawer.list.totalValue > 0 && (
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-sm">
                        <span className="font-bold text-emerald-600">
                          {formatCurrency(
                            previewDrawer.list.totalValue,
                            previewDrawer.list.currency
                          )}
                        </span>
                      </div>
                    )}
                </div>
              </div>
            </div>

            {/* Cards Section */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {previewDrawer.loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-slate-200 border-t-slate-500 animate-spin" />
                  </div>
                  <p className="text-sm text-slate-500 mt-4">
                    Cargando cartas...
                  </p>
                </div>
              ) : previewDrawer.cards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-6">
                  <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mb-5">
                    <Package className="h-10 w-10 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">
                    Colección vacía
                  </h3>
                  <p className="text-sm text-slate-500 text-center mb-6 max-w-xs">
                    Esta colección aún no tiene cartas. Agrega algunas para
                    comenzar.
                  </p>
                  <Button
                    onClick={() => {
                      handleClosePreview();
                      handleAddCards(previewDrawer.list!);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 px-6 rounded-xl"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Agregar Cartas
                  </Button>
                </div>
              ) : (
                <div className="p-5">
                  {/* Section title */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                      Vista previa
                    </h3>
                    <span className="text-xs text-slate-400">
                      {previewDrawer.cards.length} de{" "}
                      {previewDrawer.list._count?.cards || 0}
                    </span>
                  </div>

                  {/* Cards grid - more generous spacing */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-4">
                    {previewDrawer.cards.slice(0, 20).map((listCard, index) => (
                      <div
                        key={`${listCard.cardId}-${index}`}
                        className="relative group cursor-pointer transform transition-transform hover:scale-105 active:scale-95"
                        onClick={() => {
                          handleClosePreview();
                          router.push(`/cards/${listCard.cardId}`);
                        }}
                      >
                        {/* Card container with shadow */}
                        <div className="relative aspect-[2.5/3.5] rounded-xl overflow-hidden bg-white shadow-md ring-1 ring-black/5">
                          <LazyImage
                            src={listCard.card?.src}
                            fallbackSrc="/card-back.webp"
                            alt={listCard.card?.name || "Card"}
                            className="w-full h-full object-cover"
                            size="small"
                            priority={index < 8}
                          />

                          {/* Quantity badge */}
                          {listCard.quantity > 1 && (
                            <div className="absolute top-2 right-2 bg-slate-900 text-white text-xs font-bold min-w-[24px] h-6 flex items-center justify-center px-2 rounded-full shadow-lg">
                              x{listCard.quantity}
                            </div>
                          )}

                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>

                        {/* Card name below (optional, shows on hover) */}
                        {listCard.card?.name && (
                          <p className="mt-2 text-xs text-slate-600 font-medium truncate text-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {listCard.card.name}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Show more indicator if there are more cards */}
                  {previewDrawer.cards.length > 20 && (
                    <div className="mt-6 text-center">
                      <p className="text-sm text-slate-500">
                        +{previewDrawer.cards.length - 20} cartas más
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions - Safe area aware */}
            <div className="shrink-0 bg-white border-t border-slate-200 px-6 py-5 pb-safe">
              <div className="flex gap-4">
                <Button
                  onClick={() => {
                    handleClosePreview();
                    handleView(previewDrawer.list!);
                  }}
                  className="flex-1 h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-sm shadow-sm"
                >
                  <Eye className="w-5 h-5 mr-2" />
                  Ver Colección
                </Button>
                <Button
                  onClick={() => {
                    handleClosePreview();
                    handleAddCards(previewDrawer.list!);
                  }}
                  variant="outline"
                  className="flex-1 h-12 border-slate-300 hover:bg-slate-50 rounded-xl font-semibold text-sm"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Agregar
                </Button>
              </div>
            </div>
          </div>
        )}
      </BaseDrawer>
    </div>
  );
};

export default ListsPage;
