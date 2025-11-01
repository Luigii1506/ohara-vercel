// Página de gestión de listados del vendedor renovada - Ohara TCG Shop
// Fecha de modificación: 2025-01-19 - Tabla de inventario profesional

"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  Filter,
  MoreHorizontal,
  AlertTriangle,
  Package,
  DollarSign,
  TrendingUp,
  BarChart3,
  RefreshCw,
  Download,
  Upload,
  Settings,
  Star,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import {
  CardListing,
  ProductFilters,
  PaginatedResponse,
} from "@/lib/shop/types";
import { formatPrice, getStockStatus } from "@/lib/shop/utils";

export default function SellerListings() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [listings, setListings] = useState<CardListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active"); // Solo activos por defecto
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("listingDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Selección múltiple y vista
  const [selectedListings, setSelectedListings] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Verificar autenticación
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/login");
      return;
    }

    fetchListings();
  }, [
    session,
    status,
    router,
    currentPage,
    searchQuery,
    statusFilter,
    stockFilter,
    sortBy,
    sortOrder,
  ]);

  const fetchListings = async () => {
    try {
      setLoading(true);

      // Construir parámetros de consulta
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        sortBy,
        sortOrder,
      });

      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      // Siempre filtrar por productos activos y no-borrador (productos en venta real)
      if (statusFilter === "active" || statusFilter === "all") {
        params.set("isActive", "true");
        params.set("isDraft", "false");
      } else if (statusFilter === "draft") {
        params.set("isDraft", "true");
      } else if (statusFilter === "inactive") {
        params.set("isActive", "false");
        params.set("isDraft", "false");
      }

      if (stockFilter && stockFilter !== "all") {
        if (stockFilter === "in_stock") {
          params.set("inStock", "true");
        } else if (stockFilter === "low_stock") {
          params.set("lowStock", "true");
        } else if (stockFilter === "out_of_stock") {
          params.set("minPrice", "0");
          params.set("maxPrice", "0");
        }
      }

      const response = await fetch(`/api/seller/listings?${params.toString()}`);

      // Verificar si la respuesta tiene contenido antes de intentar parsear JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("La respuesta del servidor no es JSON válido");
      }

      const text = await response.text();
      if (!text) {
        throw new Error("El servidor devolvió una respuesta vacía");
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Error parsing JSON:", text);
        throw new Error("Respuesta del servidor no es JSON válido");
      }

      if (!response.ok) {
        throw new Error(data.error || "Error obteniendo listados");
      }

      if (data.success && data.data) {
        setListings(data.data.data || []);
        setCurrentPage(data.data.meta?.page || 1);
        setTotalPages(data.data.meta?.totalPages || 1);
        setTotalItems(data.data.meta?.total || 0);
      } else {
        setListings([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error("Error fetching listings:", err);
      setError(err instanceof Error ? err.message : "Error cargando listados");
      setListings([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (listingId: number) => {
    if (!confirm("¿Estás seguro de que quieres desactivar este listado?"))
      return;

    try {
      const response = await fetch(`/api/shop/listings/${listingId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error desactivando listado");
      }

      // Recargar listados
      fetchListings();
    } catch (err) {
      console.error("Error deleting listing:", err);
      alert(err instanceof Error ? err.message : "Error desactivando listado");
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchListings();
  };

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("active"); // Volver a mostrar solo activos
    setStockFilter("all");
    setSortBy("listingDate");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  // Funciones de selección múltiple
  const selectAllListings = () => {
    const allIds = listings.map((listing) => listing.id);
    setSelectedListings(allIds);
  };

  const deselectAllListings = () => {
    setSelectedListings([]);
  };

  const toggleListingSelection = (id: number) => {
    setSelectedListings((prev) =>
      prev.includes(id)
        ? prev.filter((listingId) => listingId !== id)
        : [...prev, id]
    );
  };

  const isAllSelected =
    selectedListings.length === listings.length && listings.length > 0;
  const isPartialSelected =
    selectedListings.length > 0 && selectedListings.length < listings.length;

  // Funciones de acciones masivas
  const handleBulkAction = async (action: string) => {
    if (selectedListings.length === 0) return;

    const confirmMessage =
      action === "delete"
        ? "¿Desactivar los listados seleccionados?"
        : action === "activate"
        ? "¿Activar los listados seleccionados?"
        : action === "deactivate"
        ? "¿Desactivar los listados seleccionados?"
        : "¿Continuar con la acción?";

    if (!confirm(confirmMessage)) return;

    // TODO: Implementar acciones masivas en el API
    console.log(`Acción ${action} en listados:`, selectedListings);

    // Limpiar selección después de la acción
    setSelectedListings([]);
    fetchListings();
  };

  // Función para cambiar el ordenamiento
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // Calcular métricas rápidas
  const metrics = {
    total: totalItems,
    active: listings.filter((l) => l.isActive && !l.isDraft).length,
    draft: listings.filter((l) => l.isDraft).length,
    lowStock: listings.filter(
      (l) => (l.stock || 0) <= (l.lowStockThreshold || 5)
    ).length,
    totalValue:
      listings.reduce((sum, l) => sum + (l.price || 0) * (l.stock || 0), 0) /
      100,
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 w-full">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto"></div>
            <Package className="h-8 w-8 text-blue-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-4 text-lg font-medium text-gray-700">
            Cargando inventario...
          </p>
          <p className="text-sm text-gray-500">
            Preparando tu tabla de gestión
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 w-full">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchListings} variant="outline">
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 w-full">
      {/* Header Premium */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <Link href="/seller">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Panel
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Package className="w-7 h-7 text-blue-500" />
                  Productos en Venta
                </h1>
                <p className="text-gray-600 text-sm">
                  {totalItems} productos • {selectedListings.length}{" "}
                  seleccionados
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchListings()}
                disabled={loading}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Actualizar
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
              <Link href="/seller/listings/new">
                <Button className="bg-green-500 hover:bg-green-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Listar Producto
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Nota informativa */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <Package className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900">
                Productos Activos en Venta
              </h3>
              <p className="text-sm text-blue-700">
                Aquí ves <strong>únicamente</strong> los productos que están{" "}
                <strong>activos y disponibles para compra</strong> por los
                clientes. Para gestionar todo tu inventario físico (incluyendo
                borradores), ve a{" "}
                <Link
                  href="/seller/inventory"
                  className="underline font-medium"
                >
                  Control de Inventario
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Métricas Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card className="!h-max border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-xl font-bold text-gray-900">
                    {metrics.total}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="!h-max border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Activos</p>
                  <p className="text-xl font-bold text-gray-900">
                    {metrics.active}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="!h-max border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500 rounded-lg">
                  <Edit className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Borradores</p>
                  <p className="text-xl font-bold text-gray-900">
                    {metrics.draft}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="!h-max border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Bajo Stock</p>
                  <p className="text-xl font-bold text-gray-900">
                    {metrics.lowStock}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="!h-max border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Valor Total</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatPrice(Math.round(metrics.totalValue * 100))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel de Herramientas */}
        <Card className="!h-max border-0 shadow-md mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row items-center gap-4">
              {/* Búsqueda */}
              <div className="flex-1 w-full">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por nombre, código, SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-gray-300"
                    onKeyDown={(e) => e.key === "Enter" && handleSearch(e)}
                  />
                </div>
              </div>

              {/* Filtros rápidos */}
              <div className="flex items-center gap-3">
                <Button
                  variant={showFilters ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filtros
                </Button>

                {selectedListings.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="text-sm font-medium text-blue-700">
                      {selectedListings.length} seleccionados
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleBulkAction("activate")}
                      className="h-6 px-2 text-xs text-green-600 hover:text-green-700"
                    >
                      Activar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleBulkAction("deactivate")}
                      className="h-6 px-2 text-xs text-yellow-600 hover:text-yellow-700"
                    >
                      Desactivar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleBulkAction("delete")}
                      className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                    >
                      Eliminar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={deselectAllListings}
                      className="h-6 px-2 text-xs"
                    >
                      ×
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Panel de filtros expandible */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="border-gray-300">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        Solo Activos (recomendado)
                      </SelectItem>
                      <SelectItem value="all">Activos + Borradores</SelectItem>
                      <SelectItem value="draft">Solo Borradores</SelectItem>
                      <SelectItem value="inactive">Solo Inactivos</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={stockFilter} onValueChange={setStockFilter}>
                    <SelectTrigger className="border-gray-300">
                      <SelectValue placeholder="Stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todo el stock</SelectItem>
                      <SelectItem value="in_stock">En stock</SelectItem>
                      <SelectItem value="low_stock">Stock bajo</SelectItem>
                      <SelectItem value="out_of_stock">Sin stock</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    onClick={resetFilters}
                    className="border-gray-300"
                  >
                    Limpiar Filtros
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabla de Inventario */}
        <Card className="!h-max border-0 shadow-lg">
          <CardContent className="p-0">
            {listings.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No hay productos en venta
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery ||
                  statusFilter !== "active" ||
                  stockFilter !== "all"
                    ? "No se encontraron productos activos con los filtros aplicados"
                    : "No tienes productos listados para venta. Selecciona productos de tu inventario para empezar a vender."}
                </p>
                <Link href="/seller/listings/new">
                  <Button className="bg-green-500 hover:bg-green-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Listar del Inventario
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="w-12">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={(checked) => {
                            if (checked) selectAllListings();
                            else deselectAllListings();
                          }}
                        />
                      </TableHead>
                      <TableHead className="w-20">Imagen</TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center gap-1">
                          Producto
                          {sortBy === "name" &&
                            (sortOrder === "asc" ? (
                              <ArrowUp className="w-4 h-4" />
                            ) : (
                              <ArrowDown className="w-4 h-4" />
                            ))}
                        </div>
                      </TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Condición</TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("price")}
                      >
                        <div className="flex items-center gap-1">
                          Precio
                          {sortBy === "price" &&
                            (sortOrder === "asc" ? (
                              <ArrowUp className="w-4 h-4" />
                            ) : (
                              <ArrowDown className="w-4 h-4" />
                            ))}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("stock")}
                      >
                        <div className="flex items-center gap-1">
                          Stock
                          {sortBy === "stock" &&
                            (sortOrder === "asc" ? (
                              <ArrowUp className="w-4 h-4" />
                            ) : (
                              <ArrowDown className="w-4 h-4" />
                            ))}
                        </div>
                      </TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-24">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listings.map((listing) => {
                      const stockStatus = getStockStatus(
                        listing.stock || 0,
                        listing.lowStockThreshold || 5
                      );
                      const isSelected = selectedListings.includes(listing.id);

                      return (
                        <TableRow
                          key={listing.id}
                          className={`hover:bg-gray-50 ${
                            isSelected ? "bg-blue-50" : ""
                          }`}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() =>
                                toggleListingSelection(listing.id)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="w-12 h-16 bg-gray-100 rounded overflow-hidden">
                              <img
                                src={
                                  listing.card?.src ||
                                  "/assets/images/backcard.webp"
                                }
                                alt={listing.card?.name || "Carta"}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    "/assets/images/backcard.webp";
                                }}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              <p className="font-medium text-gray-900 truncate">
                                {listing.card?.name || "Sin nombre"}
                              </p>
                              <p className="text-sm text-gray-500 truncate">
                                {listing.card?.setCode}
                              </p>
                              {listing.sku && (
                                <p className="text-xs text-gray-400">
                                  SKU: {listing.sku}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                              {listing.card?.code || "---"}
                            </code>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {listing.conditionForSale || "No especificada"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-lg">
                              {listing.price
                                ? formatPrice(listing.price)
                                : "---"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={stockStatus.color as any}
                                className="text-xs"
                              >
                                {listing.stock || 0}
                              </Badge>
                              {stockStatus.status === "low_stock" && (
                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Badge
                                variant={
                                  listing.isActive ? "default" : "secondary"
                                }
                                className="text-xs"
                              >
                                {listing.isDraft
                                  ? "Borrador"
                                  : listing.isActive
                                  ? "Activo"
                                  : "Inactivo"}
                              </Badge>
                              {listing.isFeatured && (
                                <Star className="w-3 h-3 text-yellow-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Link href={`/seller/listings/${listing.id}`}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </Link>
                              <Link
                                href={`/seller/listings/${listing.id}/edit`}
                              >
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </Link>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(listing.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Paginación Mejorada */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Mostrando</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => setItemsPerPage(Number(value))}
              >
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span>de {totalItems} productos</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
              >
                Primero
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const pageNum = currentPage - 2 + i;
                  if (pageNum < 1 || pageNum > totalPages) return null;

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
              >
                Último
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
