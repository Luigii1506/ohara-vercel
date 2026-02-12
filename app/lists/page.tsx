"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import {
  Plus,
  Package,
  Filter,
  Loader2,
  X,
  Globe,
  Lock,
  Trash2,
  FolderOpen,
  List,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserList, UserListCard } from "@/types";
import DropdownSearch from "@/components/DropdownSearch";
import ListsFiltersSidebar from "@/components/ListsFiltersSidebar";
import BaseDrawer from "@/components/ui/BaseDrawer";
import LazyImage from "@/components/LazyImage";

// New components
import { CollectionCard } from "@/components/lists/CollectionCard";
import { EmptyState } from "@/components/lists/EmptyState";
import { ActiveFilters } from "@/components/lists/ActiveFilters";
import { ListsHeader } from "@/components/lists/ListsHeader";

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
  const [selectedType, setSelectedType] = useState("all");
  const [selectedVisibility, setSelectedVisibility] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedCardsRange, setSelectedCardsRange] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");

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

  // Check if filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      searchTerm.trim() !== "" ||
      selectedType !== "all" ||
      selectedVisibility !== "all" ||
      selectedStatus !== "all" ||
      selectedColors.length > 0 ||
      selectedCardsRange !== "all" ||
      sortBy !== "date-desc"
    );
  }, [
    searchTerm,
    selectedType,
    selectedVisibility,
    selectedStatus,
    selectedColors,
    selectedCardsRange,
    sortBy,
  ]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim() !== "") count += 1;
    if (selectedType !== "all") count += 1;
    if (selectedVisibility !== "all") count += 1;
    if (selectedStatus !== "all") count += 1;
    count += selectedColors.length;
    if (selectedCardsRange !== "all") count += 1;
    if (sortBy !== "date-desc") count += 1;
    return count;
  }, [
    searchTerm,
    selectedType,
    selectedVisibility,
    selectedStatus,
    selectedColors.length,
    selectedCardsRange,
    sortBy,
  ]);

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
          return bDate - aDate;
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

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-dvh bg-slate-50 w-full">
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-200 animate-pulse" />
              <div>
                <div className="w-48 h-6 sm:h-8 bg-slate-200 rounded animate-pulse mb-2" />
                <div className="w-24 h-4 bg-slate-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card
                key={index}
                className="border border-slate-200 bg-white shadow-sm"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-100 animate-pulse" />
                    <div className="flex-1">
                      <div className="w-32 h-5 bg-slate-100 rounded animate-pulse mb-2" />
                      <div className="w-20 h-4 bg-slate-100 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="flex gap-2 mb-4">
                    <div className="w-24 h-8 bg-slate-100 rounded-full animate-pulse" />
                    <div className="w-20 h-8 bg-slate-100 rounded-full animate-pulse" />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 h-10 bg-slate-100 rounded-xl animate-pulse" />
                    <div className="flex-1 h-10 bg-slate-100 rounded-xl animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full">
      {/* Header */}
      <ListsHeader
        count={filteredAndSortedLists.length}
        totalCount={lists.length}
        hasFilters={hasActiveFilters}
        onCreateCollection={handleCreateCollection}
        onImport={() => setImportModalOpen(true)}
        onOpenFilters={() => setShowFiltersSidebar(true)}
        activeFilterCount={activeFilterCount}
      />

      {/* Search & Controls Bar */}
      <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            {/* Search */}
            <div className="w-full sm:max-w-md lg:max-w-lg">
              <DropdownSearch
                search={searchTerm}
                setSearch={setSearchTerm}
                placeholder="Buscar colecciones..."
                isInputClear={isInputClear}
                setIsInputClear={setIsInputClear}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Desktop filter button */}
              <Button
                variant={activeFilterCount > 0 ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFiltersSidebar(true)}
                className="hidden sm:flex h-10 px-4 rounded-xl"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 bg-white text-slate-900 text-xs"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>

              {/* Mobile import button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportModalOpen(true)}
                className="sm:hidden h-10 px-3 rounded-xl"
              >
                <Package className="w-4 h-4" />
              </Button>

              {/* Clear filters - only show on mobile if active */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-10 text-rose-600 hover:text-rose-700 hover:bg-rose-50 sm:hidden"
                >
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Active Filters */}
        <ActiveFilters
          searchTerm={searchTerm}
          selectedType={selectedType}
          selectedVisibility={selectedVisibility}
          selectedStatus={selectedStatus}
          selectedColors={selectedColors}
          selectedCardsRange={selectedCardsRange}
          sortBy={sortBy}
          onClearSearch={() => setSearchTerm("")}
          onClearType={() => setSelectedType("all")}
          onClearVisibility={() => setSelectedVisibility("all")}
          onClearStatus={() => setSelectedStatus("all")}
          onClearColor={(color) =>
            setSelectedColors((prev) => prev.filter((c) => c !== color))
          }
          onClearCardsRange={() => setSelectedCardsRange("all")}
          onClearSort={() => setSortBy("date-desc")}
          onClearAll={clearAllFilters}
        />

        {/* Collections Grid */}
        {filteredAndSortedLists.length === 0 ? (
          <EmptyState
            hasFilters={hasActiveFilters}
            onClearFilters={clearAllFilters}
            onCreateCollection={handleCreateCollection}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {filteredAndSortedLists.map((list) => (
              <CollectionCard
                key={list.id}
                list={list}
                onView={handleView}
                onAddCards={handleAddCards}
                onEdit={handleEdit}
                onShare={handleShare}
                onDelete={handleDelete}
                onPreview={handleOpenPreview}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
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

      {/* Import Modal */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              Importar lista
            </DialogTitle>
            <DialogDescription>
              Pega el URL de una lista de Ohara para crear una copia en tu
              cuenta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://www.oharatcg.com/lists/34"
              className="h-11"
            />
            <p className="text-xs text-slate-500">
              También puedes ingresar solo el número ID de la lista.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setImportModalOpen(false)}
              disabled={isImporting}
              className="h-11"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImportList}
              disabled={isImporting || !importUrl.trim()}
              className="h-11"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Importar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      <Dialog
        open={shareModal.open}
        onOpenChange={(open) => setShareModal({ open, list: null })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {shareModal.list?.isPublic ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-emerald-600" />
                  </div>
                  Compartir colección
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-amber-600" />
                  </div>
                  Colección privada
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {shareModal.list?.isPublic
                ? `Comparte "${shareModal.list?.name}" con otros usuarios`
                : `Esta colección es privada. Cámbiala a pública para compartirla.`}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {shareModal.list?.isPublic ? (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <p className="text-sm text-emerald-800 mb-2">
                  ✨ Esta colección es pública y puede ser vista por cualquiera
                </p>
                <p className="text-xs text-emerald-600">
                  Copia el enlace para compartirla
                </p>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-sm text-amber-800 mb-2">
                  🔒 Esta colección es privada
                </p>
                <p className="text-xs text-amber-600">
                  Ve a configuración para hacerla pública
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShareModal({ open: false, list: null })}
              className="h-11"
            >
              Cerrar
            </Button>
            {shareModal.list?.isPublic && (
              <Button
                onClick={() =>
                  shareModal.list && handleCopyLink(shareModal.list)
                }
                className="h-11 bg-blue-500 hover:bg-blue-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Copiar Enlace
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal({ open, list: null })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Eliminar colección
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar &quot;
              {deleteModal.list?.name}&quot;? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 bg-red-50 rounded-xl border border-red-200">
              <p className="text-sm text-red-800">
                Se eliminarán todas las cartas y configuraciones asociadas a
                esta colección.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteModal({ open: false, list: null })}
              className="h-11"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              className="h-11 bg-red-600 hover:bg-red-700"
            >
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
            {/* Header */}
            <div className="shrink-0 bg-white px-6 pt-6 pb-5">
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleClosePreview}
                  className="h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>

              <div className="flex flex-col items-center text-center">
                <div
                  className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
                  style={{
                    backgroundColor: `${previewDrawer.list.color || "#10B981"}20`,
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

                {/* Stats */}
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
                            previewDrawer.list.currency,
                          )}
                        </span>
                      </div>
                    )}
                </div>
              </div>
            </div>

            {/* Cards Preview */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5">
              {previewDrawer.loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-10 w-10 text-slate-400 animate-spin" />
                  <p className="text-sm text-slate-500 mt-4">
                    Cargando cartas...
                  </p>
                </div>
              ) : previewDrawer.cards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6">
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
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                    Vista previa ({previewDrawer.cards.length} cartas)
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {previewDrawer.cards.slice(0, 15).map((card) => (
                      <div
                        key={card.id}
                        className="aspect-[3/4] rounded-lg overflow-hidden bg-slate-200"
                      >
                        <LazyImage
                          src={card.card?.src || "/card-back.png"}
                          alt={card.card?.name || "Card"}
                          className="w-full h-full object-cover"
                          fallbackSrc="/card-back.png"
                        />
                      </div>
                    ))}
                    {previewDrawer.cards.length > 15 && (
                      <div className="aspect-[3/4] rounded-lg bg-slate-100 flex items-center justify-center">
                        <span className="text-lg font-bold text-slate-500">
                          +{previewDrawer.cards.length - 15}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 bg-white border-t border-slate-200 p-4">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleClosePreview}
                  className="flex-1 h-12 rounded-xl"
                >
                  Cerrar
                </Button>
                <Button
                  onClick={() => {
                    handleClosePreview();
                    handleView(previewDrawer.list!);
                  }}
                  className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-slate-800"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ver Completo
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
