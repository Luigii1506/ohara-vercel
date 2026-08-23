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
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { REGION_OPTIONS } from "@/lib/regions";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";

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
            <div className="space-y-4">
              {data.rows.map((row) => (
                <section
                  key={row.key}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-900">
                          {row.label}
                        </h4>
                        {row.key === "base" ? (
                          <Badge className="bg-slate-900 text-white hover:bg-slate-900">
                            Base
                          </Badge>
                        ) : null}
                        {row.exclusiveToSingleRegion ? (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                            Exclusiva visual
                          </Badge>
                        ) : null}
                        {row.repeatedAcrossRegions ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            Repetida
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Presente en {row.presentRegions.length} región
                        {row.presentRegions.length === 1 ? "" : "es"}:{" "}
                        {row.presentRegions.map(formatRegionLabel).join(", ")}
                      </p>
                    </div>
                  </div>

                  <div
                    className="grid gap-3 p-3"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(
                        1,
                        Math.min(data.regions.length, 4)
                      )}, minmax(0, 1fr))`,
                    }}
                  >
                    {data.regions.map((region) => {
                      const cards = row.cardsByRegion[region] ?? [];
                      return (
                        <div
                          key={`${row.key}-${region}`}
                          className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-2"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
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
                            <div className="flex min-h-[132px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white px-3 text-center text-xs text-slate-400">
                              Sin carta en esta región
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {cards.map((card) => {
                                const isSaving = Boolean(savingCardIds[card.id]);
                                return (
                                  <div
                                    key={card.id}
                                    className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                                  >
                                    <div className="relative aspect-[0.72] w-full bg-slate-100">
                                      <Image
                                        src={resolveImageSrc(card)}
                                        alt={`${card.code} ${card.name}`}
                                        fill
                                        sizes="(max-width: 768px) 50vw, 20vw"
                                        className="object-cover"
                                      />
                                    </div>

                                    <div className="space-y-2 p-2">
                                      <div>
                                        <p className="text-xs font-semibold text-slate-900">
                                          {card.setCode || card.code}
                                        </p>
                                        <p className="line-clamp-2 text-[11px] text-slate-500">
                                          {card.alternateArt?.trim() ||
                                            card.alias?.trim() ||
                                            card.illustrator?.trim() ||
                                            card.name}
                                        </p>
                                      </div>

                                      <div className="flex flex-wrap gap-1">
                                        {card.isFirstEdition ? (
                                          <Badge
                                            variant="outline"
                                            className="border-slate-300 bg-slate-100 text-[10px]"
                                          >
                                            Base
                                          </Badge>
                                        ) : (
                                          <Badge
                                            variant="outline"
                                            className="border-slate-300 bg-slate-100 text-[10px]"
                                          >
                                            Alterna
                                          </Badge>
                                        )}
                                        {card.isRegionalExclusive ? (
                                          <Badge className="bg-amber-100 text-[10px] text-amber-800 hover:bg-amber-100">
                                            Exclusive
                                          </Badge>
                                        ) : null}
                                      </div>

                                      {isAdmin ? (
                                        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                          <div className="space-y-1">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                              Región
                                            </span>
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
                                              <SelectTrigger className="h-8 bg-white text-xs">
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
                                          </div>

                                          <div className="flex items-center justify-between gap-2">
                                            <div>
                                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                                Regional Exclusive
                                              </p>
                                              <p className="text-[11px] text-slate-500">
                                                Marca manual de exclusividad
                                              </p>
                                            </div>
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
                                        </div>
                                      ) : null}
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
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
