export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { REGION_OPTIONS } from "@/lib/regions";

type RowAccumulator = {
  key: string;
  label: string;
  order: number;
  cardsByRegion: Record<string, any[]>;
};

const REGION_ORDER = REGION_OPTIONS.map((option) => option.code);
const FALLBACK_REGION = "UNASSIGNED";

const resolveRegion = (region?: string | null) => region?.trim() || FALLBACK_REGION;

const normalizeText = (value?: string | null) =>
  value?.trim().replace(/\s+/g, " ") || "";

const buildFallbackRowKey = (card: {
  alternateArt?: string | null;
  illustrator?: string | null;
  alias?: string | null;
  setCode?: string | null;
  region?: string | null;
  id: number;
}) => {
  const alt = normalizeText(card.alternateArt);
  const illustrator = normalizeText(card.illustrator);
  const alias = normalizeText(card.alias);
  const setCode = normalizeText(card.setCode);
  // Cada región escanea y traduce sus propias alternas por su cuenta, así
  // que dos cartas de regiones distintas que digan literalmente lo mismo
  // (ej. "Alternate Art") no son necesariamente la misma carta — solo
  // sabemos que SON la misma si vienen curadas con variantGroupLinks. Sin
  // esa liga explícita, el fallback nunca debe cruzar regiones: si no,
  // una alterna exclusiva de Japón termina "emparejada" con una de China
  // o Taiwán que no tiene ninguna relación real con ella.
  const region = normalizeText(card.region).toLowerCase() || "unassigned";

  if (alt) return `fallback:${region}:alt:${alt.toLowerCase()}`;
  if (illustrator) return `fallback:${region}:illustrator:${illustrator.toLowerCase()}`;
  if (alias) return `fallback:${region}:alias:${alias.toLowerCase()}`;
  if (setCode) return `fallback:${region}:set:${setCode.toLowerCase()}`;
  return `fallback:card:${card.id}`;
};

const buildFallbackRowLabel = (card: {
  alternateArt?: string | null;
  illustrator?: string | null;
  alias?: string | null;
}) => {
  if (normalizeText(card.alternateArt)) return normalizeText(card.alternateArt);
  if (normalizeText(card.illustrator)) return normalizeText(card.illustrator);
  if (normalizeText(card.alias)) return normalizeText(card.alias);
  return "Alternate";
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cardId = Number(params.id);
    if (!Number.isFinite(cardId)) {
      return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
    }

    const selectedCard = await prisma.card.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        code: true,
        name: true,
        baseGroupLinks: {
          select: {
            groupId: true,
            group: {
              select: {
                id: true,
                canonicalName: true,
              },
            },
          },
        },
      },
    });

    if (!selectedCard) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const groupId = selectedCard.baseGroupLinks[0]?.groupId ?? null;

    const rawCards = await prisma.card.findMany({
      where: { code: selectedCard.code },
      orderBy: [
        { isFirstEdition: "desc" },
        { region: "asc" },
        { setCode: "asc" },
        { id: "asc" },
      ],
      select: {
        id: true,
        name: true,
        code: true,
        src: true,
        imageKey: true,
        region: true,
        language: true,
        isFirstEdition: true,
        alternateArt: true,
        illustrator: true,
        alias: true,
        setCode: true,
        isRegionalExclusive: true,
        baseCardId: true,
        disclaimer: true,
        sets: { select: { set: { select: { title: true } } } },
        variantGroupLinks: {
          select: {
            variantGroupId: true,
            variantGroup: {
              select: {
                id: true,
                alternateArt: true,
                illustrator: true,
                variantKey: true,
              },
            },
          },
        },
      },
    });

    // Alternas "Demo Version", impresiones pre-errata reemplazadas por una
    // reimpresión corregida, y cartas del set "Demo Deck" no son print real
    // que valga comparar entre regiones — filtrado en JS (no en el WHERE)
    // para no pisar el clásico gotcha de SQL: "col ILIKE ..." da NULL (no
    // false) cuando col es NULL, y eso se come filas de más bajo NOT/OR.
    const cards = rawCards.filter((card) => {
      if ((card.alternateArt ?? "").toLowerCase().includes("demo")) return false;
      if ((card.disclaimer ?? "").toLowerCase().includes("errata")) return false;
      if (
        card.sets.some((cs) =>
          (cs.set.title ?? "").toLowerCase().includes("demo deck")
        )
      )
        return false;
      return true;
    });

    const rows = new Map<string, RowAccumulator>();
    const regions = new Set<string>();

    // TC (Taiwan/HK) no es una región real de comparación — sus cartas base
    // son el mismo archivo/texto japonés que JP, republicado (ver
    // lib/regions.ts). No tiene sentido mostrarla como columna aparte en
    // esta comparación por región.
    const comparableCards = cards.filter((card) => card.region !== "TC");

    for (const card of comparableCards) {
      const linkedVariant = card.variantGroupLinks[0]?.variantGroup;
      const isBaseRow = card.isFirstEdition && !linkedVariant && !card.baseCardId;

      let rowKey = "base";
      let rowLabel = "Base";
      let rowOrder = 0;

      if (!isBaseRow) {
        if (linkedVariant) {
          rowKey = `variant:${linkedVariant.id}`;
          rowLabel =
            normalizeText(linkedVariant.alternateArt) ||
            normalizeText(linkedVariant.illustrator) ||
            normalizeText(linkedVariant.variantKey) ||
            "Alternate";
          rowOrder = linkedVariant.id;
        } else {
          rowKey = buildFallbackRowKey(card);
          rowLabel = buildFallbackRowLabel(card);
          rowOrder = 10_000 + card.id;
        }
      }

      if (!rows.has(rowKey)) {
        rows.set(rowKey, {
          key: rowKey,
          label: rowLabel,
          order: rowOrder,
          cardsByRegion: {},
        });
      }

      const region = resolveRegion(card.region);
      regions.add(region);

      const row = rows.get(rowKey)!;
      if (!row.cardsByRegion[region]) row.cardsByRegion[region] = [];
      row.cardsByRegion[region].push(card);
    }

    const discoveredRegions = Array.from(regions);
    const orderedRegions = [
      ...REGION_ORDER.filter((region) => discoveredRegions.includes(region)),
      ...discoveredRegions.filter((region) => !REGION_ORDER.includes(region)),
    ];

    const payloadRows = Array.from(rows.values())
      .sort((left, right) => {
        if (left.key === "base") return -1;
        if (right.key === "base") return 1;
        return left.order - right.order;
      })
      .map((row) => {
        const presentRegions = orderedRegions.filter(
          (region) => (row.cardsByRegion[region]?.length ?? 0) > 0
        );

        return {
          key: row.key,
          label: row.label,
          presentRegions,
          repeatedAcrossRegions: presentRegions.length > 1,
          exclusiveToSingleRegion: presentRegions.length === 1,
          cardsByRegion: orderedRegions.reduce<Record<string, any[]>>(
            (acc, region) => {
              acc[region] = row.cardsByRegion[region] ?? [];
              return acc;
            },
            {}
          ),
        };
      });

    return NextResponse.json(
      {
        cardId: selectedCard.id,
        code: selectedCard.code,
        name: selectedCard.name,
        canonicalName:
          selectedCard.baseGroupLinks[0]?.group?.canonicalName ??
          selectedCard.name,
        groupId,
        regions: orderedRegions,
        rows: payloadRows,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching region variants:", error);
    return NextResponse.json(
      { error: "Failed to load region variants." },
      { status: 500 }
    );
  }
}
