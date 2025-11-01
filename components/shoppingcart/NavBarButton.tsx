"use client";

import { ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useRouter } from "next/navigation";

const NavBarButton = () => {
  const { items } = useCartStore();
  const router = useRouter();

  // Calculamos la cantidad total sumando la propiedad "quantity" de cada item
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex items-center justify-center">
      <button
        className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-md border border-transparent hover:border-blue-500 transition-all duration-200"
        onClick={() => router.push("/shoppingCart")}
      >
        <ShoppingCart size={20} />
        <div className="flex items-center justify-center bg-blue-600 text-white rounded-full w-6 h-6 text-sm font-medium">
          {totalQuantity}
        </div>
      </button>
    </div>
  );
};

export default NavBarButton;
