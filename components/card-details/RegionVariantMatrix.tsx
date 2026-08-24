"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp, RefreshCw, Star, Copy, Link2, Unlink } from "lucide-react";
import { REGION_OPTIONS } from "@/lib/regions";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";

const REGION_FLAGS: Record<string, string> = {
  US: "🇺🇸",
  JP: "🇯🇵",
  FR: "🇫🇷",
  KR: "🇰🇷",
  CN: "🇨🇳",
  TC: "🇹🇼",
};

type RegionVariantCard = {
  id: number;
  name: string;
  code: string;
  src: string;
  imageKey?: string | null;
  region?: string | null;
  language?: string | null;
  isFirstEdition: boolean;
  alternateArt?: string | null;
  illustrator?: string | null;
  alias?: string | null;
  setCode?: string | null;
  isRegionalExclusive: boolean;
  baseCardId?: number | null;
  variantGroupLinks?: { variantGroupId: number }[];
};

type RegionVariantRow = {
  key: string;
  label: string;
  presentRegions: string[];
  repeatedAcrossRegions: boolean;
  exclusiveToSingleRegion: boolean;
  cardsByRegion: Record<string, RegionVariantCard[]>;
};

type RegionVariantResponse = {
  cardId: number;
  code: string;
  name: string;
  canonicalName: string;
  groupId: number | null;
  regions: string[];
  rows: RegionVariantRow[];
};

type Props = {
  cardId?: string | number;
  defaultExpanded?: boolean;
  collapsible?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
};

const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL || "https://images.oharatcg.com";
const FALLBACK_IMAGE = "/assets/images/backcard.webp";
const UNASSIGNED_REGION = "UNASSIGNED";

const resolveImageSrc = (card: RegionVariantCard) => {
  if (card.src) return card.src;
  if (card.imageKey) return `${WORKER_URL}/cards/${card.imageKey}.webp`;
  return FALLBACK_IMAGE;
};

const regionLabelMap = new Map(
  REGION_OPTIONS.map((option) => [option.code, option.label])
);

const formatRegionLabel = (region: string) =>
  region === UNASSIGNED_REGION ? "Sin región" : regionLabelMap.get(region) || region;

// Regiones "legacy" que quedaron sueltas en la base (ej. "CN-S") y que no
// son una de las 6 regiones reales del selector — se muestran igual (para
// poder encontrarlas y limpiarlas) pero marcadas como no estándar.
const isNonCanonicalRegion = (region: string) =>
  region !== UNASSIGNED_REGION && !regionLabelMap.has(region);

