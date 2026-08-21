export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mergeSetAliases, normalizeSetTitle } from "@/lib/sets/normalization";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawTitle = body?.title;
    const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
    const normalizedTitle = normalizeSetTitle(title);

    if (!title) {
      return NextResponse.json(
        { error: "El nombre del set es obligatorio" },
        { status: 400 }
      );
    }

    const rawImage = typeof body?.imageUrl === "string" ? body.imageUrl : "";
    const image = rawImage?.trim() || "";
    const rawCode = typeof body?.code === "string" ? body.code.trim() : "";
    const rawVersion =
      typeof body?.version === "string" ? body.version.trim() : "";

    const code = rawCode || "";

    const existingSets = await prisma.set.findMany({
      select: {
        id: true,
        title: true,
        code: true,
        version: true,
        image: true,
        aliasesJson: true,
      },
    });

    const existingSet = existingSets.find(
      (set) => normalizeSetTitle(set.title) === normalizedTitle
    );

    if (existingSet) {
      const updatedSet = await prisma.set.update({
        where: { id: existingSet.id },
        data: {
          aliasesJson: mergeSetAliases(existingSet.aliasesJson, [
            existingSet.title,
            title,
          ]),
          image: image || existingSet.image,
          code: code || existingSet.code,
          version: rawVersion || existingSet.version,
        },
      });

      return NextResponse.json(updatedSet, { status: 200 });
    }

    const newSet = await prisma.set.create({
      data: {
        title,
        image,
        code,
        version: rawVersion || null,
        releaseDate: new Date(),
        isOpen: false,
        aliasesJson: [title],
      },
    });

    return NextResponse.json(newSet, { status: 201 });
  } catch (error) {
    console.error("Error creating quick set:", error);
    return NextResponse.json(
      { error: "No se pudo crear el set" },
      { status: 500 }
    );
  }
}
