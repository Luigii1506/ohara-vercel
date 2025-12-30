"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import TournamentCard from "@/components/tournaments/TournamentCard";
import {
  Trophy,
  TrendingUp,
  Users,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
  LayoutList,
  LayoutGrid,
} from "lucide-react";

interface CardColor {
  color: string;
}

interface LeaderCard {
  id: number;
  name: string;
  code: string;
  src: string;
  imageKey: string | null;
  colors: CardColor[];
}

interface CardInDeck {
  id: number;
  name: string;
  code: string;
  src: string;
  imageKey: string | null;
  marketPrice: any;
  category: string;
  rarity: string | null;
  colors: CardColor[];
}

interface DeckCard {
  quantity: number;
  card: CardInDeck;
}

interface Deck {
  id: number;
  name: string;
  uniqueUrl: string;
  deckCards: DeckCard[];
}

interface TournamentDeck {
  id: number;
  playerName: string;
  standing: number | null;
  deckSourceUrl: string | null;
  archetypeName: string | null;
  deck: Deck | null;
  leaderCard: LeaderCard | null;
  totalPrice: string;
}

interface Tournament {
  id: number;
  type: "REGIONAL" | "CHAMPIONSHIP" | "TREASURE_CUP" | null;
  name: string;
  region: string | null;
  country: string | null;
  format: string | null;
  eventDate: string;
  playerCount: number | null;
  winnerName: string | null;
  tournamentUrl: string;
  source: {
    name: string;
    slug: string;
  };
  decks: TournamentDeck[];
}

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface TournamentsFilters {
  type: string;
  size: string;
  recency: string;
  winner: boolean;
  search: string;
}

interface TournamentsPage {
  tournaments: Tournament[];
  nextCursor: number | null;
  hasMore: boolean;
}

// Build query params helper
function buildTournamentParams(
  filters: TournamentsFilters,
  cursor: number | null
): string {
  const params = new URLSearchParams();
  params.set("limit", "15");

  if (cursor) {
    params.set("cursor", cursor.toString());
  }

  if (filters.type !== "all") {
    const typeMap: Record<string, string> = {
      regional: "REGIONAL",
      championship: "CHAMPIONSHIP",
      treasure: "TREASURE_CUP",
    };
    params.set("type", typeMap[filters.type] || filters.type);
  }

  if (filters.size !== "all") {
    params.set("minSize", filters.size);
  }

  if (filters.recency !== "all") {
    params.set("days", filters.recency);
  }

  if (filters.winner) {
    params.set("hasWinner", "true");
  }

  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }

  return params.toString();
}

