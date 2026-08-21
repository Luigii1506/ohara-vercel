import { prisma } from "@/lib/prisma";

const HOUR_MS = 60 * 60 * 1000;

const CATALOG_WARN_HOURS = 10;
const CATALOG_STALE_HOURS = 18;
const RECONCILE_WARN_HOURS = 10;
const RECONCILE_STALE_HOURS = 18;
const RECONCILE_LAG_WARN_HOURS = 4;
const RECONCILE_LAG_STALE_HOURS = 8;

export type TcgCatalogHealthStatus = "healthy" | "warning" | "stale";

export type TcgCatalogHealth = {
  status: TcgCatalogHealthStatus;
  lastCatalogSyncAt: string | null;
  lastGapRunAt: string | null;
  catalogAgeHours: number | null;
  gapAgeHours: number | null;
  gapLagHours: number | null;
  catalogItemCount: number;
  openGapCount: number;
  issues: string[];
};

function hoursSince(value: Date | null) {
  if (!value) return null;
  return Number(((Date.now() - value.getTime()) / HOUR_MS).toFixed(2));
}

export async function getTcgCatalogHealth(): Promise<TcgCatalogHealth> {
  const [catalogAggregate, lastGapRun, catalogItemCount, openGapCount] =
    await Promise.all([
      prisma.tcgCatalogProduct.aggregate({
        _max: { lastSyncedAt: true },
      }),
      prisma.catalogGap.findFirst({
        orderBy: { lastSeenAt: "desc" },
        select: { lastSeenAt: true },
      }),
      prisma.tcgCatalogProduct.count({
        where: { productStatus: { not: "removed" } },
      }),
      prisma.catalogGap.count({
        where: { resolved: false, ignored: false },
      }),
    ]);

  const lastCatalogSyncDate = catalogAggregate._max.lastSyncedAt ?? null;
  const lastGapRunDate = lastGapRun?.lastSeenAt ?? null;

  const catalogAgeHours = hoursSince(lastCatalogSyncDate);
  const gapAgeHours = hoursSince(lastGapRunDate);
  const gapLagHours =
    lastCatalogSyncDate && lastGapRunDate
      ? Number(
          (
            (lastCatalogSyncDate.getTime() - lastGapRunDate.getTime()) /
            HOUR_MS
          ).toFixed(2)
        )
      : null;

  const issues: string[] = [];

  if (!lastCatalogSyncDate) {
    issues.push("El mirror local de TCGplayer nunca se ha sincronizado.");
  } else if (catalogAgeHours !== null && catalogAgeHours >= CATALOG_STALE_HOURS) {
    issues.push(
      `El mirror local lleva ${catalogAgeHours.toFixed(1)}h sin sincronizarse.`
    );
  } else if (catalogAgeHours !== null && catalogAgeHours >= CATALOG_WARN_HOURS) {
    issues.push(
      `El mirror local ya tiene ${catalogAgeHours.toFixed(1)}h de antigüedad.`
    );
  }

  if (!lastGapRunDate) {
    issues.push("La reconciliación de catálogo todavía no ha corrido.");
  } else if (gapAgeHours !== null && gapAgeHours >= RECONCILE_STALE_HOURS) {
    issues.push(
      `La reconciliación lleva ${gapAgeHours.toFixed(1)}h sin actualizarse.`
    );
  } else if (gapAgeHours !== null && gapAgeHours >= RECONCILE_WARN_HOURS) {
    issues.push(
      `La reconciliación ya tiene ${gapAgeHours.toFixed(1)}h de antigüedad.`
    );
  }

  if (gapLagHours !== null && gapLagHours >= RECONCILE_LAG_STALE_HOURS) {
    issues.push(
      `La reconciliación está ${gapLagHours.toFixed(1)}h detrás del último sync del mirror.`
    );
  } else if (gapLagHours !== null && gapLagHours >= RECONCILE_LAG_WARN_HOURS) {
    issues.push(
      `La reconciliación está ${gapLagHours.toFixed(1)}h detrás del último sync del mirror.`
    );
  }

  const status: TcgCatalogHealthStatus =
    !lastCatalogSyncDate ||
    !lastGapRunDate ||
    (catalogAgeHours !== null && catalogAgeHours >= CATALOG_STALE_HOURS) ||
    (gapAgeHours !== null && gapAgeHours >= RECONCILE_STALE_HOURS) ||
    (gapLagHours !== null && gapLagHours >= RECONCILE_LAG_STALE_HOURS)
      ? "stale"
      : issues.length > 0
        ? "warning"
        : "healthy";

  return {
    status,
    lastCatalogSyncAt: lastCatalogSyncDate?.toISOString() ?? null,
    lastGapRunAt: lastGapRunDate?.toISOString() ?? null,
    catalogAgeHours,
    gapAgeHours,
    gapLagHours,
    catalogItemCount,
    openGapCount,
    issues,
  };
}
