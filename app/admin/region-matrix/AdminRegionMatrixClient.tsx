"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Layers3 } from "lucide-react";
import RegionVariantMatrix from "@/components/card-details/RegionVariantMatrix";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useUser } from "@/app/context/UserContext";

type AdminCodeCard = {
  id: string;
  code: string;
  name: string;
  region?: string | null;
  isFirstEdition: boolean;
  alternateArt?: string | null;
  setCode?: string | null;
};

export default function AdminRegionMatrixClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, loading: userLoading } = useUser();
  const initialCode = searchParams.get("code")?.trim().toUpperCase() || "";

  const [searchCode, setSearchCode] = useState(initialCode);
  const [resolvedCode, setResolvedCode] = useState(initialCode);
  const [cards, setCards] = useState<AdminCodeCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && role !== "ADMIN") {
      router.push("/unauthorized");
    }
  }, [role, router, userLoading]);

  useEffect(() => {
    setSearchCode(initialCode);
    setResolvedCode(initialCode);
  }, [initialCode]);

  useEffect(() => {
    if (!resolvedCode) {
      setCards([]);
      setSelectedCardId("");
      return;
    }

    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/admin/cards/by-code/${encodeURIComponent(resolvedCode)}`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          throw new Error("No se encontraron cartas para ese código.");
        }
        const payload = (await response.json()) as AdminCodeCard[];
        if (!active) return;
        setCards(payload);
        const preferred =
          payload.find((card) => card.isFirstEdition) ??
          payload.find((card) => !card.alternateArt?.trim()) ??
          payload[0];
        setSelectedCardId(preferred?.id ?? "");
      } catch (err) {
        console.error(err);
        if (!active) return;
        setCards([]);
        setSelectedCardId("");
        setError("No se pudo resolver ese código.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [resolvedCode]);

  const selectedCard = useMemo(
    () => cards.find((card) => String(card.id) === String(selectedCardId)) ?? null,
    [cards, selectedCardId]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextCode = searchCode.trim().toUpperCase();
    if (!nextCode) return;
    router.replace(`/admin/region-matrix?code=${encodeURIComponent(nextCode)}`);
  };

  return (
    <div className="min-h-screen bg-[#f7f2e6]">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Admin Tool
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Region Variant Explorer
              </h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-600">
                Compara un mismo código entre regiones, detecta exclusivas reales
                vs repetidas y corrige la metadata sin salir de la vista.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/admin/region-alternates">
                <Button type="button" variant="outline" className="gap-2">
                  <Layers3 className="h-4 w-4" />
                  Region Alternates
                </Button>
              </Link>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 xl:flex-row xl:items-center"
          >
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchCode}
                onChange={(event) => setSearchCode(event.target.value.toUpperCase())}
                placeholder="Busca un código exacto, por ejemplo OP01-001"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </div>
            <Button type="submit" className="h-11 rounded-2xl px-5">
              Search
            </Button>
          </form>

          {resolvedCode ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-slate-900 text-white hover:bg-slate-900">
                {resolvedCode}
              </Badge>
              {selectedCard ? (
                <>
                  <Badge variant="outline" className="border-slate-300 bg-white">
                    {selectedCard.name}
                  </Badge>
                  <Badge variant="outline" className="border-slate-300 bg-white">
                    {cards.length} versiones cargadas
                  </Badge>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {cards.length > 1 ? (
          <Card className="rounded-[28px] border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Versiones detectadas
                </h2>
                <p className="text-xs text-slate-500">
                  Elige la carta inicial. La matriz se compacta por fila y región.
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
              {cards.map((card) => {
                const active = String(card.id) === String(selectedCardId);
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setSelectedCardId(String(card.id))}
                    className={`rounded-2xl border px-3 py-2 text-left transition ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">
                        {card.region || "Sin región"}
                      </span>
                      {card.isFirstEdition ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          Base
                        </Badge>
                      ) : null}
                    </div>
                    <p
                      className={`mt-1 line-clamp-2 text-xs ${
                        active ? "text-white/85" : "text-slate-600"
                      }`}
                    >
                      {card.alternateArt?.trim() || card.name}
                    </p>
                    <p
                      className={`mt-1 text-[11px] ${
                        active ? "text-white/65" : "text-slate-500"
                      }`}
                    >
                      {card.setCode || card.code}
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>
        ) : null}

        {loading ? (
          <Card className="rounded-[28px] border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-sm">
            Cargando versiones del código...
          </Card>
        ) : error ? (
          <Card className="rounded-[28px] border-rose-200 bg-rose-50 px-6 py-16 text-center text-sm text-rose-700 shadow-sm">
            {error}
          </Card>
        ) : selectedCardId ? (
          <RegionVariantMatrix
            cardId={selectedCardId}
            defaultExpanded
            collapsible={false}
            subtitle="Region Matrix"
            title="Comparación compacta por región"
            className="overflow-hidden rounded-[28px] bg-white shadow-sm"
          />
        ) : (
          <Card className="rounded-[28px] border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-sm">
            Busca un código para empezar.
          </Card>
        )}
      </div>
    </div>
  );
}
