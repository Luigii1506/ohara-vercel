// Dashboard principal de la tienda para clientes - Ohara TCG Shop
// Fecha de modificación: 2025-01-02

"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShoppingCart,
  Package,
  Heart,
  CreditCard,
  TrendingUp,
  Star,
  ArrowRight,
  Plus,
  Clock,
  CheckCircle,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { showSuccessToast } from "@/lib/toastify";

// Mock data para el dashboard
const mockRecentOrders = [
  {
    id: "ORD-2025-001",
    date: "2025-01-15",
    status: "delivered",
    total: 45.48,
    itemCount: 3,
  },
  {
    id: "ORD-2025-002",
    date: "2025-01-18",
    status: "processing",
    total: 28.74,
    itemCount: 4,
  },
];

const mockFeaturedCards = [
  {
    id: 1,
    name: "Monkey D. Luffy",
    code: "ST01-001",
    rarity: "Leader",
    price: 15.99,
    image: "/assets/images/cards/ST01-001.jpg",
    seller: "CardMaster Pro",
    sellerRating: 4.9,
  },
  {
    id: 2,
    name: "Roronoa Zoro",
    code: "ST01-013",
    rarity: "Super Rare",
    price: 8.5,
    image: "/assets/images/cards/ST01-013.jpg",
    seller: "TCG Vault",
    sellerRating: 4.8,
  },
  {
    id: 3,
    name: "Nami",
    code: "ST01-007",
    rarity: "Rare",
    price: 3.25,
    image: "/assets/images/cards/ST01-007.jpg",
    seller: "CardMaster Pro",
    sellerRating: 4.9,
  },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const addToCart = (card: any) => {
    showSuccessToast(`${card.name} agregado al carrito!`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "text-green-600 bg-green-50 border-green-200";
      case "shipped":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "processing":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
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
      default:
        return "Pendiente";
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-8">
        {/* Header de bienvenida */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            Bienvenido a Ohara TCG Shop
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Descubre la mejor colección de cartas de One Piece TCG. Encuentra
            cartas raras, construye tu deck perfecto y únete a la aventura.
          </p>
        </div>

        {/* Métricas rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Productos</p>
                  <p className="text-xl font-bold text-gray-900">1,250+</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">En Carrito</p>
                  <p className="text-xl font-bold text-gray-900">2</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500 rounded-lg">
                  <Heart className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Favoritos</p>
                  <p className="text-xl font-bold text-gray-900">5</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pedidos</p>
                  <p className="text-xl font-bold text-gray-900">12</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Acciones rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/user-store/products">
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer group">
              <CardContent className="p-6 text-center">
                <Package className="w-12 h-12 mx-auto mb-4 text-blue-500 group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold text-lg mb-2">
                  Explorar Productos
                </h3>
                <p className="text-gray-600 text-sm">
                  Descubre nuestra colección completa de cartas
                </p>
                <ArrowRight className="w-4 h-4 mx-auto mt-3 text-blue-500" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/user-store/cart">
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer group">
              <CardContent className="p-6 text-center">
                <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-green-500 group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold text-lg mb-2">Mi Carrito</h3>
                <p className="text-gray-600 text-sm">
                  Revisa y finaliza tu compra
                </p>
                <ArrowRight className="w-4 h-4 mx-auto mt-3 text-green-500" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/user-store/wishlist">
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer group">
              <CardContent className="p-6 text-center">
                <Heart className="w-12 h-12 mx-auto mb-4 text-red-500 group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold text-lg mb-2">Mis Favoritos</h3>
                <p className="text-gray-600 text-sm">
                  Cartas guardadas para más tarde
                </p>
                <ArrowRight className="w-4 h-4 mx-auto mt-3 text-red-500" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/user-store/orders">
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer group">
              <CardContent className="p-6 text-center">
                <CreditCard className="w-12 h-12 mx-auto mb-4 text-purple-500 group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold text-lg mb-2">Mis Pedidos</h3>
                <p className="text-gray-600 text-sm">
                  Historial y seguimiento de compras
                </p>
                <ArrowRight className="w-4 h-4 mx-auto mt-3 text-purple-500" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Sección de cartas destacadas */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Cartas Destacadas
            </h2>
            <Link href="/user-store/products">
              <Button variant="outline">
                Ver Todas
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {mockFeaturedCards.map((card) => (
              <Card
                key={card.id}
                className="border-0 shadow-md hover:shadow-lg transition-shadow group"
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Imagen de la carta */}
                    <div className="aspect-[2.5/3.5] bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={card.image || "/assets/images/backcard.webp"}
                        alt={card.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "/assets/images/backcard.webp";
                        }}
                      />
                    </div>

                    {/* Info de la carta */}
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm line-clamp-2">
                        {card.name}
                      </h3>
                      <p className="text-xs text-gray-600">{card.code}</p>

                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {card.rarity}
                        </Badge>
                        <span className="font-bold text-lg text-blue-600">
                          ${card.price.toFixed(2)}
                        </span>
                      </div>

                      <div className="text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span>{card.sellerRating}</span>
                          <span>• {card.seller}</span>
                        </div>
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => addToCart(card)}
                        className="flex-1 bg-green-500 hover:bg-green-600"
                        size="sm"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Agregar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => showSuccessToast("Agregado a favoritos!")}
                      >
                        <Heart className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Pedidos recientes */}
        {mockRecentOrders.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Pedidos Recientes
              </h2>
              <Link href="/user-store/orders">
                <Button variant="outline">
                  Ver Todos
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>

            <div className="space-y-4">
              {mockRecentOrders.map((order) => (
                <Card key={order.id} className="border-0 shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <Package className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Pedido {order.id}</h3>
                          <p className="text-sm text-gray-600">
                            {new Date(order.date).toLocaleDateString("es-ES")} •{" "}
                            {order.itemCount} productos
                          </p>
                        </div>
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
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Call to action */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-4">
              ¿Listo para la aventura?
            </h2>
            <p className="text-xl mb-6 opacity-90">
              Únete a miles de jugadores y construye el deck de tus sueños
            </p>
            <Link href="/user-store/products">
              <Button
                size="lg"
                variant="secondary"
                className="bg-white text-blue-600 hover:bg-gray-100"
              >
                <TrendingUp className="w-5 h-5 mr-2" />
                Comenzar a Comprar
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
