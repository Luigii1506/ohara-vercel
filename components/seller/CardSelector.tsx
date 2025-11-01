// Componente para buscar y seleccionar cartas del catálogo - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, ChevronDown, Check } from "lucide-react";

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

interface CardSelectorProps {
  selectedCard: CardData | null;
  onCardSelect: (card: CardData | null) => void;
  placeholder?: string;
  error?: string;
}

export default function CardSelector({
  selectedCard,
  onCardSelect,
  placeholder = "Buscar carta por nombre o código...",
  error,
}: CardSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(
    null
  );

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Buscar cartas con debounce
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (searchQuery.trim().length >= 2) {
      const timeout = setTimeout(() => {
        searchCards(searchQuery.trim());
      }, 300);
      setSearchTimeout(timeout);
    } else {
      setCards([]);
    }

    return () => {
      if (searchTimeout) clearTimeout(searchTimeout);
    };
  }, [searchQuery]);

  const searchCards = async (query: string) => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/cards/search?q=${encodeURIComponent(query)}&limit=10`
      );

      if (!response.ok) {
        throw new Error("Error buscando cartas");
      }

      const data = await response.json();

      if (data.success) {
        setCards(data.data.cards);
      }
    } catch (error) {
      console.error("Error searching cards:", error);
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    if (!isOpen && value.trim()) {
      setIsOpen(true);
    }
  };

  const handleCardSelect = (card: CardData) => {
    onCardSelect(card);
    setSearchQuery("");
    setIsOpen(false);
    setCards([]);
  };

  const clearSelection = () => {
    onCardSelect(null);
    setSearchQuery("");
    setCards([]);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const getCardImage = (card: CardData) => {
    return card.src || "/assets/images/backcard.webp";
  };

  const getCardTypes = (card: CardData) => {
    return card.types.map((t) => t.type).join(", ");
  };

  const getCardColors = (card: CardData) => {
    return card.colors.map((c) => c.color).join(", ");
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Carta seleccionada */}
      {selectedCard ? (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-20 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                <img
                  src={getCardImage(selectedCard)}
                  alt={selectedCard.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "/assets/images/backcard.webp";
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate">
                  {selectedCard.name}
                </h3>
                <p className="text-sm text-gray-600">
                  {selectedCard.code} • {selectedCard.setCode}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {selectedCard.category}
                  </Badge>
                  {selectedCard.rarity && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedCard.rarity}
                    </Badge>
                  )}
                  {selectedCard.cost && (
                    <Badge variant="secondary" className="text-xs">
                      Costo: {selectedCard.cost}
                    </Badge>
                  )}
                </div>
                {getCardTypes(selectedCard) && (
                  <p className="text-xs text-gray-500 mt-1">
                    Tipos: {getCardTypes(selectedCard)}
                  </p>
                )}
                {getCardColors(selectedCard) && (
                  <p className="text-xs text-gray-500">
                    Colores: {getCardColors(selectedCard)}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Campo de búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={placeholder}
              className={`pl-10 pr-8 ${
                error ? "border-red-300 focus:border-red-500" : ""
              }`}
              onFocus={() => {
                if (searchQuery.trim().length >= 2) {
                  setIsOpen(true);
                }
              }}
            />
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          </div>

          {/* Mensaje de error */}
          {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
        </>
      )}

      {/* Dropdown de resultados */}
      {isOpen && !selectedCard && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto border shadow-lg">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">Buscando cartas...</p>
              </div>
            ) : cards.length > 0 ? (
              <div className="max-h-80 overflow-y-auto">
                {cards.map((card) => (
                  <div
                    key={card.id}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => handleCardSelect(card)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                        <img
                          src={getCardImage(card)}
                          alt={card.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "/assets/images/backcard.webp";
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {card.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {card.code} • {card.setCode}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {card.category}
                          </Badge>
                          {card.rarity && (
                            <Badge variant="secondary" className="text-xs">
                              {card.rarity}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery.trim().length >= 2 ? (
              <div className="p-4 text-center text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No se encontraron cartas</p>
                <p className="text-xs text-gray-400">
                  Intenta con otro término de búsqueda
                </p>
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">
                  Escribe al menos 2 caracteres para buscar
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
