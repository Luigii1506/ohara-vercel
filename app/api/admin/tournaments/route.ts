import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 30;
    const safeLimit = Number.isNaN(limit) ? 30 : Math.min(Math.max(limit, 5), 200);

    const tournaments = await prisma.tournament.findMany({
      orderBy: { eventDate: "desc" },
      take: safeLimit,
      include: {
        source: {
          select: {
            name: true,
            slug: true,
          },
        },
        decks: {
          orderBy: {
            standing: "asc",
          },
          include: {
            deck: {
              select: {
                id: true,
                name: true,
                uniqueUrl: true,
              },
            },
            leaderCard: {
              select: {
                id: true,
                name: true,
                code: true,
                src: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ tournaments });
  } catch (error) {
    return handleAuthError(error);
  }
}
