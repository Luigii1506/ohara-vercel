// Endpoint de modo LOCAL: lee los logs de OPTCGSim del disco del usuario.
// Solo activo en localhost/dev (ver isLocalEnabled). En Vercel devuelve
// { available: false } y el frontend cae al selector de carpeta/archivo.
//
//   GET /api/replay/local             → { available, dir, games: GameSummary[] }
//   GET /api/replay/local?file=NAME   → contenido crudo del log (text/plain)

import { NextRequest, NextResponse } from "next/server";
import {
  isLocalEnabled,
  listLocalGames,
  readLocalLog,
} from "@/lib/replay/localLogs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isLocalEnabled()) {
    return NextResponse.json({ available: false });
  }

  const file = req.nextUrl.searchParams.get("file");
  if (file) {
    const content = await readLocalLog(file);
    if (content == null) {
      return new NextResponse("Not found", { status: 404 });
    }
    return new NextResponse(content, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const { dir, games } = await listLocalGames();
    return NextResponse.json({ available: true, dir, games });
  } catch (error) {
    return NextResponse.json({
      available: false,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
