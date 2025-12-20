import { prisma } from "@/lib/prisma";

export async function markCatalogProductLinked(
  productId: number,
  cardId: number,
  options?: { linkedById?: number }
) {
  if (!Number.isFinite(productId) || productId <= 0) return;
  try {
    await prisma.tcgCatalogProduct.update({
      where: { productId },
      data: {
        linkedCardId: cardId,
        linkedAt: new Date(),
        linkedById: options?.linkedById ?? null,
        productStatus: "active",
      },
    });
  } catch (error) {
    console.warn("[tcgCatalogTracker] mark linked failed", {
      productId,
      cardId,
      error,
    });
  }
}

export async function markCatalogProductUnlinked(
  productId?: number | null,
  cardId?: number | null
) {
  if (!Number.isFinite(productId ?? NaN) || !productId || productId <= 0) {
    return;
  }
  try {
    await prisma.tcgCatalogProduct.updateMany({
      where: {
        productId,
        ...(cardId ? { linkedCardId: cardId } : {}),
      },
      data: {
        linkedCardId: null,
        linkedAt: null,
        linkedById: null,
      },
    });
  } catch (error) {
    console.warn("[tcgCatalogTracker] mark unlinked failed", {
      productId,
      cardId,
      error,
    });
  }
}
