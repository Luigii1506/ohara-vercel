import { Metadata } from "next";
import TournamentsClient from "./TournamentsClient";

export const metadata: Metadata = {
  title: "Torneos - One Piece Card Game",
  description:
    "Resultados de torneos competitivos de One Piece Card Game. Explora los mejores decks, arquetipos ganadores y estadísticas del meta actual.",
  openGraph: {
    title: "Torneos - One Piece Card Game",
    description:
      "Resultados de torneos competitivos de One Piece Card Game. Explora los mejores decks, arquetipos ganadores y estadísticas del meta actual.",
  },
};

export default function TournamentsPage() {
  return <TournamentsClient />;
}
