// Panel principal del vendedor renovado - Ohara TCG Shop
// Fecha de modificación: 2025-01-19 - Implementación con sidebar layout

"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Package,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Plus,
  Eye,
  ShoppingCart,
  Star,
  Activity,
  Bell,
  ArrowUpRight,
  Gift,
} from "lucide-react";
import Link from "next/link";
import { SellerStats, LowStockAlert } from "@/lib/shop/types";
import { formatPrice, getStockStatus } from "@/lib/shop/utils";

export default function SellerDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock data para demo - en producción vendrá del API
  const mockStats = {
    totalListings: 47,
    activeListings: 42,
    totalValue: 125000, // en centavos
    averagePrice: 2500,
    lowStockItems: 8,
    totalViews: 1247,
    favoritedCount: 89,
    messagesCount: 12,
  };

  const mockRecentActivity = [
    {
      id: 1,
      type: "sale",
      message: "Luffy ST01-001 vendida por $15.99",
      time: "Hace 2 horas",
      icon: ShoppingCart,
      color: "text-green-600",
    },
    {
      id: 2,
      type: "view",
      message: "Tu listado de Zoro OP01-025 fue visto 5 veces",
      time: "Hace 4 horas",
      icon: Eye,
      color: "text-blue-600",
    },
    {
      id: 3,
      type: "favorite",
      message: "Sanji OP02-013 fue agregada a favoritos",
      time: "Hace 6 horas",
      icon: Star,
      color: "text-yellow-600",
    },
    {
      id: 4,
      type: "message",
      message: "Nuevo mensaje de comprador",
      time: "Hace 8 horas",
      icon: Bell,
      color: "text-purple-600",
    },
  ];

  // Verificar autenticación y cargar datos
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/login");
      return;
    }

    // Por ahora usar mock data - en producción llamar fetchDashboardData()
    setTimeout(() => {
      setStats(mockStats as any);
      setLoading(false);
    }, 1000);
  }, [session, status, router]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Obtener estadísticas
      const statsResponse = await fetch("/api/shop/stats");
      if (!statsResponse.ok) {
        const errorData = await statsResponse.json();
        throw new Error(errorData.error || "Error obteniendo estadísticas");
      }
      const statsData = await statsResponse.json();
      setStats(statsData.data);

      // Obtener alertas
      const alertsResponse = await fetch("/api/shop/alerts");
      if (!alertsResponse.ok) {
        const errorData = await alertsResponse.json();
        throw new Error(errorData.error || "Error obteniendo alertas");
      }
      const alertsData = await alertsResponse.json();
      setAlerts(alertsData.data || []);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(err instanceof Error ? err.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return <div />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md mx-auto shadow-lg !h-max">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-red-600">
              ¡Oops! Algo salió mal
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={fetchDashboardData} className="w-full">
              <Activity className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header de página */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            ¡Hola, {session?.user?.name}!
          </h1>
          <p className="text-gray-600 text-sm">
            Tu tienda está en línea y funcionando 🚀
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" className="hidden sm:flex">
            <Bell className="w-4 h-4 mr-2" />
            Notificaciones
            <Badge className="ml-2 px-2 py-0 text-xs bg-red-500">3</Badge>
          </Button>
          <Link href="/seller/listings/new">
            <Button className="bg-green-500 hover:bg-green-600">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Listado
            </Button>
          </Link>
        </div>
      </div>

      {/* Métricas principales */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="!h-max border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <Badge variant="outline" className="text-xs">
                  Activos
                </Badge>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.totalListings}
              </div>
              <p className="text-sm text-gray-600">Total Listados</p>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-green-600 font-medium">
                  {stats.activeListings}
                </span>
                <Progress
                  value={(stats.activeListings / stats.totalListings) * 100}
                  className="w-16 h-1.5"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="!h-max border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-green-500 rounded-lg">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                <Badge variant="outline" className="text-xs text-green-600">
                  +12.5%
                </Badge>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatPrice(stats.totalValue)}
              </div>
              <p className="text-sm text-gray-600">Valor Inventario</p>
              <p className="text-xs text-green-600 mt-1">
                Promedio: {formatPrice(stats.averagePrice)}
              </p>
            </CardContent>
          </Card>

          <Card className="!h-max border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <Eye className="h-5 w-5 text-white" />
                </div>
                <Badge variant="outline" className="text-xs">
                  24h
                </Badge>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {(stats as any).totalViews || 1247}
              </div>
              <p className="text-sm text-gray-600">Visualizaciones</p>
              <div className="mt-1 flex items-center gap-3 text-xs">
                <span className="text-yellow-600">
                  ⭐ {(stats as any).favoritedCount || 89}
                </span>
                <span className="text-blue-600">
                  💬 {(stats as any).messagesCount || 12}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="!h-max border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-orange-500 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                {stats.lowStockItems > 0 && (
                  <Badge className="text-xs bg-red-100 text-red-700">
                    ¡Atención!
                  </Badge>
                )}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.lowStockItems}
              </div>
              <p className="text-sm text-gray-600">Bajo Stock</p>
              <p
                className={`text-xs mt-1 font-medium ${
                  stats.lowStockItems > 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                {stats.lowStockItems > 0
                  ? "Requiere atención"
                  : "Todo en orden ✅"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Panel de dos columnas para overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Acciones rápidas */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="!h-max group hover:shadow-lg transition-all border-0 bg-gradient-to-br from-green-50 to-emerald-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-green-500 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                    <Plus className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Nuevo Listado
                    </h3>
                    <p className="text-sm text-gray-600">
                      Agrega cartas y empieza a vender
                    </p>
                  </div>
                </div>
                <Link href="/seller/listings/new">
                  <Button className="w-full bg-green-500 hover:bg-green-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Ahora
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="!h-max group hover:shadow-lg transition-all border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-blue-500 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Gestionar Inventario
                    </h3>
                    <p className="text-sm text-gray-600">
                      Ve y actualiza tus listados
                    </p>
                  </div>
                </div>
                <Link href="/seller/listings">
                  <Button
                    variant="outline"
                    className="w-full border-blue-300 text-blue-600"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Ver Listados
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Alertas */}
          {stats && stats.lowStockItems > 0 ? (
            <Card className="!h-max border-0 shadow-lg bg-gradient-to-r from-orange-50 to-red-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-base">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Alertas de Inventario
                  <Badge className="bg-orange-100 text-orange-700 text-xs">
                    {stats?.lowStockItems}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600 mb-3">
                  Tienes productos que necesitan reabastecimiento
                </div>
                <Link href="/seller/inventory">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-orange-300 text-orange-700"
                  >
                    Ver Alertas Completas
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="!h-max border-0 shadow-lg bg-gradient-to-r from-green-50 to-emerald-50">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Gift className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1">
                  ¡Todo en Orden!
                </h3>
                <p className="text-sm text-gray-600">
                  Tu inventario está bien abastecido
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actividad reciente */}
        <Card className="!h-max border-0 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-blue-500" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockRecentActivity.slice(0, 4).map((activity) => {
                const IconComponent = activity.icon;
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div
                      className={`p-1.5 rounded-lg bg-gray-100 ${activity.color}`}
                    >
                      <IconComponent className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 leading-tight">
                        {activity.message}
                      </p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <Link href="/seller/activity">
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-3 text-blue-600 text-xs"
              >
                Ver todo <ArrowUpRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
