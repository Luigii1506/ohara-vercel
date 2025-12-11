export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const slugifyCode = (title: string) =>
  title
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawTitle = body?.title;
    const title = typeof rawTitle === "string" ? rawTitle.trim() : "";

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

    const newSet = await prisma.set.create({
      data: {
        title,
        image,
        code,
        version: rawVersion || null,
        releaseDate: new Date(),
        isOpen: false,
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
