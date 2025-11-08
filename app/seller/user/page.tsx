// Página principal de la tienda para clientes - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  ShoppingCart,
  Package,
  User,
  Star,
  Plus,
  Minus,
  X,
  ChevronDown,
  ChevronRight,
  Heart,
  Eye,
  CreditCard,
  Truck,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowLeft,
  Grid3X3,
  List,
  SortAsc,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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

const mockCartItems = [
  {
    id: 1,
    cardId: 1,
    card: mockCards[0],
    quantity: 2,
    price: 15.99,
  },
  {
    id: 2,
    cardId: 2,
    card: mockCards[1],
    quantity: 1,
    price: 8.5,
  },
];

const mockOrders = [
  {
    id: "ORD-2025-001",
    date: "2025-01-15",
    status: "delivered",
    total: 45.48,
    items: [
      { card: mockCards[0], quantity: 2, price: 15.99 },
      { card: mockCards[1], quantity: 1, price: 8.5 },
    ],
    shipping: {
      method: "Standard Shipping",
      cost: 4.99,
      trackingNumber: "1Z999AA1234567890",
    },
  },
  {
    id: "ORD-2025-002",
    date: "2025-01-18",
    status: "processing",
    total: 28.74,
    items: [{ card: mockCards[2], quantity: 4, price: 3.25 }],
    shipping: {
      method: "Express Shipping",
      cost: 9.99,
      trackingNumber: null,
    },
  },
];

interface CartItem {
  id: number;
  cardId: number;
  card: any;
  quantity: number;
  price: number;
}

