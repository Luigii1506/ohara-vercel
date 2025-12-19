"use client";

import { useEffect, useMemo, useState } from "react";
import MultiSelect, {
  Option as MultiSelectOption,
} from "@/components/MultiSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, ImageIcon, Layers } from "lucide-react";

interface AdminSet {
  id: number;
  title: string;
  code?: string | null;
  image?: string | null;
  releaseDate?: string;
  isOpen?: boolean;
}

interface VisualizerCard {
  id: number;
  name: string;
  code: string;
  src: string;
  imageKey?: string | null;
  category?: string | null;
  rarity?: string | null;
  alternateArt?: string | null;
  cost?: string | null;
  power?: string | null;
  attribute?: string | null;
}

type SetCardsState = {
  cards: VisualizerCard[];
  loading: boolean;
  error?: string;
};

const FALLBACK_IMAGE = "/assets/images/backcard.webp";
const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL || "https://images.oharatcg.com";

export default function SetVisualizerPage() {
  const [sets, setSets] = useState<AdminSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(true);
  const [setsError, setSetsError] = useState<string | null>(null);
  const [selectedSetIds, setSelectedSetIds] = useState<string[]>([]);
  const [setCards, setSetCards] = useState<Record<string, SetCardsState>>({});

  useEffect(() => {
    const fetchSets = async () => {
      try {
        setSetsLoading(true);
        const response = await fetch("/api/admin/sets");
        if (!response.ok) {
          throw new Error("Error al cargar los sets");
        }
        const data = (await response.json()) as AdminSet[];
        setSets(data);
      } catch (error) {
        console.error("Error fetching sets:", error);
        setSetsError(
          error instanceof Error ? error.message : "Error desconocido"
        );
      } finally {
        setSetsLoading(false);
      }
    };

    fetchSets();
  }, []);

  useEffect(() => {
    setSetCards((prev) => {
      const next: Record<string, SetCardsState> = {};
      selectedSetIds.forEach((id) => {
        if (prev[id]) {
          next[id] = prev[id];
        }
      });
      return next;
    });
  }, [selectedSetIds]);

  useEffect(() => {
    selectedSetIds.forEach((id) => {
      if (!setCards[id]) {
        fetchCardsBySet(Number(id));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSetIds, setCards]);

  const setOptions: MultiSelectOption[] = useMemo(() => {
    return sets.map((set) => ({
      value: String(set.id),
      label: set.code ? `${set.title} (${set.code})` : set.title,
    }));
  }, [sets]);

  const fetchCardsBySet = async (setId: number) => {
    const key = String(setId);
    setSetCards((prev) => ({
      ...prev,
      [key]: {
        cards: prev[key]?.cards ?? [],
        loading: true,
        error: undefined,
      },
    }));

    try {
      const response = await fetch(`/api/admin/cards/by-set-id/${setId}`);
      if (!response.ok) {
        throw new Error("Error al cargar las cartas del set");
      }
      const data = (await response.json()) as VisualizerCard[];

      setSetCards((prev) => ({
        ...prev,
        [key]: {
          cards: data,
          loading: false,
        },
      }));
    } catch (error) {
      console.error(`Error fetching cards for set ${setId}:`, error);
      setSetCards((prev) => ({
        ...prev,
        [key]: {
          cards: prev[key]?.cards ?? [],
          loading: false,
          error: error instanceof Error ? error.message : "Error desconocido",
        },
      }));
    }
  };

  const handleRefreshSet = (setId: string) => {
    fetchCardsBySet(Number(setId));
  };

  const selectedSetsMetadata = useMemo(() => {
    const lookup: Record<string, AdminSet> = {};
    sets.forEach((set) => {
      lookup[String(set.id)] = set;
    });
    return lookup;
  }, [sets]);

  const resolveImageSrc = (card: VisualizerCard) => {
    if (card.src) {
      return card.src;
    }
    if (card.imageKey) {
      return `${WORKER_URL}/cards/${card.imageKey}.webp`;
    }
    return FALLBACK_IMAGE;
  };

  const renderCard = (card: VisualizerCard) => {
    const imageSrc = resolveImageSrc(card);

    return (
      <div
        key={card.id}
        className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-100">
          <img
            src={imageSrc}
            alt={card.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
            }}
          />
          {card.category ? (
            <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white">
              {card.category}
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2 flex-col">
            <div className="flex flex-col">
              <p className="text-sm font-semibold text-gray-900">{card.name}</p>
              <p className="text-xs font-mono text-gray-500">{card.code}</p>
            </div>
            {card.alternateArt ? (
              <Badge variant="outline" className="text-xs">
                {card.alternateArt}
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-600">
            {card.rarity ? (
              <Badge
                variant="secondary"
                className="rounded-full border border-amber-100 bg-amber-50 text-amber-700"
              >
                {card.rarity}
              </Badge>
            ) : null}
            {card.cost ? (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                Coste: {card.cost}
              </span>
            ) : null}
            {card.power ? (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                Power: {card.power}
              </span>
            ) : null}
            {card.attribute ? (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                {card.attribute}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderSetSection = (setId: string) => {
    const state = setCards[setId];
    const setInfo = selectedSetsMetadata[setId];
    const title = setInfo?.title || `Set ${setId}`;
    const releaseDate = setInfo?.releaseDate
      ? new Date(setInfo.releaseDate).toLocaleDateString()
      : null;

    return (
      <section
        key={setId}
        className="rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-sm"
      >
        <div className="flex flex-col gap-4 border-b border-gray-100 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Layers className="h-5 w-5 text-amber-600" />
              <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
              <span>
                {setInfo?.code ? `Código: ${setInfo.code}` : "Sin código"}
              </span>
              {releaseDate ? (
                <span>
                  Lanzamiento:{" "}
                  <strong className="font-semibold text-gray-800">
                    {releaseDate}
                  </strong>
                </span>
              ) : null}
              {state?.cards ? (
                <span>
                  Cartas:{" "}
                  <strong className="font-semibold text-gray-800">
                    {state.cards.length}
                  </strong>
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {setInfo?.isOpen ? (
              <Badge className="bg-emerald-100 text-emerald-800">
                Set Activo
              </Badge>
            ) : (
              <Badge variant="outline" className="text-gray-600">
                Cerrado
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRefreshSet(setId)}
              disabled={state?.loading}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${state?.loading ? "animate-spin" : ""}`}
              />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="mt-6">
          {state?.loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {[...Array(4)].map((_, index) => (
                <div
                  key={`${setId}-skeleton-${index}`}
                  className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white/70 p-3"
                >
                  <Skeleton className="h-40 w-full rounded-xl" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : state?.error ? (
            <div className="flex items-center gap-3 rounded-lg border border-red-100 bg-red-50/80 p-4 text-sm text-red-700">
              <span>⚠️</span>
              <p>{state.error}</p>
            </div>
          ) : state?.cards?.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {state.cards.map((card) => renderCard(card))}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/70 p-4 text-sm text-gray-600">
              <ImageIcon className="h-4 w-4" />
              <p>No se encontraron cartas para este set.</p>
            </div>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#f9f4eb] via-[#f0e1ca] to-[#f9f4eb] px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-amber-100 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-widest text-amber-600">
                Herramientas de administración
              </p>
              <h1 className="mt-1 text-3xl font-bold text-gray-900">
                Set Visualizer
              </h1>
              <p className="mt-2 max-w-2xl text-gray-600">
                Selecciona uno o varios sets para visualizar todas las cartas
                asociadas. Esta vista es ideal para validar contenido, revisar
                ilustraciones y verificar que cada set esté completo.
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-gray-200 bg-white/90 p-5 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Seleccionar sets
                </h2>
                <p className="text-sm text-gray-600">
                  Puedes elegir múltiples sets para compararlos o revisarlos en
                  un solo lugar.
                </p>
              </div>
              <Badge variant="outline" className="text-gray-600">
                {selectedSetIds.length} seleccionado
                {selectedSetIds.length === 1 ? "" : "s"}
              </Badge>
            </div>

            {setsLoading ? (
              <Skeleton className="h-12 w-full rounded-xl" />
            ) : setsError ? (
              <div className="rounded-lg border border-red-200 bg-red-50/70 p-4 text-sm text-red-700">
                {setsError}
              </div>
            ) : (
              <MultiSelect
                options={setOptions}
                selected={selectedSetIds}
                setSelected={setSelectedSetIds}
                buttonLabel="Elige los sets a visualizar"
                searchPlaceholder="Busca por nombre..."
                isSearchable
                isSolid
                isFullWidth
                displaySelectedAs={(values) =>
                  values.length
                    ? `${values.length} set${
                        values.length === 1 ? "" : "s"
                      } seleccionado${values.length === 1 ? "" : "s"}`
                    : "Elige los sets a visualizar"
                }
              />
            )}
          </div>
        </section>

        {selectedSetIds.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white/60 p-8 text-center text-gray-600">
            Selecciona al menos un set para visualizar sus cartas.
          </div>
        ) : (
          <div className="space-y-8">
            {selectedSetIds.map((id) => renderSetSection(id))}
          </div>
        )}
      </div>
    </div>
  );
}
