// Página para crear listados directos - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Package, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import InventorySelector from "@/components/seller/InventorySelector";

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

export default function CreateListing() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Verificar autenticación
  useEffect(() => {
    if (status === "loading") return;

    if (!session) {
      router.push("/login");
      return;
    }
  }, [session, status, router]);

  const handleItemSelect = (item: InventoryItem) => {
    if (item.isListed) {
      alert("Este producto ya está listado para venta");
      return;
    }
    setSelectedItem(item);
  };

  const handleCreateListing = async () => {
    if (!selectedItem) {
      alert("Debes seleccionar un producto de tu inventario");
      return;
    }

    if (selectedItem.availableStock <= 0) {
      alert("Este producto no tiene stock disponible");
      return;
    }

    try {
      setLoading(true);

      // Activar el producto del inventario para que aparezca en listings
      const response = await fetch(
        `/api/seller/inventory/${selectedItem.id}/list`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            listPrice: selectedItem.listPrice,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error listando producto");
      }

      if (result.success) {
        alert("Producto listado exitosamente");
        router.push("/seller/listings");
      } else {
        throw new Error(result.error || "Error listando producto");
      }
    } catch (error) {
      console.error("Error creating listing:", error);
      alert(error instanceof Error ? error.message : "Error creando listado");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 w-full">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto"></div>
            <Package className="h-8 w-8 text-blue-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-4 text-lg font-medium text-gray-700">
            Cargando formulario...
          </p>
          <p className="text-sm text-gray-500">Preparando para crear listado</p>
        </div>
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
              <Link href="/seller/listings">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Volver a Listados
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Package className="w-7 h-7 text-blue-500" />
                  Crear Listado
                </h1>
                <p className="text-gray-600 text-sm">
                  Crea un producto listo para venta inmediata
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Nota informativa */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <Star className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900">
                Listar Producto del Inventario
              </h3>
              <p className="text-sm text-blue-700">
                Selecciona un producto de tu inventario para ponerlo en venta.
                Solo puedes listar productos que ya están en tu{" "}
                <Link
                  href="/seller/inventory"
                  className="underline font-medium"
                >
                  Inventario
                </Link>
                . Si necesitas agregar nuevos productos, ve a{" "}
                <Link
                  href="/seller/inventory/new"
                  className="underline font-medium"
                >
                  Agregar al Inventario
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Selector de inventario */}
        <InventorySelector
          onItemSelect={handleItemSelect}
          selectedItem={selectedItem}
        />

        {/* Producto seleccionado y botón de acción */}
        {selectedItem && (
          <div className="mt-6">
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Producto Seleccionado
              </h3>

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-20 h-28 bg-white rounded overflow-hidden flex-shrink-0">
                  <img
                    src={
                      selectedItem.card.src || "/assets/images/backcard.webp"
                    }
                    alt={selectedItem.card.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "/assets/images/backcard.webp";
                    }}
                  />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-lg text-gray-900">
                    {selectedItem.card.name}
                  </h4>
                  <p className="text-gray-600">
                    {selectedItem.card.code} • {selectedItem.card.setCode}
                  </p>
                  <p className="text-sm text-gray-600">
                    Condición: {selectedItem.condition}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-sm text-gray-600">
                      Stock disponible:{" "}
                      <strong>{selectedItem.availableStock}</strong>
                    </span>
                    <span className="text-sm text-gray-600">
                      Precio:{" "}
                      <strong>${selectedItem.listPrice.toFixed(2)}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setSelectedItem(null)}
                  disabled={loading}
                >
                  Cancelar Selección
                </Button>
                <Button
                  onClick={handleCreateListing}
                  disabled={loading || selectedItem.availableStock <= 0}
                  className="bg-green-500 hover:bg-green-600"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  ) : (
                    <Package className="w-4 h-4 mr-2" />
                  )}
                  Listar para Venta
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