const TournamentsClient: React.FC = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [recencyFilter, setRecencyFilter] = useState("all");
  const [winnerFilter, setWinnerFilter] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Debounce search term (400ms delay)
  const debouncedSearch = useDebounce(searchTerm, 400);

  // Ref for intersection observer
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Filters object for query key
  const filters: TournamentsFilters = useMemo(
    () => ({
      type: typeFilter,
      size: sizeFilter,
      recency: recencyFilter,
      winner: winnerFilter,
      search: debouncedSearch,
    }),
    [typeFilter, sizeFilter, recencyFilter, winnerFilter, debouncedSearch]
  );

  // React Query infinite query with caching
  const {
    data,
    isLoading,
    isFetchingNextPage: isLoadingMore,
    hasNextPage: hasMore,
    fetchNextPage: loadMore,
    error,
  } = useInfiniteQuery<
    TournamentsPage,
    Error,
    { pages: TournamentsPage[]; pageParams: (number | null)[] },
    readonly [string, TournamentsFilters],
    number | null
  >({
    queryKey: ["tournaments", filters] as const,
    queryFn: async ({ pageParam }) => {
      const queryString = buildTournamentParams(filters, pageParam);
      const res = await fetch(`/api/tournaments?${queryString}`);
      if (!res.ok) {
        throw new Error("Error al cargar torneos");
      }
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: null,
    staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh
    gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache
  });

  // Flatten all pages into single array
  const tournaments: Tournament[] = useMemo(() => {
    return data?.pages.flatMap((page) => page.tournaments) ?? [];
  }, [data]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !isLoading &&
          !isLoadingMore
        ) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadMore]);

  const typeFilters = [
    { key: "all", label: "Todos" },
    { key: "regional", label: "Regional" },
    { key: "championship", label: "Championship" },
    { key: "treasure", label: "Treasure Cup" },
  ];

  const sizeFilters = [
    { key: "all", label: "Cualquier tamaño" },
    { key: "32", label: "32+" },
    { key: "64", label: "64+" },
  ];

  const recencyFilters = [
    { key: "all", label: "Cualquier fecha" },
    { key: "30", label: "30 días" },
  ];

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    typeFilter !== "all" ||
    sizeFilter !== "all" ||
    recencyFilter !== "all" ||
    winnerFilter;

  const activeFilterCount =
    (typeFilter !== "all" ? 1 : 0) +
    (sizeFilter !== "all" ? 1 : 0) +
    (recencyFilter !== "all" ? 1 : 0) +
    (winnerFilter ? 1 : 0);

  // Stats (based on loaded tournaments)
  const totalDecks = tournaments.reduce(
    (sum, t) => sum + (t.decks?.length || 0),
    0
  );

  const archetypeStats = tournaments.reduce((map, tournament) => {
    tournament.decks?.forEach((deck) => {
      const key = deck.archetypeName || deck.leaderCard?.name || "Desconocido";
      const current = map.get(key) || { name: key, count: 0, wins: 0 };
      current.count += 1;
      if (deck.standing === 1) current.wins += 1;
      map.set(key, current);
    });
    return map;
  }, new Map<string, { name: string; count: number; wins: number }>());

  const topArchetypes = Array.from(archetypeStats.values())
    .map((stat) => ({
      ...stat,
      winRate: stat.count > 0 ? (stat.wins / stat.count) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const leaderStats = tournaments.reduce((map, tournament) => {
    tournament.decks?.forEach((deck) => {
      if (!deck.leaderCard?.code) return;
      const code = deck.leaderCard.code;
      const current = map.get(code) || {
        name: deck.leaderCard.name,
        code,
        count: 0,
        wins: 0,
      };
      current.count += 1;
      if (deck.standing === 1) current.wins += 1;
      map.set(code, current);
    });
    return map;
  }, new Map<string, { name: string; code: string; count: number; wins: number }>());

  const topLeaders = Array.from(leaderStats.values())
    .map((stat) => ({
      ...stat,
      winRate: stat.count > 0 ? (stat.wins / stat.count) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Clear filters handler
  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setTypeFilter("all");
    setSizeFilter("all");
    setRecencyFilter("all");
    setWinnerFilter(false);
  }, []);

  const formatDate = useCallback((date: string) => {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  const formatTypeLabel = useCallback((type: Tournament["type"]) => {
    switch (type) {
      case "REGIONAL":
        return "Regional";
      case "CHAMPIONSHIP":
        return "Championship";
      case "TREASURE_CUP":
        return "Treasure Cup";
      default:
        return "Open";
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 w-full overflow-auto">
      {/* Simple Header - Sticky only on desktop */}
      <div className="border-b border-slate-200 bg-white/95 backdrop-blur md:sticky md:top-0 md:z-20">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-amber-500" />
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Torneos
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 pb-6 pt-0 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Tournaments List */}
          <div>
            <div className="sticky top-0 z-10 -mx-4 mb-2 space-y-3 bg-slate-50 px-4 pb-3 pt-4 sm:-mx-6 sm:px-6 md:top-[73px] lg:-mx-8 lg:px-8">
              {/* Search + Filter Button Row */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar torneo, ciudad, formato o jugador"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Mobile Filter Button */}
                <button
                  onClick={() => setIsFilterOpen(true)}
                  className="relative flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 md:hidden"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only">Filtros</span>
                  {activeFilterCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

              {/* View Switch */}
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setViewMode("cards")}
                    className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                      viewMode === "cards"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Tarjetas
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                      viewMode === "table"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <LayoutList className="h-4 w-4" />
                    Tabla
                  </button>
                </div>
                <span className="text-xs text-slate-500">
                  {viewMode === "table" ? "Vista compacta" : "Vista visual"}
                </span>
              </div>

              {/* Desktop Filters - Hidden on mobile */}
              <div className="hidden space-y-3 md:block">
                <div>
                  <span className="text-xs font-semibold text-slate-500">
                    Tipo
                  </span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {typeFilters.map((filter) => {
                      const isActive = typeFilter === filter.key;
                      return (
                        <button
                          key={filter.key}
                          onClick={() => setTypeFilter(filter.key)}
                          className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                            isActive
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {filter.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-6">
                  <div>
                    <span className="text-xs font-semibold text-slate-500">
                      Tamaño
                    </span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {sizeFilters.map((filter) => {
                        const isActive = sizeFilter === filter.key;
                        return (
                          <button
                            key={filter.key}
                            onClick={() => setSizeFilter(filter.key)}
                            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                              isActive
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {filter.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-slate-500">
                      Fecha
                    </span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {recencyFilters.map((filter) => {
                        const isActive = recencyFilter === filter.key;
                        return (
                          <button
                            key={filter.key}
                            onClick={() => setRecencyFilter(filter.key)}
                            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                              isActive
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {filter.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-slate-500">
                      Otros
                    </span>
                    <div className="mt-1">
                      <button
                        onClick={() => setWinnerFilter((prev) => !prev)}
                        className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                          winnerFilter
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        Con ganador
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {isLoading
                    ? "Cargando..."
                    : `Mostrando ${tournaments.length} torneos${
                        hasMore ? "+" : ""
                      }`}
                </span>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Filter Drawer */}
            {isFilterOpen && (
              <div className="fixed inset-0 z-50 md:hidden">
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                  onClick={() => setIsFilterOpen(false)}
                />

                {/* Drawer */}
                <div className="absolute inset-x-0 bottom-0 max-h-[85vh] animate-slide-up overflow-y-auto rounded-t-3xl bg-white shadow-xl">
                  {/* Handle */}
                  <div className="sticky top-0 z-10 bg-white px-6 pb-2 pt-3">
                    <div className="mx-auto h-1 w-10 rounded-full bg-slate-300" />
                  </div>

                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 px-6 pb-4">
                    <h2 className="text-lg font-bold text-slate-900">
                      Filtros
                    </h2>
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Filter Sections */}
                  <div className="space-y-6 p-6">
                    {/* Tipo */}
                    <div>
                      <span className="text-sm font-semibold text-slate-700">
                        Tipo de torneo
                      </span>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {typeFilters.map((filter) => {
                          const isActive = typeFilter === filter.key;
                          return (
                            <button
                              key={filter.key}
                              onClick={() => setTypeFilter(filter.key)}
                              className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                                isActive
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {filter.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tamaño */}
                    <div>
                      <span className="text-sm font-semibold text-slate-700">
                        Tamaño del torneo
                      </span>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {sizeFilters.map((filter) => {
                          const isActive = sizeFilter === filter.key;
                          return (
                            <button
                              key={filter.key}
                              onClick={() => setSizeFilter(filter.key)}
                              className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                                isActive
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {filter.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Fecha */}
                    <div>
                      <span className="text-sm font-semibold text-slate-700">
                        Fecha
                      </span>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {recencyFilters.map((filter) => {
                          const isActive = recencyFilter === filter.key;
                          return (
                            <button
                              key={filter.key}
                              onClick={() => setRecencyFilter(filter.key)}
                              className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                                isActive
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {filter.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Otros */}
                    <div>
                      <span className="text-sm font-semibold text-slate-700">
                        Otros filtros
                      </span>
                      <div className="mt-3">
                        <button
                          onClick={() => setWinnerFilter((prev) => !prev)}
                          className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                            winnerFilter
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          Con ganador
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="sticky bottom-0 border-t border-slate-100 bg-white p-4">
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setTypeFilter("all");
                          setSizeFilter("all");
                          setRecencyFilter("all");
                          setWinnerFilter(false);
                        }}
                        className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Limpiar
                      </button>
                      <button
                        onClick={() => setIsFilterOpen(false)}
                        className="flex-1 rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Aplicar filtros
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Initial Loading State */}
            {isLoading && (
              <div className="flex min-h-[400px] items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm w-full">
                <div className="text-center">
                  <Loader2 className="mx-auto h-12 w-12 animate-spin text-emerald-500" />
                  <p className="mt-4 text-slate-600">Cargando torneos...</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div className="rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
                <p className="text-red-700">{error.message}</p>
                <button
                  onClick={() => loadMore()}
                  className="mt-4 rounded-xl bg-red-100 px-6 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
                >
                  Reintentar
                </button>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && tournaments.length === 0 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                <Trophy className="mx-auto h-16 w-16 text-slate-300" />
                <p className="mt-4 text-lg text-slate-600">
                  {hasActiveFilters
                    ? "No hay torneos que coincidan con tu búsqueda"
                    : "No hay torneos disponibles aún"}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-4 rounded-xl bg-slate-100 px-6 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            )}

            {/* Tournament List */}
            {!isLoading && !error && tournaments.length > 0 && (
              <>
                <div
                  className={`transition-all duration-300 ${
                    viewMode === "cards" ? "space-y-6" : "hidden"
                  }`}
                >
                  {tournaments.map((tournament) => (
                    <TournamentCard
                      key={tournament.id}
                      tournament={tournament}
                    />
                  ))}
                </div>

                <div
                  className={`transition-all duration-300 ${
                    viewMode === "table"
                      ? "rounded-3xl border border-slate-200 bg-white shadow-sm"
                      : "hidden"
                  }`}
                >
                  <div className="divide-y divide-slate-100">
                    {tournaments.map((tournament, index) => (
                      <button
                        key={tournament.id}
                        onClick={() => {
                          router.push(`/tournaments/${tournament.id}`);
                        }}
                        className="w-full text-left transition hover:bg-slate-50"
                      >
                        <div className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                                {formatTypeLabel(tournament.type)}
                              </span>
                              <span className="text-xs text-slate-500">
                                {tournament.region || "Global"}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-slate-900 line-clamp-2">
                              {tournament.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span>{formatDate(tournament.eventDate)}</span>
                              <span>
                                {tournament.playerCount
                                  ? `${tournament.playerCount} jugadores`
                                  : "Jugadores N/D"}
                              </span>
                              {tournament.winnerName && (
                                <span className="text-emerald-600">
                                  Ganador: {tournament.winnerName}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:flex-col sm:items-end sm:gap-2">
                            <span className="text-xs font-semibold text-slate-400">
                              {tournament.source?.name ?? "Fuente"}
                            </span>
                            <span className="text-xs text-slate-400">
                              #{index + 1}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Load More Trigger */}
                <div ref={loadMoreRef} className="h-4" />

                {/* Loading More Indicator */}
                {isLoadingMore && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                )}

                {/* End of List */}
                {!hasMore && tournaments.length > 0 && (
                  <p className="py-6 text-center text-sm text-slate-400">
                    Has llegado al final
                  </p>
                )}
              </>
            )}
          </div>

          {/* Sidebar Stats - Hidden on mobile, visible on desktop */}
          <div className="hidden space-y-6 lg:block">
            {/* Top Arquetipos */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Top Meta
              </h3>
              <div className="space-y-3">
                {topArchetypes.slice(0, 3).map((archetype, index) => (
                  <div key={archetype.name}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                          {index + 1}
                        </span>
                        <span className="truncate font-medium text-slate-800">
                          {archetype.name}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {archetype.count}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{
                          width: `${Math.min(
                            (archetype.count / totalDecks) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Líderes */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                <Users className="h-4 w-4 text-sky-600" />
                Líderes
              </h3>
              <div className="space-y-2">
                {topLeaders.slice(0, 5).map((leader) => (
                  <div
                    key={leader.code}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {leader.name}
                      </p>
                      <p className="text-xs text-slate-500">{leader.code}</p>
                    </div>
                    <div className="ml-2 text-right">
                      <p className="text-sm font-bold text-slate-900">
                        {leader.count}
                      </p>
                      <p className="text-xs text-emerald-600">
                        {leader.winRate.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentsClient;
