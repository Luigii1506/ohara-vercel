// Página de gestión de inventario del vendedor - Ohara TCG Shop
// Fecha de modificación: 2025-01-19 - Control operativo de stock y logística

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Package,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Plus,
  Minus,
  RotateCcw,
  Download,
  Upload,
  Search,
  Filter,
  RefreshCw,
  DollarSign,
  Target,
  Activity,
  BarChart3,
  Truck,
  Calculator,
  Clock,
  Archive,
  AlertCircle,
  CheckCircle,
  XCircle,
  Edit,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/shop/utils";

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
  language: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  reorderPoint: number;
  costPrice: number; // Precio de costo/adquisición
  listPrice: number; // Precio de venta
  margin: number; // Margen de ganancia
  lastRestocked: string;
  supplier?: string;
  location?: string; // Ubicación física
  isListed: boolean; // Si está publicado para venta
  status: "active" | "discontinued" | "backorder" | "pending";
  movementHistory: Array<{
    date: string;
    type: "in" | "out" | "adjustment" | "sale" | "return";
    quantity: number;
    reason: string;
    reference?: string;
  }>;
}

export default function SellerInventory() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [alertFilter, setAlertFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("lastRestocked");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [activeTab, setActiveTab] = useState("overview");

  // Estados de vista
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Función para cargar inventario real
  const fetchInventory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(statusFilter !== "all" && {
          isListed: statusFilter === "listed" ? "true" : "false",
        }),
        ...(stockFilter !== "all" && {
          lowStock: stockFilter === "low" ? "true" : "false",
        }),
      });

      const response = await fetch(`/api/seller/inventory?${params}`);

      if (!response.ok) {
        throw new Error("Error cargando inventario");
      }

      const data = await response.json();

      if (data.success) {
        // Adaptar formato de API a formato de componente
        const adaptedItems = data.data.items.map((item: any) => ({
          ...item,
          language: "ES", // TODO: Agregar al modelo si es necesario
          margin: parseFloat(item.margin),
          status: item.isListed ? "active" : "discontinued",
          movementHistory: [], // TODO: Implementar historial cuando sea necesario
        }));

        setInventory(adaptedItems);
        setTotalItems(data.data.pagination.total);
        setTotalPages(data.data.pagination.last_page);
      } else {
        throw new Error(data.error || "Error cargando inventario");
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
      setError(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  // Verificar autenticación y cargar datos
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/login");
      return;
    }

    fetchInventory();
  }, [
    session,
    status,
    router,
    currentPage,
    itemsPerPage,
    searchQuery,
    statusFilter,
    stockFilter,
  ]);

  // Calcular métricas del inventario
  const metrics = {
    totalItems: inventory.length,
    lowStockItems: inventory.filter(
      (item) => item.availableStock <= item.minStockLevel
    ).length,
    outOfStockItems: inventory.filter((item) => item.availableStock === 0)
      .length,
    overStockItems: inventory.filter(
      (item) => item.availableStock > item.maxStockLevel
    ).length,
    totalValue: inventory.reduce(
      (sum, item) => sum + item.costPrice * item.currentStock,
      0
    ),
    totalRetailValue: inventory.reduce(
      (sum, item) => sum + item.listPrice * item.currentStock,
      0
    ),
    avgMargin:
      inventory.length > 0
        ? inventory.reduce((sum, item) => sum + item.margin, 0) /
          inventory.length
        : 0,
    reorderNeeded: inventory.filter(
      (item) => item.availableStock <= item.reorderPoint
    ).length,
  };

  const getStockStatusBadge = (item: InventoryItem) => {
    if (item.availableStock === 0) {
      return (
        <Badge variant="secondary" className="bg-red-100 text-red-700">
          Sin Stock
        </Badge>
      );
    } else if (item.availableStock <= item.minStockLevel) {
      return (
        <Badge variant="secondary" className="bg-orange-100 text-orange-700">
          Stock Bajo
        </Badge>
      );
    } else if (item.availableStock > item.maxStockLevel) {
      return (
        <Badge variant="secondary" className="bg-purple-100 text-purple-700">
          Sobre Stock
        </Badge>
      );
    } else {
      return <Badge variant="default">Normal</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "discontinued":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "backorder":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "pending":
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleBulkRestock = async () => {
    if (selectedItems.length === 0) {
      alert("Selecciona items para reabastecer");
      return;
    }
    // TODO: Implementar restock masivo
    console.log("Restock masivo:", selectedItems);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const selectAllItems = () => {
    const allIds = inventory.map((item) => item.id);
    setSelectedItems(allIds);
  };

  const deselectAllItems = () => {
    setSelectedItems([]);
  };

  const toggleItemSelection = (id: number) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const isAllSelected =
    selectedItems.length === inventory.length && inventory.length > 0;

  // Funciones para manejar acciones de items
  const handleViewItem = (itemId: number) => {
    // TODO: Abrir modal o página de detalles del item
    console.log("Ver detalles del item:", itemId);
  };

  const handleEditItem = (itemId: number) => {
    // TODO: Abrir modal de edición de stock/precio
    console.log("Editar item:", itemId);
  };

  const handleListItem = async (itemId: number) => {
    // Prompt para el precio de venta
    const listPrice = prompt("Ingresa el precio de venta (USD):");
    if (!listPrice || parseFloat(listPrice) <= 0) {
      alert("Precio inválido");
      return;
    }

    if (!confirm("¿Listar este producto para venta?")) return;

    try {
      setLoading(true);

      const response = await fetch(`/api/seller/inventory/${itemId}/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listPrice: parseFloat(listPrice),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error listando producto");
      }

      // Recargar inventario
      await fetchInventory();

      alert("Producto listado exitosamente");
    } catch (error) {
      console.error("Error al listar producto:", error);
      alert(
        error instanceof Error ? error.message : "Error al listar producto"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUnlistItem = async (itemId: number) => {
    if (!confirm("¿Quitar este producto de venta?")) return;

    try {
      setLoading(true);

      const response = await fetch(`/api/seller/inventory/${itemId}/unlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error quitando producto de venta");
      }

      // Recargar inventario
      await fetchInventory();

      alert("Producto quitado de venta exitosamente");
    } catch (error) {
      console.error("Error al quitar de venta:", error);
      alert(
        error instanceof Error ? error.message : "Error al quitar de venta"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewProduct = () => {
    router.push("/seller/inventory/new");
  };

  const handleBulkList = async () => {
    if (selectedItems.length === 0) {
      alert("Selecciona productos para listar");
      return;
    }

    // Prompt para precio general o individual
    const priceStrategy = confirm(
      "¿Usar el mismo precio para todos los productos?\n\nOK = Mismo precio\nCancelar = Precio individual (próximamente)"
    );

    if (!priceStrategy) {
      alert(
        "Funcionalidad de precios individuales próximamente. Por ahora usa precio general."
      );
      return;
    }

    const generalPrice = prompt(
      "Ingresa el precio general para todos los productos (USD):"
    );
    if (!generalPrice || parseFloat(generalPrice) <= 0) {
      alert("Precio inválido");
      return;
    }

    const confirmMessage = `¿Listar ${selectedItems.length} productos para venta con precio $${generalPrice}?`;
    if (!confirm(confirmMessage)) return;

    try {
      setLoading(true);
      let successCount = 0;
      let errorCount = 0;

      // Procesar cada producto individualmente
      for (const itemId of selectedItems) {
        try {
          const response = await fetch(`/api/seller/inventory/${itemId}/list`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              listPrice: parseFloat(generalPrice),
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      // Recargar inventario
      await fetchInventory();
      setSelectedItems([]);

      if (successCount > 0) {
        alert(
          `${successCount} productos listados exitosamente${
            errorCount > 0 ? `, ${errorCount} fallaron` : ""
          }`
        );
      } else {
        alert("Error: Ningún producto pudo ser listado");
      }
    } catch (error) {
      console.error("Error al listar productos:", error);
      alert("Error al listar productos");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUnlist = async () => {
    if (selectedItems.length === 0) {
      alert("Selecciona productos para quitar de venta");
      return;
    }

    const confirmMessage = `¿Quitar ${selectedItems.length} productos de venta?`;
    if (!confirm(confirmMessage)) return;

    try {
      setLoading(true);
      let successCount = 0;
      let errorCount = 0;

      // Procesar cada producto individualmente
      for (const itemId of selectedItems) {
        try {
          const response = await fetch(
            `/api/seller/inventory/${itemId}/unlist`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            }
          );

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      // Recargar inventario
      await fetchInventory();
      setSelectedItems([]);

      if (successCount > 0) {
        alert(
          `${successCount} productos quitados de venta exitosamente${
            errorCount > 0 ? `, ${errorCount} fallaron` : ""
          }`
        );
      } else {
        alert("Error: Ningún producto pudo ser quitado de venta");
      }
    } catch (error) {
      console.error("Error al quitar de venta:", error);
      alert("Error al quitar de venta");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto"></div>
            <Package className="h-8 w-8 text-blue-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-4 text-lg font-medium text-gray-700">
            Cargando inventario...
          </p>
          <p className="text-sm text-gray-500">Preparando control de stock</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header Premium */}
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
              Control de Inventario
            </h1>
            <p className="text-gray-600 text-sm">
              {totalItems} productos • {metrics.reorderNeeded} necesitan restock
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Importar
          </Button>
          <Button
            className="bg-green-500 hover:bg-green-600"
            onClick={handleAddNewProduct}
          >
            <Plus className="w-4 h-4 mr-2" />
            Añadir Producto
          </Button>
        </div>
      </div>

      {/* Nota informativa */}
      <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-start gap-3">
          <Package className="h-5 w-5 text-green-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-green-900">
              Control de Inventario
            </h3>
            <p className="text-sm text-green-700">
              Aquí ves <strong>todo tu stock físico</strong> (listados y no
              listados). Desde aquí puedes "listar" productos para que aparezcan
              en{" "}
              <Link href="/seller/listings" className="underline font-medium">
                Mis Listados
              </Link>{" "}
              y sean visibles para compradores.
            </p>
          </div>
        </div>
      </div>

      {/* Métricas del Inventario */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="!h-max border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Items</p>
                <p className="text-xl font-bold text-gray-900">
                  {metrics.totalItems}
                </p>
                <p className="text-xs text-gray-500">Productos únicos</p>
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
                <p className="text-sm text-gray-600">Alertas de Stock</p>
                <p className="text-xl font-bold text-gray-900">
                  {metrics.lowStockItems + metrics.outOfStockItems}
                </p>
                <p className="text-xs text-gray-500">
                  {metrics.reorderNeeded} necesitan restock
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="!h-max border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Valor Inventario</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatPrice(metrics.totalValue)}
                </p>
                <p className="text-xs text-gray-500">Costo total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="!h-max border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Margen Promedio</p>
                <p className="text-xl font-bold text-gray-900">
                  {metrics.avgMargin.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">Rentabilidad</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Gestión */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <TabsList className="grid w-full grid-cols-4 bg-gray-50 p-1 m-1 rounded-lg">
            <TabsTrigger
              value="overview"
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger
              value="alerts"
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Alertas</span>
            </TabsTrigger>
            <TabsTrigger
              value="movements"
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Movimientos</span>
            </TabsTrigger>
            <TabsTrigger
              value="suppliers"
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Truck className="w-4 h-4" />
              <span className="hidden sm:inline">Proveedores</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB: OVERVIEW */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          {/* Panel de Herramientas */}
          <Card className="!h-max border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row items-center gap-4">
                {/* Búsqueda */}
                <div className="flex-1 w-full">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Buscar por SKU, nombre, código..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 border-gray-300"
                    />
                  </div>
                </div>

                {/* Filtros */}
                <div className="flex items-center gap-3">
                  <Button
                    variant={showFilters ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Filtros
                  </Button>

                  {selectedItems.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                      <span className="text-sm font-medium text-blue-700">
                        {selectedItems.length} seleccionados
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleBulkList}
                        className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700"
                      >
                        Listar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleBulkUnlist}
                        className="h-6 px-2 text-xs text-orange-600 hover:text-orange-700"
                      >
                        Quitar de venta
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={deselectAllItems}
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
                    <Select
                      value={statusFilter}
                      onValueChange={setStatusFilter}
                    >
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los estados</SelectItem>
                        <SelectItem value="active">Activo</SelectItem>
                        <SelectItem value="discontinued">
                          Discontinuado
                        </SelectItem>
                        <SelectItem value="backorder">Backorder</SelectItem>
                        <SelectItem value="pending">Pendiente</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={stockFilter} onValueChange={setStockFilter}>
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder="Nivel de Stock" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los niveles</SelectItem>
                        <SelectItem value="in_stock">En stock</SelectItem>
                        <SelectItem value="low_stock">Stock bajo</SelectItem>
                        <SelectItem value="out_of_stock">Sin stock</SelectItem>
                        <SelectItem value="over_stock">Sobre stock</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={alertFilter} onValueChange={setAlertFilter}>
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder="Alertas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="reorder">
                          Necesita restock
                        </SelectItem>
                        <SelectItem value="critical">Crítico</SelectItem>
                        <SelectItem value="overstock">Sobre stock</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("all");
                        setStockFilter("all");
                        setAlertFilter("all");
                      }}
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
              {inventory.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No hay inventario
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Comienza añadiendo productos a tu inventario
                  </p>
                  <Button className="bg-green-500 hover:bg-green-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Añadir Producto
                  </Button>
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
                              if (checked) selectAllItems();
                              else deselectAllItems();
                            }}
                          />
                        </TableHead>
                        <TableHead className="w-20">Imagen</TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort("card.name")}
                        >
                          <div className="flex items-center gap-1">
                            Producto
                            {sortBy === "card.name" &&
                              (sortOrder === "asc" ? (
                                <ArrowUp className="w-4 h-4" />
                              ) : (
                                <ArrowDown className="w-4 h-4" />
                              ))}
                          </div>
                        </TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Ubicación</TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort("availableStock")}
                        >
                          <div className="flex items-center gap-1">
                            Stock
                            {sortBy === "availableStock" &&
                              (sortOrder === "asc" ? (
                                <ArrowUp className="w-4 h-4" />
                              ) : (
                                <ArrowDown className="w-4 h-4" />
                              ))}
                          </div>
                        </TableHead>
                        <TableHead>Costo/Precio</TableHead>
                        <TableHead>Margen</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventory.map((item) => {
                        const isSelected = selectedItems.includes(item.id);
                        const needsReorder =
                          item.availableStock <= item.reorderPoint;

                        return (
                          <TableRow
                            key={item.id}
                            className={`hover:bg-gray-50 ${
                              isSelected ? "bg-blue-50" : ""
                            } ${
                              needsReorder ? "border-l-4 border-orange-500" : ""
                            }`}
                          >
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() =>
                                  toggleItemSelection(item.id)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <div className="w-12 h-16 bg-gray-100 rounded overflow-hidden">
                                <img
                                  src={
                                    item.card.src ||
                                    "/assets/images/backcard.webp"
                                  }
                                  alt={item.card.name}
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
                                  {item.card.name}
                                </p>
                                <p className="text-sm text-gray-500 truncate">
                                  {item.card.code} • {item.condition}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {item.isListed ? (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Listado
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      No listado
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                                {item.sku}
                              </code>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {item.location || "---"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-lg">
                                    {item.availableStock}
                                  </span>
                                  {getStockStatusBadge(item)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  <span>Total: {item.currentStock}</span>
                                  {item.reservedStock > 0 && (
                                    <span>
                                      {" "}
                                      • Reservado: {item.reservedStock}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Min: {item.minStockLevel} • Reorder:{" "}
                                  {item.reorderPoint}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="text-sm">
                                  <span className="text-gray-600">Costo:</span>{" "}
                                  <span className="font-medium">
                                    {formatPrice(item.costPrice)}
                                  </span>
                                </div>
                                <div className="text-sm">
                                  <span className="text-gray-600">Precio:</span>{" "}
                                  <span className="font-medium">
                                    {formatPrice(item.listPrice)}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.margin > 30 ? "default" : "secondary"
                                }
                                className="text-xs"
                              >
                                {item.margin.toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(item.status)}
                                <span className="text-sm capitalize">
                                  {item.status}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  title="Ver detalles"
                                  onClick={() => handleViewItem(item.id)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  title="Editar stock/precio"
                                  onClick={() => handleEditItem(item.id)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                {!item.isListed ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                                    title="Listar para venta"
                                    onClick={() => handleListItem(item.id)}
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
                                    title="Quitar de venta"
                                    onClick={() => handleUnlistItem(item.id)}
                                  >
                                    <Minus className="w-4 h-4" />
                                  </Button>
                                )}
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
        </TabsContent>

        {/* TAB: ALERTAS */}
        <TabsContent value="alerts" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stock Bajo */}
            <Card className="!h-max border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Stock Bajo ({metrics.lowStockItems})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {inventory
                    .filter(
                      (item) =>
                        item.availableStock <= item.minStockLevel &&
                        item.availableStock > 0
                    )
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              item.card.src || "/assets/images/backcard.webp"
                            }
                            alt={item.card.name}
                            className="w-10 h-12 object-cover rounded"
                          />
                          <div>
                            <p className="font-medium text-sm">
                              {item.card.name}
                            </p>
                            <p className="text-xs text-gray-600">{item.sku}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-orange-600">
                            {item.availableStock} disponibles
                          </p>
                          <p className="text-xs text-gray-500">
                            Min: {item.minStockLevel}
                          </p>
                        </div>
                      </div>
                    ))}
                  {metrics.lowStockItems === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm">
                        Todos los productos tienen stock suficiente
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sin Stock */}
            <Card className="!h-max border-0 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  Sin Stock ({metrics.outOfStockItems})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {inventory
                    .filter((item) => item.availableStock === 0)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={
                              item.card.src || "/assets/images/backcard.webp"
                            }
                            alt={item.card.name}
                            className="w-10 h-12 object-cover rounded opacity-50"
                          />
                          <div>
                            <p className="font-medium text-sm">
                              {item.card.name}
                            </p>
                            <p className="text-xs text-gray-600">{item.sku}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600">Agotado</p>
                          <p className="text-xs text-gray-500">
                            Min: {item.minStockLevel}
                          </p>
                        </div>
                      </div>
                    ))}
                  {metrics.outOfStockItems === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm">Ningún producto está agotado</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB: MOVIMIENTOS */}
        <TabsContent value="movements" className="space-y-6 mt-0">
          <Card className="!h-max border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Movimientos Recientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {inventory
                  .flatMap((item) =>
                    item.movementHistory.map((movement) => ({
                      ...movement,
                      item: item,
                    }))
                  )
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime()
                  )
                  .slice(0, 10)
                  .map((movement, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg"
                    >
                      <div
                        className={`p-2 rounded-lg ${
                          movement.type === "in"
                            ? "bg-green-100"
                            : movement.type === "sale"
                            ? "bg-blue-100"
                            : movement.type === "out"
                            ? "bg-red-100"
                            : "bg-gray-100"
                        }`}
                      >
                        {movement.type === "in" ? (
                          <Plus className="h-4 w-4 text-green-600" />
                        ) : movement.type === "sale" ? (
                          <TrendingDown className="h-4 w-4 text-blue-600" />
                        ) : movement.type === "out" ? (
                          <Minus className="h-4 w-4 text-red-600" />
                        ) : (
                          <RotateCcw className="h-4 w-4 text-gray-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">
                            {movement.item.card.name}
                          </p>
                          <span
                            className={`font-bold ${
                              movement.quantity > 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {movement.quantity > 0 ? "+" : ""}
                            {movement.quantity}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">
                          {movement.reason}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {new Date(movement.date).toLocaleDateString()}
                          </span>
                          {movement.reference && (
                            <>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-500">
                                {movement.reference}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: PROVEEDORES */}
        <TabsContent value="suppliers" className="space-y-6 mt-0">
          <Card className="!h-max border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Gestión de Proveedores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Truck className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Gestión de Proveedores
                </h3>
                <p className="text-gray-600 mb-4">
                  Funcionalidad en desarrollo próximamente
                </p>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Añadir Proveedor
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
