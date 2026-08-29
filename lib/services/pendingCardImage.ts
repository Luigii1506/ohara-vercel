import { uploadCardImageToR2 } from "@/lib/r2/uploadCardImage";
import { prisma } from "@/lib/prisma";

/**
 * Dorso de carta, ya usado en todo el frontend como fallback de imagen rota
 * (ver LazyImage/CardWithBadges `fallbackSrc`) — se reutiliza tal cual como
 * placeholder cuando TCGplayer todavía no tiene la foto real de un producto
 * recién agregado a su catálogo.
 */
export const PENDING_IMAGE_PLACEHOLDER_SRC = "/assets/images/backcard.webp";

export type CardImageResult = {
  src: string;
  pendingImage: boolean;
};

/**
 * Sube a R2 la imagen de un producto de TCGplayer (alta resolución, con
 * fallback a la de menor resolución). Si TCGplayer todavía no tiene NINGUNA
 * imagen para este producto (visto en listados recién agregados: ambas
 * resoluciones dan 403), no falla — devuelve el placeholder de dorso con
 * `pendingImage: true` para que la carta se cree igual, marcada para que un
 * cron reintente la subida real más adelante (ver
 * app/api/cron/retry-pending-images/route.ts).
 */
export async function uploadTcgplayerCardImage(
  productId: number,
  filenameBase: string
): Promise<CardImageResult> {
  const hiRes = `https://tcgplayer-cdn.tcgplayer.com/product/${productId}_in_1000x1000.jpg`;
  const loRes = `https://tcgplayer-cdn.tcgplayer.com/product/${productId}_400w.jpg`;

  try {
    const { r2Url } = await uploadCardImageToR2(hiRes, filenameBase, true);
    return { src: r2Url, pendingImage: false };
  } catch {
    // sigue con el fallback de baja resolución
  }

  try {
    const { r2Url } = await uploadCardImageToR2(loRes, filenameBase, true);
    return { src: r2Url, pendingImage: false };
  } catch {
    return { src: PENDING_IMAGE_PLACEHOLDER_SRC, pendingImage: true };
  }
}

export type RetryPendingImagesResult = {
  checked: number;
  resolved: number;
  stillPending: number;
};

/**
 * Reintenta la subida real para toda carta marcada `pendingImage: true` (ver
 * uploadTcgplayerCardImage) — TCGplayer sube la foto de un producto nuevo con
 * retraso, así que un producto que no tenía imagen hace unos días puede ya
 * tenerla ahora. Usado por el cron retry-pending-images.
 */
export async function retryPendingCardImages(): Promise<RetryPendingImagesResult> {
  const pending = await prisma.card.findMany({
    where: { pendingImage: true, tcgplayerProductId: { not: null } },
    select: { id: true, code: true, tcgplayerProductId: true },
  });

  let resolved = 0;
  for (const card of pending) {
    const pid = Number(card.tcgplayerProductId);
    if (!Number.isFinite(pid)) continue;

    const filename = `${card.code}-tcg${pid}-${Date.now().toString(36)}`;
    const result = await uploadTcgplayerCardImage(pid, filename);
    if (!result.pendingImage) {
      await prisma.card.update({
        where: { id: card.id },
        data: { src: result.src, pendingImage: false },
      });
      resolved += 1;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  return {
    checked: pending.length,
    resolved,
    stillPending: pending.length - resolved,
  };
}
