// Página de detalles de listado individual - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  Package,
  Edit,
  Eye,
  Star,
  AlertTriangle,
  DollarSign,
  Calendar,
  BarChart3,
  Users,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/shop/utils";

interface CardListing {
  id: number;
  uuid: string;
  cardId: number;
  sellerId: number;
  price: number;
  stock: number;
  conditionForSale: string;
  sku?: string;
  isActive: boolean;
  isDraft: boolean;
  isFeatured: boolean;
  lowStockThreshold: number;
  listingDate: string;
  createdAt: string;
  updatedAt: string;
  card: {
    id: number;
    name: string;
    code: string;
    src: string;
    setCode: string;
    category: string;
    cost?: string;
    rarity?: string;
    types: Array<{ type: string }>;
    colors: Array<{ color: string }>;
    sets: Array<{
      set: {
        title: string;
        code: string;
      };
    }>;
  };
  seller: {
    id: number;
    name: string;
    email: string;
  };
  reviews: Array<{
    id: number;
    rating: number;
    comment?: string;
    createdAt: string;
    user: {
      id: number;
      name: string;
    };
  }>;
}

export default function ListingDetail({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [listing, setListing] = useState<CardListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verificar autenticación y cargar datos
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/login");
      return;
    }

    fetchListing();
  }, [session, status, router, params.id]);

  const fetchListing = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/seller/listings/${params.id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error obteniendo listado");
      }

      const data = await response.json();

      if (data.success) {
        setListing(data.data);
      } else {
        throw new Error(data.error || "Error obteniendo listado");
      }
    } catch (error) {
      console.error("Error fetching listing:", error);
      setError(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!listing) return;

    const confirmMessage = `¿Estás seguro de que quieres desactivar "${listing.card.name}"?`;
    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetch(`/api/seller/listings/${listing.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error desactivando listado");
      }

      alert("Listado desactivado exitosamente");
      router.push("/seller/listings");
    } catch (error) {
      console.error("Error deleting listing:", error);
      alert(
        error instanceof Error ? error.message : "Error desactivando listado"
      );
    }
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
            Cargando listado...
          </p>
          <p className="text-sm text-gray-500">
            Obteniendo detalles del producto
          </p>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 w-full">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-red-600">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {error || "Listado no encontrado"}
              </p>
              <div className="flex gap-2">
                <Button onClick={() => router.back()} variant="outline">
                  Volver
                </Button>
                <Button onClick={fetchListing}>Reintentar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getStockStatus = () => {
    if (listing.stock === 0) {
      return { color: "destructive", text: "Sin Stock", icon: AlertTriangle };
    } else if (listing.stock <= listing.lowStockThreshold) {
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

  const stockStatus = getStockStatus();
  const averageRating =
    listing.reviews.length > 0
      ? listing.reviews.reduce((sum, review) => sum + review.rating, 0) /
        listing.reviews.length
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 w-full">
      {/* Header Premium */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <Link href="/seller/listings">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Volver a Listados
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Package className="w-7 h-7 text-blue-500" />
                  Detalles del Listado
                </h1>
                <p className="text-gray-600 text-sm">
                  {listing.card.name} • {listing.sku || listing.card.code}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link href={`/seller/listings/${listing.id}/edit`}>
                <Button variant="outline" size="sm">
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Desactivar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Información Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Imagen y Detalles de la Carta */}
          <div className="lg:col-span-1">
            <Card className="!h-max border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="text-center mb-4">
                  <div className="w-48 h-64 mx-auto bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={listing.card.src || "/assets/images/backcard.webp"}
                      alt={listing.card.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/assets/images/backcard.webp";
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">
                      {listing.card.name}
                    </h3>
                    <p className="text-gray-600">{listing.card.code}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{listing.card.category}</Badge>
                    {listing.card.rarity && (
                      <Badge variant="secondary">{listing.card.rarity}</Badge>
                    )}
                    {listing.card.cost && (
                      <Badge variant="secondary">
                        Costo: {listing.card.cost}
                      </Badge>
                    )}
                  </div>

                  {listing.card.types.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Tipos:
                      </p>
                      <p className="text-sm text-gray-600">
                        {listing.card.types.map((t) => t.type).join(", ")}
                      </p>
                    </div>
                  )}

                  {listing.card.colors.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Colores:
                      </p>
                      <p className="text-sm text-gray-600">
                        {listing.card.colors.map((c) => c.color).join(", ")}
                      </p>
                    </div>
                  )}

                  {listing.card.sets.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">Set:</p>
                      <p className="text-sm text-gray-600">
                        {listing.card.sets[0].set.title} (
                        {listing.card.sets[0].set.code})
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Información del Listado */}
          <div className="lg:col-span-2 space-y-6">
            {/* Estado y Precio */}
            <Card className="!h-max border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Información de Venta
                  </span>
                  <div className="flex items-center gap-2">
                    {listing.isDraft ? (
                      <Badge
                        variant="secondary"
                        className="bg-yellow-100 text-yellow-700"
                      >
                        Borrador
                      </Badge>
                    ) : listing.isActive ? (
                      <Badge variant="default">Activo</Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}

                    {listing.isFeatured && (
                      <Badge
                        variant="outline"
                        className="border-yellow-300 text-yellow-700"
                      >
                        <Star className="w-3 h-3 mr-1" />
                        Destacado
                      </Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Precio</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPrice(listing.price)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Stock</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-bold text-gray-900">
                        {listing.stock}
                      </p>
                      <Badge
                        variant={stockStatus.color as any}
                        className={stockStatus.className}
                      >
                        {stockStatus.text}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Condición
                    </p>
                    <p className="text-lg font-medium text-gray-900">
                      {listing.conditionForSale}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">SKU</p>
                    <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {listing.sku || "---"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Umbral de stock bajo:</p>
                      <p className="font-medium">
                        {listing.lowStockThreshold} unidades
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Fecha de listado:</p>
                      <p className="font-medium">
                        {new Date(listing.listingDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="!h-max border-0 shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <Eye className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Visitas</p>
                      <p className="text-xl font-bold text-gray-900">0</p>
                      <p className="text-xs text-gray-500">Próximamente</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="!h-max border-0 shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Ventas</p>
                      <p className="text-xl font-bold text-gray-900">0</p>
                      <p className="text-xs text-gray-500">Próximamente</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="!h-max border-0 shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500 rounded-lg">
                      <Star className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Rating</p>
                      <p className="text-xl font-bold text-gray-900">
                        {averageRating > 0 ? averageRating.toFixed(1) : "---"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {listing.reviews.length} reseñas
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Historial y Actividad */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Reseñas */}
          <Card className="!h-max border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Reseñas ({listing.reviews.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {listing.reviews.length > 0 ? (
                <div className="space-y-4">
                  {listing.reviews.map((review) => (
                    <div
                      key={review.id}
                      className="border-b border-gray-200 pb-4 last:border-b-0"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm">
                          {review.user.name}
                        </p>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < review.rating
                                  ? "text-yellow-400 fill-current"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-gray-600">
                          {review.comment}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Sin reseñas aún</p>
                  <p className="text-xs">
                    Las reseñas aparecerán cuando los clientes compren este
                    producto
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Información del Sistema */}
          <Card className="!h-max border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Información del Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    UUID del Listado
                  </p>
                  <p className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                    {listing.uuid}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Fecha de Creación
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(listing.createdAt).toLocaleString()}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Última Actualización
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(listing.updatedAt).toLocaleString()}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700">Vendedor</p>
                  <p className="text-sm text-gray-600">{listing.seller.name}</p>
                  <p className="text-xs text-gray-500">
                    {listing.seller.email}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
