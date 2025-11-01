"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Edit3,
  Trash2,
  Share2,
  Copy,
  Globe,
  Lock,
  Package,
  FolderOpen,
  List,
  Star,
  Home,
  RefreshCw,
  Settings,
  Filter,
  Calendar,
  Users,
  TrendingUp,
  Clock,
  SortAsc,
  SortDesc,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { UserList } from "@/types";
import ListsFiltersSidebar from "@/components/ListsFiltersSidebar";
import ListsViewSwitcher from "@/components/ListsViewSwitcher";

interface ListsPageProps {}

const ListsPage: React.FC<ListsPageProps> = () => {
  const router = useRouter();

  // Core state
  const [lists, setLists] = useState<UserList[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all"); // "all", "folder", "list"
  const [selectedVisibility, setSelectedVisibility] = useState("all"); // "all", "public", "private"
  const [selectedStatus, setSelectedStatus] = useState("all"); // "all", "with-cards", "empty"
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedCardsRange, setSelectedCardsRange] = useState("all"); // "all", "empty", "1-10", "11-50", "51-100", "100+"
  const [sortBy, setSortBy] = useState("date-desc"); // "name-asc", "name-desc", "date-desc", "date-asc", "cards-desc", "cards-asc", etc.

  // View mode
  const [viewMode, setViewMode] = useState<"grid" | "list" | "detailed">(
    "grid"
  );

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

  // Stats for quick filters
  const stats = useMemo(() => {
    const totalLists = lists.length;
    const totalFolders = lists.filter((l) => l.isOrdered).length;
    const totalSimpleLists = lists.filter((l) => !l.isOrdered).length;
    const publicLists = lists.filter((l) => l.isPublic).length;
    const privateLists = lists.filter((l) => !l.isPublic).length;
    const emptyLists = lists.filter((l) => (l._count?.cards || 0) === 0).length;
    const withCardsLists = lists.filter(
      (l) => (l._count?.cards || 0) > 0
    ).length;

    return {
      totalLists,
      totalFolders,
      totalSimpleLists,
      publicLists,
      privateLists,
      emptyLists,
      withCardsLists,
    };
  }, [lists]);

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
    fetchLists();
  }, []);

  // Quick filter actions
  const handleQuickFilter = (filterType: string, value: string) => {
    switch (filterType) {
      case "type":
        setSelectedType(value);
        break;
      case "visibility":
        setSelectedVisibility(value);
        break;
      case "status":
        setSelectedStatus(value);
        break;
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm("");
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

  const handleCreateFolder = () => {
    router.push("/lists/create");
  };

  const handleGoHome = () => {
    router.push("/");
  };

  // Format date
  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Get sort icon
  const getSortIcon = () => {
    if (sortBy.endsWith("-asc")) return <SortAsc className="w-4 h-4" />;
    if (sortBy.endsWith("-desc")) return <SortDesc className="w-4 h-4" />;
    return <Calendar className="w-4 h-4" />;
  };

  // Render different views
  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {filteredAndSortedLists.map((list) => (
        <Card
          key={list.id}
          className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-white overflow-hidden"
        >
          <CardContent className="p-0">
            {/* Header with color bar */}
            <div
              className="h-2"
              style={{ backgroundColor: list.color || "#10B981" }}
            />

            {/* Content */}
            <div className="p-4">
              {/* Title and type */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {list.isOrdered ? (
                      <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    ) : (
                      <List className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                    <h3 className="font-semibold text-gray-900 text-sm truncate">
                      {list.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Badge variant="outline" className="text-xs">
                      {list.isOrdered ? "Carpeta" : "Lista"}
                    </Badge>

                    {list.isPublic ? (
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        <span>Pública</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Privada</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  <span>{list._count?.cards || 0} cartas</span>
                </div>

                {list.isOrdered && (
                  <div className="text-xs">{list.totalPages || 0} páginas</div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                {/* Primary Action - Add Cards (Highlighted) */}
                <Button
                  onClick={() => handleAddCards(list)}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 h-auto"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Agregar
                </Button>

                {/* View */}
                <Button
                  variant="outline"
                  onClick={() => handleView(list)}
                  className="text-sm py-2 h-auto hover:bg-gray-50"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Ver
                </Button>
              </div>

              {/* Secondary Actions */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(list)}
                          className="w-7 h-7 p-0 hover:bg-gray-100"
                        >
                          <Settings className="w-3 h-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Configurar</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShare(list)}
                          className="w-7 h-7 p-0 hover:bg-gray-100"
                        >
                          <Share2 className="w-3 h-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Compartir</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {list.isDeletable && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(list)}
                          className="w-7 h-7 p-0 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Eliminar</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderListView = () => (
    <Card className="border-0 shadow-md">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-8"></TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Visibilidad</TableHead>
            <TableHead>Cartas</TableHead>
            <TableHead>Páginas</TableHead>
            <TableHead>Creada</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAndSortedLists.map((list) => (
            <TableRow key={list.id} className="hover:bg-gray-50">
              <TableCell>
                <div
                  className="w-3 h-8 rounded-sm"
                  style={{ backgroundColor: list.color || "#10B981" }}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {list.isOrdered ? (
                    <FolderOpen className="w-4 h-4 text-blue-500" />
                  ) : (
                    <List className="w-4 h-4 text-green-500" />
                  )}
                  <div>
                    <div className="font-medium">{list.name}</div>
                    {list.description && (
                      <div className="text-sm text-gray-500 truncate">
                        {list.description}
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {list.isOrdered ? "Carpeta" : "Lista"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {list.isPublic ? (
                    <>
                      <Globe className="w-3 h-3 text-green-600" />
                      <span className="text-green-600">Pública</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 text-orange-600" />
                      <span className="text-orange-600">Privada</span>
                    </>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  {list._count?.cards || 0}
                </div>
              </TableCell>
              <TableCell>
                {list.isOrdered ? list.totalPages || 0 : "-"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Clock className="w-3 h-3" />
                  {list.createdAt ? formatDate(list.createdAt) : "-"}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    onClick={() => handleAddCards(list)}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleView(list)}
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(list)}
                  >
                    <Settings className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleShare(list)}
                  >
                    <Share2 className="w-3 h-3" />
                  </Button>
                  {list.isDeletable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(list)}
                      className="hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );

  const renderDetailedView = () => (
    <div className="space-y-4">
      {filteredAndSortedLists.map((list) => (
        <Card
          key={list.id}
          className="border-0 shadow-md hover:shadow-lg transition-shadow"
        >
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              {/* Color indicator and icon */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: list.color || "#10B981" }}
                >
                  {list.isOrdered ? (
                    <FolderOpen className="w-6 h-6 text-white" />
                  ) : (
                    <List className="w-6 h-6 text-white" />
                  )}
                </div>
                <Badge variant="outline" className="text-xs">
                  {list.isOrdered ? "Carpeta" : "Lista"}
                </Badge>
              </div>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {list.name}
                    </h3>
                    {list.description && (
                      <p className="text-gray-600 text-sm">
                        {list.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {list.isPublic ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <Globe className="w-4 h-4" />
                        <span className="text-sm">Pública</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-orange-600">
                        <Lock className="w-4 h-4" />
                        <span className="text-sm">Privada</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="w-4 h-4 text-blue-500" />
                    <span className="text-gray-600">
                      <strong>{list._count?.cards || 0}</strong> cartas
                    </span>
                  </div>

                  {list.isOrdered && (
                    <div className="flex items-center gap-2 text-sm">
                      <FolderOpen className="w-4 h-4 text-green-500" />
                      <span className="text-gray-600">
                        <strong>{list.totalPages || 0}</strong> páginas
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">
                      {list.createdAt ? formatDate(list.createdAt) : "-"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-purple-500" />
                    <span className="text-gray-600">
                      {list.isPublic ? "Compartida" : "Solo tú"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => handleAddCards(list)}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Cartas
                  </Button>

                  <Button variant="outline" onClick={() => handleView(list)}>
                    <Eye className="w-4 h-4 mr-2" />
                    Ver
                  </Button>

                  <Button variant="outline" onClick={() => handleEdit(list)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Configurar
                  </Button>

                  <Button variant="outline" onClick={() => handleShare(list)}>
                    <Share2 className="w-4 h-4 mr-2" />
                    Compartir
                  </Button>

                  {list.isDeletable && (
                    <Button
                      variant="outline"
                      onClick={() => handleDelete(list)}
                      className="hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 w-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left section */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoHome}
                className="flex items-center gap-2 hover:bg-gray-100"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Inicio</span>
              </Button>

              <div className="flex items-center gap-2">
                <FolderOpen className="w-6 h-6 text-blue-500" />
                <h1 className="text-xl font-semibold text-gray-900">
                  Mis Carpetas
                </h1>
                <Badge variant="secondary" className="ml-2">
                  {filteredAndSortedLists.length}
                  {hasActiveFilters && ` de ${lists.length}`}
                </Badge>
              </div>
            </div>

            {/* Right section */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLists}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">Actualizar</span>
              </Button>

              <Button
                onClick={handleCreateFolder}
                className="bg-green-500 hover:bg-green-600 text-white flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Carpeta</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats & Quick Filters Bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stats */}
            <div className="lg:col-span-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.totalLists}
                  </div>
                  <div className="text-xs text-gray-600">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {stats.totalFolders}
                  </div>
                  <div className="text-xs text-gray-600">Carpetas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.publicLists}
                  </div>
                  <div className="text-xs text-gray-600">Públicas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {stats.withCardsLists}
                  </div>
                  <div className="text-xs text-gray-600">Con Cartas</div>
                </div>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">
                Filtros Rápidos
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedType === "folder" ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    handleQuickFilter(
                      "type",
                      selectedType === "folder" ? "all" : "folder"
                    )
                  }
                  className="text-xs"
                >
                  <FolderOpen className="w-3 h-3 mr-1" />
                  Carpetas ({stats.totalFolders})
                </Button>
                <Button
                  variant={
                    selectedVisibility === "public" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() =>
                    handleQuickFilter(
                      "visibility",
                      selectedVisibility === "public" ? "all" : "public"
                    )
                  }
                  className="text-xs"
                >
                  <Globe className="w-3 h-3 mr-1" />
                  Públicas ({stats.publicLists})
                </Button>
                <Button
                  variant={selectedStatus === "empty" ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    handleQuickFilter(
                      "status",
                      selectedStatus === "empty" ? "all" : "empty"
                    )
                  }
                  className="text-xs"
                >
                  <Package className="w-3 h-3 mr-1" />
                  Vacías ({stats.emptyLists})
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Controls Bar */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            {/* Search */}
            <div className="flex-1 w-full lg:max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Buscar por nombre o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              {/* Advanced Filters Button */}
              <Button
                variant={hasActiveFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFiltersSidebar(true)}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filtros</span>
                {hasActiveFilters && (
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-white text-blue-600 text-xs"
                  >
                    ●
                  </Badge>
                )}
              </Button>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Limpiar
                </Button>
              )}

              {/* Sort indicator */}
              <div className="flex items-center gap-1 text-sm text-gray-600">
                {getSortIcon()}
                <span className="hidden sm:inline">
                  {sortBy === "date-desc"
                    ? "Recientes"
                    : sortBy === "name-asc"
                    ? "A-Z"
                    : sortBy === "name-desc"
                    ? "Z-A"
                    : sortBy === "cards-desc"
                    ? "Más cartas"
                    : "Ordenado"}
                </span>
              </div>

              {/* View Switcher */}
              <ListsViewSwitcher
                viewSelected={viewMode}
                setViewSelected={setViewMode}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
              <p className="text-gray-600">Cargando carpetas...</p>
            </div>
          </div>
        ) : filteredAndSortedLists.length === 0 ? (
          <div className="text-center py-20">
            {hasActiveFilters ? (
              <>
                <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No se encontraron carpetas
                </h3>
                <p className="text-gray-600 mb-6">
                  Intenta ajustar tus filtros o crear una nueva carpeta
                </p>
                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={clearAllFilters}>
                    Limpiar Filtros
                  </Button>
                  <Button
                    onClick={handleCreateFolder}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Carpeta
                  </Button>
                </div>
              </>
            ) : (
              <>
                <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No tienes carpetas aún
                </h3>
                <p className="text-gray-600 mb-6">
                  Crea tu primera carpeta para organizar tus cartas
                </p>
                <Button
                  onClick={handleCreateFolder}
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Primera Carpeta
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            {viewMode === "grid" && renderGridView()}
            {viewMode === "list" && renderListView()}
            {viewMode === "detailed" && renderDetailedView()}
          </>
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

      {/* Share Modal */}
      <Dialog
        open={shareModal.open}
        onOpenChange={(open) => setShareModal({ open, list: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartir carpeta</DialogTitle>
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
                    Esta carpeta es pública y puede ser vista por cualquiera
                  </span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-orange-600" />
                  <span>Esta carpeta es privada</span>
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
            <DialogTitle>Eliminar carpeta</DialogTitle>
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
    </div>
  );
};

export default ListsPage;
