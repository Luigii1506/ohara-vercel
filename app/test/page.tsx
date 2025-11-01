"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeftIcon,
  CreditCardIcon,
  PackageIcon,
  TruckIcon,
  UserIcon,
  ShoppingCartIcon,
  MinusIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";

import { useCartStore } from "@/store/cartStore";
import ProceedCart from "@/components/shoppingcart/ProceedCart";

const AddSet = () => {
  const [isDeleting, setIsDeleting] = React.useState(false);

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

  const cartItems = useCartStore((state) => state.items);

  // State for shipping method
  const [shippingMethod, setShippingMethod] = useState("standard");

  // State for payment method
  const [paymentMethod, setPaymentMethod] = useState("card");

  // Calculate shipping cost
  const shippingCost = shippingMethod === "express" ? 9.99 : 4.99;

  // Calculate tax (21%)
  const tax = subtotal * 0.21;

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Payment processing logic goes here
    alert("Order placed successfully");
  };

  return (
    <div className="min-h-0 h-full flex flex-col flex-1">
      <Card className="flex flex-col h-full min-h-0 flex-1">
        <CardContent className="flex flex-1 flex-col h-full min-h-0">
          <form
            onSubmit={handleSubmit}
            className="flex-1 flex overflow-hidden flex-col h-full"
          >
            <div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <UserIcon className="h-5 w-5" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          placeholder="Your first name"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          placeholder="Your last name"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@example.com"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+1 234 567 8900"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <PackageIcon className="h-5 w-5" />
                    Shipping Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        placeholder="Street, number, apartment"
                        required
                      />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input id="city" placeholder="Your city" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">Postal Code</Label>
                        <Input id="postalCode" placeholder="00000" required />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="province">Province/State</Label>
                        <Input
                          id="province"
                          placeholder="Your province/state"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Select defaultValue="us">
                          <SelectTrigger id="country">
                            <SelectValue placeholder="Select a country" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="us">United States</SelectItem>
                            <SelectItem value="mx">Mexico</SelectItem>
                            <SelectItem value="ar">Argentina</SelectItem>
                            <SelectItem value="co">Colombia</SelectItem>
                            <SelectItem value="cl">Chile</SelectItem>
                            <SelectItem value="pe">Peru</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Shipping Notes (optional)</Label>
                      <Input
                        id="notes"
                        placeholder="Special delivery instructions"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <TruckIcon className="h-5 w-5" />
                    Shipping Method
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    defaultValue="standard"
                    value={shippingMethod}
                    onValueChange={setShippingMethod}
                    className="space-y-4"
                  >
                    <div className="flex items-center space-x-2 border rounded-lg p-4">
                      {/* <RadioGroupItem value="standard" id="standard" /> */}
                      <Label
                        htmlFor="standard"
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-medium">Standard Shipping</div>
                        <div className="text-sm text-muted-foreground">
                          Delivery in 3-5 business days
                        </div>
                      </Label>
                      <div className="font-medium">€4.99</div>
                    </div>
                    <div className="flex items-center space-x-2 border rounded-lg p-4">
                      {/* <RadioGroupItem value="express" id="express" /> */}
                      <Label
                        htmlFor="express"
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-medium">Express Shipping</div>
                        <div className="text-sm text-muted-foreground">
                          Delivery in 1-2 business days
                        </div>
                      </Label>
                      <div className="font-medium">€9.99</div>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <CreditCardIcon className="h-5 w-5" />
                    Payment Method
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    defaultValue="card"
                    value={paymentMethod}
                    onValueChange={setPaymentMethod}
                    className="space-y-4"
                  >
                    <div className="flex items-center space-x-2 border rounded-lg p-4">
                      {/* <RadioGroupItem value="card" id="card" /> */}
                      <Label htmlFor="card" className="flex-1 cursor-pointer">
                        <div className="font-medium">Credit/Debit Card</div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded-lg p-4">
                      {/* <RadioGroupItem value="paypal" id="paypal" /> */}
                      <Label htmlFor="paypal" className="flex-1 cursor-pointer">
                        <div className="font-medium">PayPal</div>
                      </Label>
                    </div>
                  </RadioGroup>

                  {paymentMethod === "card" && (
                    <div className="mt-6 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="cardName">Name on Card</Label>
                        <Input id="cardName" placeholder="Full name" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cardNumber">Card Number</Label>
                        <Input
                          id="cardNumber"
                          placeholder="0000 0000 0000 0000"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="expiry">Expiry Date</Label>
                          <Input id="expiry" placeholder="MM/YY" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cvc">CVC</Label>
                          <Input id="cvc" placeholder="000" required />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <div className="space-y-4">
                      {cartItems.map((item) => (
                        <div key={item.id} className="flex gap-4">
                          <div className="relative h-16 w-12  rounded-md border">
                            <Image
                              src={item.src || "/placeholder.svg"}
                              alt={item.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-medium">{item.name}</h4>
                            {item.rarity && (
                              <p className="text-xs text-muted-foreground">
                                {item.rarity}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Quantity: {item.quantity}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-medium">
                              {(item.price * item.quantity).toFixed(2)}€
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>{subtotal.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tax (21%)</span>
                        <span>{tax.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Shipping</span>
                        <span>{shippingCost.toFixed(2)}€</span>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>{total.toFixed(2)}€</span>
                    </div>

                    <div className="flex items-start space-x-2 pt-4">
                      <Checkbox id="terms" required />
                      <Label htmlFor="terms" className="text-sm">
                        I accept the terms and conditions and privacy policy
                      </Label>
                    </div>

                    <Button type="submit" className="w-full mt-4">
                      Place Order
                    </Button>

                    <div className="text-center text-xs text-muted-foreground mt-2">
                      Your data is safe and encrypted
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddSet;
