"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Link2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";

type GroupLink = {
  cardId: number;
  region?: string | null;
  language?: string | null;
  card: {
    id: number;
    name: string;
    code: string;
    src: string;
    imageKey?: string | null;
  };
};

type CardGroupItem = {
  id: number;
  canonicalCode: string;
  canonicalName?: string | null;
  regions: string[];
  missingRegions: string[];
  notAvailableRegions: string[];
  regionStatus: Record<string, "present" | "missing" | "not-available">;
  totalLinks: number;
  heroCard?: GroupLink["card"] | null;
  links: GroupLink[];
};

type GroupResponse = {
  items: CardGroupItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  regionOrder: string[];
};

type UngroupedCard = {
  id: number;
  code: string;
  name: string;
  region?: string | null;
  language?: string | null;
  src: string;
  imageKey?: string | null;
};

type UngroupedResponse = {
  items: UngroupedCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const REGION_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "CN", label: "CN" },
  { value: "JP", label: "JP" },
  { value: "US", label: "US" },
  { value: "FR", label: "FR" },
  { value: "KR", label: "KR" },
];

const setCodesOptions = [
  { value: "OP01", label: "OP01" },
  { value: "OP02", label: "OP02" },
  { value: "OP03", label: "OP03" },
  { value: "OP04", label: "OP04" },
  { value: "OP05", label: "OP05" },
  { value: "OP06", label: "OP06" },
  { value: "OP07", label: "OP07" },
  { value: "OP08", label: "OP08" },
  { value: "OP09", label: "OP09" },
  { value: "OP10", label: "OP10" },
  { value: "OP11", label: "OP11" },
  { value: "OP12", label: "OP12" },
  { value: "OP13", label: "OP13" },
  { value: "OP14", label: "OP14" },
  { value: "EB01", label: "EB01" },
  { value: "EB02", label: "EB02" },
  { value: "EB03", label: "EB03" },
  { value: "PRB01", label: "PRB01" },
  { value: "PRB02", label: "PRB02" },
  { value: "ST01", label: "ST01" },
  { value: "ST02", label: "ST02" },
  { value: "ST03", label: "ST03" },
  { value: "ST04", label: "ST04" },
  { value: "ST05", label: "ST05" },
  { value: "ST06", label: "ST06" },
  { value: "ST07", label: "ST07" },
  { value: "ST08", label: "ST08" },
  { value: "ST09", label: "ST09" },
  { value: "ST10", label: "ST10" },
  { value: "ST11", label: "ST11" },
  { value: "ST12", label: "ST12" },
  { value: "ST13", label: "ST13" },
  { value: "ST14", label: "ST14" },
  { value: "ST15", label: "ST15" },
  { value: "ST16", label: "ST16" },
  { value: "ST17", label: "ST17" },
  { value: "ST18", label: "ST18" },
  { value: "ST19", label: "ST19" },
  { value: "ST20", label: "ST20" },
  { value: "ST21", label: "ST21" },
  { value: "ST22", label: "ST22" },
  { value: "ST23", label: "ST23" },
  { value: "ST24", label: "ST24" },
  { value: "ST25", label: "ST25" },
  { value: "ST26", label: "ST26" },
  { value: "ST27", label: "ST27" },
  { value: "ST28", label: "ST28" },
  { value: "PROMO", label: "Promo" },
];

const SET_CODE_ORDER = setCodesOptions.map((option) => option.value);
const DEFAULT_REGION_ORDER = ["CN", "JP", "US", "FR", "KR"];

const getSetKey = (canonicalCode: string) => {
  const upper = canonicalCode.toUpperCase();
  const match = upper.match(/^(OP|EB|ST|PRB)(\d{2})/);
  if (match) return `${match[1]}${match[2]}`;
  if (upper.startsWith("P")) return "PROMO";
  return "OTHER";
};

const statusStyles = {
  present: "bg-emerald-100 text-emerald-800 border-emerald-200",
  missing: "bg-rose-100 text-rose-700 border-rose-200",
  "not-available": "bg-slate-100 text-slate-500 border-slate-200",
};

