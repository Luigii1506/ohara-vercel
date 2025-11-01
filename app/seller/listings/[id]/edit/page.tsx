// Página para editar listados existentes - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Package, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import ListingForm from "@/components/seller/ListingForm";

interface CardData {
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
}

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
  card: CardData;
  seller: {
    id: number;
    name: string;
    email: string;
  };
}

interface ListingFormData {
  cardId: number | null;
  price: string;
  stock: string;
  conditionForSale: string;
  sku: string;
  lowStockThreshold: string;
  isFeatured: boolean;
  isDraft: boolean;
  isActive: boolean;
}

export default function EditListing({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [listing, setListing] = useState<CardListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const handleSubmit = async (
    data: ListingFormData & { selectedCard: CardData | null }
  ) => {
    if (!listing) return;

    try {
      setSaving(true);

      const response = await fetch(`/api/seller/listings/${listing.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          price: parseFloat(data.price),
          stock: parseInt(data.stock),
          conditionForSale: data.conditionForSale,
          sku: data.sku || undefined,
          lowStockThreshold: parseInt(data.lowStockThreshold),
          isFeatured: data.isFeatured,
          isDraft: data.isDraft,
          isActive: data.isActive,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error actualizando listado");
      }

      if (result.success) {
        alert("Listado actualizado exitosamente");
        router.push(`/seller/listings/${listing.id}`);
      } else {
        throw new Error(result.error || "Error actualizando listado");
      }
    } catch (error) {
      console.error("Error updating listing:", error);
      alert(
        error instanceof Error ? error.message : "Error actualizando listado"
      );
    } finally {
      setSaving(false);
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
          <p className="text-sm text-gray-500">Obteniendo datos para edición</p>
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

  // Preparar datos iniciales para el formulario
  const initialFormData = {
    cardId: listing.cardId,
    price: (listing.price / 100).toString(), // Convertir de centavos a dólares
    stock: listing.stock.toString(),
    conditionForSale: listing.conditionForSale,
    sku: listing.sku || "",
    lowStockThreshold: listing.lowStockThreshold.toString(),
    isFeatured: listing.isFeatured,
    isDraft: listing.isDraft,
    isActive: listing.isActive,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 w-full">
      {/* Header Premium */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <Link href={`/seller/listings/${listing.id}`}>
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Volver a Detalles
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Edit className="w-7 h-7 text-blue-500" />
                  Editar Listado
                </h1>
                <p className="text-gray-600 text-sm">
                  {listing.card.name} • {listing.sku || listing.card.code}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/seller/listings">
                <Button variant="outline" size="sm">
                  Ver Todos los Listados
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Nota informativa */}
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-start gap-3">
            <Edit className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-900">Editando Listado</h3>
              <p className="text-sm text-yellow-700">
                Estás editando un listado existente. Los cambios se aplicarán
                inmediatamente y afectarán la visibilidad del producto para los
                compradores. Puedes cambiar el estado del producto usando las
                opciones de configuración.
              </p>
            </div>
          </div>
        </div>

        {/* Información de la Carta (Solo Lectura) */}
        <Card className="!h-max border-0 shadow-md mb-6">
          <CardHeader>
            <CardTitle className="text-base">
              Carta Asociada (No Editable)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="w-16 h-20 bg-gray-100 rounded overflow-hidden flex-shrink-0">
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
              <div>
                <h3 className="font-medium text-gray-900">
                  {listing.card.name}
                </h3>
                <p className="text-sm text-gray-600">
                  {listing.card.code} • {listing.card.setCode}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                    {listing.card.category}
                  </span>
                  {listing.card.rarity && (
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                      {listing.card.rarity}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              La carta asociada al listado no se puede cambiar. Si necesitas un
              listado de otra carta, crea un nuevo listado.
            </p>
          </CardContent>
        </Card>

        {/* Formulario de Edición */}
        <div className="max-w-4xl mx-auto">
          <ListingForm
            mode="edit"
            initialData={initialFormData}
            initialCard={listing.card}
            onSubmit={handleSubmit}
            loading={saving}
            submitText="Guardar Cambios"
          />
        </div>
      </div>
    </div>
  );
}
