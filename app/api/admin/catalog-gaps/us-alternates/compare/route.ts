export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tcgplayerFetch } from "@/lib/services/tcgplayerClient";
import { findBestSetMatch, resolveTcgSetTargets } from "@/lib/services/catalogSetResolver";
import { fetchLimitlessCardComparison } from "@/lib/services/limitlessCardData";

type SetOption = {
  setId: number | null;
  title: string;
  code: string | null;
  sources: string[];
  matchedBy: string | null;
};

function mergeSetOptions(
  options: SetOption[],
  next: SetOption
) {
  const existing = options.find(
    (option) =>
      option.setId === next.setId &&
      option.title.trim().toLowerCase() === next.title.trim().toLowerCase()
  );

  if (existing) {
    existing.sources = Array.from(new Set(existing.sources.concat(next.sources)));
    existing.matchedBy = existing.matchedBy ?? next.matchedBy;
    existing.code = existing.code ?? next.code;
    return;
  }

  options.push(next);
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const productId = Number(sp.get("productId") ?? "");
    const codeFromQuery = (sp.get("code") ?? "").trim().toUpperCase();

    if (!Number.isFinite(productId)) {
      return NextResponse.json({ error: "productId inválido" }, { status: 400 });
    }

    const prod = await prisma.tcgCatalogProduct.findUnique({
      where: { productId },
      select: {
        productId: true,
        number: true,
        name: true,
        rarity: true,
        cardType: true,
        url: true,
        metadata: true,
      },
    });
    if (!prod) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const code = codeFromQuery || prod.number?.toUpperCase();
    if (!code) {
      return NextResponse.json({ error: "El producto no tiene code" }, { status: 422 });
    }

    const groupId = (prod.metadata as any)?.groupId ?? null;
    let groupName: string | null = null;
    let groupAbbreviation: string | null = null;
    if (groupId) {
      try {
        const res: any = await tcgplayerFetch(`/catalog/groups/${groupId}`);
        const group = res?.results?.[0] ?? res?.Results?.[0];
        groupName = group?.name ?? null;
        groupAbbreviation = group?.abbreviation ?? null;
      } catch {
        groupName = null;
        groupAbbreviation = null;
      }
    }

    const [tcgTargets, limitless] = await Promise.all([
      resolveTcgSetTargets(groupName, groupAbbreviation, prod.name ?? null),
      fetchLimitlessCardComparison(code, productId),
    ]);

    const matchedLimitlessSet = limitless.matchedPrint
      ? await findBestSetMatch(limitless.matchedPrint.title, null)
      : null;

    const setOptions: SetOption[] = [];
    tcgTargets.forEach((target) =>
      mergeSetOptions(setOptions, {
        setId: target.setId,
        title: target.title,
        code: target.code,
        sources: ["tcgplayer"],
        matchedBy: target.matchedBy,
      })
    );

    if (matchedLimitlessSet) {
      mergeSetOptions(setOptions, {
        setId: matchedLimitlessSet.setId,
        title: matchedLimitlessSet.title,
        code: matchedLimitlessSet.code,
        sources: ["limitless"],
        matchedBy: matchedLimitlessSet.matchedBy,
      });
    }

    setOptions.sort((a, b) => {
      const score = (option: SetOption) =>
        Number(option.sources.includes("limitless")) * 4 +
        Number(option.sources.includes("tcgplayer")) * 2 +
        Number(option.setId != null);
      return score(b) - score(a) || a.title.localeCompare(b.title);
    });

    return NextResponse.json({
      productId,
      code,
      productName: prod.name,
      tcgplayer: {
        groupName,
        groupAbbreviation,
        suggestedSets: tcgTargets,
      },
      limitless: {
        cardUrl: limitless.cardUrl,
        pageTitle: limitless.pageTitle,
        matchedPrint: matchedLimitlessSet
          ? {
              ...matchedLimitlessSet,
              productId: limitless.matchedPrint?.productId ?? null,
              tcgUrl: limitless.matchedPrint?.tcgUrl ?? null,
              usdPrice: limitless.matchedPrint?.usdPrice ?? null,
            }
          : null,
        prints: limitless.prints,
      },
      setOptions,
      conflicts: {
        set: matchedLimitlessSet
          ? tcgTargets.length > 0 &&
            !tcgTargets.some(
              (target) =>
                target.title.trim().toLowerCase() ===
                matchedLimitlessSet.title.trim().toLowerCase()
            )
          : false,
      },
    });
  } catch (error: any) {
    console.error("[us-alternates/compare] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "No se pudo comparar fuentes" },
      { status: 500 }
    );
  }
}
