"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import {
  Plus,
  Package,
  Filter,
  Loader2,
  Globe,
  Lock,
  Trash2,
  FolderOpen,
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
import { convertForListDisplay } from "@/lib/lists/currency";
import DropdownSearch from "@/components/DropdownSearch";
import ListsFiltersSidebar from "@/components/ListsFiltersSidebar";
import BaseDrawer from "@/components/ui/BaseDrawer";
import LazyImage from "@/components/LazyImage";
import { CollectionCard } from "@/components/lists/CollectionCard";
import { EmptyState } from "@/components/lists/EmptyState";
import { ActiveFilters } from "@/components/lists/ActiveFilters";
import { ListsHeader } from "@/components/lists/ListsHeader";
import { LIST_PURPOSE_LABELS, type ListPurpose } from "@/lib/lists/purpose";

type ListsWorkspaceProps = {
  title: string;
  createLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  filteredEmptyTitle: string;
  filteredEmptyDescription: string;
  searchPlaceholder: string;
  defaultPurpose?: "all" | ListPurpose;
  lockedPurpose?: ListPurpose | null;
};

export function ListsWorkspace({
  title,
  createLabel,
  emptyTitle,
  emptyDescription,
  filteredEmptyTitle,
  filteredEmptyDescription,
  searchPlaceholder,
  defaultPurpose = "all",
  lockedPurpose = null,
}: ListsWorkspaceProps) {
  const router = useRouter();
  const { status } = useSession();
  const [lists, setLists] = useState<UserList[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isInputClear, setIsInputClear] = useState(false);
  const [selectedType, setSelectedType] = useState("all");
  const [selectedPurpose, setSelectedPurpose] = useState<string>(
    lockedPurpose ?? defaultPurpose
  );
  const [selectedVisibility, setSelectedVisibility] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedCardsRange, setSelectedCardsRange] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");
  const [showFiltersSidebar, setShowFiltersSidebar] = useState(false);
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
  const [previewDrawer, setPreviewDrawer] = useState<{
    open: boolean;
    list: UserList | null;
    cards: UserListCard[];
    loading: boolean;
  }>({ open: false, list: null, cards: [], loading: false });

  useEffect(() => {
    setSelectedPurpose(lockedPurpose ?? defaultPurpose);
  }, [defaultPurpose, lockedPurpose]);

  const purposeBaseline = lockedPurpose ?? defaultPurpose;

  const hasActiveFilters = useMemo(
    () =>
      searchTerm.trim() !== "" ||
      selectedType !== "all" ||
      selectedPurpose !== purposeBaseline ||
      selectedVisibility !== "all" ||
      selectedStatus !== "all" ||
      selectedColors.length > 0 ||
      selectedCardsRange !== "all" ||
      sortBy !== "date-desc",
    [
      purposeBaseline,
      searchTerm,
      selectedType,
      selectedPurpose,
      selectedVisibility,
      selectedStatus,
      selectedColors,
      selectedCardsRange,
      sortBy,
    ]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim() !== "") count += 1;
    if (selectedType !== "all") count += 1;
    if (selectedPurpose !== purposeBaseline) count += 1;
    if (selectedVisibility !== "all") count += 1;
    if (selectedStatus !== "all") count += 1;
    count += selectedColors.length;
    if (selectedCardsRange !== "all") count += 1;
    if (sortBy !== "date-desc") count += 1;
    return count;
  }, [
    purposeBaseline,
    searchTerm,
    selectedType,
    selectedPurpose,
    selectedVisibility,
    selectedStatus,
    selectedColors.length,
    selectedCardsRange,
    sortBy,
  ]);

  const filteredAndSortedLists = useMemo(() => {
    const filtered = lists.filter((list) => {
      const matchesSearch =
        list.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (list.description || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      const matchesType =
        selectedType === "all" ||
        (selectedType === "folder" && list.isOrdered) ||
        (selectedType === "list" && !list.isOrdered);
      const matchesPurpose =
        selectedPurpose === "all" || list.purpose === selectedPurpose;
      const matchesVisibility =
        selectedVisibility === "all" ||
        (selectedVisibility === "public" && list.isPublic) ||
        (selectedVisibility === "private" && !list.isPublic);
      const cardCount = list._count?.cards || 0;
      const matchesStatus =
        selectedStatus === "all" ||
        (selectedStatus === "with-cards" && cardCount > 0) ||
        (selectedStatus === "empty" && cardCount === 0);
      const matchesColor =
        selectedColors.length === 0 ||
        selectedColors.includes(list.color || "gray");
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
        matchesPurpose &&
        matchesVisibility &&
        matchesStatus &&
        matchesColor &&
        matchesCardsRange
      );
    });

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
    selectedPurpose,
    selectedVisibility,
    selectedStatus,
    selectedColors,
    selectedCardsRange,
    sortBy,
  ]);

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
  }, [router, status]);

  const clearAllFilters = () => {
    setSearchTerm("");
    setIsInputClear(true);
    setSelectedType("all");
    setSelectedPurpose(purposeBaseline);
    setSelectedVisibility("all");
    setSelectedStatus("all");
    setSelectedColors([]);
    setSelectedCardsRange("all");
    setSortBy("date-desc");
  };

  const formatCurrency = (
    value: number,
    currency?: string | null,
    listForCurrency?: UserList | null
  ) => {
    const sourceCurrency = currency || "USD";
    const { value: displayValue, currency: displayCurrencyCode } =
      sourceCurrency === "USD"
        ? convertForListDisplay(value, listForCurrency)
        : { value, currency: sourceCurrency };

    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: displayCurrencyCode,
      minimumFractionDigits: 2,
    }).format(displayValue);
  };

  const extractListId = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
    try {
      const url = new URL(trimmed);
      const match = url.pathname.match(/\/lists\/(\d+)/);
      return match?.[1] ? Number.parseInt(match[1], 10) : null;
    } catch {
      const match = trimmed.match(/\/lists\/(\d+)/);
      return match?.[1] ? Number.parseInt(match[1], 10) : null;
    }
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
              <Card key={index} className="border border-slate-200 bg-white shadow-sm">
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
      <ListsHeader
        title={title}
        createLabel={createLabel}
        count={filteredAndSortedLists.length}
        totalCount={lists.length}
        hasFilters={hasActiveFilters}
        onCreateCollection={() => {
          const params = new URLSearchParams();
          if (purposeBaseline !== "all") params.set("purpose", purposeBaseline);
          router.push(`/lists/create${params.toString() ? `?${params.toString()}` : ""}`);
        }}
        onImport={() => setImportModalOpen(true)}
        onOpenFilters={() => setShowFiltersSidebar(true)}
        activeFilterCount={activeFilterCount}
      />

      <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-md lg:max-w-lg">
              <DropdownSearch
                search={searchTerm}
                setSearch={setSearchTerm}
                placeholder={searchPlaceholder}
                isInputClear={isInputClear}
                setIsInputClear={setIsInputClear}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={activeFilterCount > 0 ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFiltersSidebar(true)}
                className="hidden sm:flex h-10 px-4 rounded-xl"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2 bg-white text-slate-900 text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportModalOpen(true)}
                className="sm:hidden h-10 px-3 rounded-xl"
              >
                <Package className="w-4 h-4" />
              </Button>

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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <ActiveFilters
          searchTerm={searchTerm}
          selectedType={selectedType}
          selectedPurpose={selectedPurpose}
          selectedVisibility={selectedVisibility}
          selectedStatus={selectedStatus}
          selectedColors={selectedColors}
          selectedCardsRange={selectedCardsRange}
          sortBy={sortBy}
          onClearSearch={() => setSearchTerm("")}
          onClearType={() => setSelectedType("all")}
          onClearPurpose={() => setSelectedPurpose(purposeBaseline)}
          onClearVisibility={() => setSelectedVisibility("all")}
          onClearStatus={() => setSelectedStatus("all")}
          onClearColor={(color) =>
            setSelectedColors((prev) => prev.filter((c) => c !== color))
          }
          onClearCardsRange={() => setSelectedCardsRange("all")}
          onClearSort={() => setSortBy("date-desc")}
          onClearAll={clearAllFilters}
        />

        {!lockedPurpose && (
          <div className="mb-5 flex flex-wrap gap-2">
            <Button
              variant={selectedPurpose === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPurpose("all")}
              className="rounded-full"
            >
              Todas
            </Button>
            {(["GENERAL", "INVENTORY", "WISHLIST"] as ListPurpose[]).map(
              (purpose) => (
                <Button
                  key={purpose}
                  variant={selectedPurpose === purpose ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPurpose(purpose)}
                  className="rounded-full"
                >
                  {LIST_PURPOSE_LABELS[purpose]}
                </Button>
              )
            )}
          </div>
        )}

        {filteredAndSortedLists.length === 0 ? (
          <EmptyState
            hasFilters={hasActiveFilters}
            onClearFilters={clearAllFilters}
            onCreateCollection={() => {
              const params = new URLSearchParams();
              if (purposeBaseline !== "all") params.set("purpose", purposeBaseline);
              router.push(`/lists/create${params.toString() ? `?${params.toString()}` : ""}`);
            }}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            filteredEmptyTitle={filteredEmptyTitle}
            filteredEmptyDescription={filteredEmptyDescription}
            createLabel={createLabel}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {filteredAndSortedLists.map((list) => (
              <CollectionCard
                key={list.id}
                list={list}
                onView={(value) => router.push(`/lists/${value.id}`)}
                onAddCards={(value) => router.push(`/lists/${value.id}/add-cards`)}
                onEdit={(value) => router.push(`/lists/${value.id}/edit`)}
                onShare={(value) => setShareModal({ open: true, list: value })}
                onDelete={(value) => setDeleteModal({ open: true, list: value })}
                onPreview={async (value) => {
                  setPreviewDrawer({
                    open: true,
                    list: value,
                    cards: [],
                    loading: true,
                  });
                  try {
                    const response = await fetch(`/api/lists/${value.id}`);
                    if (!response.ok) {
                      throw new Error("Error al cargar las cartas");
                    }
                    const data = await response.json();
                    setPreviewDrawer({
                      open: true,
                      list: value,
                      cards: data.cards || [],
                      loading: false,
                    });
                  } catch (error) {
                    console.error("Error fetching list cards:", error);
                    toast.error("Error al cargar las cartas");
                    setPreviewDrawer((prev) => ({ ...prev, loading: false }));
                  }
                }}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        )}
      </div>

      <ListsFiltersSidebar
        isOpen={showFiltersSidebar}
        setIsOpen={setShowFiltersSidebar}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        selectedPurpose={selectedPurpose}
        setSelectedPurpose={setSelectedPurpose}
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
        lockedPurpose={lockedPurpose}
      />

      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              Importar lista
            </DialogTitle>
            <DialogDescription>
              Pega el URL de una lista de Ohara para crear una copia en tu cuenta.
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
              onClick={async () => {
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
              }}
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
                  Compartir lista
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-amber-600" />
                  </div>
                  Lista privada
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {shareModal.list?.isPublic
                ? `Comparte "${shareModal.list?.name}" con otros usuarios`
                : "Esta lista es privada. Cámbiala a pública para compartirla."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {shareModal.list?.isPublic ? (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <p className="text-sm text-emerald-800 mb-2">
                  Esta lista es pública y puede ser vista por cualquiera
                </p>
                <p className="text-xs text-emerald-600">
                  Copia el enlace para compartirla
                </p>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-sm text-amber-800 mb-2">Esta lista es privada</p>
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
                onClick={async () => {
                  if (!shareModal.list) return;
                  try {
                    const url = `${window.location.origin}/shared-lists/${shareModal.list.id}`;
                    await navigator.clipboard.writeText(url);
                    toast.success("Enlace copiado al portapapeles");
                    setShareModal({ open: false, list: null });
                  } catch {
                    toast.error("Error al copiar el enlace");
                  }
                }}
                className="h-11 bg-blue-500 hover:bg-blue-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Copiar Enlace
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal({ open, list: null })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Eliminar lista
            </DialogTitle>
            <DialogDescription>
              {deleteModal.list
                ? `Esta acción eliminará "${deleteModal.list.name}" permanentemente.`
                : "Esta acción eliminará la lista permanentemente."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteModal({ open: false, list: null })}
              className="h-11"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmDelete}
              className="h-11 bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BaseDrawer
        isOpen={previewDrawer.open}
        onClose={() =>
          setPreviewDrawer({ open: false, list: null, cards: [], loading: false })
        }
        maxHeight="90vh"
        desktopModal
        desktopMaxWidth="max-w-4xl"
      >
        <div className="bg-white rounded-t-3xl lg:rounded-2xl border border-slate-200 w-full max-h-[90vh] flex flex-col">
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold text-slate-900 truncate">
                  {previewDrawer.list?.name || "Vista rápida"}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {previewDrawer.cards.length} cartas en la lista
                </p>
              </div>
              {previewDrawer.list?.color && (
                <div
                  className="w-8 h-8 rounded-full border-4 border-white shadow-lg flex-shrink-0"
                  style={{ backgroundColor: previewDrawer.list.color }}
                />
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {previewDrawer.loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Card key={index} className="border border-slate-200">
                    <CardContent className="p-3">
                      <div className="aspect-[0.7] bg-slate-100 rounded-lg animate-pulse mb-3" />
                      <div className="w-3/4 h-4 bg-slate-100 rounded animate-pulse mb-2" />
                      <div className="w-1/2 h-3 bg-slate-100 rounded animate-pulse" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : previewDrawer.cards.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  Lista vacía
                </h3>
                <p className="text-slate-500">
                  Esta lista no tiene cartas para previsualizar
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {previewDrawer.cards.slice(0, 12).map((item) => (
                  <Card key={item.id} className="border border-slate-200 overflow-hidden">
                    <CardContent className="p-0">
                      <div className="relative aspect-[0.7] bg-slate-50">
                        <LazyImage
                          src={item.card?.src || ""}
                          fallbackSrc={item.card?.src || ""}
                          alt={item.card?.name || "Carta"}
                          className="h-full"
                          objectFit="contain"
                        />
                      </div>
                      <div className="p-3">
                        <h4 className="font-medium text-slate-900 text-sm line-clamp-1 mb-1">
                          {item.card?.name}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {item.card?.code}
                        </p>
                        {item.quantity > 1 && (
                          <Badge
                            variant="secondary"
                            className="mt-2 text-xs bg-blue-100 text-blue-700"
                          >
                            x{item.quantity}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          {previewDrawer.cards.length > 12 && !previewDrawer.loading && (
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <p className="text-sm text-slate-500 text-center">
                Mostrando 12 de {previewDrawer.cards.length} cartas
              </p>
            </div>
          )}
        </div>
      </BaseDrawer>
    </div>
  );
}
