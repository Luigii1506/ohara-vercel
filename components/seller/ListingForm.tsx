// Formulario reutilizable para crear/editar listados - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import CardSelector from "./CardSelector";
import { formatPrice } from "@/lib/shop/utils";
import {
  Package,
  DollarSign,
  AlertTriangle,
  Star,
  Save,
  Eye,
  Settings,
} from "lucide-react";

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

interface ListingFormProps {
  initialData?: Partial<ListingFormData>;
  initialCard?: CardData | null;
  mode: "create_inventory" | "create_listing" | "edit";
  onSubmit: (
    data: ListingFormData & { selectedCard: CardData | null }
  ) => Promise<void>;
  loading?: boolean;
  submitText?: string;
}

const CARD_CONDITIONS = [
  { value: "Near Mint", label: "Near Mint (NM)" },
  { value: "Light Play", label: "Light Play (LP)" },
  { value: "Moderate Play", label: "Moderate Play (MP)" },
  { value: "Heavy Play", label: "Heavy Play (HP)" },
  { value: "Damaged", label: "Damaged (DM)" },
];

const DEFAULT_FORM_DATA: ListingFormData = {
  cardId: null,
  price: "",
  stock: "1",
  conditionForSale: "Near Mint",
  sku: "",
  lowStockThreshold: "5",
  isFeatured: false,
  isDraft: true,
  isActive: false,
};

