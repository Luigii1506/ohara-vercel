// Página de mis órdenes - Ohara TCG Shop
// Fecha de modificación: 2025-01-02

"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package,
  CheckCircle,
  AlertCircle,
  Clock,
  Truck,
  Eye,
  Download,
  ArrowLeft,
  Search,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "react-hot-toast";

// Mock data de órdenes
const mockOrders = [
  {
    id: "ORD-2025-001",
    date: "2025-01-15",
    status: "delivered",
    total: 45.48,
    items: [
      {
        card: {
          id: 1,
          name: "Monkey D. Luffy",
          code: "ST01-001",
          image: "/assets/images/cards/ST01-001.jpg",
        },
        quantity: 2,
        price: 15.99,
      },
      {
        card: {
          id: 2,
          name: "Roronoa Zoro",
          code: "ST01-013",
          image: "/assets/images/cards/ST01-013.jpg",
        },
        quantity: 1,
        price: 8.5,
      },
    ],
    shipping: {
      method: "Standard Shipping",
      cost: 4.99,
      trackingNumber: "1Z999AA1234567890",
      address: "123 Main St, Anytown, ST 12345",
    },
  },
  {
    id: "ORD-2025-002",
    date: "2025-01-18",
    status: "processing",
    total: 28.74,
    items: [
      {
        card: {
          id: 3,
          name: "Nami",
          code: "ST01-007",
          image: "/assets/images/cards/ST01-007.jpg",
        },
        quantity: 4,
        price: 3.25,
      },
    ],
    shipping: {
      method: "Express Shipping",
      cost: 9.99,
      trackingNumber: null,
      address: "456 Oak Ave, Another City, ST 67890",
    },
  },
  {
    id: "ORD-2025-003",
    date: "2025-01-20",
    status: "shipped",
    total: 67.23,
    items: [
      {
        card: {
          id: 1,
          name: "Monkey D. Luffy",
          code: "ST01-001",
          image: "/assets/images/cards/ST01-001.jpg",
        },
        quantity: 1,
        price: 15.99,
      },
      {
        card: {
          id: 2,
          name: "Roronoa Zoro",
          code: "ST01-013",
          image: "/assets/images/cards/ST01-013.jpg",
        },
        quantity: 3,
        price: 8.5,
      },
    ],
    shipping: {
      method: "Standard Shipping",
      cost: 4.99,
      trackingNumber: "1Z999BB9876543210",
      address: "789 Pine Rd, Somewhere, ST 11111",
    },
  },
];

