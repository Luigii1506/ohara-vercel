"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Crown,
  BarChart3,
  Package,
  TrendingUp,
  Settings,
  Plus,
  Bell,
  Eye,
  Users,
  Gift,
  Target,
  Calendar,
  Star,
  DollarSign,
  AlertTriangle,
  Activity,
  Search,
  Filter,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Home,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface SellerLayoutProps {
  children: React.ReactNode;
}

const SellerLayout = ({ children }: SellerLayoutProps) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false); // Para móvil
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Para desktop
  const [notificationCount, setNotificationCount] = useState(3);

  // Verificar autenticación
  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login");
      return;
    }
  }, [session, status, router]);

  // Tipos para los items del menú
  interface MenuItem {
    name: string;
    href: string;
    icon: any;
    current: boolean;
    badge?: string;
    highlight?: boolean;
  }

  // Estructura del menú del sidebar
  const menuSections = [
    {
      title: "Dashboard",
      items: [
        {
          name: "Overview",
          href: "/seller",
          icon: BarChart3,
          current: pathname === "/seller",
        },
        {
          name: "Actividad Reciente",
          href: "/seller/activity",
          icon: Activity,
          current: pathname === "/seller/activity",
          badge: "nuevo",
        },
      ] as MenuItem[],
    },
    {
      title: "Inventario",
      items: [
        {
          name: "Mis Listados",
          href: "/seller/listings",
          icon: Package,
          current:
            pathname.startsWith("/seller/listings") &&
            pathname !== "/seller/listings/new",
        },
        {
          name: "Control de Inventario",
          href: "/seller/inventory",
          icon: AlertTriangle,
          current: pathname === "/seller/inventory",
          badge: "8",
        },
      ] as MenuItem[],
    },
    {
      title: "Ventas y Analítica",
      items: [
        {
          name: "Analítica",
          href: "/seller/analytics",
          icon: TrendingUp,
          current: pathname === "/seller/analytics",
        },
        {
          name: "Reportes",
          href: "/seller/reports",
          icon: Target,
          current: pathname === "/seller/reports",
          badge: "pronto",
        },
      ] as MenuItem[],
    },
    {
      title: "Comunicación",
      items: [
        {
          name: "Mensajes",
          href: "/seller/messages",
          icon: Bell,
          current: pathname === "/seller/messages",
          badge:
            notificationCount > 0 ? notificationCount.toString() : undefined,
        },
        {
          name: "Reviews",
          href: "/seller/reviews",
          icon: Star,
          current: pathname === "/seller/reviews",
        },
        {
          name: "Clientes",
          href: "/seller/customers",
          icon: Users,
          current: pathname === "/seller/customers",
        },
      ] as MenuItem[],
    },
    {
      title: "Marketing",
      items: [
        {
          name: "Promociones",
          href: "/seller/promotions",
          icon: Gift,
          current: pathname === "/seller/promotions",
          badge: "pronto",
        },
        {
          name: "Campañas",
          href: "/seller/campaigns",
          icon: Calendar,
          current: pathname === "/seller/campaigns",
          badge: "pronto",
        },
      ] as MenuItem[],
    },
    {
      title: "Configuración",
      items: [
        {
          name: "Perfil de Vendedor",
          href: "/seller/profile",
          icon: Settings,
          current: pathname === "/seller/profile",
        },
        {
          name: "Pagos",
          href: "/seller/payments",
          icon: DollarSign,
          current: pathname === "/seller/payments",
          badge: "pronto",
        },
      ] as MenuItem[],
    },
  ];

  const renderBadge = (badge: string, isHighlight?: boolean) => {
    if (badge === "pronto") {
      return (
        <Badge
          variant="secondary"
          className="ml-auto text-xs bg-gray-100 text-gray-500"
        >
          Pronto
        </Badge>
      );
    }
    if (badge === "nuevo") {
      return (
        <Badge
          variant="secondary"
          className="ml-auto text-xs bg-blue-100 text-blue-700"
        >
          Nuevo
        </Badge>
      );
    }
    if (isHighlight) {
      return (
        <Badge className="ml-auto text-xs bg-green-500 text-white">+</Badge>
      );
    }
    return (
      <Badge
        variant="secondary"
        className="ml-auto text-xs bg-red-100 text-red-700"
      >
        {badge}
      </Badge>
    );
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 w-full">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto"></div>
            <Crown className="h-8 w-8 text-blue-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-4 text-lg font-medium text-gray-700">
            Cargando dashboard...
          </p>
          <p className="text-sm text-gray-500">
            Preparando tu espacio de vendedor
          </p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="max-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex min-h-0">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden min-h-0"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-50 bg-white shadow-xl transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } ${sidebarCollapsed ? "w-16" : "w-80"}`}
        >
          <div className="flex flex-col h-full">
            {/* Header del sidebar */}
            <div
              className={`flex items-center border-b border-gray-200 ${
                sidebarCollapsed ? "p-3 justify-center" : "p-6 justify-between"
              }`}
            >
              {!sidebarCollapsed && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Crown className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900">
                      TCG Shop
                    </h1>
                    <p className="text-xs text-gray-600">Dashboard Vendedor</p>
                  </div>
                </div>
              )}

              {sidebarCollapsed && (
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Crown className="h-5 w-5 text-white" />
                </div>
              )}

              <div className="flex items-center gap-2">
                {/* Botón de toggle para desktop */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden lg:flex"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                >
                  {sidebarCollapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>

                {/* Botón de cerrar para móvil */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Perfil del usuario */}
            <div
              className={`border-b border-gray-200 ${
                sidebarCollapsed ? "p-2" : "p-4"
              }`}
            >
              <div
                className={`flex items-center ${
                  sidebarCollapsed ? "justify-center" : "gap-3"
                }`}
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={session?.user?.image || ""} />
                    <AvatarFallback className="bg-blue-500 text-white font-medium">
                      {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                </div>

                {!sidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {session?.user?.name || "Usuario"}
                    </p>
                    <p className="text-xs text-gray-600">Vendedor Activo</p>
                  </div>
                )}
              </div>
            </div>

            {/* Navegación */}
            <div
              className={`flex-1 overflow-y-auto space-y-6 ${
                sidebarCollapsed ? "p-2" : "p-4"
              }`}
            >
              {menuSections.map((section) => (
                <div key={section.title}>
                  {!sidebarCollapsed && (
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      {section.title}
                    </h3>
                  )}
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const IconComponent = item.icon;
                      const linkContent = (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={`group flex items-center text-sm font-medium rounded-lg transition-all duration-200 relative ${
                            sidebarCollapsed
                              ? "px-2 py-3 justify-center"
                              : "px-3 py-2.5"
                          } ${
                            item.current
                              ? "bg-blue-50 text-blue-700 border-r-2 border-blue-500"
                              : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                          }`}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <IconComponent
                            className={`h-4 w-4 transition-colors ${
                              sidebarCollapsed ? "" : "mr-3"
                            } ${
                              item.current
                                ? "text-blue-500"
                                : "text-gray-400 group-hover:text-gray-600"
                            }`}
                          />

                          {!sidebarCollapsed && (
                            <>
                              <span className="flex-1">{item.name}</span>
                              {item.badge &&
                                renderBadge(item.badge, item.highlight)}
                              {item.current && (
                                <ChevronRight className="h-3 w-3 text-blue-500 ml-1" />
                              )}
                            </>
                          )}

                          {/* Badge para sidebar colapsado */}
                          {sidebarCollapsed && item.badge && (
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
                          )}
                        </Link>
                      );

                      // Si el sidebar está colapsado, envolver con tooltip
                      if (sidebarCollapsed) {
                        return (
                          <Tooltip key={item.name}>
                            <TooltipTrigger asChild>
                              {linkContent}
                            </TooltipTrigger>
                            <TooltipContent side="right" className="ml-2">
                              <p>{item.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      }

                      return linkContent;
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer del sidebar */}
            <div
              className={`border-t border-gray-200 ${
                sidebarCollapsed ? "p-2" : "p-4"
              }`}
            >
              {sidebarCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/" className="w-full">
                      <Button
                        variant="outline"
                        className="w-full text-sm border-gray-300 justify-center px-2"
                      >
                        <Home className="w-4 h-4" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="ml-2">
                    <p>Volver a TCG</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Link href="/" className="w-full">
                  <Button
                    variant="outline"
                    className="w-full text-sm border-gray-300 justify-start"
                  >
                    <Home className="w-4 h-4 mr-3" />
                    Volver a TCG
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 flex flex-col lg:ml-0">
          {/* Header móvil */}
          <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-blue-500" />
              <span className="font-semibold text-gray-900">TCG Shop</span>
            </div>
            <Button variant="ghost" size="sm">
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <Badge className="ml-1 px-1.5 py-0 text-xs bg-red-500 text-white">
                  {notificationCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Header desktop con toggle del sidebar */}
          <div className="hidden lg:flex bg-white border-b border-gray-200 px-4 py-3 items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-gray-600 hover:text-gray-900"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </Button>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm">
                <Bell className="h-5 w-5" />
                {notificationCount > 0 && (
                  <Badge className="ml-1 px-1.5 py-0 text-xs bg-red-500 text-white">
                    {notificationCount}
                  </Badge>
                )}
              </Button>
            </div>
          </div>

          {/* Contenido de la página */}
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default SellerLayout;