export default function RegionVariantMatrix({
  cardId,
  defaultExpanded = false,
  collapsible = true,
  title = "Comparar alternas y exclusivas por región",
  subtitle = "Region Matrix",
  className = "",
}: Props) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RegionVariantResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingCardIds, setSavingCardIds] = useState<Record<number, boolean>>({});

  const load = async () => {
    if (!cardId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cards/${cardId}/region-variants`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("No se pudo cargar la matriz regional.");
      }
      const payload = (await response.json()) as RegionVariantResponse;
      setData(payload);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la información regional.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!expanded || !cardId) return;
    void load();
  }, [expanded, cardId]);

  const totalCards = useMemo(
    () =>
      data?.rows.reduce((sum, row) => {
        return (
          sum +
          Object.values(row.cardsByRegion).reduce(
            (inner, cards) => inner + cards.length,
            0
          )
        );
      }, 0) ?? 0,
    [data]
  );
  // Sin tope artificial: si hay 6 regiones reales (o alguna región legacy
  // suelta como "CN-S") cada una se queda con su propia columna en vez de
  // desbordar a una segunda fila y apachurrar todo lo demás.
  const resolvedColumns = Math.max(1, data?.regions.length ?? 1);

  const updateCard = async (
    targetCardId: number,
    patch: Partial<Pick<RegionVariantCard, "region" | "isRegionalExclusive">>
  ) => {
    setSavingCardIds((prev) => ({ ...prev, [targetCardId]: true }));
    try {
      const response = await fetch(`/api/admin/cards/${targetCardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        throw new Error("No se pudo guardar la carta.");
      }
      showSuccessToast("Carta actualizada");
      await load();
    } catch (err) {
      console.error(err);
      showErrorToast("Error al actualizar la carta");
    } finally {
      setSavingCardIds((prev) => ({ ...prev, [targetCardId]: false }));
    }
  };

  // Mueve UNA carta a la fila (= alterna) a la que realmente corresponde,
  // en un solo paso — sin tener que re-seleccionar a todas las que ya
  // estaban bien vinculadas. Si la fila destino ya es un CardVariantGroup
  // (viene de otra región ya reconocida), la carta se suma ahí; si la fila
  // destino todavía es una carta "suelta" (exclusiva sin grupo), se crea el
  // grupo en ese momento con ambas.
  const moveCardToRow = async (card: RegionVariantCard, targetRow: RegionVariantRow) => {
    if (!data || card.isFirstEdition) return;
    setSavingCardIds((prev) => ({ ...prev, [card.id]: true }));
    try {
      const targetCards = Object.values(targetRow.cardsByRegion).flat();
      const anchor = targetCards.find((c) => c.variantGroupLinks?.length) ?? targetCards[0];
      if (!anchor) return;

      let variantGroupId = anchor.variantGroupLinks?.[0]?.variantGroupId ?? null;
      if (variantGroupId == null) {
        if (data.groupId == null) {
          showErrorToast(
            "Esta carta no tiene un grupo base entre regiones todavía — no se puede vincular."
          );
          return;
        }
        const response = await fetch("/api/admin/card-variant-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseGroupId: data.groupId, cardId: anchor.id }),
        });
        if (!response.ok) throw new Error("No se pudo crear el grupo de variante.");
        const created = (await response.json()) as { variantGroupId: number };
        variantGroupId = created.variantGroupId;
      }

      const response = await fetch(
        `/api/admin/card-variant-groups/${variantGroupId}/link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: card.id }),
        }
      );
      if (!response.ok) throw new Error("No se pudo vincular la carta.");

      showSuccessToast("Carta movida a su alterna correspondiente.");
      await load();
    } catch (err) {
      console.error(err);
      showErrorToast(err instanceof Error ? err.message : "Error al vincular.");
    } finally {
      setSavingCardIds((prev) => ({ ...prev, [card.id]: false }));
    }
  };

  const unlinkCard = async (card: RegionVariantCard) => {
    const variantGroupId = card.variantGroupLinks?.[0]?.variantGroupId;
    if (!variantGroupId) return;
    setSavingCardIds((prev) => ({ ...prev, [card.id]: true }));
    try {
      const response = await fetch(
        `/api/admin/card-variant-groups/${variantGroupId}/unlink`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: card.id }),
        }
      );
      if (!response.ok) throw new Error("No se pudo desvincular.");
      showSuccessToast("Carta desvinculada.");
      await load();
    } catch (err) {
      console.error(err);
      showErrorToast("Error al desvincular.");
    } finally {
      setSavingCardIds((prev) => ({ ...prev, [card.id]: false }));
    }
  };

  if (!cardId) return null;

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-slate-50/80 ${className}`}
    >
      {collapsible ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {subtitle}
            </p>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </button>
      ) : (
        <div className="border-b border-slate-200 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {subtitle}
          </p>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        </div>
      )}

      {expanded ? (
        <div className="border-t border-slate-200 px-3 pb-3 pt-3 sm:px-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-slate-300 bg-white">
                {data?.code ?? "Cargando..."}
              </Badge>
              {data ? (
                <>
                  <Badge variant="outline" className="border-slate-300 bg-white">
                    {data.rows.length} filas
                  </Badge>
                  <Badge variant="outline" className="border-slate-300 bg-white">
                    {totalCards} cartas
                  </Badge>
                </>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>


          {loading && !data ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Cargando matriz regional...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50 px-4 py-8 text-center text-sm text-rose-700">
              {error}
            </div>
          ) : data ? (
            <div className="space-y-3">
              <div
                className="hidden gap-2 xl:grid"
                style={{
                  gridTemplateColumns: `minmax(180px, 220px) repeat(${resolvedColumns}, minmax(0, 1fr))`,
                }}
              >
                <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Variant Row
                </div>
                {data.regions.map((region) => {
                  const nonCanonical = isNonCanonicalRegion(region);
                  return (
                    <div
                      key={`header-${region}`}
                      className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] ${
                        nonCanonical
                          ? "border-dashed border-slate-300 bg-slate-50 text-slate-400"
                          : "border-slate-200 bg-slate-100 text-slate-500"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="text-base leading-none">
                          {REGION_FLAGS[region] ?? "🏳️"}
                        </span>
                        {formatRegionLabel(region)}
                      </span>
                      {nonCanonical ? (
                        <span className="text-[9px] font-medium normal-case tracking-normal text-slate-400">
                          región no estándar
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {data.rows.map((row) => {
                // El color de acento es la señal principal de jerarquía:
                // negro = base (el ancla), ámbar = exclusiva de una sola
                // región (posible candidata a vincular), verde = ya
                // reconocida como el mismo print repetido entre regiones.
                const accent =
                  row.key === "base"
                    ? "border-l-slate-900"
                    : row.exclusiveToSingleRegion
                      ? "border-l-amber-400"
                      : "border-l-emerald-400";
                return (
                <section
                  key={row.key}
                  className={`grid gap-2 rounded-2xl border-l-4 pl-1 xl:grid-cols-[minmax(180px,220px)_1fr] ${accent}`}
                >
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      {row.key === "base" ? (
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                          B
                        </span>
                      ) : row.exclusiveToSingleRegion ? (
                        <Star className="h-4 w-4 flex-shrink-0 fill-amber-500 text-amber-500" />
                      ) : (
                        <Copy className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                      )}
                      <h4
                        className={`text-sm font-semibold ${
                          row.key === "base" ? "text-slate-950" : "text-slate-900"
                        }`}
                      >
                        {row.label}
                      </h4>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {row.exclusiveToSingleRegion ? (
                        <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                          Exclusiva
                        </Badge>
                      ) : null}
                      {row.repeatedAcrossRegions ? (
                        <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          <Copy className="h-3 w-3" />
                          Repetida
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-slate-500">
                      {row.presentRegions
                        .map((region) => `${REGION_FLAGS[region] ?? ""} ${formatRegionLabel(region)}`.trim())
                        .join(" · ") || "Sin regiones"}
                    </p>
                  </div>

                  <div
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${resolvedColumns}, minmax(0, 1fr))`,
                    }}
                  >
                    {data.regions.map((region) => {
                      const cards = row.cardsByRegion[region] ?? [];
                      return (
                        <div
                          key={`${row.key}-${region}`}
                          className={`min-w-0 rounded-2xl border p-2 shadow-sm ${
                            cards.length === 0
                              ? "border-dashed border-slate-200 bg-slate-50/60"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="mb-2 flex items-center justify-between gap-2 xl:hidden">
                            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                              <span className="text-sm leading-none">
                                {REGION_FLAGS[region] ?? "🏳️"}
                              </span>
                              {formatRegionLabel(region)}
                            </span>
                            <Badge
                              variant="outline"
                              className="border-slate-300 bg-white text-[10px]"
                            >
                              {cards.length}
                            </Badge>
                          </div>

                          {cards.length === 0 ? (
                            <div className="flex min-h-[132px] flex-col items-center justify-center gap-1.5 rounded-xl px-2 text-center">
                              <span className="text-xl leading-none opacity-25 grayscale">
                                {REGION_FLAGS[region] ?? "🏳️"}
                              </span>
                              <span className="text-[11px] font-medium text-slate-400">
                                No disponible
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {cards.map((card) => {
                                const isSaving = Boolean(savingCardIds[card.id]);
                                const linkedGroupId = card.variantGroupLinks?.[0]?.variantGroupId;
                                const linkTargets = data.rows.filter(
                                  (r) => r.key !== "base" && r.key !== row.key
                                );
                                return (
                                  <div
                                    key={card.id}
                                    className={`rounded-xl border p-2 transition ${
                                      card.isRegionalExclusive
                                        ? "border-amber-200 bg-amber-50/60"
                                        : "border-slate-200 bg-slate-50"
                                    }`}
                                  >
                                    <div className="flex flex-col gap-2">
                                      <div className="relative aspect-[5/7] w-full max-w-[200px] self-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                        <Image
                                          src={resolveImageSrc(card)}
                                          alt={`${card.code} ${card.name}`}
                                          fill
                                          sizes="220px"
                                          className="object-cover"
                                        />
                                        {linkedGroupId ? (
                                          <span
                                            title="Ya vinculada con otra(s) región(es) como el mismo print"
                                            className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow"
                                          >
                                            <Link2 className="h-2.5 w-2.5" />
                                          </span>
                                        ) : null}
                                      </div>

                                      <div className="flex min-w-0 flex-col gap-1.5">
                                        <p className="truncate text-[12px] font-semibold text-slate-900">
                                          {card.setCode || card.code}
                                        </p>
                                        <p className="line-clamp-2 text-[11px] leading-4 text-slate-500">
                                          {card.alternateArt?.trim() ||
                                            card.alias?.trim() ||
                                            card.illustrator?.trim() ||
                                            card.name}
                                        </p>

                                        <div className="flex flex-wrap items-center gap-1">
                                          <Badge
                                            variant="outline"
                                            className="border-slate-300 bg-white px-1.5 py-0 text-[10px]"
                                          >
                                            {card.isFirstEdition ? "Base" : "Alt"}
                                          </Badge>
                                          {card.isRegionalExclusive ? (
                                            <Badge className="gap-1 bg-amber-100 px-1.5 py-0 text-[10px] text-amber-800 hover:bg-amber-100">
                                              <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                                              Exclusive
                                            </Badge>
                                          ) : null}
                                          {linkedGroupId && isAdmin ? (
                                            <button
                                              type="button"
                                              onClick={() => void unlinkCard(card)}
                                              disabled={isSaving}
                                              title="Desvincular de las otras regiones"
                                              className="ml-auto flex items-center gap-0.5 rounded-full border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] text-slate-500 hover:border-rose-300 hover:text-rose-600"
                                            >
                                              <Unlink className="h-2.5 w-2.5" />
                                            </button>
                                          ) : null}
                                        </div>

                                        {isAdmin ? (
                                          <div className="flex flex-col gap-1.5 pt-1">
                                            <Select
                                              value={card.region?.trim() || UNASSIGNED_REGION}
                                              onValueChange={(value) =>
                                                void updateCard(card.id, {
                                                  region:
                                                    value === UNASSIGNED_REGION
                                                      ? null
                                                      : value,
                                                })
                                              }
                                              disabled={isSaving}
                                            >
                                              <SelectTrigger className="h-8 w-full min-w-0 bg-white px-2 text-[12px]">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value={UNASSIGNED_REGION}>
                                                  Sin región
                                                </SelectItem>
                                                {REGION_OPTIONS.map((option) => (
                                                  <SelectItem
                                                    key={option.code}
                                                    value={option.code}
                                                  >
                                                    {option.label}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>

                                            <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                                              <span className="text-[11px] font-medium text-slate-500">
                                                Exclusive
                                              </span>
                                              <Switch
                                                checked={card.isRegionalExclusive}
                                                onCheckedChange={(checked) =>
                                                  void updateCard(card.id, {
                                                    isRegionalExclusive: checked,
                                                  })
                                                }
                                                disabled={isSaving}
                                                aria-label="Toggle regional exclusive"
                                              />
                                            </div>

                                            {!card.isFirstEdition && linkTargets.length > 0 ? (
                                              <Select
                                                value=""
                                                onValueChange={(targetKey) => {
                                                  const target = linkTargets.find(
                                                    (r) => r.key === targetKey
                                                  );
                                                  if (target) void moveCardToRow(card, target);
                                                }}
                                                disabled={isSaving}
                                              >
                                                <SelectTrigger className="h-8 w-full min-w-0 gap-1 bg-white px-2 text-[12px]">
                                                  <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                                                  <SelectValue placeholder="Mover a su alterna..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {linkTargets.map((target) => (
                                                    <SelectItem key={target.key} value={target.key}>
                                                      {target.presentRegions
                                                        .map((rg) => REGION_FLAGS[rg] ?? "🏳️")
                                                        .join("")}{" "}
                                                      {target.label} ·{" "}
                                                      {target.repeatedAcrossRegions
                                                        ? "repetida"
                                                        : "exclusiva"}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            ) : null}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
