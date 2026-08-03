export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadCardImageToR2 } from "@/lib/r2/uploadCardImage";
import {
  tcgplayerFetch,
  getTcgplayerProductPricing,
} from "@/lib/services/tcgplayerClient";
import {
  parseTcgCard,
  classifyAlternateArt,
  splitDisclaimer,
  deriveSetTitles,
} from "@/lib/services/tcgplayerCardData";

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

/** Find-or-create de un Set por título (tolerante a espacios/mayúsculas). */
async function findOrCreateSetByTitle(title: string): Promise<number> {
  const trimmed = title.trim();
  const candidates = await prisma.set.findMany({
    where: { title: { contains: trimmed, mode: "insensitive" } },
    select: { id: true, title: true },
  });
  const match = candidates.find(
    (s) => s.title.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (match) return match.id;
  const created = await prisma.set.create({
    data: { title: trimmed, image: "", code: null, releaseDate: new Date(), isOpen: false },
    select: { id: true },
  });
  return created.id;
}

/**
 * Encuentra (o crea) los Sets de una carta a partir del grupo/nombre de
 * TCGplayer. Devuelve [principal, ...secundarios]:
 *   - Promo   → [pack/playmat real, "One Piece Promotion Cards"].
 *   - Deck    → [nombre del deck formateado, ej. "RED Monkey.D.Luffy"].
 *   - Booster → [nombre del grupo].
 * El pack/deck queda como set PRINCIPAL (el primero) para ligar la carta a su
 * sobre (precios/EV), y el umbrella promo como secundario para browsing.
 */
async function resolveSetIds(
  groupId: number | null,
  productName: string | null
): Promise<number[]> {
  if (!groupId) return [];
  let groupName: string | null = null;
  try {
    const res: any = await tcgplayerFetch(`/catalog/groups/${groupId}`);
    groupName = res?.results?.[0]?.name ?? res?.Results?.[0]?.name ?? null;
  } catch {
    return [];
  }
  const titles = deriveSetTitles(groupName, productName);
  const ids: number[] = [];
  for (const t of titles) ids.push(await findOrCreateSetByTitle(t));
  return ids;
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

    // Carta base US (para clonar cuando SÍ la tenemos y esto es una alterna).
    const base = await prisma.card.findFirst({
      where: { code, isFirstEdition: true, OR: [{ region: "US" }, { region: null }] },
      include: { types: true, colors: true, effects: true, conditions: true, texts: true },
    });

    // Set correcto desde el grupo de TCGplayer (lo crea si no existe).
    const groupId = (prod.metadata as any)?.groupId ?? null;
    const setIds = await resolveSetIds(groupId, prod.name);
    const setId = setIds[0] ?? null; // principal (para la respuesta)
    const setsCreate = setIds.length
      ? { sets: { create: setIds.map((id) => ({ setId: id })) } }
      : {};

    // Imagen: subir a R2 la de ALTA resolución (1000x1000) con fallback a 400w.
    // Nombre ÚNICO (con sufijo) para evitar el caché immutable de R2/CDN: si se
    // re-crea la carta, la URL cambia y no sirve una imagen vieja cacheada.
    const filename = `${code}-tcg${pid}-${Date.now().toString(36)}`;
    const hiRes = `https://tcgplayer-cdn.tcgplayer.com/product/${pid}_in_1000x1000.jpg`;
    const loRes =
      prod.imageUrl || `https://tcgplayer-cdn.tcgplayer.com/product/${pid}_400w.jpg`;
    let r2Url: string;
    try {
      ({ r2Url } = await uploadCardImageToR2(hiRes, filename, true));
    } catch {
      ({ r2Url } = await uploadCardImageToR2(loRes, filename, true));
    }

    // Precio: traerlo de TCGplayer al momento (para ver la data al instante, sin
    // esperar al sync). Elegimos la entrada con market/mid disponible.
    let priceData: {
      marketPrice?: number | null;
      midPrice?: number | null;
      lowPrice?: number | null;
      highPrice?: number | null;
      priceCurrency?: string;
      priceUpdatedAt?: Date;
    } = {};
    try {
      const pricing = await getTcgplayerProductPricing([pid]);
      const entry =
        pricing.find((e: any) => e.marketPrice != null || e.midPrice != null) ??
        pricing[0];
      if (entry) {
        priceData = {
          marketPrice: entry.marketPrice ?? entry.midPrice ?? null,
          midPrice: entry.midPrice ?? null,
          lowPrice: entry.lowPrice ?? null,
          highPrice: entry.highPrice ?? entry.directLowPrice ?? null,
          priceCurrency: "USD",
          priceUpdatedAt: new Date(),
        };
      }
    } catch (e) {
      console.warn("[create] pricing no disponible:", (e as Error).message);
    }

    // Disclaimer (pre-errata / no legal / reprint) desde el Description.
    const description =
      (prod.metadata as any)?.extendedData?.find((e: any) => e.name === "Description")
        ?.value ?? null;
    const { disclaimer } = splitDisclaimer(description);

    let card: { id: number };
    let mode: "alternate" | "new-base";

    if (base) {
      // === Ya tenemos la carta → crear ALTERNA clonando la base ===
      mode = "alternate";
      const alternateArt = classifyAlternateArt(prod.name, disclaimer, prod.rarity);
      card = await prisma.card.create({
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
          disclaimer,
          status: base.status,
          triggerCard: base.triggerCard,
          tcgUrl: prod.url ?? null,
          tcgplayerProductId: String(pid),
          tcgplayerLinkStatus: true,
          ...priceData,
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
          ...setsCreate,
        },
        select: { id: true },
      });
    } else {
      // === No la tenemos → crear la carta COMPLETA desde TCGplayer (base) ===
      mode = "new-base";
      const parsed = parseTcgCard((prod.metadata as any)?.extendedData ?? [], prod.name);
      if (!parsed) {
        return NextResponse.json(
          { error: `TCGplayer no tiene datos suficientes para ${code}` },
          { status: 422 }
        );
      }
      card = await prisma.card.create({
        data: {
          name: parsed.name,
          code: parsed.code,
          setCode: parsed.setCode,
          src: r2Url,
          imageKey: null,
          cost: parsed.cost,
          power: parsed.power,
          attribute: parsed.attribute,
          counter: parsed.counter,
          category: parsed.category,
          life: parsed.life,
          rarity: parsed.rarity,
          alternateArt: null,
          disclaimer: parsed.disclaimer,
          tcgUrl: prod.url ?? null,
          tcgplayerProductId: String(pid),
          tcgplayerLinkStatus: true,
          ...priceData,
          // Mejores prácticas: primera versión US, sin base (es la base).
          isFirstEdition: true,
          region: "US",
          baseCardId: null,
          colors: parsed.colors.length ? { create: parsed.colors.map((color) => ({ color })) } : undefined,
          types: parsed.types.length ? { create: parsed.types.map((type) => ({ type })) } : undefined,
          effects: parsed.effects.length ? { create: parsed.effects.map((effect) => ({ effect })) } : undefined,
          texts: parsed.texts.length ? { create: parsed.texts.map((text) => ({ text })) } : undefined,
          ...setsCreate,
        },
        select: { id: true },
      });
    }

    // Linkear el producto del mirror a la nueva carta.
    await prisma.tcgCatalogProduct.update({
      where: { productId: pid },
      data: { linkedCardId: card.id, linkedAt: new Date() },
    });

    return NextResponse.json({
      cardId: card.id,
      mode,
      setId,
      alternateArt: base ? classifyAlternateArt(prod.name, disclaimer, prod.rarity) : null,
      hasPrice: priceData.marketPrice != null,
      hasDisclaimer: Boolean(disclaimer),
    });
  } catch (error: any) {
    console.error("[us-alternates/create] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "No se pudo crear la alterna" },
      { status: 500 }
    );
  }
}
