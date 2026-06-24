import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { uploadCardImageToR2, hasR2Credentials } from "@/lib/r2/uploadCardImage";

export const runtime = "nodejs";
export const maxDuration = 60;

const sanitizeFilename = (value: string) =>
  (value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-_]/g, "-")
    .replace(/-+/g, "-");

/**
 * Corrige la imagen de UNA carta: descarga desde Limitless, sube a R2 con un
 * nombre versionado (cards/{CODE}-v{version}.webp) y actualiza el `src`.
 *
 * Body: { cardId: number, code: string, limitlessSrc: string, version: number }
 */
export async function POST(request: NextRequest) {
  try {
    const { cardId, code, limitlessSrc, version } = await request.json();

    if (!cardId || !code || !limitlessSrc) {
      return NextResponse.json(
        { error: "Faltan cardId, code o limitlessSrc" },
        { status: 400 }
      );
    }
    if (!hasR2Credentials()) {
      return NextResponse.json(
        { error: "Faltan credenciales de R2 en el entorno" },
        { status: 500 }
      );
    }

    const v = Number(version) || Date.now();
    // Incluir cardId garantiza una llave única por registro (base vs alternas
    // del mismo código no se pisan en R2) y rompe el caché immutable previo.
    const filename = sanitizeFilename(`${code}-v${v}-${Number(cardId)}`);

    const { r2Url } = await uploadCardImageToR2(limitlessSrc, filename, true);

    await prisma.card.update({
      where: { id: Number(cardId) },
      data: { src: r2Url, imageKey: null },
    });

    return NextResponse.json({ ok: true, cardId, code, r2Url });
  } catch (error) {
    console.error("❌ fix-set-images/apply error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error inesperado" },
      { status: 500 }
    );
  }
}
