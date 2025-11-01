// Modal para agregar carta al inventario - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Package, DollarSign, X } from "lucide-react";

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

interface AddToInventoryModalProps {
  card: CardData | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CARD_CONDITIONS = [
  { value: "Near Mint", label: "Near Mint (NM)" },
  { value: "Light Play", label: "Light Play (LP)" },
  { value: "Moderate Play", label: "Moderate Play (MP)" },
  { value: "Heavy Play", label: "Heavy Play (HP)" },
  { value: "Damaged", label: "Damaged (DM)" },
];

export default function AddToInventoryModal({
  card,
  isOpen,
  onClose,
  onSuccess,
}: AddToInventoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    price: "",
    stock: "1",
    conditionForSale: "Near Mint",
    sku: "",
    lowStockThreshold: "5",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Limpiar error cuando el usuario empiece a corregir
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.price || parseFloat(formData.price) <= 0) {
      newErrors.price = "El precio debe ser mayor a 0";
    }

    if (!formData.stock || parseInt(formData.stock) < 0) {
      newErrors.stock = "El stock no puede ser negativo";
    }

    if (parseInt(formData.lowStockThreshold) < 0) {
      newErrors.lowStockThreshold = "El umbral no puede ser negativo";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!card || !validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/seller/inventory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardId: card.id,
          price: parseFloat(formData.price),
          stock: parseInt(formData.stock),
          conditionForSale: formData.conditionForSale,
          sku: formData.sku || undefined,
          lowStockThreshold: parseInt(formData.lowStockThreshold),
          isDraft: true, // Siempre como borrador en inventario
          isActive: false, // Siempre inactivo hasta que se liste
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Error agregando producto al inventario"
        );
      }

      if (result.success) {
        // Resetear formulario
        setFormData({
          price: "",
          stock: "1",
          conditionForSale: "Near Mint",
          sku: "",
          lowStockThreshold: "5",
        });
        setErrors({});
        onSuccess();
        onClose();
      } else {
        throw new Error(result.error || "Error agregando producto");
      }
    } catch (error) {
      console.error("Error adding to inventory:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Error agregando producto al inventario"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setErrors({});
      onClose();
    }
  };

  if (!card) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" />
            Agregar al Inventario
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información de la carta */}
          <Card className="!h-max border-0 bg-gray-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-28 bg-white rounded overflow-hidden flex-shrink-0">
                  <img
                    src={card.src || "/assets/images/backcard.webp"}
                    alt={card.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "/assets/images/backcard.webp";
                    }}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900">
                    {card.name}
                  </h3>
                  <p className="text-gray-600">
                    {card.code} • {card.setCode}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline">{card.category}</Badge>
                    {card.rarity && (
                      <Badge variant="secondary">{card.rarity}</Badge>
                    )}
                    {card.cost && (
                      <Badge variant="secondary">Costo: {card.cost}</Badge>
                    )}
                  </div>
                  {card.types.length > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Tipos: {card.types.map((t) => t.type).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Precio */}
              <div className="space-y-2">
                <Label htmlFor="price">Precio (USD) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => handleInputChange("price", e.target.value)}
                  placeholder="0.00"
                  className={errors.price ? "border-red-300" : ""}
                />
                {errors.price && (
                  <p className="text-sm text-red-600">{errors.price}</p>
                )}
              </div>

              {/* Stock */}
              <div className="space-y-2">
                <Label htmlFor="stock">Cantidad *</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => handleInputChange("stock", e.target.value)}
                  placeholder="1"
                  className={errors.stock ? "border-red-300" : ""}
                />
                {errors.stock && (
                  <p className="text-sm text-red-600">{errors.stock}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Condición */}
              <div className="space-y-2">
                <Label htmlFor="condition">Condición *</Label>
                <Select
                  value={formData.conditionForSale}
                  onValueChange={(value) =>
                    handleInputChange("conditionForSale", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar condición" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CONDITIONS.map((condition) => (
                      <SelectItem key={condition.value} value={condition.value}>
                        {condition.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Umbral de Stock Bajo */}
              <div className="space-y-2">
                <Label htmlFor="lowStockThreshold">Umbral de Stock Bajo</Label>
                <Input
                  id="lowStockThreshold"
                  type="number"
                  min="0"
                  value={formData.lowStockThreshold}
                  onChange={(e) =>
                    handleInputChange("lowStockThreshold", e.target.value)
                  }
                  placeholder="5"
                  className={errors.lowStockThreshold ? "border-red-300" : ""}
                />
                {errors.lowStockThreshold && (
                  <p className="text-sm text-red-600">
                    {errors.lowStockThreshold}
                  </p>
                )}
              </div>
            </div>

            {/* SKU */}
            <div className="space-y-2">
              <Label htmlFor="sku">SKU (Código del Producto)</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => handleInputChange("sku", e.target.value)}
                placeholder="Se generará automáticamente si se deja vacío"
              />
              <p className="text-xs text-gray-500">
                Código único para identificar este producto en tu inventario
              </p>
            </div>

            {/* Nota informativa */}
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-start gap-2">
                <Package className="h-4 w-4 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm text-green-800">
                    Este producto se agregará como <strong>borrador</strong> en
                    tu inventario. Podrás activarlo para venta desde el Control
                    de Inventario.
                  </p>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-green-500 hover:bg-green-600"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                ) : (
                  <Package className="w-4 h-4 mr-2" />
                )}
                Agregar al Inventario
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
