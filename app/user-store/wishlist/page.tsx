// Página de favoritos/wishlist - Ohara TCG Shop
// Fecha de modificación: 2025-01-02

"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Heart,
  ShoppingCart,
  Plus,
  X,
  Star,
  Package,
  ArrowLeft,
  Search,
  Grid3X3,
  List,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { showSuccessToast } from "@/lib/toastify";

// Mock data de favoritos
const mockWishlistItems = [
  {
    id: 1,
    card: {
      id: 1,
      name: "Monkey D. Luffy",
      code: "ST01-001",
      set: "Starter Deck: Straw Hat Crew",
      rarity: "Leader",
      price: 15.99,
      condition: "Near Mint",
      seller: "CardMaster Pro",
      sellerRating: 4.9,
      image: "/assets/images/cards/ST01-001.jpg",
      stock: 5,
      description:
        "The captain of the Straw Hat Pirates, Monkey D. Luffy possesses the power of the Gum-Gum Fruit.",
      power: 5000,
      cost: 0,
      attribute: "Slash",
      type: "Character",
      counter: 1000,
    },
    dateAdded: "2025-01-15",
    priceWhenAdded: 15.99,
  },
  {
    id: 2,
    card: {
      id: 2,
      name: "Roronoa Zoro",
      code: "ST01-013",
      set: "Starter Deck: Straw Hat Crew",
      rarity: "Super Rare",
      price: 8.5,
      condition: "Near Mint",
      seller: "TCG Vault",
      sellerRating: 4.8,
      image: "/assets/images/cards/ST01-013.jpg",
      stock: 12,
      description:
        "The swordsman of the Straw Hat Pirates, aiming to become the world's greatest swordsman.",
      power: 4000,
      cost: 4,
      attribute: "Slash",
      type: "Character",
      counter: 1000,
    },
    dateAdded: "2025-01-18",
    priceWhenAdded: 9.0,
  },
  {
    id: 3,
    card: {
      id: 3,
      name: "Nami",
      code: "ST01-007",
      set: "Starter Deck: Straw Hat Crew",
      rarity: "Rare",
      price: 3.25,
      condition: "Lightly Played",
      seller: "CardMaster Pro",
      sellerRating: 4.9,
      image: "/assets/images/cards/ST01-007.jpg",
      stock: 8,
      description:
        "The navigator of the Straw Hat Pirates, expert in weather and cartography.",
      power: 1000,
      cost: 1,
      attribute: "Special",
      type: "Character",
      counter: 1000,
    },
    dateAdded: "2025-01-20",
    priceWhenAdded: 3.25,
  },
];

