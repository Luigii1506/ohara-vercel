import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const parseLimit = (value: string | null) => {
  if (!value) return 24;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 24;
  return Math.min(parsed, 100);
};

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const region = searchParams.get("region")?.trim() || "JP";
    const status = searchParams.get("status")?.trim() || "pending";
    const search = searchParams.get("search")?.trim() || "";
    const cursorParam = searchParams.get("cursor");
    const cursor = cursorParam ? Number(cursorParam) : null;
    const limit = parseLimit(searchParams.get("limit"));

    const baseWhere: any = {
      isFirstEdition: false,
      ...(region === "all"
        ? { region: { not: "US" } }
        : { region }),
    };

    if (status === "pending") {
      baseWhere.OR = [
        { alternateArt: null },
        { alternateArt: "" },
        { alternateArt: "Alternate Art" },
      ];
    }

    if (search) {
      baseWhere.AND = [
        {
          OR: [
            { code: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ],
        },
      ];
    }

    if (cursor) {
      baseWhere.id = { gt: cursor };
    }

    const items = await prisma.card.findMany({
      where: baseWhere,
      orderBy: { id: "asc" },
      take: limit + 1,
      select: {
        id: true,
        code: true,
        name: true,
        src: true,
        imageKey: true,
        region: true,
        language: true,
        alternateArt: true,
        setCode: true,
      },
    });

    const hasNext = items.length > limit;
    const sliced = hasNext ? items.slice(0, limit) : items;
    const nextCursor = hasNext ? sliced[sliced.length - 1]?.id ?? null : null;

    const codes = Array.from(
      new Set(sliced.map((item) => item.code).filter(Boolean))
    );

    const usCandidates = codes.length
      ? await prisma.card.findMany({
          where: {
            code: { in: codes },
            region: "US",
            isFirstEdition: false,
          },
          orderBy: [{ code: "asc" }, { id: "asc" }],
          select: {
            id: true,
            code: true,
            name: true,
            src: true,
            imageKey: true,
            alternateArt: true,
            setCode: true,
          },
        })
      : [];

    const usByCode = usCandidates.reduce<Record<string, typeof usCandidates>>(
      (acc, card) => {
        if (!acc[card.code]) acc[card.code] = [];
        acc[card.code].push(card);
        return acc;
      },
      {}
    );

    const result = sliced.map((item) => ({
      ...item,
      usCandidates: usByCode[item.code] ?? [],
    }));

    return NextResponse.json({ items: result, nextCursor }, { status: 200 });
  } catch (error: any) {
    console.error("Error in GET /api/admin/region-alternates:", error);
    return NextResponse.json(
      { error: error.message ?? "Failed to load region alternates." },
      { status: 500 }
    );
  }
}