export default function ShopPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // Estados principales
  const [activeView, setActiveView] = useState<"catalog" | "cart" | "orders">(
    "catalog"
  );
  const [cartItems, setCartItems] = useState<CartItem[]>(mockCartItems);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);

  // Estados para catálogo
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSet, setSelectedSet] = useState("all");
  const [selectedRarity, setSelectedRarity] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);

  // Estados para checkout
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [shippingInfo, setShippingInfo] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "US",
  });
  const [paymentInfo, setPaymentInfo] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    nameOnCard: "",
  });

  // Funciones del carrito
  const addToCart = (card: any, quantity: number = 1) => {
    const existingItem = cartItems.find((item) => item.cardId === card.id);

    if (existingItem) {
      setCartItems(
        cartItems.map((item) =>
          item.cardId === card.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      );
    } else {
      const newItem: CartItem = {
        id: Date.now(),
        cardId: card.id,
        card: card,
        quantity: quantity,
        price: card.price,
      };
      setCartItems([...cartItems, newItem]);
    }

    showSuccessToast(`Added ${card.name} to cart!`);
  };

  const updateCartQuantity = (itemId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCartItems(
      cartItems.map((item) =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const removeFromCart = (itemId: number) => {
    setCartItems(cartItems.filter((item) => item.id !== itemId));
    showSuccessToast("Item removed from cart");
  };

  const getCartTotal = () => {
    return cartItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
  };

  const getCartItemsCount = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "text-green-600 bg-green-50";
      case "shipped":
        return "text-blue-600 bg-blue-50";
      case "processing":
        return "text-yellow-600 bg-yellow-50";
      case "cancelled":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
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
      case "cancelled":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo y navegación */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Package className="w-8 h-8 text-blue-500" />
                <h1 className="text-xl font-bold text-gray-900">
                  Ohara TCG Shop
                </h1>
              </div>

              <nav className="hidden md:flex items-center gap-4">
                <Button
                  variant={activeView === "catalog" ? "default" : "ghost"}
                  onClick={() => setActiveView("catalog")}
                  className="flex items-center gap-2"
                >
                  <Grid3X3 className="w-4 h-4" />
                  Cards
                </Button>
                <Button
                  variant={activeView === "orders" ? "default" : "ghost"}
                  onClick={() => setActiveView("orders")}
                  className="flex items-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  My Orders
                </Button>
              </nav>
            </div>

            {/* Carrito y usuario */}
            <div className="flex items-center gap-3">
              <Button
                variant={activeView === "cart" ? "default" : "outline"}
                onClick={() => setActiveView("cart")}
                className="relative"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Cart
                {getCartItemsCount() > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-red-500 text-white text-xs min-w-[20px] h-5 flex items-center justify-center rounded-full">
                    {getCartItemsCount()}
                  </Badge>
                )}
              </Button>

              {session ? (
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={session.user?.image || ""} />
                    <AvatarFallback>
                      {session.user?.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline text-sm font-medium">
                    {session.user?.name}
                  </span>
                </div>
              ) : (
                <Button onClick={() => router.push("/login")}>
                  <User className="w-4 h-4 mr-2" />
                  Login
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="container mx-auto px-4 py-6">
        {/* Vista de Catálogo */}
        {activeView === "catalog" && (
          <div className="space-y-6">
            {/* Barra de búsqueda y filtros */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Búsqueda */}
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search cards by name or code..."
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
                        <SelectValue placeholder="All Sets" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sets</SelectItem>
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
                        <SelectValue placeholder="Rarity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="Leader">Leader</SelectItem>
                        <SelectItem value="Super Rare">Super Rare</SelectItem>
                        <SelectItem value="Rare">Rare</SelectItem>
                        <SelectItem value="Common">Common</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="price-low">
                          Price: Low to High
                        </SelectItem>
                        <SelectItem value="price-high">
                          Price: High to Low
                        </SelectItem>
                        <SelectItem value="rarity">Rarity</SelectItem>
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
              <p className="text-gray-600">
                Showing {sortedCards.length} cards
              </p>
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
                              {card.stock} available
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

                      {/* Botón de agregar al carrito */}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(card);
                        }}
                        className="w-full mt-3 bg-green-500 hover:bg-green-600"
                        size="sm"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add to Cart
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              /* Vista de lista */
              <div className="space-y-3">
                {sortedCards.map((card) => (
                  <Card
                    key={card.id}
                    className="hover:shadow-md transition-shadow"
                  >
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
                              <h3 className="font-semibold text-lg">
                                {card.name}
                              </h3>
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
                                <span>• {card.stock} available</span>
                              </div>
                            </div>

                            <div className="text-right space-y-2">
                              <div className="font-bold text-xl text-blue-600">
                                ${card.price.toFixed(2)}
                              </div>
                              <Button
                                onClick={() => addToCart(card)}
                                className="bg-green-500 hover:bg-green-600"
                                size="sm"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Add to Cart
                              </Button>
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
                  No cards found
                </h3>
                <p className="text-gray-600">
                  Try adjusting your search or filters
                </p>
              </div>
            )}
          </div>
        )}

        {/* Vista del Carrito */}
        {activeView === "cart" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Shopping Cart
              </h2>
              <Button
                variant="outline"
                onClick={() => setActiveView("catalog")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Continue Shopping
              </Button>
            </div>

            {cartItems.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Items del carrito */}
                <div className="lg:col-span-2 space-y-4">
                  {cartItems.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Imagen */}
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

                          {/* Info del item */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold">{item.card.name}</h3>
                            <p className="text-sm text-gray-600">
                              {item.card.code} • {item.card.condition}
                            </p>
                            <p className="text-sm text-gray-600">
                              Sold by {item.card.seller}
                            </p>
                            <p className="font-semibold text-blue-600">
                              ${item.price.toFixed(2)} each
                            </p>
                          </div>

                          {/* Controles de cantidad */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateCartQuantity(item.id, item.quantity - 1)
                              }
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="w-8 text-center">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateCartQuantity(item.id, item.quantity + 1)
                              }
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>

                          {/* Precio total y eliminar */}
                          <div className="text-right">
                            <p className="font-bold">
                              ${(item.price * item.quantity).toFixed(2)}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromCart(item.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Resumen del pedido */}
                <div className="space-y-4">
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <h3 className="font-semibold text-lg">Order Summary</h3>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Subtotal ({getCartItemsCount()} items)</span>
                          <span>${getCartTotal().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Shipping</span>
                          <span>$4.99</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tax</span>
                          <span>${(getCartTotal() * 0.08).toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total</span>
                          <span>
                            $
                            {(
                              getCartTotal() +
                              4.99 +
                              getCartTotal() * 0.08
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <Button
                        className="w-full bg-green-500 hover:bg-green-600"
                        onClick={() => setIsCheckoutModalOpen(true)}
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Proceed to Checkout
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Información de envío */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className="w-4 h-4 text-blue-500" />
                        <span className="font-medium">
                          Shipping Information
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Standard shipping (5-7 business days): $4.99
                      </p>
                      <p className="text-sm text-gray-600">
                        Express shipping (2-3 business days): $9.99
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              /* Carrito vacío */
              <div className="text-center py-12">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Your cart is empty
                </h3>
                <p className="text-gray-600 mb-4">
                  Add some cards to get started!
                </p>
                <Button
                  onClick={() => setActiveView("catalog")}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  Browse Cards
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Vista de Pedidos */}
        {activeView === "orders" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">My Orders</h2>

            {mockOrders.length > 0 ? (
              <div className="space-y-4">
                {mockOrders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">
                            Order {order.id}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Placed on{" "}
                            {new Date(order.date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              order.status
                            )}`}
                          >
                            {getStatusIcon(order.status)}
                            {order.status.charAt(0).toUpperCase() +
                              order.status.slice(1)}
                          </div>
                          <p className="font-bold text-lg mt-1">
                            ${order.total.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Items del pedido */}
                      <div className="space-y-3 mb-4">
                        {order.items.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="w-12 h-16 bg-white rounded overflow-hidden flex-shrink-0">
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
                            <div className="flex-1">
                              <h4 className="font-medium">{item.card.name}</h4>
                              <p className="text-sm text-gray-600">
                                {item.card.code}
                              </p>
                              <p className="text-sm text-gray-600">
                                Qty: {item.quantity} × ${item.price.toFixed(2)}
                              </p>
                            </div>
                            <div className="font-semibold">
                              ${(item.quantity * item.price).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Información de envío */}
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Shipping</p>
                            <p className="text-sm text-gray-600">
                              {order.shipping.method}
                            </p>
                            {order.shipping.trackingNumber && (
                              <p className="text-sm text-blue-600">
                                Tracking: {order.shipping.trackingNumber}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              ${order.shipping.cost.toFixed(2)}
                            </p>
                            {order.status === "shipped" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-1"
                              >
                                <Truck className="w-4 h-4 mr-1" />
                                Track Package
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              /* Sin pedidos */
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No orders yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Your order history will appear here
                </p>
                <Button
                  onClick={() => setActiveView("catalog")}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  Start Shopping
                </Button>
              </div>
            )}
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
                  <h3 className="font-semibold mb-2">Seller Information</h3>
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
                    {selectedCard.stock} available
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
                      Add to Cart
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        addToCart(selectedCard);
                        setIsCardModalOpen(false);
                        setActiveView("cart");
                        setTimeout(() => setIsCheckoutModalOpen(true), 500);
                      }}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Buy Now
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Checkout */}
      <Dialog open={isCheckoutModalOpen} onOpenChange={setIsCheckoutModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Checkout</DialogTitle>
            <DialogDescription>
              Complete your purchase securely
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulario de checkout */}
            <div className="space-y-6">
              {/* Pasos del checkout */}
              <div className="flex items-center gap-2 mb-6">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        step <= checkoutStep
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {step}
                    </div>
                    {step < 3 && (
                      <div
                        className={`w-8 h-0.5 ${
                          step < checkoutStep ? "bg-blue-500" : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Paso 1: Información de envío */}
              {checkoutStep === 1 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">
                    Shipping Information
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={shippingInfo.firstName}
                        onChange={(e) =>
                          setShippingInfo({
                            ...shippingInfo,
                            firstName: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={shippingInfo.lastName}
                        onChange={(e) =>
                          setShippingInfo({
                            ...shippingInfo,
                            lastName: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={shippingInfo.email}
                      onChange={(e) =>
                        setShippingInfo({
                          ...shippingInfo,
                          email: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={shippingInfo.phone}
                      onChange={(e) =>
                        setShippingInfo({
                          ...shippingInfo,
                          phone: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={shippingInfo.address}
                      onChange={(e) =>
                        setShippingInfo({
                          ...shippingInfo,
                          address: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={shippingInfo.city}
                        onChange={(e) =>
                          setShippingInfo({
                            ...shippingInfo,
                            city: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={shippingInfo.state}
                        onChange={(e) =>
                          setShippingInfo({
                            ...shippingInfo,
                            state: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="zipCode">ZIP Code</Label>
                      <Input
                        id="zipCode"
                        value={shippingInfo.zipCode}
                        onChange={(e) =>
                          setShippingInfo({
                            ...shippingInfo,
                            zipCode: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <Button
                    onClick={() => setCheckoutStep(2)}
                    className="w-full"
                    disabled={
                      !shippingInfo.firstName ||
                      !shippingInfo.lastName ||
                      !shippingInfo.email ||
                      !shippingInfo.address
                    }
                  >
                    Continue to Shipping Method
                  </Button>
                </div>
              )}

              {/* Paso 2: Método de envío */}
              {checkoutStep === 2 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Shipping Method</h3>

                  <RadioGroup defaultValue="standard">
                    <div className="flex items-center space-x-2 p-3 border rounded-lg">
                      <RadioGroupItem value="standard" id="standard" />
                      <Label
                        htmlFor="standard"
                        className="flex-1 cursor-pointer"
                      >
                        <div className="flex justify-between">
                          <div>
                            <p className="font-medium">Standard Shipping</p>
                            <p className="text-sm text-gray-600">
                              5-7 business days
                            </p>
                          </div>
                          <span className="font-semibold">$4.99</span>
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2 p-3 border rounded-lg">
                      <RadioGroupItem value="express" id="express" />
                      <Label
                        htmlFor="express"
                        className="flex-1 cursor-pointer"
                      >
                        <div className="flex justify-between">
                          <div>
                            <p className="font-medium">Express Shipping</p>
                            <p className="text-sm text-gray-600">
                              2-3 business days
                            </p>
                          </div>
                          <span className="font-semibold">$9.99</span>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setCheckoutStep(1)}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={() => setCheckoutStep(3)}
                      className="flex-1"
                    >
                      Continue to Payment
                    </Button>
                  </div>
                </div>
              )}

              {/* Paso 3: Información de pago */}
              {checkoutStep === 3 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Payment Information</h3>

                  <div>
                    <Label htmlFor="cardNumber">Card Number</Label>
                    <Input
                      id="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      value={paymentInfo.cardNumber}
                      onChange={(e) =>
                        setPaymentInfo({
                          ...paymentInfo,
                          cardNumber: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="nameOnCard">Name on Card</Label>
                    <Input
                      id="nameOnCard"
                      value={paymentInfo.nameOnCard}
                      onChange={(e) =>
                        setPaymentInfo({
                          ...paymentInfo,
                          nameOnCard: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="expiryDate">Expiry Date</Label>
                      <Input
                        id="expiryDate"
                        placeholder="MM/YY"
                        value={paymentInfo.expiryDate}
                        onChange={(e) =>
                          setPaymentInfo({
                            ...paymentInfo,
                            expiryDate: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="cvv">CVV</Label>
                      <Input
                        id="cvv"
                        placeholder="123"
                        value={paymentInfo.cvv}
                        onChange={(e) =>
                          setPaymentInfo({
                            ...paymentInfo,
                            cvv: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="terms" />
                    <Label htmlFor="terms" className="text-sm">
                      I agree to the Terms of Service and Privacy Policy
                    </Label>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setCheckoutStep(2)}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={() => {
                        showSuccessToast("Order placed successfully!");
                        setIsCheckoutModalOpen(false);
                        setCartItems([]);
                        setActiveView("orders");
                      }}
                      className="flex-1 bg-green-500 hover:bg-green-600"
                      disabled={
                        !paymentInfo.cardNumber ||
                        !paymentInfo.nameOnCard ||
                        !paymentInfo.expiryDate ||
                        !paymentInfo.cvv
                      }
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Place Order
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Resumen del pedido */}
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-4">Order Summary</h3>

                  <div className="space-y-3 mb-4">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        <div className="w-12 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                          <img
                            src={
                              item.card.image || "/assets/images/backcard.webp"
                            }
                            alt={item.card.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "/assets/images/backcard.webp";
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            {item.card.name}
                          </p>
                          <p className="text-xs text-gray-600">
                            {item.card.code}
                          </p>
                          <p className="text-xs text-gray-600">
                            Qty: {item.quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">
                            ${(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>${getCartTotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Shipping</span>
                      <span>$4.99</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tax</span>
                      <span>${(getCartTotal() * 0.08).toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold">
                      <span>Total</span>
                      <span>
                        $
                        {(
                          getCartTotal() +
                          4.99 +
                          getCartTotal() * 0.08
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Información de seguridad */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-sm">Secure Checkout</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Your payment information is encrypted and secure. We never
                    store your card details.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
