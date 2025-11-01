// Componente para mostrar grid de cartas para seleccionar - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Package, Filter, Grid, List } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface CardGridProps {
  onCardSelect: (card: CardData) => void;
  selectedCards?: number[];
}

export default function CardGrid({
  onCardSelect,
  selectedCards = [],
}: CardGridProps) {
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Filtros
  const [setFilter, setSetFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const fetchCards = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
      });

      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }

      if (setFilter !== "all") {
        params.set("setCode", setFilter);
      }

      if (categoryFilter !== "all") {
        params.set("category", categoryFilter);
      }

      const response = await fetch(`/api/cards/search?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Error cargando cartas");
      }

      const data = await response.json();

      if (data.success) {
        setCards(data.data.cards);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Error fetching cards:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, [currentPage, searchQuery, setFilter, categoryFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchCards();
  };

  const isCardSelected = (cardId: number) => {
    return selectedCards.includes(cardId);
  };

  const getCardImage = (card: CardData) => {
    return card.src || "/assets/images/backcard.webp";
  };

  if (loading && cards.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando cartas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda y filtros */}
      <Card className="!h-max border-0 shadow-md">
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Búsqueda */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar cartas por nombre o código..."
                  className="pl-10"
                />
              </div>
              <Button type="submit" disabled={loading}>
                <Search className="w-4 h-4" />
              </Button>
            </form>

            {/* Filtros y vista */}
            <div className="flex items-center gap-4">
              <Select value={setFilter} onValueChange={setSetFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los sets</SelectItem>
                  <SelectItem value="OP01">OP01 - Romance Dawn</SelectItem>
                  <SelectItem value="OP02">OP02 - Paramount War</SelectItem>
                  <SelectItem value="OP03">
                    OP03 - Pillars of Strength
                  </SelectItem>
                  <SelectItem value="OP04">
                    OP04 - Kingdoms of Intrigue
                  </SelectItem>
                  <SelectItem value="OP05">
                    OP05 - Awakening of the New Era
                  </SelectItem>
                  <SelectItem value="OP06">
                    OP06 - Wings of the Captain
                  </SelectItem>
                  <SelectItem value="OP07">
                    OP07 - 500 Years in the Future
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="Leader">Leader</SelectItem>
                  <SelectItem value="Character">Character</SelectItem>
                  <SelectItem value="Event">Event</SelectItem>
                  <SelectItem value="Stage">Stage</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1 ml-auto">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid/Lista de cartas */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {cards.map((card) => {
            const selected = isCardSelected(card.id);
            return (
              <Card
                key={card.id}
                className={`cursor-pointer hover:shadow-lg transition-all ${
                  selected ? "ring-2 ring-blue-500 shadow-lg" : ""
                }`}
                onClick={() => onCardSelect(card)}
              >
                <CardContent className="p-2">
                  <div className="relative">
                    <img
                      src={getCardImage(card)}
                      alt={card.name}
                      className="w-full aspect-[2.5/3.5] object-cover rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/assets/images/backcard.webp";
                      }}
                    />
                    {selected && (
                      <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full p-1">
                        <Package className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium truncate">{card.name}</p>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {card.code}
                      </Badge>
                      {card.rarity && (
                        <Badge variant="secondary" className="text-xs">
                          {card.rarity}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="!h-max border-0 shadow-md">
          <CardContent className="p-0">
            <div className="space-y-0">
              {cards.map((card) => {
                const selected = isCardSelected(card.id);
                return (
                  <div
                    key={card.id}
                    className={`flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                      selected ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                    }`}
                    onClick={() => onCardSelect(card)}
                  >
                    <div className="w-16 h-20 flex-shrink-0">
                      <img
                        src={getCardImage(card)}
                        alt={card.name}
                        className="w-full h-full object-cover rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "/assets/images/backcard.webp";
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{card.name}</h3>
                      <p className="text-sm text-gray-600">
                        {card.code} • {card.setCode}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {card.category}
                        </Badge>
                        {card.rarity && (
                          <Badge variant="secondary" className="text-xs">
                            {card.rarity}
                          </Badge>
                        )}
                        {card.cost && (
                          <Badge variant="secondary" className="text-xs">
                            Costo: {card.cost}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {selected ? (
                        <div className="flex items-center gap-2 text-blue-600">
                          <Package className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            En Inventario
                          </span>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline">
                          <Plus className="w-4 h-4 mr-1" />
                          Agregar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Anterior
          </Button>

          <span className="text-sm text-gray-600">
            Página {currentPage} de {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {loading && cards.length > 0 && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mx-auto"></div>
        </div>
      )}
    </div>
  );
}
