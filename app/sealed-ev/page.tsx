import type { Metadata } from "next";
import SealedEvClient from "./SealedEvClient";

export const metadata: Metadata = {
  title: "¿Vale la pena? · Valor esperado de sellados",
  description:
    "Ranking de productos sellados de One Piece Card Game por valor esperado (EV) vs precio de mercado. Descubre qué caja o sobre es oro.",
};

export default function SealedEvPage() {
  return <SealedEvClient />;
}
