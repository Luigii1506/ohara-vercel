import axios from "axios";
import { createHash } from "crypto";
import { EventRegion, EventStatus, EventType } from "@prisma/client";
import { prisma } from "../../prisma";
import { generateSlug, syncEventMissingCardsInDb } from "./eventScraper";

/**
 * /products/ (colecciones especiales: Premium Card Collection, Illustration
 * Box, Anniversary Set, Double/Tin Pack, Playmat&Card Set…) usa una plantilla
 * totalmente distinta a /events/, /news/ y /topics/ — un carrusel Swiper sin
 * ningún heading por carta. El código NUNCA va en el nombre del archivo
 * (siempre "img_itemNN.webp" o similar), a veces sí va en el atributo alt
 * ("Card image of OP15-040"), a veces el alt es genérico ("Card image", sin
 * código — ahí no hay forma de saberlo sin mirar la imagen). Reusa
 * syncEventMissingCardsInDb (mismo Event+MissingCard pipeline que
 * eventos/news/topics) en vez de reimplementar el dedupe/canonicalKey.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

function getAttr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? m[1] : null;
}

function resolveUrl(src: string, baseUrl: string): string {
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return src;
  }
}

export interface ProductCardCandidate {
  code: string;
  title: string;
  image: string | null;
  /** true = alt genérico "Card image", sin código — el admin lo llena a mano. */
  needsManualCode: boolean;
}

export interface ScrapedProductPage {
  title: string;
  sourceUrl: string;
  cards: ProductCardCandidate[];
}

/** Título real: vive en "<h2>" dentro de ".articleColHead" (no en <title>, que
 * trae el sufijo del sitio pegado — mismo problema ya visto en /news/). */
function extractProductTitle(html: string): string {
  const headMatch = html.match(/articleColHead["'][\s\S]{0,400}?<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const raw = headMatch?.[1] ?? html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "";
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/\s*[|−]\s*ONE PIECE CARD GAME.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function scrapeProductPage(
  url: string
): Promise<ScrapedProductPage | null> {
  let html: string;
  try {
    const res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 20000 });
    html = res.data;
  } catch (e) {
    console.error(`❌ Failed to fetch ${url}:`, (e as Error).message);
    return null;
  }

  const title = extractProductTitle(html);
  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const seenSrc = new Set<string>();
  const cards: ProductCardCandidate[] = [];

  for (const tag of imgTags) {
    const alt = (getAttr(tag, "alt") ?? "").trim();
    if (!/^card image/i.test(alt)) continue;
    const rawSrc = getAttr(tag, "data-src") ?? getAttr(tag, "src") ?? "";
    if (!rawSrc || seenSrc.has(rawSrc)) continue;
    seenSrc.add(rawSrc);
    const image = resolveUrl(rawSrc, url);

    // DON!!/sleeve/playmat no son "carta" con código — sin este chequeo
    // ANTES del regex genérico, "Card image of DON!! Card" se partía mal
    // (el regex de código no incluye "!", capturaba code:"DON" y el título
    // se quedaba con el resto, "!! Card", perdiendo la palabra clave "DON!!"
    // que syncEventMissingCardsInDb necesita para mandarlo a MissingProduct
    // en vez de crearlo como una carta rota).
    if (/don!!|sleeve|playmat/i.test(alt)) {
      cards.push({ code: "DON!!", title: alt.replace(/^card image of\s+/i, "").trim() || title, image, needsManualCode: false });
      continue;
    }

    const named = alt.match(/^card image of\s+([A-Za-z0-9-]+)\s*(.*)$/i);
    if (named) {
      const code = named[1].toUpperCase();
      const name = named[2].trim();
      cards.push({ code, title: name || title, image, needsManualCode: false });
    } else {
      // Sin código detectable: placeholder único por imagen (nunca choca
      // entre sí ni con un código real) hasta que el admin lo corrija a mano
      // en el modal de catalog-gaps.
      const hash = createHash("sha1").update(image).digest("hex").slice(0, 10);
      cards.push({
        code: `UNK-${hash}`,
        title,
        image,
        needsManualCode: true,
      });
    }
  }

  return { title, sourceUrl: url, cards };
}

/** Crea/actualiza el Event de esta página de producto y sincroniza sus
 * MissingCard candidatas — mismo pipeline que /news/ y /topics/. */
export async function syncProductPageInDb(scraped: ScrapedProductPage) {
  const slug = generateSlug(scraped.title, EventRegion.GLOBAL, scraped.sourceUrl);
  const event = await prisma.event.upsert({
    where: { slug },
    create: {
      slug,
      title: scraped.title,
      sourceUrl: scraped.sourceUrl,
      region: EventRegion.GLOBAL,
      status: EventStatus.COMPLETED,
      eventType: EventType.OTHER,
      isApproved: true,
    },
    update: {
      title: scraped.title,
      sourceUrl: scraped.sourceUrl,
    },
  });

  await syncEventMissingCardsInDb(
    event.id,
    scraped.cards.map((c) => ({ code: c.code, title: c.title, image: c.image }))
  );

  return event;
}