export default function OrdersPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [orders, setOrders] = useState(mockOrders);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "text-green-600 bg-green-50 border-green-200";
      case "shipped":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "processing":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "cancelled":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle className="w-4 h-4" />;
      case "shipped":
        return <Truck className="w-4 h-4" />;
      case "processing":
        return <Clock className="w-4 h-4" />;
      case "cancelled":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "delivered":
        return "Entregado";
      case "shipped":
        return "Enviado";
      case "processing":
        return "Procesando";
      case "cancelled":
        return "Cancelado";
      default:
        return "Pendiente";
    }
  };

  // Filtrar órdenes
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      String(order.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.items.some((item) =>
        item.card.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;
    const matchesTab = activeTab === "all" || order.status === activeTab;

    return matchesSearch && matchesStatus && matchesTab;
  });

  const getOrdersByStatus = (status: string) => {
    return orders.filter((order) => order.status === status);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mis Pedidos</h1>
            <p className="text-gray-600">
              Historial y seguimiento de tus compras
            </p>
          </div>
          <Link href="/user-store/products">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Seguir Comprando
            </Button>
          </Link>
        </div>

        {/* Filtros y búsqueda */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por número de pedido o producto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="processing">Procesando</SelectItem>
                  <SelectItem value="shipped">Enviado</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs por estado */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-gray-50 p-1 rounded-lg">
            <TabsTrigger value="all" className="data-[state=active]:bg-white">
              Todos ({orders.length})
            </TabsTrigger>
            <TabsTrigger
              value="processing"
              className="data-[state=active]:bg-white"
            >
              Procesando ({getOrdersByStatus("processing").length})
            </TabsTrigger>
            <TabsTrigger
              value="shipped"
              className="data-[state=active]:bg-white"
            >
              Enviado ({getOrdersByStatus("shipped").length})
            </TabsTrigger>
            <TabsTrigger
              value="delivered"
              className="data-[state=active]:bg-white"
            >
              Entregado ({getOrdersByStatus("delivered").length})
            </TabsTrigger>
            <TabsTrigger
              value="cancelled"
              className="data-[state=active]:bg-white"
            >
              Cancelado ({getOrdersByStatus("cancelled").length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {filteredOrders.length > 0 ? (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <Card
                    key={order.id}
                    className="border-0 shadow-md hover:shadow-lg transition-shadow"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">
                            Pedido {order.id}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Realizado el{" "}
                            {new Date(order.date).toLocaleDateString("es-ES", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                              order.status
                            )}`}
                          >
                            {getStatusIcon(order.status)}
                            {getStatusText(order.status)}
                          </Badge>
                          <p className="font-bold text-lg mt-1">
                            ${order.total.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Items del pedido */}
                      <div className="space-y-3 mb-4">
                        {order.items.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="w-12 h-16 bg-white rounded overflow-hidden flex-shrink-0">
                              <img
                                src={
                                  item.card.image ||
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
                            <div className="flex-1">
                              <h4 className="font-medium">{item.card.name}</h4>
                              <p className="text-sm text-gray-600">
                                {item.card.code}
                              </p>
                              <p className="text-sm text-gray-600">
                                Cantidad: {item.quantity} × $
                                {item.price.toFixed(2)}
                              </p>
                            </div>
                            <div className="font-semibold">
                              ${(item.quantity * item.price).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Información de envío y acciones */}
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Envío</p>
                            <p className="text-sm text-gray-600">
                              {order.shipping.method} - $
                              {order.shipping.cost.toFixed(2)}
                            </p>
                            {order.shipping.trackingNumber && (
                              <p className="text-sm text-blue-600 font-medium">
                                Tracking: {order.shipping.trackingNumber}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedOrder(order);
                                setIsOrderModalOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver Detalles
                            </Button>
                            {order.status === "shipped" &&
                              order.shipping.trackingNumber && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    toast.success("Abriendo seguimiento...");
                                    // Aquí iría la lógica para abrir el tracking
                                  }}
                                >
                                  <Truck className="w-4 h-4 mr-1" />
                                  Rastrear
                                </Button>
                              )}
                            {order.status === "delivered" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  toast.success("Descargando factura...");
                                  // Aquí iría la lógica para descargar la factura
                                }}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Factura
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              /* Estado vacío */
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No hay pedidos
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm || statusFilter !== "all"
                    ? "No se encontraron pedidos con los filtros aplicados"
                    : "Tu historial de pedidos aparecerá aquí"}
                </p>
                <Link href="/user-store/products">
                  <Button className="bg-blue-500 hover:bg-blue-600">
                    <Package className="w-4 h-4 mr-2" />
                    Comenzar a Comprar
                  </Button>
                </Link>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de detalles del pedido */}
      <Dialog open={isOrderModalOpen} onOpenChange={setIsOrderModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Detalles del Pedido {selectedOrder.id}
                </DialogTitle>
                <DialogDescription>
                  Información completa de tu pedido
                </DialogDescription>
              </DialogHeader>

              {/* Estado y fecha */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Estado del pedido</p>
                  <Badge
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
                      selectedOrder.status
                    )}`}
                  >
                    {getStatusIcon(selectedOrder.status)}
                    {getStatusText(selectedOrder.status)}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Fecha del pedido</p>
                  <p className="font-semibold">
                    {new Date(selectedOrder.date).toLocaleDateString("es-ES", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Productos */}
              <div>
                <h3 className="font-semibold text-lg mb-4">Productos</h3>
                <div className="space-y-3">
                  {selectedOrder.items.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-4 border rounded-lg"
                    >
                      <div className="w-16 h-22 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                        <img
                          src={
                            item.card.image || "/assets/images/backcard.webp"
                          }
                          alt={item.card.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "/assets/images/backcard.webp";
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold">{item.card.name}</h4>
                        <p className="text-sm text-gray-600">
                          {item.card.code}
                        </p>
                        <p className="text-sm text-gray-600">
                          Cantidad: {item.quantity}
                        </p>
                        <p className="text-sm text-gray-600">
                          Precio unitario: ${item.price.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          ${(item.quantity * item.price).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Información de envío */}
              <div>
                <h3 className="font-semibold text-lg mb-4">
                  Información de Envío
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Método de Envío</h4>
                    <p className="text-sm text-gray-600">
                      {selectedOrder.shipping.method}
                    </p>
                    <p className="text-sm font-semibold">
                      ${selectedOrder.shipping.cost.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Dirección de Envío</h4>
                    <p className="text-sm text-gray-600">
                      {selectedOrder.shipping.address}
                    </p>
                  </div>
                </div>
                {selectedOrder.shipping.trackingNumber && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium mb-2 text-blue-800">
                      Número de Seguimiento
                    </h4>
                    <p className="text-blue-700 font-mono">
                      {selectedOrder.shipping.trackingNumber}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        toast.success("Abriendo seguimiento...");
                      }}
                    >
                      <Truck className="w-4 h-4 mr-1" />
                      Rastrear Paquete
                    </Button>
                  </div>
                )}
              </div>

              {/* Resumen de costos */}
              <div>
                <h3 className="font-semibold text-lg mb-4">
                  Resumen de Costos
                </h3>
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>
                      $
                      {selectedOrder.items
                        .reduce(
                          (total: number, item: any) =>
                            total + item.quantity * item.price,
                          0
                        )
                        .toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Envío</span>
                    <span>${selectedOrder.shipping.cost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Impuestos</span>
                    <span>
                      $
                      {(
                        selectedOrder.total -
                        selectedOrder.items.reduce(
                          (total: number, item: any) =>
                            total + item.quantity * item.price,
                          0
                        ) -
                        selectedOrder.shipping.cost
                      ).toFixed(2)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>${selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-3 pt-4">
                {selectedOrder.status === "delivered" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      toast.success("Descargando factura...");
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Descargar Factura
                  </Button>
                )}
                {selectedOrder.status === "processing" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      toast.success("Contactando soporte...");
                    }}
                  >
                    Cancelar Pedido
                  </Button>
                )}
                <Button
                  onClick={() => {
                    toast.success("Contactando soporte...");
                  }}
                >
                  Contactar Soporte
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