export default function WishlistPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [wishlistItems, setWishlistItems] = useState(mockWishlistItems);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("dateAdded");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Funciones de la wishlist
  const removeFromWishlist = (itemId: number) => {
    setWishlistItems(wishlistItems.filter((item) => item.id !== itemId));
    setSelectedItems(selectedItems.filter((id) => id !== itemId));
    showSuccessToast("Eliminado de favoritos");
  };

  const addToCart = (card: any) => {
    showSuccessToast(`${card.name} agregado al carrito!`);
  };

  const addAllToCart = () => {
    const itemsToAdd =
      selectedItems.length > 0
        ? wishlistItems.filter((item) => selectedItems.includes(item.id))
        : wishlistItems;

    showSuccessToast(`${itemsToAdd.length} productos agregados al carrito!`);
  };

  const removeSelectedItems = () => {
    setWishlistItems(
      wishlistItems.filter((item) => !selectedItems.includes(item.id))
    );
    setSelectedItems([]);
    showSuccessToast("Productos eliminados de favoritos");
  };

  const toggleItemSelection = (itemId: number) => {
    setSelectedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const selectAllItems = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map((item) => item.id));
    }
  };

  const getPriceChange = (item: any) => {
    const currentPrice = item.card.price;
    const originalPrice = item.priceWhenAdded;
    const change = currentPrice - originalPrice;
    return {
      amount: Math.abs(change),
      type: change > 0 ? "increase" : change < 0 ? "decrease" : "same",
      percentage:
        originalPrice > 0 ? Math.abs((change / originalPrice) * 100) : 0,
    };
  };

  // Filtrado y ordenamiento
  const filteredItems = wishlistItems.filter(
    (item) =>
      item.card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.card.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.card.name.localeCompare(b.card.name);
      case "price-low":
        return a.card.price - b.card.price;
      case "price-high":
        return b.card.price - a.card.price;
      case "dateAdded":
        return (
          new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
        );
      case "rarity":
        return a.card.rarity.localeCompare(b.card.rarity);
      default:
        return 0;
    }
  });

  const getTotalValue = () => {
    const items =
      selectedItems.length > 0
        ? wishlistItems.filter((item) => selectedItems.includes(item.id))
        : wishlistItems;
    return items.reduce((total, item) => total + item.card.price, 0);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mis Favoritos</h1>
            <p className="text-gray-600">
              {wishlistItems.length}{" "}
              {wishlistItems.length === 1 ? "producto" : "productos"} en tu
              lista de deseos
            </p>
          </div>
          <Link href="/user-store/products">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Seguir Explorando
            </Button>
          </Link>
        </div>

        {wishlistItems.length > 0 ? (
          <>
            {/* Barra de herramientas */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Búsqueda */}
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Buscar en favoritos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Controles */}
                  <div className="flex items-center gap-3">
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dateAdded">
                          Agregado Recientemente
                        </SelectItem>
                        <SelectItem value="name">Nombre</SelectItem>
                        <SelectItem value="price-low">
                          Precio: Menor a Mayor
                        </SelectItem>
                        <SelectItem value="price-high">
                          Precio: Mayor a Menor
                        </SelectItem>
                        <SelectItem value="rarity">Rareza</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex items-center border rounded-lg">
                      <Button
                        variant={viewMode === "grid" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("grid")}
                        className="rounded-r-none"
                      >
                        <Grid3X3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={viewMode === "list" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("list")}
                        className="rounded-l-none"
                      >
                        <List className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Selección múltiple */}
                {sortedItems.length > 0 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedItems.length === sortedItems.length}
                          onCheckedChange={selectAllItems}
                        />
                        <span className="text-sm text-gray-600">
                          {selectedItems.length > 0
                            ? `${selectedItems.length} seleccionados`
                            : "Seleccionar todo"}
                        </span>
                      </div>
                      {selectedItems.length > 0 && (
                        <div className="text-sm text-gray-600">
                          Valor total:{" "}
                          <span className="font-semibold">
                            ${getTotalValue().toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    {selectedItems.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addAllToCart}
                          className="text-green-600 hover:text-green-700"
                        >
                          <ShoppingCart className="w-4 h-4 mr-1" />
                          Agregar al Carrito
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={removeSelectedItems}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Grid/Lista de favoritos */}
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {sortedItems.map((item) => {
                  const priceChange = getPriceChange(item);
                  return (
                    <Card
                      key={item.id}
                      className="group hover:shadow-lg transition-shadow"
                    >
                      <CardContent className="p-4">
                        {/* Checkbox de selección */}
                        <div className="flex items-center justify-between mb-3">
                          <Checkbox
                            checked={selectedItems.includes(item.id)}
                            onCheckedChange={() => toggleItemSelection(item.id)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromWishlist(item.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {/* Imagen de la carta */}
                          <div className="aspect-[2.5/3.5] bg-gray-100 rounded-lg overflow-hidden cursor-pointer">
                            <img
                              src={
                                item.card.image ||
                                "/assets/images/backcard.webp"
                              }
                              alt={item.card.name}
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
                              {item.card.name}
                            </h3>
                            <p className="text-xs text-gray-600">
                              {item.card.code}
                            </p>

                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-xs">
                                {item.card.rarity}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {item.card.condition}
                              </Badge>
                            </div>

                            {/* Precio y cambio */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-lg text-blue-600">
                                  ${item.card.price.toFixed(2)}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {item.card.stock} disponibles
                                </span>
                              </div>

                              {priceChange.type !== "same" && (
                                <div
                                  className={`text-xs ${
                                    priceChange.type === "decrease"
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {priceChange.type === "decrease" ? "↓" : "↑"}$
                                  {priceChange.amount.toFixed(2)} (
                                  {priceChange.percentage.toFixed(1)}%)
                                </div>
                              )}
                            </div>

                            <div className="text-xs text-gray-600">
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                <span>{item.card.sellerRating}</span>
                                <span>• {item.card.seller}</span>
                              </div>
                            </div>

                            <div className="text-xs text-gray-500">
                              Agregado el{" "}
                              {new Date(item.dateAdded).toLocaleDateString(
                                "es-ES"
                              )}
                            </div>
                          </div>

                          {/* Botón de agregar al carrito */}
                          <Button
                            onClick={() => addToCart(item.card)}
                            className="w-full bg-green-500 hover:bg-green-600"
                            size="sm"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Agregar al Carrito
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              /* Vista de lista */
              <div className="space-y-3">
                {sortedItems.map((item) => {
                  const priceChange = getPriceChange(item);
                  return (
                    <Card
                      key={item.id}
                      className="hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Checkbox */}
                          <Checkbox
                            checked={selectedItems.includes(item.id)}
                            onCheckedChange={() => toggleItemSelection(item.id)}
                          />

                          {/* Imagen pequeña */}
                          <div className="w-16 h-22 bg-gray-100 rounded overflow-hidden flex-shrink-0">
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

                          {/* Info de la carta */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <h3 className="font-semibold text-lg">
                                  {item.card.name}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  {item.card.code} • {item.card.set}
                                </p>

                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {item.card.rarity}
                                  </Badge>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {item.card.condition}
                                  </Badge>
                                </div>

                                <div className="flex items-center gap-1 text-sm text-gray-600">
                                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                  <span>{item.card.sellerRating}</span>
                                  <span>• {item.card.seller}</span>
                                  <span>• {item.card.stock} disponibles</span>
                                </div>

                                <div className="text-xs text-gray-500">
                                  Agregado el{" "}
                                  {new Date(item.dateAdded).toLocaleDateString(
                                    "es-ES"
                                  )}
                                </div>
                              </div>

                              <div className="text-right space-y-2">
                                <div className="space-y-1">
                                  <div className="font-bold text-xl text-blue-600">
                                    ${item.card.price.toFixed(2)}
                                  </div>
                                  {priceChange.type !== "same" && (
                                    <div
                                      className={`text-xs ${
                                        priceChange.type === "decrease"
                                          ? "text-green-600"
                                          : "text-red-600"
                                      }`}
                                    >
                                      {priceChange.type === "decrease"
                                        ? "↓"
                                        : "↑"}
                                      ${priceChange.amount.toFixed(2)} (
                                      {priceChange.percentage.toFixed(1)}%)
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => addToCart(item.card)}
                                    className="bg-green-500 hover:bg-green-600"
                                    size="sm"
                                  >
                                    <Plus className="w-4 h-4 mr-1" />
                                    Agregar
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeFromWishlist(item.id)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Empty state para búsqueda */}
            {sortedItems.length === 0 && searchTerm && (
              <div className="text-center py-12">
                <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No se encontraron resultados
                </h3>
                <p className="text-gray-600">
                  Intenta con otros términos de búsqueda
                </p>
              </div>
            )}
          </>
        ) : (
          /* Wishlist vacía */
          <div className="text-center py-12">
            <Heart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Tu lista de favoritos está vacía
            </h3>
            <p className="text-gray-600 mb-4">
              Guarda productos que te interesen para encontrarlos fácilmente más
              tarde
            </p>
            <Link href="/user-store/products">
              <Button className="bg-blue-500 hover:bg-blue-600">
                <Package className="w-4 h-4 mr-2" />
                Explorar Productos
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
