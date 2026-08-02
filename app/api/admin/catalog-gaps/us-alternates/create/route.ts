export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadCardImageToR2 } from "@/lib/r2/uploadCardImage";
import { tcgplayerFetch } from "@/lib/services/tcgplayerClient";

/**
 * POST /api/admin/catalog-gaps/us-alternates/create
 * Body: { productId: number }
 *
 * Crea la carta ALTERNA en el catálogo a partir de un producto de TCGplayer:
 *  - clona la carta base (misma info, colores, tipos, textos…)
 *  - resuelve el SET desde el grupo de TCGplayer (lo crea si no existe)
 *  - sube la imagen de TCGplayer a R2
 *  - deja la alterna linkeada al producto (tcgplayerProductId + linkedCardId)
 */

/** Deriva un alternateArt legible del nombre del producto de TCGplayer. */
function altArtLabel(name: string | null): string {
  const n = (name ?? "").toLowerCase();
  if (/reprint/.test(n)) return "Reprint";
  if (/parallel/.test(n)) return "Parallel";
  if (/manga/.test(n)) return "Manga";
  if (/serial/.test(n)) return "Serial Number";
  if (/\bsp\b|special/.test(n)) return "Special";
  // Paréntesis final que no sea el código (ej. "Yamato (Treasure Cup)").
  const m = (name ?? "").match(/\(([^)]+)\)\s*$/);
  if (m) {
    const inner = m[1].trim();
    if (!/^[A-Za-z]+-?\d+$/.test(inner) && !/alternate art/i.test(inner)) return inner;
  }
  return "Alternate Art";
}

/** Encuentra (o crea) nuestro Set a partir del grupo de TCGplayer. */
async function resolveSetId(groupId: number | null): Promise<number | null> {
  if (!groupId) return null;
  let name: string | null = null;
  try {
    const res: any = await tcgplayerFetch(`/catalog/groups/${groupId}`);
    name = res?.results?.[0]?.name ?? res?.Results?.[0]?.name ?? null;
  } catch {
    return null;
  }
  if (!name) return null;
  const existing = await prisma.set.findFirst({
    where: { title: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.set.create({
    data: { title: name, image: "", code: null, releaseDate: new Date(), isOpen: false },
    select: { id: true },
  });
  return created.id;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pid = Number(body.productId);
    if (!Number.isFinite(pid)) {
      return NextResponse.json({ error: "productId inválido" }, { status: 400 });
    }

    const prod = await prisma.tcgCatalogProduct.findUnique({ where: { productId: pid } });
    if (!prod || !prod.number) {
      return NextResponse.json({ error: "Producto TCGplayer no encontrado" }, { status: 404 });
    }
    const code = prod.number.toUpperCase();

    // ¿Ya existe una carta linkeada a este producto?
    const already = await prisma.card.findFirst({
      where: { tcgplayerProductId: String(pid) },
      select: { id: true },
    });
    if (already) {
      await prisma.tcgCatalogProduct.update({
        where: { productId: pid },
        data: { linkedCardId: already.id, linkedAt: new Date() },
      });
      return NextResponse.json({ cardId: already.id, alreadyExisted: true });
    }

    // Carta base US.
    const base = await prisma.card.findFirst({
      where: { code, isFirstEdition: true, OR: [{ region: "US" }, { region: null }] },
      include: { types: true, colors: true, effects: true, conditions: true, texts: true },
    });
    if (!base) {
      return NextResponse.json(
        { error: `No hay carta base US para ${code} (súbela primero desde Limitless)` },
        { status: 422 }
      );
    }

    const groupId = (prod.metadata as any)?.groupId ?? null;
    const setId = await resolveSetId(groupId);
    const alternateArt = altArtLabel(prod.name);

    // Imagen: subir la de TCGplayer a R2.
    const imageUrl =
      prod.imageUrl || `https://tcgplayer-cdn.tcgplayer.com/product/${pid}_400w.jpg`;
    const filename = `${code}-tcg${pid}`;
    const { r2Url } = await uploadCardImageToR2(imageUrl, filename, true);

    // Crear la alterna clonando la base.
    const card = await prisma.card.create({
      data: {
        name: base.name,
        code: base.code,
        setCode: base.setCode,
        src: r2Url,
        imageKey: null,
        cost: base.cost,
        power: base.power,
        attribute: base.attribute,
        counter: base.counter,
        category: base.category,
        life: base.life,
        rarity: prod.rarity ?? base.rarity,
        illustrator: base.illustrator,
        alternateArt,
        status: base.status,
        triggerCard: base.triggerCard,
        tcgUrl: prod.url ?? null,
        tcgplayerProductId: String(pid),
        tcgplayerLinkStatus: true,
        alias: base.alias,
        order: base.order,
        isFirstEdition: false,
        isPro: base.isPro,
        region: base.region ?? "US",
        baseCardId: base.id,
        types: base.types.length ? { create: base.types.map((t) => ({ type: t.type })) } : undefined,
        colors: base.colors.length ? { create: base.colors.map((c) => ({ color: c.color })) } : undefined,
        effects: base.effects.length ? { create: base.effects.map((e) => ({ effect: e.effect })) } : undefined,
        conditions: base.conditions.length ? { create: base.conditions.map((c) => ({ condition: c.condition })) } : undefined,
        texts: base.texts.length ? { create: base.texts.map((t) => ({ text: t.text })) } : undefined,
        ...(setId ? { sets: { create: { setId } } } : {}),
      },
      select: { id: true },
    });

    // Linkear el producto del mirror a la nueva carta.
    await prisma.tcgCatalogProduct.update({
      where: { productId: pid },
      data: { linkedCardId: card.id, linkedAt: new Date() },
    });

    return NextResponse.json({ cardId: card.id, alternateArt, setId });
  } catch (error: any) {
    console.error("[us-alternates/create] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "No se pudo crear la alterna" },
      { status: 500 }
    );
  }
}
