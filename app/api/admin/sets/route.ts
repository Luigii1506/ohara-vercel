export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mergeSetAliases, normalizeSetTitle } from "@/lib/sets/normalization";

// CREATE - POST
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawTitle = typeof body?.title === "string" ? body.title.trim() : "";
    const normalizedTitle = normalizeSetTitle(rawTitle);
    const image = typeof body?.image === "string" ? body.image : body?.image;
    const code = typeof body?.code === "string" ? body.code.trim() : body?.code;
    const version =
      typeof body?.version === "string" ? body.version.trim() : body?.version;
    const isOpen = body?.isOpen ?? false;
    const parsedReleaseDate = body?.releaseDate ? new Date(body.releaseDate) : null;

    if (!rawTitle) {
      return NextResponse.json(
        { error: "Set title is required" },
        { status: 400 }
      );
    }

    const existingSets = await prisma.set.findMany({
      select: {
        id: true,
        title: true,
        code: true,
        version: true,
        aliasesJson: true,
        image: true,
        releaseDate: true,
        isOpen: true,
      },
    });

    const existingSet = existingSets.find(
      (set) => normalizeSetTitle(set.title) === normalizedTitle
    );

    if (existingSet) {
      const aliases = mergeSetAliases(existingSet.aliasesJson, [
        existingSet.title,
        rawTitle,
      ]);

      const updatedSet = await prisma.set.update({
        where: { id: existingSet.id },
        data: {
          aliasesJson: aliases.length > 0 ? aliases : undefined,
          image: image || existingSet.image,
          code:
            typeof code === "string" && code.length > 0
              ? code
              : existingSet.code,
          version:
            typeof version === "string" && version.length > 0
              ? version
              : existingSet.version,
          releaseDate:
            parsedReleaseDate && !Number.isNaN(parsedReleaseDate.getTime())
              ? parsedReleaseDate
              : existingSet.releaseDate,
          isOpen,
        },
      });

      return NextResponse.json(updatedSet, { status: 200 });
    }

    const newSet = await prisma.set.create({
      data: {
        image,
        title: rawTitle,
        code,
        version,
        releaseDate:
          parsedReleaseDate && !Number.isNaN(parsedReleaseDate.getTime())
            ? parsedReleaseDate
            : new Date(),
        isOpen,
        aliasesJson: [rawTitle],
      },
    });

    return NextResponse.json(newSet, { status: 201 });
  } catch (error: any) {
    console.error("Error en POST /api/sets:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// READ - GET ALL
export async function GET(req: NextRequest) {
  // Obtenemos parámetros de query para incluir relaciones si es necesario
  const includeRelations = req.nextUrl.searchParams.get("includeRelations");

  try {
    const sets = await prisma.set.findMany({
      include:
        includeRelations === "true"
          ? { cards: true, events: true, _count: { select: { cards: true } } }
          : { _count: { select: { cards: true } } },
      orderBy: { createdAt: "desc" }, // Más recientes primero
    });

    return NextResponse.json(sets, { status: 200 });
  } catch (error: any) {
    console.error("Error en GET /api/sets:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
