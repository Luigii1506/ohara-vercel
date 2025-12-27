import { NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";
import {
  syncLimitlessTournamentDecks,
  syncLimitlessTournaments,
} from "@/lib/services/tournaments/limitlessScraper";

export async function POST() {
  try {
    const user = await requireAuth();

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const tournamentResult = await syncLimitlessTournaments();
    const deckResult = await syncLimitlessTournamentDecks();

    return NextResponse.json({
      ok: true,
      source: "limitless",
      tournaments: tournamentResult,
      decks: deckResult,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
