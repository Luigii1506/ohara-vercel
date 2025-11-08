// Página de productos/catálogo - Ohara TCG Shop
// Fecha de modificación: 2025-01-02

"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  ShoppingCart,
  Package,
  Star,
  Plus,
  Grid3X3,
  List,
  Eye,
  Heart,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { showSuccessToast } from "@/lib/toastify";

// Mock data - será reemplazado por API calls
const mockCards = [
  {
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
  {
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
  {
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
];

export default function ProductsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // Estados para catálogo
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSet, setSelectedSet] = useState("all");
  const [selectedRarity, setSelectedRarity] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);

  // Función para agregar al carrito (temporal)
  const addToCart = (card: any, quantity: number = 1) => {
    showSuccessToast(`Added ${card.name} to cart!`);
  };

  // Filtrado de cartas
  const filteredCards = mockCards.filter((card) => {
    const matchesSearch =
      card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSet = selectedSet === "all" || card.set === selectedSet;
    const matchesRarity =
      selectedRarity === "all" || card.rarity === selectedRarity;

    return matchesSearch && matchesSet && matchesRarity;
  });

  const sortedCards = [...filteredCards].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "price-low":
        return a.price - b.price;
      case "price-high":
        return b.price - a.price;
      case "rarity":
        return a.rarity.localeCompare(b.rarity);
      default:
        return 0;
    }
  });

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Productos</h1>
            <p className="text-gray-600">
              Descubre nuestra colección de cartas de One Piece TCG
            </p>
          </div>
        </div>

        {/* Barra de búsqueda y filtros */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Búsqueda */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar cartas por nombre o código..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Filtros */}
              <div className="flex items-center gap-3">
                <Select value={selectedSet} onValueChange={setSelectedSet}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Todos los Sets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Sets</SelectItem>
                    <SelectItem value="Starter Deck: Straw Hat Crew">
                      Starter Deck: Straw Hat Crew
                    </SelectItem>
                    <SelectItem value="Booster Pack: Romance Dawn">
                      Booster Pack: Romance Dawn
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={selectedRarity}
                  onValueChange={setSelectedRarity}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Rareza" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="Leader">Leader</SelectItem>
                    <SelectItem value="Super Rare">Super Rare</SelectItem>
                    <SelectItem value="Rare">Rare</SelectItem>
                    <SelectItem value="Common">Common</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
          </CardContent>
        </Card>

        {/* Resultados */}
        <div className="flex items-center justify-between">
          <p className="text-gray-600">Mostrando {sortedCards.length} cartas</p>
        </div>

        {/* Grid de cartas */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {sortedCards.map((card) => (
              <Card
                key={card.id}
                className="group hover:shadow-lg transition-shadow cursor-pointer"
              >
                <CardContent className="p-4">
                  <div
                    className="space-y-3"
                    onClick={() => {
                      setSelectedCard(card);
                      setIsCardModalOpen(true);
                    }}
                  >
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
                        <Badge variant="secondary" className="text-xs">
                          {card.condition}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="font-bold text-lg text-blue-600">
                          ${card.price.toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {card.stock} disponibles
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
                  </div>

                  {/* Botones de acción */}
                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(card);
                      }}
                      className="flex-1 bg-green-500 hover:bg-green-600"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        showSuccessToast("Agregado a favoritos!");
                      }}
                    >
                      <Heart className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Vista de lista */
          <div className="space-y-3">
            {sortedCards.map((card) => (
              <Card key={card.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Imagen pequeña */}
                    <div
                      className="w-16 h-22 bg-gray-100 rounded overflow-hidden flex-shrink-0 cursor-pointer"
                      onClick={() => {
                        setSelectedCard(card);
                        setIsCardModalOpen(true);
                      }}
                    >
                      <img
                        src={card.image || "/assets/images/backcard.webp"}
                        alt={card.name}
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
                          <h3 className="font-semibold text-lg">{card.name}</h3>
                          <p className="text-sm text-gray-600">
                            {card.code} • {card.set}
                          </p>

                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {card.rarity}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {card.condition}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span>{card.sellerRating}</span>
                            <span>• {card.seller}</span>
                            <span>• {card.stock} disponibles</span>
                          </div>
                        </div>

                        <div className="text-right space-y-2">
                          <div className="font-bold text-xl text-blue-600">
                            ${card.price.toFixed(2)}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => addToCart(card)}
                              className="bg-green-500 hover:bg-green-600"
                              size="sm"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Agregar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                showSuccessToast("Agregado a favoritos!")
                              }
                            >
                              <Heart className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {sortedCards.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No se encontraron cartas
            </h3>
            <p className="text-gray-600">
              Intenta ajustar tu búsqueda o filtros
            </p>
          </div>
        )}
      </div>

      {/* Modal de detalles de carta */}
      <Dialog open={isCardModalOpen} onOpenChange={setIsCardModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedCard && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Imagen de la carta */}
              <div className="space-y-4">
                <div className="aspect-[2.5/3.5] bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={selectedCard.image || "/assets/images/backcard.webp"}
                    alt={selectedCard.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "/assets/images/backcard.webp";
                    }}
                  />
                </div>
              </div>

              {/* Información de la carta */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    {selectedCard.name}
                  </h2>
                  <p className="text-gray-600 mb-4">
                    {selectedCard.code} • {selectedCard.set}
                  </p>

                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="outline">{selectedCard.rarity}</Badge>
                    <Badge variant="secondary">{selectedCard.condition}</Badge>
                    <Badge variant="outline">{selectedCard.type}</Badge>
                  </div>

                  <p className="text-gray-700 mb-4">
                    {selectedCard.description}
                  </p>
                </div>

                {/* Stats de la carta */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Power:</span>
                      <span className="font-semibold">
                        {selectedCard.power}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cost:</span>
                      <span className="font-semibold">{selectedCard.cost}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Attribute:</span>
                      <span className="font-semibold">
                        {selectedCard.attribute}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Counter:</span>
                      <span className="font-semibold">
                        {selectedCard.counter}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Información del vendedor */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">
                    Información del Vendedor
                  </h3>
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">
                      {selectedCard.sellerRating}
                    </span>
                    <span className="text-gray-600">
                      • {selectedCard.seller}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {selectedCard.stock} disponibles
                  </p>
                </div>

                {/* Precio y acciones */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-bold text-blue-600">
                      ${selectedCard.price.toFixed(2)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Heart className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button
                      onClick={() => {
                        addToCart(selectedCard);
                        setIsCardModalOpen(false);
                      }}
                      className="w-full bg-green-500 hover:bg-green-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar al Carrito
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        addToCart(selectedCard);
                        setIsCardModalOpen(false);
                        router.push("/user-store/cart");
                      }}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Comprar Ahora
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
