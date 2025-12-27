"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useUser } from "@/app/context/UserContext";
import {
  RefreshCw,
  Trophy,
  Users,
  Globe,
  Swords,
  ExternalLink,
} from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";

interface LeaderCard {
  id: number;
  name: string;
  code: string | null;
  src: string | null;
}

interface DeckRef {
  id: number;
  name: string;
  uniqueUrl: string;
}

interface TournamentDeckDto {
  id: number;
  playerName: string;
  standing: number | null;
  deckSourceUrl: string | null;
  archetypeName: string | null;
  deck: DeckRef | null;
  leaderCard: LeaderCard | null;
}

interface TournamentDto {
  id: number;
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
  decks: TournamentDeckDto[];
}

const AdminTournamentsPage = () => {
  const router = useRouter();
  const { role, loading } = useUser();
  const [tournaments, setTournaments] = useState<TournamentDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (!loading && role !== "ADMIN") {
      router.push("/unauthorized");
    }
  }, [role, loading, router]);

  const loadTournaments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/admin/tournaments?limit=40", {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("Error loading tournaments");
      }
      const data = await res.json();
      setTournaments(data.tournaments || []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Unexpected error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role === "ADMIN") {
      loadTournaments();
    }
  }, [role]);

  useEffect(() => {
    if (tournaments.length && !selectedTournamentId) {
      setSelectedTournamentId(tournaments[0].id);
    }
  }, [tournaments, selectedTournamentId]);

  const selectedTournament = useMemo(
    () =>
      tournaments.find((t) => t.id === selectedTournamentId) ?? tournaments[0],
    [tournaments, selectedTournamentId]
  );

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const res = await fetch("/api/tournaments/sync/limitless", {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to sync tournaments");
      }
      const data = await res.json();
      showSuccessToast(
        `Sincronizados ${data?.tournaments?.total ?? 0} torneos y ${
          data?.decks?.processed ?? 0
        } decks`
      );
      await loadTournaments();
    } catch (err: any) {
      console.error(err);
      showErrorToast(err?.message ?? "Failed to sync");
    } finally {
      setIsSyncing(false);
    }
  };

  const totalDecks = useMemo(
    () =>
      tournaments.reduce((sum, tournament) => sum + tournament.decks.length, 0),
    [tournaments]
  );

  const lastEvent = tournaments[0];
  const archetypeStats = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        appearances: number;
        wins: number;
        leaderName?: string | null;
      }
    >();
    tournaments.forEach((tournament) => {
      tournament.decks.forEach((deck) => {
        const key =
          deck.archetypeName || deck.leaderCard?.name || "Sin etiqueta";
        const current = map.get(key) ?? {
          name: key,
          appearances: 0,
          wins: 0,
          leaderName: deck.leaderCard?.name,
        };
        current.appearances += 1;
        if (deck.standing === 1) current.wins += 1;
        map.set(key, current);
      });
    });
    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        winRate: entry.appearances ? (entry.wins / entry.appearances) * 100 : 0,
      }))
      .sort((a, b) => b.appearances - a.appearances);
  }, [tournaments]);

  const leaderStats = useMemo(() => {
    const map = new Map<
      string,
      { code: string; name: string; appearances: number; wins: number }
    >();
    tournaments.forEach((t) => {
      t.decks.forEach((deck) => {
        const code = deck.leaderCard?.code;
        if (!code) return;
        const current = map.get(code) ?? {
          code,
          name: deck.leaderCard?.name || code,
          appearances: 0,
          wins: 0,
        };
        current.appearances += 1;
        if (deck.standing === 1) current.wins += 1;
        map.set(code, current);
      });
    });
    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        winRate: entry.appearances ? (entry.wins / entry.appearances) * 100 : 0,
      }))
      .sort((a, b) => b.appearances - a.appearances);
  }, [tournaments]);

  const regionStats = useMemo(() => {
    const map = new Map<string, number>();
    tournaments.forEach((t) => {
      if (!t.region) return;
      map.set(t.region, (map.get(t.region) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [tournaments]);

  const topArchetype = archetypeStats[0];

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(date);
  };

  const formatNumber = (value?: number | null) =>
    typeof value === "number" ? value.toLocaleString() : "—";

  if (loading || role !== "ADMIN") {
    return (
      <div className="p-8 text-center text-white">
        {loading ? "Validando permisos..." : "Redirigiendo..."}
      </div>
    );
  }

  return (
    <div className="overflow-auto bg-gradient-to-b from-slate-950 via-slate-900 to-black p-4 text-white sm:p-6 md:p-10 w-full min-h-0">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-emerald-300">
              Admin · Torneos
            </p>
            <h1 className="text-3xl font-bold">Resultados & Decklists</h1>
            <p className="text-white/70">
              Monitoriza los torneos sincronizados desde Limitless y accede
              rápidamente a los decks importados.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={loadTournaments}
              disabled={isLoading || isSyncing}
              className="w-full md:w-auto"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refrescar
            </Button>
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              className="bg-emerald-600 hover:bg-emerald-500 w-full md:w-auto"
            >
              <Swords
                className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
              />
              {isSyncing ? "Sincronizando..." : "Sync Limitless"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 shadow-lg shadow-black/40">
            <div className="flex items-center gap-3 text-sm text-white/60">
              <Trophy className="h-5 w-5 text-yellow-400" />
              Torneos trazados
            </div>
            <p className="mt-3 text-3xl font-semibold">
              {formatNumber(tournaments.length)}
            </p>
            <p className="text-xs text-white/50">
              Último:{" "}
              {lastEvent
                ? `${lastEvent.name} (${formatDate(lastEvent.eventDate)})`
                : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 shadow-lg shadow-black/40">
            <div className="flex items-center gap-3 text-sm text-white/60">
              <Users className="h-5 w-5 text-sky-400" />
              Decklists importados
            </div>
            <p className="mt-3 text-3xl font-semibold">
              {formatNumber(totalDecks)}
            </p>
            <p className="text-xs text-white/50">
              Decks con enlace directo a tu ecosistema
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 shadow-lg shadow-black/40">
            <div className="flex items-center gap-3 text-sm text-white/60">
              <Globe className="h-5 w-5 text-emerald-400" />
              Meta dominante
            </div>
            <p className="mt-3 text-3xl font-semibold">
              {topArchetype ? topArchetype.name : "—"}
            </p>
            <p className="text-xs text-white/50">
              {topArchetype
                ? `${
                    topArchetype.appearances
                  } apariciones · ${topArchetype.winRate.toFixed(1)}% win rate`
                : "Aún no hay datos suficientes"}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/40 p-6 shadow-lg shadow-black/30">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-sm uppercase tracking-wide text-white/50">
                Líderes más jugados
              </p>
              <div className="mt-3 space-y-3">
                {leaderStats.slice(0, 4).map((leader) => (
                  <div
                    key={leader.code}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-semibold">{leader.name}</p>
                      <p className="text-xs text-white/50">{leader.code}</p>
                    </div>
                    <div className="text-right text-xs text-white/60">
                      <p>{leader.appearances} apariciones</p>
                      <p>{leader.winRate.toFixed(1)}% win rate</p>
                    </div>
                  </div>
                ))}
                {leaderStats.length === 0 && (
                  <p className="text-sm text-white/60">
                    Todavía no hay líderes registrados en los decks.
                  </p>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-white/50">
                Actividad por región
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {regionStats.length === 0 && (
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                    Sin datos
                  </span>
                )}
                {regionStats.slice(0, 6).map(([region, count]) => (
                  <span
                    key={region}
                    className="rounded-full border border-emerald-400/40 px-3 py-1 text-xs text-emerald-200"
                  >
                    {region} · {count}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="">
          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
              {error}
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-black/40 p-6 shadow-lg shadow-black/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-wide text-white/50">
                    Meta overview
                  </p>
                  <h3 className="text-xl font-semibold">Top arquetipos</h3>
                </div>
                <span className="text-xs text-white/50">
                  Últimos {tournaments.length} torneos
                </span>
              </div>
              <div className="mt-4 space-y-4">
                {archetypeStats.slice(0, 5).map((stat, index) => (
                  <div key={stat.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm text-white/80">
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-white/50">
                          #{index + 1}
                        </span>
                        {stat.name}
                      </span>
                      <span className="text-white/60">
                        {stat.appearances} · {stat.winRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                        style={{
                          width: totalDecks
                            ? `${Math.min(
                                (stat.appearances / totalDecks) * 100,
                                100
                              )}%`
                            : "0%",
                        }}
                      />
                    </div>
                  </div>
                ))}
                {archetypeStats.length === 0 && (
                  <p className="text-sm text-white/60">
                    Todavía no hay información sobre arquetipos. Ejecuta una
                    sincronización para comenzar.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-4 rounded-3xl border border-white/10 bg-black/40 p-4">
              <h3 className="text-lg font-semibold">Torneos sincronizados</h3>
              <div className="space-y-3">
                {isLoading && (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-sm text-white/60">
                    Cargando torneos...
                  </div>
                )}
                {!isLoading && tournaments.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center text-sm text-white/60">
                    No hay torneos sincronizados todavía. Ejecuta un sync para
                    comenzar.
                  </div>
                )}
                {tournaments.map((tournament) => {
                  const isSelected = selectedTournament?.id === tournament.id;
                  return (
                    <button
                      key={tournament.id}
                      onClick={() => setSelectedTournamentId(tournament.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20"
                          : "border-white/10 bg-slate-900/40 hover:border-white/30"
                      }`}
                    >
                      <div className="flex items-center justify-between text-sm text-white/60">
                        <span>{formatDate(tournament.eventDate)}</span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs">
                          {tournament.source.slug}
                        </span>
                      </div>
                      <p className="mt-1 text-base font-semibold text-white">
                        {tournament.name}
                      </p>
                      <p className="text-xs text-white/60">
                        {formatNumber(tournament.playerCount)} jugadores ·
                        Ganador: {tournament.winnerName ?? "—"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/60">
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-7 px-3"
                        >
                          <Link href={`${"/admin/events"}?id=${tournament.id}`}>
                            Editar
                          </Link>
                        </Button>
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-7 px-3"
                        >
                          <Link href={tournament.tournamentUrl} target="_blank">
                            Ver fuente
                          </Link>
                        </Button>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-4 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/70 to-black/60 p-6 shadow-xl shadow-black/30">
              {!selectedTournament ? (
                <div className="text-center text-sm text-white/60">
                  Selecciona un torneo para ver el detalle.
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-white/60">
                        <span className="rounded-full border border-white/10 px-2 py-0.5">
                          {selectedTournament.source.name}
                        </span>
                        {selectedTournament.format && (
                          <span className="rounded-full border border-white/10 px-2 py-0.5">
                            Formato {selectedTournament.format}
                          </span>
                        )}
                        {selectedTournament.region && (
                          <span className="rounded-full border border-white/10 px-2 py-0.5">
                            {selectedTournament.region}
                            {selectedTournament.country
                              ? ` · ${selectedTournament.country}`
                              : ""}
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl font-semibold">
                        {selectedTournament.name}
                      </h2>
                      <p className="text-sm text-white/60">
                        {formatDate(selectedTournament.eventDate)} •{" "}
                        {formatNumber(selectedTournament.playerCount)} jugadores
                        • Ganador: {selectedTournament.winnerName ?? "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-white/60">
                      <Link
                        href={selectedTournament.tournamentUrl}
                        target="_blank"
                        className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-xs hover:border-white/50"
                      >
                        Ver en la fuente
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  <div className="hidden overflow-x-auto rounded-2xl border border-white/5 md:block">
                    <table className="min-w-full divide-y divide-white/5 text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-white/50">
                          <th className="py-2 pr-4">Pos.</th>
                          <th className="py-2 pr-4">Jugador</th>
                          <th className="py-2 pr-4">Deck</th>
                          <th className="py-2 pr-4">Líder</th>
                          <th className="py-2 pr-4">Fuente</th>
                          <th className="py-2 pr-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {selectedTournament.decks.map((deck) => (
                          <tr key={deck.id} className="align-top">
                            <td className="py-3 pr-4 font-semibold text-white/80">
                              {deck.standing ?? "—"}
                            </td>
                            <td className="py-3 pr-4">
                              <p className="font-medium">{deck.playerName}</p>
                              <p className="text-xs text-white/50">
                                {deck.archetypeName || "Arquetipo sin nombre"}
                              </p>
                            </td>
                            <td className="py-3 pr-4">
                              {deck.deck ? (
                                <Link
                                  href={`/decks/${deck.deck.uniqueUrl}`}
                                  className="text-emerald-300 hover:text-emerald-200"
                                >
                                  {deck.deck.name}
                                </Link>
                              ) : (
                                <span className="text-white/50">
                                  Deck sin construir
                                </span>
                              )}
                            </td>
                            <td className="py-3 pr-4">
                              {deck.leaderCard ? (
                                <div className="text-sm">
                                  <p className="font-medium">
                                    {deck.leaderCard.name}
                                  </p>
                                  <p className="text-xs text-white/50">
                                    {deck.leaderCard.code}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-white/50">—</span>
                              )}
                            </td>
                            <td className="py-3 pr-4">
                              {deck.deckSourceUrl ? (
                                <Link
                                  href={deck.deckSourceUrl}
                                  target="_blank"
                                  className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white"
                                >
                                  Lista <ExternalLink className="h-3 w-3" />
                                </Link>
                              ) : (
                                <span className="text-white/50">—</span>
                              )}
                            </td>
                            <td className="py-3 pr-0 text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                {deck.deck && (
                                  <Button asChild size="sm" variant="secondary">
                                    <Link
                                      href={`/decks/${deck.deck.uniqueUrl}`}
                                    >
                                      Ver deck
                                    </Link>
                                  </Button>
                                )}
                                {deck.deckSourceUrl && (
                                  <Button asChild size="sm" variant="ghost">
                                    <Link
                                      href={deck.deckSourceUrl}
                                      target="_blank"
                                    >
                                      Fuente
                                    </Link>
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {selectedTournament.decks.map((deck) => (
                      <div
                        key={`${deck.id}-card`}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm"
                      >
                        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/50">
                          <span>Posición</span>
                          <span className="text-lg font-semibold text-white">
                            {deck.standing ?? "—"}
                          </span>
                        </div>
                        <div className="mt-2">
                          <p className="text-base font-semibold">
                            {deck.playerName}
                          </p>
                          <p className="text-xs text-white/60">
                            {deck.archetypeName || "Sin arquetipo"}
                          </p>
                        </div>
                        <div className="mt-3 space-y-1 text-xs text-white/70">
                          <p>
                            <span className="text-white/50">Deck: </span>
                            {deck.deck ? (
                              <Link
                                href={`/decks/${deck.deck.uniqueUrl}`}
                                className="text-emerald-300 underline-offset-2 hover:underline"
                              >
                                {deck.deck.name}
                              </Link>
                            ) : (
                              "No disponible"
                            )}
                          </p>
                          <p>
                            <span className="text-white/50">Líder: </span>
                            {deck.leaderCard
                              ? `${deck.leaderCard.name} (${deck.leaderCard.code})`
                              : "—"}
                          </p>
                          {deck.deckSourceUrl && (
                            <p>
                              <Link
                                href={deck.deckSourceUrl}
                                target="_blank"
                                className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200"
                              >
                                Fuente <ExternalLink className="h-3 w-3" />
                              </Link>
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTournamentsPage;
