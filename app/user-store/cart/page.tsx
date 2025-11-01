// Página del carrito de compras - Ohara TCG Shop
// Fecha de modificación: 2025-01-02

"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShoppingCart,
  Plus,
  Minus,
  X,
  CreditCard,
  Truck,
  CheckCircle,
  ArrowLeft,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "react-hot-toast";

// Mock data del carrito
const mockCartItems = [
  {
    id: 1,
    cardId: 1,
    card: {
      id: 1,
      name: "Monkey D. Luffy",
      code: "ST01-001",
      set: "Starter Deck: Straw Hat Crew",
      rarity: "Leader",
      condition: "Near Mint",
      seller: "CardMaster Pro",
      sellerRating: 4.9,
      image: "/assets/images/cards/ST01-001.jpg",
      stock: 5,
    },
    quantity: 2,
    price: 15.99,
  },
  {
    id: 2,
    cardId: 2,
    card: {
      id: 2,
      name: "Roronoa Zoro",
      code: "ST01-013",
      set: "Starter Deck: Straw Hat Crew",
      rarity: "Super Rare",
      condition: "Near Mint",
      seller: "TCG Vault",
      sellerRating: 4.8,
      image: "/assets/images/cards/ST01-013.jpg",
      stock: 12,
    },
    quantity: 1,
    price: 8.5,
  },
];

interface CartItem {
  id: number;
  cardId: number;
  card: any;
  quantity: number;
  price: number;
}

export default function CartPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [cartItems, setCartItems] = useState<CartItem[]>(mockCartItems);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
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
    toast.success("Producto eliminado del carrito");
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

  const getTotalWithTaxAndShipping = () => {
    const subtotal = getCartTotal();
    const shipping = 4.99;
    const tax = subtotal * 0.08;
    return subtotal + shipping + tax;
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mi Carrito</h1>
            <p className="text-gray-600">
              {getCartItemsCount()}{" "}
              {getCartItemsCount() === 1 ? "producto" : "productos"} en tu
              carrito
            </p>
          </div>
          <Link href="/user-store/products">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Seguir Comprando
            </Button>
          </Link>
        </div>

        {cartItems.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Items del carrito */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <Card key={item.id} className="border-0 shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Imagen */}
                      <div className="w-16 h-22 bg-gray-100 rounded overflow-hidden flex-shrink-0">
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

                      {/* Info del item */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg">
                          {item.card.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {item.card.code} • {item.card.condition}
                        </p>
                        <p className="text-sm text-gray-600">
                          Vendido por {item.card.seller}
                        </p>
                        <p className="font-semibold text-blue-600 mt-1">
                          ${item.price.toFixed(2)} cada uno
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
                        <span className="w-8 text-center font-medium">
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
                        <p className="font-bold text-lg">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
              <Card className="border-0 shadow-md">
                <CardContent className="p-4 space-y-4">
                  <h3 className="font-semibold text-lg">Resumen del Pedido</h3>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal ({getCartItemsCount()} productos)</span>
                      <span>${getCartTotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Envío</span>
                      <span>$4.99</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Impuestos</span>
                      <span>${(getCartTotal() * 0.08).toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>${getTotalWithTaxAndShipping().toFixed(2)}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full bg-green-500 hover:bg-green-600"
                    onClick={() => setIsCheckoutModalOpen(true)}
                    size="lg"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Proceder al Pago
                  </Button>
                </CardContent>
              </Card>

              {/* Información de envío */}
              <Card className="border-0 shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Truck className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">Información de Envío</span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>
                      <strong>Envío Estándar (5-7 días hábiles):</strong> $4.99
                    </p>
                    <p>
                      <strong>Envío Express (2-3 días hábiles):</strong> $9.99
                    </p>
                    <p className="text-green-600">
                      ✓ Envío gratis en pedidos mayores a $50
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Garantía de seguridad */}
              <Card className="border-0 shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-sm">Compra Segura</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Tu información de pago está encriptada y segura. Nunca
                    almacenamos los detalles de tu tarjeta.
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
              Tu carrito está vacío
            </h3>
            <p className="text-gray-600 mb-4">
              ¡Agrega algunas cartas para comenzar!
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

      {/* Modal de Checkout */}
      <Dialog open={isCheckoutModalOpen} onOpenChange={setIsCheckoutModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Finalizar Compra</DialogTitle>
            <DialogDescription>
              Completa tu compra de forma segura
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
                    Información de Envío
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">Nombre</Label>
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
                      <Label htmlFor="lastName">Apellido</Label>
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
                    <Label htmlFor="phone">Teléfono</Label>
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
                    <Label htmlFor="address">Dirección</Label>
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
                      <Label htmlFor="city">Ciudad</Label>
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
                      <Label htmlFor="state">Estado</Label>
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
                      <Label htmlFor="zipCode">Código Postal</Label>
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
                    Continuar al Método de Envío
                  </Button>
                </div>
              )}

              {/* Paso 2: Método de envío */}
              {checkoutStep === 2 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Método de Envío</h3>

                  <RadioGroup defaultValue="standard">
                    <div className="flex items-center space-x-2 p-3 border rounded-lg">
                      <RadioGroupItem value="standard" id="standard" />
                      <Label
                        htmlFor="standard"
                        className="flex-1 cursor-pointer"
                      >
                        <div className="flex justify-between">
                          <div>
                            <p className="font-medium">Envío Estándar</p>
                            <p className="text-sm text-gray-600">
                              5-7 días hábiles
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
                            <p className="font-medium">Envío Express</p>
                            <p className="text-sm text-gray-600">
                              2-3 días hábiles
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
                      Atrás
                    </Button>
                    <Button
                      onClick={() => setCheckoutStep(3)}
                      className="flex-1"
                    >
                      Continuar al Pago
                    </Button>
                  </div>
                </div>
              )}

              {/* Paso 3: Información de pago */}
              {checkoutStep === 3 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Información de Pago</h3>

                  <div>
                    <Label htmlFor="cardNumber">Número de Tarjeta</Label>
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
                    <Label htmlFor="nameOnCard">Nombre en la Tarjeta</Label>
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
                      <Label htmlFor="expiryDate">Fecha de Vencimiento</Label>
                      <Input
                        id="expiryDate"
                        placeholder="MM/AA"
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
                      Acepto los Términos de Servicio y Política de Privacidad
                    </Label>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setCheckoutStep(2)}
                      className="flex-1"
                    >
                      Atrás
                    </Button>
                    <Button
                      onClick={() => {
                        toast.success("¡Pedido realizado con éxito!");
                        setIsCheckoutModalOpen(false);
                        setCartItems([]);
                        router.push("/user-store/orders");
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
                      Realizar Pedido
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Resumen del pedido */}
            <div className="space-y-4">
              <Card className="border-0 shadow-md">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-4">
                    Resumen del Pedido
                  </h3>

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
                            Cant: {item.quantity}
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
                      <span>Envío</span>
                      <span>$4.99</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Impuestos</span>
                      <span>${(getCartTotal() * 0.08).toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold">
                      <span>Total</span>
                      <span>${getTotalWithTaxAndShipping().toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Información de seguridad */}
              <Card className="border-0 shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-sm">Compra Segura</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Tu información de pago está encriptada y segura. Nunca
                    almacenamos los detalles de tu tarjeta.
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
