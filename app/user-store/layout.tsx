"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Store,
  ShoppingCart,
  User,
  Search,
  Heart,
  Bell,
  Menu,
  X,
  Home,
  Package,
  CreditCard,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

// Fecha de modificación: 2025-01-02 - Layout específico para user-store

interface UserStoreLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout específico para la sección user-store de Ohara TCG Shop.
 * Proporciona una experiencia de tienda moderna y profesional completamente
 * diferente al layout principal de la aplicación.
 *
 * @param {UserStoreLayoutProps} props Los props del componente, incluyendo `children`.
 * @returns {JSX.Element} Un elemento JSX que representa el layout de la tienda de usuarios.
 */
const UserStoreLayout = ({ children }: UserStoreLayoutProps) => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Navegación principal de la tienda
  const navigationItems = [
    { href: "/user-store", label: "Inicio", icon: Home },
    { href: "/user-store/products", label: "Productos", icon: Package },
    { href: "/user-store/cart", label: "Mi Carrito", icon: ShoppingCart },
    { href: "/user-store/orders", label: "Mis Pedidos", icon: CreditCard },
    { href: "/user-store/wishlist", label: "Favoritos", icon: Heart },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 w-full flex flex-col">
      {/* Header de la tienda */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50 flex-shrink-0">
        <div className="container mx-auto px-4">
          {/* Top bar */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex items-center gap-4">
              {/* Logo de la tienda */}
              <Link href="/user-store" className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <Store className="w-6 h-6 text-white" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold text-gray-900">Ohara TCG</h1>
                  <p className="text-xs text-gray-500">Shop</p>
                </div>
              </Link>

              {/* Barra de búsqueda */}
              <div className="hidden md:flex flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar cartas, productos..."
                    className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Acciones del usuario */}
            <div className="flex items-center gap-3">
              {/* Favoritos */}
              <Link href="/user-store/wishlist">
                <Button variant="ghost" size="sm" className="relative">
                  <Heart className="w-5 h-5" />
                  <Badge
                    variant="secondary"
                    className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-red-100 text-red-700"
                  >
                    5
                  </Badge>
                </Button>
              </Link>

              {/* Carrito */}
              <Link href="/user-store/cart">
                <Button variant="ghost" size="sm" className="relative">
                  <ShoppingCart className="w-5 h-5" />
                  <Badge
                    variant="default"
                    className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-green-500"
                  >
                    2
                  </Badge>
                </Button>
              </Link>

              {/* Notificaciones */}
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="w-5 h-5" />
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs"
                >
                  3
                </Badge>
              </Button>

              {/* Perfil de usuario */}
              <Button variant="ghost" size="sm">
                <User className="w-5 h-5" />
              </Button>

              {/* Menú móvil */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Navegación principal */}
          <nav className="hidden md:flex items-center gap-1 py-3">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={`flex items-center gap-2 ${
                      isActive
                        ? "bg-blue-500 hover:bg-blue-600 text-white"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* Menú móvil desplegable */}
          {isMobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-100">
              {/* Barra de búsqueda móvil */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar cartas, productos..."
                    className="pl-10 border-gray-300"
                  />
                </div>
              </div>

              {/* Navegación móvil */}
              <div className="space-y-1">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`w-full justify-start gap-3 ${
                          isActive
                            ? "bg-blue-50 text-blue-600 border-l-4 border-blue-500"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        }`}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Contenido principal - Flex grow para ocupar el espacio disponible */}
      <main className="flex-1 w-full">
        <div className="min-h-full">{children}</div>
      </main>

      {/* Footer de la tienda - Siempre al fondo */}
      <footer className="bg-white border-t border-gray-200 mt-auto flex-shrink-0">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Información de la tienda */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Store className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Ohara TCG Shop</h3>
                  <p className="text-xs text-gray-500">
                    Tu tienda de confianza
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                La mejor selección de cartas de One Piece TCG y productos
                relacionados.
              </p>
            </div>

            {/* Enlaces rápidos */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">
                Enlaces Rápidos
              </h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <Link
                    href="/user-store/products"
                    className="hover:text-blue-600"
                  >
                    Productos
                  </Link>
                </li>
                <li>
                  <Link
                    href="/user-store/collections"
                    className="hover:text-blue-600"
                  >
                    Colecciones
                  </Link>
                </li>
                <li>
                  <Link
                    href="/user-store/offers"
                    className="hover:text-blue-600"
                  >
                    Ofertas
                  </Link>
                </li>
                <li>
                  <Link
                    href="/user-store/new-arrivals"
                    className="hover:text-blue-600"
                  >
                    Novedades
                  </Link>
                </li>
              </ul>
            </div>

            {/* Soporte */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Soporte</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <Link href="/user-store/help" className="hover:text-blue-600">
                    Centro de Ayuda
                  </Link>
                </li>
                <li>
                  <Link
                    href="/user-store/shipping"
                    className="hover:text-blue-600"
                  >
                    Envíos
                  </Link>
                </li>
                <li>
                  <Link
                    href="/user-store/returns"
                    className="hover:text-blue-600"
                  >
                    Devoluciones
                  </Link>
                </li>
                <li>
                  <Link
                    href="/user-store/contact"
                    className="hover:text-blue-600"
                  >
                    Contacto
                  </Link>
                </li>
              </ul>
            </div>

            {/* Cuenta */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Mi Cuenta</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <Link
                    href="/user-store/profile"
                    className="hover:text-blue-600"
                  >
                    Perfil
                  </Link>
                </li>
                <li>
                  <Link
                    href="/user-store/orders"
                    className="hover:text-blue-600"
                  >
                    Mis Pedidos
                  </Link>
                </li>
                <li>
                  <Link
                    href="/user-store/wishlist"
                    className="hover:text-blue-600"
                  >
                    Lista de Deseos
                  </Link>
                </li>
                <li>
                  <Link
                    href="/user-store/settings"
                    className="hover:text-blue-600"
                  >
                    Configuración
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-gray-200 mt-8 pt-6 text-center">
            <p className="text-sm text-gray-500">
              © 2025 Ohara TCG Shop. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default UserStoreLayout;