const AdminCardGroupsPage = () => {
  const [groups, setGroups] = useState<CardGroupItem[]>([]);
  const [ungrouped, setUngrouped] = useState<UngroupedCard[]>([]);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [setFilter, setSetFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingUngrouped, setLoadingUngrouped] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<CardGroupItem | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [regionOrder, setRegionOrder] = useState<string[]>([]);

  const resolvedRegionOrder = regionOrder.length
    ? regionOrder
    : DEFAULT_REGION_ORDER;

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "500");
      if (search.trim()) params.set("search", search.trim());
      if (regionFilter !== "all") params.set("region", regionFilter);
      const response = await fetch(`/api/admin/card-groups?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch groups");
      const data = (await response.json()) as GroupResponse;
      setGroups(data.items);
      setRegionOrder(data.regionOrder ?? []);
    } catch (error) {
      console.error(error);
      showErrorToast("Error al cargar grupos");
    } finally {
      setLoading(false);
    }
  };

  const fetchUngrouped = async () => {
    try {
      setLoadingUngrouped(true);
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "200");
      if (search.trim()) params.set("search", search.trim());
      if (regionFilter !== "all") params.set("region", regionFilter);
      const response = await fetch(
        `/api/admin/card-groups/ungrouped?${params.toString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch ungrouped");
      const data = (await response.json()) as UngroupedResponse;
      setUngrouped(data.items);
      setSelectedCardId(data.items[0]?.id ?? null);
    } catch (error) {
      console.error(error);
      showErrorToast("Error al cargar cartas sin grupo");
    } finally {
      setLoadingUngrouped(false);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchUngrouped();
  }, [search, regionFilter]);

  const handleLink = async () => {
    if (!selectedGroup || !selectedCardId) return;
    try {
      const response = await fetch(
        `/api/admin/card-groups/${selectedGroup.id}/link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: selectedCardId }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to link card");
      }
      showSuccessToast("Carta vinculada al grupo");
      await fetchGroups();
      await fetchUngrouped();
    } catch (error) {
      console.error(error);
      showErrorToast(
        error instanceof Error ? error.message : "Error al vincular"
      );
    }
  };

  const selectedCard = useMemo(
    () => ungrouped.find((card) => card.id === selectedCardId) ?? null,
    [ungrouped, selectedCardId]
  );

  const groupsBySet = useMemo(() => {
    const map = new Map<string, CardGroupItem[]>();
    for (const group of groups) {
      const key = getSetKey(group.canonicalCode);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(group);
    }
    Array.from(map.values()).forEach((entries) => {
      entries.sort((a, b) => a.canonicalCode.localeCompare(b.canonicalCode));
    });
    return map;
  }, [groups]);

  const orderedSetKeys = useMemo(() => {
    const keys = [...SET_CODE_ORDER];
    if (groupsBySet.has("OTHER")) {
      keys.push("OTHER");
    }
    if (setFilter !== "all") {
      return keys.filter((key) => key === setFilter);
    }
    return keys;
  }, [setFilter, groupsBySet]);

  const orderedGroups = useMemo(() => {
    const output: CardGroupItem[] = [];
    for (const key of orderedSetKeys) {
      const items = groupsBySet.get(key) ?? [];
      output.push(...items);
    }
    return output;
  }, [groupsBySet, orderedSetKeys]);

  useEffect(() => {
    if (!orderedGroups.length) {
      setSelectedGroup(null);
      return;
    }
    if (!selectedGroup) {
      setSelectedGroup(orderedGroups[0]);
      return;
    }
    const stillExists = orderedGroups.find((group) => group.id === selectedGroup.id);
    if (!stillExists) {
      setSelectedGroup(orderedGroups[0] ?? null);
    }
  }, [orderedGroups, selectedGroup]);

  const sortedLinks = useMemo(() => {
    if (!selectedGroup) return [];
    const regionIndex = new Map(
      resolvedRegionOrder.map((region, idx) => [region, idx])
    );
    return [...selectedGroup.links].sort((a, b) => {
      const aIndex = regionIndex.get(a.region ?? "") ?? 999;
      const bIndex = regionIndex.get(b.region ?? "") ?? 999;
      if (aIndex !== bIndex) return aIndex - bIndex;
      return a.card.code.localeCompare(b.card.code);
    });
  }, [selectedGroup, resolvedRegionOrder]);

  return (
    <div className="flex h-screen w-full min-w-0 flex-col overflow-hidden bg-[#f2eede] lg:flex-row">
      <div className="flex w-full flex-col border-b border-slate-200 bg-white lg:h-full lg:w-[420px] lg:flex-shrink-0 lg:border-b-0 lg:border-r">
        <div className="border-b border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Card Groups
              </h1>
              <p className="text-xs text-slate-500">
                {groups.length} grupos
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                fetchGroups();
                fetchUngrouped();
              }}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por code o nombre..."
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  {REGION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={setFilter} onValueChange={setSetFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {setCodesOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="OTHER">Otros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Cargando...</div>
          ) : orderedGroups.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No hay grupos con estos filtros.
            </div>
          ) : (
            <div className="space-y-4">
              {orderedSetKeys.map((setKey) => {
                const section = groupsBySet.get(setKey) ?? [];
                if (!section.length) return null;
                return (
                  <div key={setKey} className="space-y-2">
                    <div className="flex items-center justify-between px-1 text-xs font-semibold uppercase text-slate-500">
                      <span>{setKey === "OTHER" ? "Otros" : setKey}</span>
                      <span>{section.length}</span>
                    </div>
                    <div className="space-y-2">
                      {section.map((group) => (
                        <button
                          key={group.id}
                          onClick={() => setSelectedGroup(group)}
                          className={`w-full rounded-2xl border p-3 text-left transition ${
                            selectedGroup?.id === group.id
                              ? "border-primary bg-primary/5"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-16 w-12 overflow-hidden rounded-lg border bg-muted">
                              {group.heroCard?.src ? (
                                <img
                                  src={group.heroCard.src}
                                  alt={group.heroCard.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                  Sin imagen
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900">
                                  {group.canonicalCode}
                                </span>
                                {group.missingRegions.length > 0 && (
                                  <Badge variant="destructive" className="text-[10px]">
                                    {group.missingRegions.length} faltantes
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">
                                {group.canonicalName || "Sin nombre canonico"}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {resolvedRegionOrder.map((region) => {
                                  const status =
                                    group.regionStatus?.[region] ?? "not-available";
                                  return (
                                    <span
                                      key={`${group.id}-${region}`}
                                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusStyles[status]}`}
                                    >
                                      {region}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6">
          {!selectedGroup ? (
            <div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/70 py-20 text-sm text-slate-500">
              Selecciona un grupo para ver el detalle.
            </div>
          ) : (
            <>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-semibold text-slate-900">
                        {selectedGroup.canonicalCode}
                      </h2>
                      {selectedGroup.missingRegions.length > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {selectedGroup.missingRegions.length} faltantes
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedGroup.canonicalName || "Sin nombre canonico"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {selectedGroup.totalLinks} cards
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {selectedGroup.regions.length} regiones
                    </Badge>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-5">
                  {resolvedRegionOrder.map((region) => {
                    const status =
                      selectedGroup.regionStatus?.[region] ?? "not-available";
                    const label =
                      status === "present"
                        ? "OK"
                        : status === "missing"
                        ? "MISSING"
                        : "N/A";
                    return (
                      <div
                        key={`${selectedGroup.id}-${region}`}
                        className={`flex flex-col items-center gap-1 rounded-2xl border px-3 py-3 text-xs font-semibold ${statusStyles[status]}`}
                      >
                        <span>{region}</span>
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    OK
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    Missing
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                    N/A
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Cartas vinculadas
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {sortedLinks.length}
                    </Badge>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {sortedLinks.map((link) => (
                      <div
                        key={link.cardId}
                        className="group rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                      >
                        <div className="relative overflow-hidden rounded-xl border bg-slate-50">
                          {link.card.src ? (
                            <img
                              src={link.card.src}
                              alt={link.card.name}
                              className="h-48 w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-48 w-full items-center justify-center text-xs text-slate-400">
                              Sin imagen
                            </div>
                          )}
                          <span className="absolute left-3 top-3 rounded-full border bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            {link.region || "?"}
                          </span>
                        </div>
                        <div className="mt-3 space-y-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {link.card.code}
                          </p>
                          <p className="text-xs text-slate-500">
                            {link.card.name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Vincular carta
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {ungrouped.length} sin grupo
                    </Badge>
                  </div>
                  <div className="mt-4 space-y-4">
                    {loadingUngrouped ? (
                      <div className="text-sm text-muted-foreground">
                        Cargando...
                      </div>
                    ) : ungrouped.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No hay cartas base sin grupo.
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">
                            Selecciona carta base
                          </p>
                          <Select
                            value={selectedCardId?.toString() || ""}
                            onValueChange={(value) =>
                              setSelectedCardId(Number(value))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona carta..." />
                            </SelectTrigger>
                            <SelectContent>
                              {ungrouped.slice(0, 80).map((card) => (
                                <SelectItem key={card.id} value={card.id.toString()}>
                                  {card.code} • {card.region ?? "?"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {ungrouped.length > 80 && (
                            <div className="text-[10px] text-muted-foreground">
                              Mostrando 80. Usa el buscador para refinar.
                            </div>
                          )}
                        </div>
                        {selectedCard && (
                          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="h-16 w-12 overflow-hidden rounded-lg border bg-muted">
                              {selectedCard.src ? (
                                <img
                                  src={selectedCard.src}
                                  alt={selectedCard.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                  —
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-900">
                                {selectedCard.code}
                              </p>
                              <p className="text-xs text-slate-500">
                                {selectedCard.name}
                              </p>
                            </div>
                            <Badge variant="secondary" className="text-[10px]">
                              {selectedCard.region || "?"}
                            </Badge>
                          </div>
                        )}
                        <Button
                          onClick={handleLink}
                          disabled={!selectedGroup || !selectedCardId}
                          className="w-full"
                        >
                          <Link2 className="mr-2 h-4 w-4" />
                          Vincular al grupo seleccionado
                        </Button>
                      </>
                    )}
                    {!selectedGroup && (
                      <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                        <AlertTriangle className="h-4 w-4" />
                        Selecciona un grupo para poder vincular.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCardGroupsPage;
