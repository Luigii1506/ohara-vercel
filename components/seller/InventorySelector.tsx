// Componente para seleccionar productos del inventario para listar - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Package,
  CheckCircle,
  AlertTriangle,
  Grid,
  List,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InventoryItem {
  id: number;
  cardId: number;
  sku: string;
  card: {
    name: string;
    code: string;
    src: string;
    setCode: string;
  };
  condition: string;
  currentStock: number;
  availableStock: number;
  listPrice: number;
  isListed: boolean;
  status: string;
}

interface InventorySelectorProps {
  onItemSelect: (item: InventoryItem) => void;
  selectedItem?: InventoryItem | null;
}

export default function InventorySelector({
  onItemSelect,
  selectedItem,
}: InventorySelectorProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>("not_listed");
  const [stockFilter, setStockFilter] = useState<string>("all");

  const fetchItems = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
      });

      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      if (statusFilter === "not_listed") {
        params.set("isListed", "false");
      } else if (statusFilter === "listed") {
        params.set("isListed", "true");
      }

      if (stockFilter === "low_stock") {
        params.set("lowStock", "true");
      }

      const response = await fetch(
        `/api/seller/inventory?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Error cargando inventario");
      }

      const data = await response.json();

      if (data.success) {
        setItems(data.data.items);
        setTotalPages(data.data.pagination.last_page);
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [currentPage, searchQuery, statusFilter, stockFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchItems();
  };

  const getItemImage = (item: InventoryItem) => {
    return item.card.src || "/assets/images/backcard.webp";
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.availableStock === 0) {
      return { color: "destructive", text: "Sin Stock", icon: AlertTriangle };
    } else if (item.availableStock <= 5) {
      return {
        color: "secondary",
        text: "Stock Bajo",
        icon: AlertTriangle,
        className: "bg-orange-100 text-orange-700",
      };
    } else {
      return { color: "default", text: "En Stock", icon: Package };
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando inventario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda y filtros */}
      <Card className="!h-max border-0 shadow-md">
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Búsqueda */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar en tu inventario..."
                  className="pl-10"
                />
              </div>
              <Button type="submit" disabled={loading}>
                <Search className="w-4 h-4" />
              </Button>
            </form>

            {/* Filtros y vista */}
            <div className="flex items-center gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Estado de listado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_listed">No listados</SelectItem>
                  <SelectItem value="listed">Ya listados</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el stock</SelectItem>
                  <SelectItem value="low_stock">Stock bajo</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1 ml-auto">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid/Lista de productos del inventario */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {items.map((item) => {
            const stockStatus = getStockStatus(item);
            const isSelected = selectedItem?.id === item.id;

            return (
              <Card
                key={item.id}
                className={`cursor-pointer hover:shadow-lg transition-all ${
                  isSelected ? "ring-2 ring-blue-500 shadow-lg" : ""
                } ${item.isListed ? "opacity-60" : ""}`}
                onClick={() => onItemSelect(item)}
              >
                <CardContent className="p-2">
                  <div className="relative">
                    <img
                      src={getItemImage(item)}
                      alt={item.card.name}
                      className="w-full aspect-[2.5/3.5] object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/assets/images/backcard.webp";
                      }}
                    />
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-1">
                        <CheckCircle className="w-3 h-3" />
                      </div>
                    )}
                    {item.isListed && (
                      <div className="absolute top-1 left-1 bg-green-500 text-white rounded-full p-1">
                        <Package className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium truncate">
                      {item.card.name}
                    </p>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {item.card.code}
                      </Badge>
                      <Badge
                        variant={stockStatus.color as any}
                        className={`text-xs ${stockStatus.className || ""}`}
                      >
                        {item.availableStock}
                      </Badge>
                    </div>
                    {item.isListed && (
                      <Badge variant="secondary" className="text-xs w-full">
                        Ya listado
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="!h-max border-0 shadow-md">
          <CardContent className="p-0">
            <div className="space-y-0">
              {items.map((item) => {
                const stockStatus = getStockStatus(item);
                const isSelected = selectedItem?.id === item.id;

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                      isSelected
                        ? "bg-blue-50 border-l-4 border-l-blue-500"
                        : ""
                    } ${item.isListed ? "opacity-60" : ""}`}
                    onClick={() => onItemSelect(item)}
                  >
                    <div className="w-16 h-20 flex-shrink-0">
                      <img
                        src={getItemImage(item)}
                        alt={item.card.name}
                        className="w-full h-full object-cover rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "/assets/images/backcard.webp";
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {item.card.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {item.card.code} • {item.card.setCode}
                      </p>
                      <p className="text-sm text-gray-600">
                        Condición: {item.condition}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant={stockStatus.color as any}
                          className={`text-xs ${stockStatus.className || ""}`}
                        >
                          Stock: {item.availableStock}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          ${item.listPrice.toFixed(2)}
                        </Badge>
                        {item.isListed && (
                          <Badge variant="secondary" className="text-xs">
                            Ya listado
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {isSelected ? (
                        <div className="flex items-center gap-2 text-blue-600">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            Seleccionado
                          </span>
                        </div>
                      ) : item.isListed ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <Package className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            Ya listado
                          </span>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline">
                          Seleccionar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado vacío */}
      {!loading && items.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay productos en tu inventario
          </h3>
          <p className="text-gray-600 mb-4">
            {statusFilter === "not_listed"
              ? "No tienes productos sin listar en tu inventario"
              : "Agrega productos a tu inventario para poder listarlos"}
          </p>
          <Button variant="outline">
            <Package className="w-4 h-4 mr-2" />
            Agregar al Inventario
          </Button>
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Anterior
          </Button>

          <span className="text-sm text-gray-600">
            Página {currentPage} de {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {loading && items.length > 0 && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mx-auto"></div>
        </div>
      )}
    </div>
  );
}
