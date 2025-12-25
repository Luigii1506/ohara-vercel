"use client";

import React, { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { shallow } from "zustand/shallow";
import { CardWithCollectionData } from "@/types";
import { useSimulatorStore } from "@/store/simulatorStore";
import { Side, ZoneId } from "@/types/simulator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ArrowLeftRight,
  Camera,
  Layers,
  Play,
  RefreshCw,
  Search,
  Shield,
  Sword,
  Trash2,
  Users,
} from "lucide-react";
import LazyImage from "@/components/LazyImage";
import { SIMULATOR_CARD_FALLBACK } from "@/store/simulatorStore";

interface SimulatorControlsProps {
  cards: CardWithCollectionData[];
  isLoadingCards: boolean;
}

const SimulatorControls: React.FC<SimulatorControlsProps> = ({
  cards,
  isLoadingCards,
}) => {
  const [search, setSearch] = useState("");
  const [deckIdInput, setDeckIdInput] = useState("");
  const [logIdInput, setLogIdInput] = useState("");
  const [isImportingDeck, setIsImportingDeck] = useState(false);
  const [isImportingLog, setIsImportingLog] = useState(false);

  const {
    spawnCard,
    activePerspective,
    setPerspective,
    swapPerspective,
    turnOwner,
    setTurnOwner,
    life,
    donAvailable,
    updateLife,
    setDon,
    createSnapshot,
    snapshots,
    loadSnapshot,
    deleteSnapshot,
    resetBoard,
    importDeck,
    importGameLog,
    replayMetadata,
  } = useSimulatorStore(
    (state) => ({
      spawnCard: state.spawnCard,
      activePerspective: state.activePerspective,
      setPerspective: state.setPerspective,
      swapPerspective: state.swapPerspective,
      turnOwner: state.turnOwner,
      setTurnOwner: state.setTurnOwner,
      life: state.life,
      donAvailable: state.donAvailable,
      updateLife: state.updateLife,
      setDon: state.setDon,
      createSnapshot: state.createSnapshot,
      snapshots: state.snapshots,
      loadSnapshot: state.loadSnapshot,
      deleteSnapshot: state.deleteSnapshot,
      resetBoard: state.resetBoard,
      importDeck: state.importDeck,
      importGameLog: state.importGameLog,
      replayMetadata: state.replayMetadata,
    }),
    shallow
  );

  const filteredCards = useMemo(() => {
    if (!cards?.length) return [];
    const term = search.trim().toLowerCase();
    if (!term) return cards.slice(0, 40);
    return cards
      .filter((card) => {
        const name = card.name?.toLowerCase() ?? "";
        const code = card.code?.toLowerCase() ?? "";
        return name.includes(term) || code.includes(term);
      })
      .slice(0, 40);
  }, [cards, search]);

  const handleSpawn = (card: CardWithCollectionData, side: Side) => {
    const zoneId: ZoneId = side === "player" ? "player-hand" : "opponent-hand";
    spawnCard(card, zoneId, side);
    toast.success(`Carta añadida al ${side === "player" ? "tu" : "oponente"} lado`, {
      autoClose: 1500,
    });
  };

  const handleSnapshot = () => {
    const snapshot = createSnapshot();
    if (snapshot) {
      toast.success(`Snapshot guardado (${snapshot.label})`, {
        autoClose: 1500,
      });
    }
  };

  const handleImportDeck = async () => {
    const deckId = parseInt(deckIdInput, 10);
    if (Number.isNaN(deckId)) {
      toast.error("Ingresa un ID de deck válido");
      return;
    }
    try {
      setIsImportingDeck(true);
      await importDeck(deckId, "player");
      toast.success("Deck importado al simulador");
    } catch (error: any) {
      toast.error(error?.message || "Error importando deck");
    } finally {
      setIsImportingDeck(false);
    }
  };

  const handleImportLog = async () => {
    const logId = parseInt(logIdInput, 10);
    if (Number.isNaN(logId)) {
      toast.error("Ingresa un ID de log válido");
      return;
    }
    try {
      setIsImportingLog(true);
      await importGameLog(logId);
      toast.success("Log cargado, listo para recrear");
    } catch (error: any) {
      toast.error(error?.message || "Error importando log");
    } finally {
      setIsImportingLog(false);
    }
  };

  const ResourceControls = ({ side }: { side: Side }) => (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-center justify-between text-sm text-white/80">
        <div className="flex items-center gap-2 text-white">
          <Users className="h-4 w-4" />
          <span>{side === "player" ? "Tu lado" : "Oponente"}</span>
        </div>
        {turnOwner === side && (
          <span className="text-xs uppercase tracking-wide text-emerald-300">
            Turno
          </span>
        )}
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/80">Vida</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => updateLife(side, -1)}
            >
              -
            </Button>
            <span className="w-8 text-center text-lg font-semibold text-white">
              {life[side]}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => updateLife(side, 1)}
            >
              +
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/80">DON activos</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDon(side, Math.max(0, donAvailable[side] - 1))}
            >
              -
            </Button>
            <span className="w-8 text-center text-lg font-semibold text-white">
              {donAvailable[side]}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDon(side, donAvailable[side] + 1)}
            >
              +
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-black/40 p-4 lg:p-6">
      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
          <Sword className="h-4 w-4" />
          <span>Perspectiva actual</span>
          <strong className="text-white">
            {activePerspective === "player" ? "Tu lado" : "Oponente"}
          </strong>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activePerspective === "player" ? "default" : "outline"}
            size="sm"
            onClick={() => setPerspective("player")}
          >
            Ver mi lado
          </Button>
          <Button
            variant={activePerspective === "opponent" ? "default" : "outline"}
            size="sm"
            onClick={() => setPerspective("opponent")}
          >
            Ver oponente
          </Button>
          <Button variant="ghost" size="sm" onClick={swapPerspective}>
            <ArrowLeftRight className="h-4 w-4" />
            Intercambiar
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
          <Button
            variant={turnOwner === "player" ? "default" : "outline"}
            size="sm"
            onClick={() => setTurnOwner("player")}
          >
            Mi turno
          </Button>
          <Button
            variant={turnOwner === "opponent" ? "default" : "outline"}
            size="sm"
            onClick={() => setTurnOwner("opponent")}
          >
            Turno rival
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <ResourceControls side="player" />
        <ResourceControls side="opponent" />
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center gap-2 text-white">
          <Search className="h-4 w-4" />
          <span className="font-semibold">Cartas</span>
          <span className="text-xs text-white/50">
            {isLoadingCards ? "Cargando..." : `${cards.length} disponibles`}
          </span>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o código"
          className="bg-black/60 text-white placeholder:text-white/40"
        />
        <div className="max-h-[360px] space-y-3 overflow-y-auto pr-2">
          {isLoadingCards && (
            <p className="text-sm text-white/60">Cargando cartas...</p>
          )}
          {!isLoadingCards && filteredCards.length === 0 && (
            <p className="text-sm text-white/60">Sin resultados</p>
          )}
          {filteredCards.map((card) => (
            <div
              key={card.id}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-black/30 p-3"
            >
              <div className="w-16">
                <LazyImage
                  src={card.src}
                  fallbackSrc={SIMULATOR_CARD_FALLBACK}
                  alt={card.name}
                  className="rounded-lg"
                  objectFit="cover"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{card.name}</p>
                <p className="text-xs text-white/60">{card.code}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleSpawn(card, "player")}
                >
                  Añadir a mi lado
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSpawn(card, "opponent")}
                >
                  Añadir rival
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Camera className="h-4 w-4" />
            <span className="font-semibold">Snapshots</span>
          </div>
          <Button size="sm" onClick={handleSnapshot}>
            Guardar estado
          </Button>
        </div>
        <div className="space-y-2">
          {snapshots.length === 0 && (
            <p className="text-sm text-white/60">
              Aún no tienes snapshots guardados.
            </p>
          )}
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            >
              <div>
                <p className="font-semibold">{snapshot.label}</p>
                <p className="text-xs text-white/50">
                  {new Date(snapshot.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => loadSnapshot(snapshot.id)}
                >
                  <Play className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteSnapshot(snapshot.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <Layers className="h-4 w-4" />
            Importar deck
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Deck ID"
              value={deckIdInput}
              onChange={(event) => setDeckIdInput(event.target.value)}
              className="bg-black/60 text-white"
            />
            <Button onClick={handleImportDeck} disabled={isImportingDeck}>
              {isImportingDeck ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                "Importar"
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <Shield className="h-4 w-4" />
            Importar log
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Game log ID"
              value={logIdInput}
              onChange={(event) => setLogIdInput(event.target.value)}
              className="bg-black/60 text-white"
            />
            <Button onClick={handleImportLog} disabled={isImportingLog}>
              {isImportingLog ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                "Cargar"
              )}
            </Button>
          </div>
        </div>

        {replayMetadata && (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-white/80">
            <p className="text-xs uppercase tracking-wide text-white/50">
              Log cargado
            </p>
            <p className="text-lg font-semibold text-white">
              {replayMetadata.deckName || "Deck sin nombre"}
            </p>
            <p>Vs: {replayMetadata.opponentName || "?"}</p>
            <p>
              Resultado:{" "}
              {replayMetadata.result === "win" ? "Victoria" : "Derrota"} ·{" "}
              {replayMetadata.wentFirst ? "Fuiste primero" : "Fuiste segundo"}
            </p>
            {replayMetadata.comments && (
              <p className="text-xs text-white/60">{replayMetadata.comments}</p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-semibold text-white">Reiniciar tablero</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" onClick={() => resetBoard()}>
            Reset total
          </Button>
          <Button
            variant="outline"
            onClick={() => resetBoard({ keepLeaders: true })}
          >
            Conservar líderes
          </Button>
        </div>
      </section>
    </div>
  );
};

export default SimulatorControls;
