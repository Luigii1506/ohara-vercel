import type { Metadata } from "next";
import MarketClient from "./MarketClient";

export const metadata: Metadata = {
  title: "Mercado · Análisis de precios One Piece Card Game",
  description:
    "Dashboard de mercado: valor esperado de sellados, cartas que más suben, joyas baratas subiendo y descuentos desde máximo. Encuentra qué comprar antes de que suba.",
};

export default function MarketPage() {
  return <MarketClient />;
}
