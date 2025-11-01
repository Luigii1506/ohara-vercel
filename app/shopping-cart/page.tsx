"use client";

import Image from "next/image";
import Link from "next/link";
import { MinusIcon, PlusIcon, ShoppingCartIcon, TrashIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { useCartStore } from "@/store/cartStore"; // Ajusta la ruta según tu estructura

import ProceedCart from "@/components/shoppingcart/ProceedCart";
import { useState } from "react";

const ShoppingCart = () => {
  // Extraemos del store los items y las acciones para actualizar el carrito
  const { items, removeItem, updateItemQuantity } = useCartStore();

  const [isCheckout, setIsCheckout] = useState(false);

  // Función para actualizar la cantidad de un item
  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    updateItemQuantity(id, newQuantity);
  };

  // Calcular el subtotal
  const subtotal = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  // Calcular el IVA (21%)
  const iva = subtotal * 0.21;

  // Calcular el total
  const total = subtotal + iva;

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="w-screen px-4 py-8  min-h-0 flex flex-1">
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 justify-center items-center min-h-0 flex-col">
          <Card className="flex-1 flex min-h-0">
            <CardContent className="flex-1 flex min-h-0 py-5 max-w-6xl w-full">
              {!isCheckout ? (
                items.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCartIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h2 className="text-xl font-semibold mb-2">
                      Tu carrito está vacío
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      Añade algunas cartas a tu carrito para continuar
                    </p>
                    <Button asChild>
                      <Link href="/tienda">Ir a la Tienda</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 min-h-0">
                    <div className="flex items-center gap-2 mb-6">
                      <ShoppingCartIcon className="h-6 w-6" />
                      <h1 className="text-2xl font-bold">
                        Tu Carrito ({totalQuantity})
                      </h1>
                    </div>
                    <div className="flex-1 flex-col-reverse lg:flex-row min-h-0 flex justify-center items-start gap-5">
                      <div className="min-h-0 flex flex-1 w-full h-full ">
                        <Card className="min-h-0 h-full">
                          <CardContent className="p-6  overflow-scroll min-h-0 h-full">
                            <div className="grid gap-6">
                              {items.map((item) => (
                                <div key={item.id} className="grid gap-4">
                                  <div className="flex items-start gap-4">
                                    <div className="relative h-20 w-16 overflow-hidden rounded-md border">
                                      <Image
                                        src={item.src || "/placeholder.svg"}
                                        alt={item.name}
                                        fill
                                        className="object-cover"
                                      />
                                    </div>
                                    <div className="grid gap-1 flex-1">
                                      <h3 className="font-medium">
                                        {item.name}
                                      </h3>
                                      {item.rarity && (
                                        <p className="text-sm text-muted-foreground">
                                          {item.rarity}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-2 mt-1">
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() =>
                                            updateQuantity(
                                              item.id,
                                              item.quantity - 1
                                            )
                                          }
                                        >
                                          <MinusIcon className="h-3 w-3" />
                                        </Button>
                                        <span className="w-8 text-center">
                                          {item.quantity}
                                        </span>
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() =>
                                            updateQuantity(
                                              item.id,
                                              item.quantity + 1
                                            )
                                          }
                                        >
                                          <PlusIcon className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 ml-auto"
                                          onClick={() => removeItem(item.id)}
                                        >
                                          <TrashIcon className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="text-right flex flex-col">
                                      <span className="font-medium">
                                        $
                                        {(item.price * item.quantity).toFixed(
                                          2
                                        )}
                                      </span>
                                      <p className="text-sm text-muted-foreground">
                                        ${item.price.toFixed(2)} por unidad
                                      </p>
                                    </div>
                                  </div>
                                  <Separator />
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      <div className="w-full lg:w-fit lg:min-w-[350px]">
                        <Card>
                          <CardContent className="p-6">
                            <h2 className="text-lg font-semibold mb-4">
                              Resumen del Pedido
                            </h2>
                            <div className="space-y-3">
                              <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>${subtotal.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Item</span>
                                <span>{totalQuantity}</span>
                              </div>

                              <div className="flex justify-between">
                                <span>IVA (21%)</span>
                                <span>{iva.toFixed(2)}$</span>
                              </div>
                              <Separator />
                              <div className="flex justify-between font-semibold text-lg">
                                <span>Total</span>
                                <span>${total.toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="mt-6 space-y-3">
                              <Button
                                className="w-full"
                                onClick={() => setIsCheckout(true)}
                              >
                                Check Out
                              </Button>
                              <Button
                                variant="outline"
                                asChild
                                className="w-full"
                              >
                                <Link href="/">Keep buying</Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex flex-col flex-1 min-h-0">
                  <ProceedCart setIsCheckout={setIsCheckout} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ShoppingCart;