export default function ListingForm({
  initialData = {},
  initialCard = null,
  mode,
  onSubmit,
  loading = false,
  submitText,
}: ListingFormProps) {
  const [selectedCard, setSelectedCard] = useState<CardData | null>(
    initialCard
  );
  const [formData, setFormData] = useState<ListingFormData>({
    ...DEFAULT_FORM_DATA,
    ...initialData,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Configurar valores por defecto según el modo
  useEffect(() => {
    if (mode === "create_inventory") {
      setFormData((prev) => ({
        ...prev,
        isDraft: true,
        isActive: false,
      }));
    } else if (mode === "create_listing") {
      setFormData((prev) => ({
        ...prev,
        isDraft: false,
        isActive: true,
      }));
    }
  }, [mode]);

  // Generar SKU automático cuando se selecciona una carta
  useEffect(() => {
    if (selectedCard && !formData.sku && mode !== "edit") {
      const timestamp = Date.now();
      const generatedSku = `${
        selectedCard.code
      }-${formData.conditionForSale.replace(/\s+/g, "")}-${timestamp}`;
      setFormData((prev) => ({
        ...prev,
        sku: generatedSku,
      }));
    }
  }, [selectedCard, formData.conditionForSale, mode]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedCard) {
      newErrors.card = "Debes seleccionar una carta";
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      newErrors.price = "El precio debe ser mayor a 0";
    }

    if (!formData.stock || parseInt(formData.stock) < 0) {
      newErrors.stock = "El stock no puede ser negativo";
    }

    if (!formData.conditionForSale) {
      newErrors.conditionForSale = "Debes seleccionar una condición";
    }

    if (parseInt(formData.lowStockThreshold) < 0) {
      newErrors.lowStockThreshold = "El umbral no puede ser negativo";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const submitData = {
      ...formData,
      cardId: selectedCard?.id || null,
      selectedCard,
    };

    await onSubmit(submitData);
  };

  const handleInputChange = (
    field: keyof ListingFormData,
    value: string | boolean
  ) => {
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

  const getFormTitle = () => {
    switch (mode) {
      case "create_inventory":
        return "Agregar al Inventario";
      case "create_listing":
        return "Crear Listado";
      case "edit":
        return "Editar Listado";
      default:
        return "Formulario de Producto";
    }
  };

  const getFormDescription = () => {
    switch (mode) {
      case "create_inventory":
        return "Agrega un producto a tu inventario. Podrás listarlo para venta después.";
      case "create_listing":
        return "Crea un listado que estará inmediatamente disponible para venta.";
      case "edit":
        return "Modifica los detalles de tu listado.";
      default:
        return "";
    }
  };

  const getDefaultSubmitText = () => {
    switch (mode) {
      case "create_inventory":
        return "Agregar al Inventario";
      case "create_listing":
        return "Crear Listado";
      case "edit":
        return "Guardar Cambios";
      default:
        return "Guardar";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <Card className="!h-max border-0 shadow-md">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" />
            {getFormTitle()}
          </CardTitle>
          <p className="text-sm text-gray-600">{getFormDescription()}</p>
        </CardHeader>
      </Card>

      {/* Selección de Carta */}
      <Card className="!h-max border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-base">Carta</CardTitle>
        </CardHeader>
        <CardContent>
          <CardSelector
            selectedCard={selectedCard}
            onCardSelect={setSelectedCard}
            placeholder="Buscar carta por nombre o código..."
            error={errors.card}
          />
        </CardContent>
      </Card>

      {/* Información de Venta */}
      <Card className="!h-max border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Información de Venta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              {formData.price && parseFloat(formData.price) > 0 && (
                <p className="text-sm text-gray-500">
                  Precio:{" "}
                  {formatPrice(Math.round(parseFloat(formData.price) * 100))}
                </p>
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
                <SelectTrigger
                  className={errors.conditionForSale ? "border-red-300" : ""}
                >
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
              {errors.conditionForSale && (
                <p className="text-sm text-red-600">
                  {errors.conditionForSale}
                </p>
              )}
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
              <p className="text-xs text-gray-500">
                Recibirás alertas cuando el stock esté por debajo de este número
              </p>
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
        </CardContent>
      </Card>

      {/* Configuración Avanzada */}
      <Card className="!h-max border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configuración
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "create_listing" && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="featured"
                checked={formData.isFeatured}
                onCheckedChange={(checked) =>
                  handleInputChange("isFeatured", Boolean(checked))
                }
              />
              <Label htmlFor="featured" className="flex items-center gap-2">
                <Star className="w-4 h-4" />
                Producto destacado
              </Label>
              <Badge variant="outline" className="text-xs">
                Premium
              </Badge>
            </div>
          )}

          {mode === "edit" && (
            <>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="featured"
                  checked={formData.isFeatured}
                  onCheckedChange={(checked) =>
                    handleInputChange("isFeatured", Boolean(checked))
                  }
                />
                <Label htmlFor="featured" className="flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Producto destacado
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    handleInputChange("isActive", Boolean(checked))
                  }
                />
                <Label htmlFor="active" className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Visible para compradores
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="draft"
                  checked={formData.isDraft}
                  onCheckedChange={(checked) =>
                    handleInputChange("isDraft", Boolean(checked))
                  }
                />
                <Label htmlFor="draft">Guardar como borrador</Label>
              </div>
            </>
          )}

          {/* Vista previa del estado */}
          <div className="pt-2 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Estado del producto:
            </p>
            <div className="flex items-center gap-2">
              {formData.isDraft ? (
                <Badge
                  variant="secondary"
                  className="bg-yellow-100 text-yellow-700"
                >
                  Borrador
                </Badge>
              ) : formData.isActive ? (
                <Badge variant="default">Activo</Badge>
              ) : (
                <Badge variant="secondary">Inactivo</Badge>
              )}

              {formData.isFeatured && (
                <Badge
                  variant="outline"
                  className="border-yellow-300 text-yellow-700"
                >
                  <Star className="w-3 h-3 mr-1" />
                  Destacado
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formData.isDraft
                ? "El producto estará en tu inventario pero no será visible para compradores"
                : formData.isActive
                ? "El producto estará disponible para compra"
                : "El producto estará en tu inventario pero no será visible para compradores"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Botones de Acción */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="submit"
          disabled={loading}
          className="bg-green-500 hover:bg-green-600"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {submitText || getDefaultSubmitText()}
        </Button>
      </div>
    </form>
  );
}
