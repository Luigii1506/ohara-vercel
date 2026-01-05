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
  isExclusive: boolean;
  baseComplete: boolean;
  fullComplete: boolean;
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

type RegionCard = {
  id: number;
  code: string;
  name: string;
  src: string;
  region?: string | null;
  isFirstEdition: boolean;
  alternateArt?: string | null;
  illustrator?: string | null;
  alias?: string | null;
  order?: string | null;
  setCode?: string | null;
  baseGroupLinked: boolean;
  variantGroupId: number | null;
};

type VariantGroup = {
  id: number;
  variantKey?: string | null;
  alternateArt?: string | null;
  illustrator?: string | null;
  links: Array<{
    cardId: number;
    card: {
      id: number;
      code: string;
      region?: string | null;
      src?: string | null;
    };
  }>;
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
  // OP sets first
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
  // ST sets second
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
  // EB sets third
  { value: "EB01", label: "EB01" },
  { value: "EB02", label: "EB02" },
  { value: "EB03", label: "EB03" },
  // PRB sets fourth
  { value: "PRB01", label: "PRB01" },
  { value: "PRB02", label: "PRB02" },
  // Promo last
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
  const [selectedGroup, setSelectedGroup] = useState<CardGroupItem | null>(
    null
  );
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [regionOrder, setRegionOrder] = useState<string[]>([]);
  const [regionCards, setRegionCards] = useState<RegionCard[]>([]);
  const [variantGroups, setVariantGroups] = useState<VariantGroup[]>([]);
  const [loadingRegion, setLoadingRegion] = useState(false);
  const [selectedVariantGroupId, setSelectedVariantGroupId] = useState<
    number | null
  >(null);
  const [baseRegionStatus, setBaseRegionStatus] = useState<
    Record<string, string>
  >({});
  const [variantRegionStatus, setVariantRegionStatus] = useState<
    Record<number, Record<string, string>>
  >({});
  const [creatingVariant, setCreatingVariant] = useState(false);

  const resolvedRegionOrder = regionOrder.length
    ? regionOrder
    : DEFAULT_REGION_ORDER;

  const formatVariantLabel = (group: VariantGroup) => {
    const label =
      group.alternateArt?.trim() ||
      group.illustrator?.trim() ||
      group.variantKey?.trim() ||
      `Grupo ${group.id}`;
    return `${label}`;
  };

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "3000");
      if (search.trim()) params.set("search", search.trim());
      if (regionFilter !== "all") params.set("region", regionFilter);
      const response = await fetch(
        `/api/admin/card-groups?${params.toString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch groups");
      const data = (await response.json()) as GroupResponse;
      console.log("[fetchGroups] total from API:", data.total, "items received:", data.items.length);
      console.log("[fetchGroups] first 10 codes:", data.items.slice(0, 10).map(g => g.canonicalCode));
      setGroups(data.items);
      setRegionOrder(data.regionOrder ?? []);
    } catch (error) {
      console.error(error);
      showErrorToast("Error al cargar grupos");
    } finally {
      setLoading(false);
    }
  };

  const refreshSingleGroup = async (groupId: number) => {
    try {
      const response = await fetch(
        `/api/admin/card-groups?search=&limit=1&groupId=${groupId}`
      );
      if (!response.ok) return;
      const data = (await response.json()) as GroupResponse;
      const updatedGroup = data.items[0];
      if (!updatedGroup) return;

      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? updatedGroup : g))
      );

      if (selectedGroup?.id === groupId) {
        setSelectedGroup(updatedGroup);
      }
    } catch (error) {
      console.error("Error refreshing single group:", error);
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

  const fetchRegionCards = async (groupId: number): Promise<void> => {
    try {
      setLoadingRegion(true);
      const response = await fetch(
        `/api/admin/card-groups/${groupId}/region-cards`
      );
      if (!response.ok) throw new Error("Failed to fetch region cards");
      const data = (await response.json()) as {
        cards: Array<{
          id: number;
          code: string;
          name: string;
          src: string;
          region?: string | null;
          isFirstEdition: boolean;
          alternateArt?: string | null;
          illustrator?: string | null;
          alias?: string | null;
          order?: string | null;
          setCode?: string | null;
          baseGroupLinks: { id: number }[];
          variantGroupLinks: { variantGroupId: number }[];
        }>;
        variantGroups: VariantGroup[];
        baseRegionStatus: Record<string, string>;
        variantRegionStatus: Record<number, Record<string, string>>;
      };
      setVariantGroups(data.variantGroups ?? []);
      setBaseRegionStatus(data.baseRegionStatus ?? {});
      setVariantRegionStatus(data.variantRegionStatus ?? {});
      setRegionCards(
        (data.cards ?? []).map((card) => ({
          id: card.id,
          code: card.code,
          name: card.name,
          src: card.src,
          region: card.region,
          isFirstEdition: card.isFirstEdition,
          alternateArt: card.alternateArt ?? null,
          illustrator: card.illustrator ?? null,
          alias: card.alias ?? null,
          order: card.order ?? null,
          setCode: card.setCode ?? null,
          baseGroupLinked: (card.baseGroupLinks ?? []).length > 0,
          variantGroupId: card.variantGroupLinks?.[0]?.variantGroupId ?? null,
        }))
      );
    } catch (error) {
      console.error(error);
      showErrorToast("Error al cargar cartas por region");
      setRegionCards([]);
      setVariantGroups([]);
      setBaseRegionStatus({});
      setVariantRegionStatus({});
    } finally {
      setLoadingRegion(false);
    }
  };

  useEffect(() => {
    if (!selectedGroup) return;
    fetchRegionCards(selectedGroup.id);
  }, [selectedGroup]);

  useEffect(() => {
    if (!variantGroups.length) {
      setSelectedVariantGroupId(null);
      return;
    }
    if (selectedVariantGroupId) {
      const exists = variantGroups.some(
        (group) => group.id === selectedVariantGroupId
      );
      if (exists) return;
    }
    setSelectedVariantGroupId(variantGroups[0].id);
  }, [variantGroups, selectedVariantGroupId]);

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

  const handleLinkBase = async (cardId: number) => {
    if (!selectedGroup) return;
    try {
      const response = await fetch(
        `/api/admin/card-groups/${selectedGroup.id}/link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to link card");
      }
      showSuccessToast("Carta base vinculada");
      await fetchGroups();
      await fetchRegionCards(selectedGroup.id);
    } catch (error) {
      console.error(error);
      showErrorToast(
        error instanceof Error ? error.message : "Error al vincular"
      );
    }
  };

  const handleUnlinkBase = async (cardId: number) => {
    if (!selectedGroup) return;
    try {
      const response = await fetch(
        `/api/admin/card-groups/${selectedGroup.id}/unlink`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unlink card");
      }
      showSuccessToast("Vinculo eliminado");
      await fetchGroups();
      await fetchRegionCards(selectedGroup.id);
    } catch (error) {
      console.error(error);
      showErrorToast(
        error instanceof Error ? error.message : "Error al desvincular"
      );
    }
  };

  const handleAssignVariant = async (
    cardId: number,
    variantGroupId: number | "new" | "none"
  ) => {
    if (!selectedGroup) return;
    try {
      if (variantGroupId === "none") {
        const current = regionCards.find((card) => card.id === cardId);
        if (!current?.variantGroupId) return;
        const response = await fetch(
          `/api/admin/card-variant-groups/${current.variantGroupId}/unlink`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cardId }),
          }
        );
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to unlink");
        }
        showSuccessToast("Alterna desvinculada");
      } else if (variantGroupId === "new") {
        const response = await fetch(`/api/admin/card-variant-groups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseGroupId: selectedGroup.id,
            cardId,
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create variant group");
        }
        const created = (await response.json()) as { variantGroupId?: number };
        if (created?.variantGroupId) {
          setSelectedVariantGroupId(created.variantGroupId);
        }
        showSuccessToast("Grupo de alterna creado");
      } else {
        const response = await fetch(
          `/api/admin/card-variant-groups/${variantGroupId}/link`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cardId }),
          }
        );
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to link variant");
        }
        showSuccessToast("Alterna vinculada");
      }
      await fetchGroups();
      await fetchRegionCards(selectedGroup.id);
    } catch (error) {
      console.error(error);
      showErrorToast(
        error instanceof Error ? error.message : "Error al vincular alterna"
      );
    }
  };

  const handleUpdateBaseRegionStatus = async (
    region: string,
    status: "UNKNOWN" | "NOT_EXISTS" | "EXCLUSIVE" | "RESET"
  ) => {
    if (!selectedGroup) return;
    try {
      const response = await fetch(
        `/api/admin/card-groups/${selectedGroup.id}/region-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ region, status }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update status");
      }
      await fetchGroups();
      await fetchRegionCards(selectedGroup.id);
    } catch (error) {
      console.error(error);
      showErrorToast(
        error instanceof Error ? error.message : "Error al actualizar"
      );
    }
  };

  const handleUpdateVariantRegionStatus = async (
    variantGroupId: number,
    region: string,
    status: "UNKNOWN" | "NOT_EXISTS" | "EXCLUSIVE" | "RESET"
  ) => {
    try {
      const response = await fetch(
        `/api/admin/card-variant-groups/${variantGroupId}/region-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ region, status }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update status");
      }
      if (selectedGroup) {
        await fetchRegionCards(selectedGroup.id);
      }
    } catch (error) {
      console.error(error);
      showErrorToast(
        error instanceof Error ? error.message : "Error al actualizar"
      );
    }
  };

  const selectedCard = useMemo(
    () => ungrouped.find((card) => card.id === selectedCardId) ?? null,
    [ungrouped, selectedCardId]
  );

  const variantLabelById = useMemo(() => {
    return new Map(
      variantGroups.map((group) => [group.id, formatVariantLabel(group)])
    );
  }, [variantGroups]);

  const cardsByRegion = useMemo(() => {
    const map: Record<
      string,
      { base: RegionCard | null; alternates: RegionCard[] }
    > = {};
    resolvedRegionOrder.forEach((region) => {
      map[region] = { base: null, alternates: [] };
    });
    regionCards.forEach((card) => {
      const region = card.region ?? "";
      if (!region) return;
      if (!map[region]) {
        map[region] = { base: null, alternates: [] };
      }
      if (card.isFirstEdition) {
        map[region].base = card;
      } else {
        map[region].alternates.push(card);
      }
    });
    Object.values(map).forEach((entry) => {
      entry.alternates.sort((a, b) => a.code.localeCompare(b.code));
    });
    return map;
  }, [regionCards, resolvedRegionOrder]);

  const isBaseExclusive = useMemo(() => {
    const hasBase = resolvedRegionOrder.some(
      (region) => cardsByRegion[region]?.base
    );
    const hasReviewed = Object.values(baseRegionStatus ?? {}).includes(
      "NOT_EXISTS"
    );
    return hasBase && hasReviewed;
  }, [cardsByRegion, baseRegionStatus, resolvedRegionOrder]);

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
    console.log("[groupsBySet] keys:", Array.from(map.keys()));
    console.log("[groupsBySet] sizes:", Array.from(map.entries()).map(([k, v]) => `${k}:${v.length}`));
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
    const updated = orderedGroups.find(
      (group) => group.id === selectedGroup.id
    );
    if (updated) {
      setSelectedGroup(updated);
      return;
    }
    setSelectedGroup(orderedGroups[0] ?? null);
  }, [orderedGroups, selectedGroup]);

  return (
    <div className="flex h-screen w-full min-w-0 flex-col overflow-hidden bg-[#f2eede] lg:flex-row">
      <div className="flex w-full flex-col border-b border-slate-200 bg-white lg:h-full lg:w-[420px] lg:flex-shrink-0 lg:border-b-0 lg:border-r">
        <div className="border-b border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Card Groups
              </h1>
              <p className="text-xs text-slate-500">{groups.length} grupos</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                fetchGroups();
                fetchUngrouped();
              }}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
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

                console.log(`[setKey=${setKey}] cards:`, section.length, section.map(g => g.canonicalCode));

                return (
                  <div key={setKey} className="space-y-2">
                    <div className="flex items-center justify-between px-1 text-xs font-semibold uppercase text-slate-500">
                      <span>{setKey === "OTHER" ? "Otros" : setKey}</span>
                      <span>{section.length}</span>
                    </div>
                    <div className="space-y-2">
                      {section.map((group) => {
                        const baseComplete =
                          group.baseComplete ??
                          (group.missingRegions?.length ?? 0) === 0;
                        const fullComplete = group.fullComplete ?? false;
                        return (
                          <button
                            key={group.id}
                            onClick={() => setSelectedGroup(group)}
                            className={`w-full rounded-2xl border p-3 text-left transition ${
                              fullComplete
                                ? "border-emerald-300 bg-emerald-50"
                                : baseComplete
                                ? "border-amber-300 bg-amber-50"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            } ${
                              selectedGroup?.id === group.id
                                ? "ring-2 ring-primary/40"
                                : ""
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-16 w-12 overflow-hidden rounded-lg border bg-muted">
                                <img
                                  src={
                                    group.heroCard?.src ??
                                    "/assets/images/backcard.webp"
                                  }
                                  alt={group.heroCard?.name || "Backcard"}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-900">
                                    {group.canonicalCode}
                                  </span>
                                  {group.missingRegions.length > 0 && (
                                    <Badge
                                      variant="destructive"
                                      className="text-[10px]"
                                    >
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
                                      group.regionStatus?.[region] ??
                                      "not-available";
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
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-none flex-col gap-6 px-6 py-6">
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
                      {selectedGroup.isExclusive && (
                        <Badge variant="outline" className="text-xs">
                          Exclusive
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

              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Cartas vinculadas
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {regionCards.length}
                    </Badge>
                  </div>

                  {loadingRegion ? (
                    <div className="text-sm text-muted-foreground">
                      Cargando...
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <div className="grid gap-4 lg:grid-cols-5">
                        {resolvedRegionOrder.map((region) => {
                          const entry = cardsByRegion[region] ?? {
                            base: null,
                            alternates: [],
                          };
                          const reviewStatus =
                            baseRegionStatus?.[region] ?? "VIRGIN";
                          return (
                            <div
                              key={`base-${region}`}
                              className="rounded-2xl border border-slate-200 bg-white p-3"
                            >
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-600">
                                  {region}
                                </span>
                                {(!entry.base ||
                                  !entry.base.baseGroupLinked) && (
                                  <Select
                                    value={reviewStatus}
                                    onValueChange={(value) =>
                                      handleUpdateBaseRegionStatus(
                                        region,
                                        value === "VIRGIN"
                                          ? "RESET"
                                          : (value as
                                              | "UNKNOWN"
                                              | "NOT_EXISTS"
                                              | "EXCLUSIVE")
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-7 w-[140px] rounded-full text-[10px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="VIRGIN">
                                        Sin revisar
                                      </SelectItem>
                                      <SelectItem value="UNKNOWN">
                                        Revisado
                                      </SelectItem>
                                      <SelectItem value="NOT_EXISTS">
                                        No existe
                                      </SelectItem>
                                      <SelectItem value="EXCLUSIVE">
                                        Exclusiva
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                              {entry.base && reviewStatus !== "NOT_EXISTS" ? (
                                <div className="space-y-3">
                                  <div className="relative overflow-hidden rounded-xl border bg-slate-50">
                                    <div className="aspect-[63/88] w-full">
                                      <img
                                        src={
                                          entry.base.src ||
                                          "/assets/images/backcard.webp"
                                        }
                                        alt={entry.base.name}
                                        className="h-full w-full object-contain"
                                      />
                                    </div>
                                    <span className="absolute left-3 top-3 rounded-full border bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                      {entry.base.baseGroupLinked
                                        ? "Linked"
                                        : "No link"}
                                    </span>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-slate-900">
                                      {entry.base.code}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {entry.base.name}
                                    </p>
                                  </div>
                                  {entry.base.baseGroupLinked ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleUnlinkBase(entry.base!.id)
                                      }
                                      className="w-full"
                                    >
                                      Desvincular
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleLinkBase(entry.base!.id)
                                      }
                                      className="w-full"
                                    >
                                      Vincular
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <div
                                    className={`relative overflow-hidden rounded-xl border ${
                                      reviewStatus === "NOT_EXISTS"
                                        ? "border-rose-200 bg-rose-50"
                                        : reviewStatus === "EXCLUSIVE"
                                        ? "border-emerald-200 bg-emerald-50"
                                        : reviewStatus === "UNKNOWN"
                                        ? "border-amber-200 bg-amber-50"
                                        : "border-slate-200 bg-slate-50"
                                    }`}
                                  >
                                    <div className="aspect-[63/88] w-full">
                                      <img
                                        src="/assets/images/backcard.webp"
                                        alt="Backcard"
                                        className={`h-full w-full object-contain ${
                                          reviewStatus === "VIRGIN"
                                            ? ""
                                            : "grayscale"
                                        }`}
                                      />
                                    </div>
                                    <span
                                      className={`absolute left-3 top-3 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                        reviewStatus === "NOT_EXISTS"
                                          ? "border-rose-200 bg-rose-50 text-rose-700"
                                          : reviewStatus === "EXCLUSIVE"
                                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                          : reviewStatus === "UNKNOWN"
                                          ? "border-amber-200 bg-amber-50 text-amber-700"
                                          : "border-slate-200 bg-white/90 text-slate-600"
                                      }`}
                                    >
                                      {reviewStatus === "NOT_EXISTS"
                                        ? "No existe"
                                        : reviewStatus === "EXCLUSIVE"
                                        ? "Exclusiva"
                                        : reviewStatus === "UNKNOWN"
                                        ? "Revisado"
                                        : "Sin revisar"}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Sin base en esta region.
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              Alternas por grupo
                            </p>
                            <p className="text-xs text-slate-500">
                              Selecciona un grupo alterno para asignar por
                              region.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant={
                                creatingVariant ? "secondary" : "outline"
                              }
                              size="sm"
                              onClick={() =>
                                setCreatingVariant((prev) => {
                                  const next = !prev;
                                  if (next) {
                                    setSelectedVariantGroupId(null);
                                  }
                                  return next;
                                })
                              }
                            >
                              {creatingVariant ? "Cancelar" : "+ Crear grupo"}
                            </Button>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {variantGroups.length === 0 ? (
                            <Badge variant="outline">Sin grupos</Badge>
                          ) : (
                            variantGroups.map((group) => (
                              <button
                                key={group.id}
                                onClick={() => {
                                  setSelectedVariantGroupId(group.id);
                                  setCreatingVariant(false);
                                }}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                  selectedVariantGroupId === group.id
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                                }`}
                              >
                                {formatVariantLabel(group)}
                              </button>
                            ))
                          )}
                        </div>

                        {creatingVariant ? (
                          <div className="mt-6 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                            Selecciona una alterna en cualquier region para
                            crear el grupo.
                          </div>
                        ) : null}

                        <div className="mt-6 space-y-4">
                          {!selectedVariantGroupId && !creatingVariant ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                              Selecciona un grupo alterno o crea uno para
                              asignar cartas.
                            </div>
                          ) : null}
                          <div className="flex items-center gap-2">
                            {selectedVariantGroupId
                              ? (() => {
                                  const hasLinks =
                                    variantGroups.find(
                                      (group) =>
                                        group.id === selectedVariantGroupId
                                    )?.links?.length ?? 0;

                                  const hasReviewed = Object.values(
                                    variantRegionStatus?.[
                                      selectedVariantGroupId
                                    ] ?? {}
                                  ).includes("NOT_EXISTS");

                                  return hasLinks && hasReviewed ? (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Exclusive
                                    </Badge>
                                  ) : null;
                                })()
                              : null}
                          </div>
                          <div className="space-y-4">
                            {resolvedRegionOrder.map((region) => {
                              const entry = cardsByRegion[region] ?? {
                                base: null,
                                alternates: [],
                              };

                              const status = selectedVariantGroupId
                                ? variantRegionStatus?.[
                                    selectedVariantGroupId
                                  ]?.[region] ?? "VIRGIN"
                                : "VIRGIN";
                              const hasLinkedAlternate = selectedVariantGroupId
                                ? entry.alternates.some(
                                    (card) =>
                                      card.variantGroupId ===
                                      selectedVariantGroupId
                                  )
                                : false;

                              return (
                                <div
                                  key={`variant-${region}`}
                                  className="rounded-2xl border border-slate-200 bg-white p-3"
                                >
                                  <div className="mb-2 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-600">
                                      {region}
                                    </span>

                                    {selectedVariantGroupId &&
                                      !hasLinkedAlternate && (
                                        <Select
                                          value={status}
                                          onValueChange={(value) =>
                                            handleUpdateVariantRegionStatus(
                                              selectedVariantGroupId,
                                              region,
                                              value === "VIRGIN"
                                                ? "RESET"
                                                : (value as
                                                    | "UNKNOWN"
                                                    | "NOT_EXISTS"
                                                    | "EXCLUSIVE")
                                            )
                                          }
                                        >
                                          <SelectTrigger className="h-7 w-[140px] rounded-full text-[10px]">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="VIRGIN">
                                              Sin revisar
                                            </SelectItem>
                                            <SelectItem value="UNKNOWN">
                                              Revisado
                                            </SelectItem>
                                            <SelectItem value="NOT_EXISTS">
                                              No existe
                                            </SelectItem>
                                            <SelectItem value="EXCLUSIVE">
                                              Exclusiva
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      )}
                                  </div>

                                  {entry.alternates.length === 0 ||
                                  status === "NOT_EXISTS" ? (
                                    <div className="space-y-3">
                                      <div
                                        className={`relative overflow-hidden rounded-xl border ${
                                          status === "NOT_EXISTS"
                                            ? "border-rose-200 bg-rose-50"
                                            : status === "EXCLUSIVE"
                                            ? "border-emerald-200 bg-emerald-50"
                                            : status === "UNKNOWN"
                                            ? "border-amber-200 bg-amber-50"
                                            : "border-slate-200 bg-slate-50"
                                        }`}
                                      >
                                        <div className="aspect-[63/88] w-full">
                                          <img
                                            src="/assets/images/backcard.webp"
                                            alt="Backcard"
                                            className={`h-full w-full object-contain ${
                                              status === "VIRGIN"
                                                ? ""
                                                : "grayscale"
                                            }`}
                                          />
                                        </div>
                                        <span
                                          className={`absolute left-3 top-3 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                            status === "NOT_EXISTS"
                                              ? "border-rose-200 bg-rose-50 text-rose-700"
                                              : status === "EXCLUSIVE"
                                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                              : status === "UNKNOWN"
                                              ? "border-amber-200 bg-amber-50 text-amber-700"
                                              : "border-slate-200 bg-white/90 text-slate-600"
                                          }`}
                                        >
                                          {status === "NOT_EXISTS"
                                            ? "No existe"
                                            : status === "EXCLUSIVE"
                                            ? "Exclusiva"
                                            : status === "UNKNOWN"
                                            ? "Revisado"
                                            : "Sin revisar"}
                                        </span>
                                      </div>
                                      <div className="text-xs text-slate-500">
                                        Sin alternas en esta region.
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
                                      {entry.alternates.map((card) => {
                                        const effectiveGroupId = creatingVariant
                                          ? null
                                          : selectedVariantGroupId;
                                        const isLinked =
                                          effectiveGroupId !== null &&
                                          card.variantGroupId ===
                                            effectiveGroupId;
                                        const isLinkedOther =
                                          effectiveGroupId !== null &&
                                          card.variantGroupId !== null &&
                                          card.variantGroupId !==
                                            effectiveGroupId;
                                        const linkedLabel = card.variantGroupId
                                          ? variantLabelById.get(
                                              card.variantGroupId
                                            ) ?? `Grupo ${card.variantGroupId}`
                                          : null;

                                        return (
                                          <button
                                            key={card.id}
                                            onClick={() => {
                                              if (creatingVariant) {
                                                handleAssignVariant(
                                                  card.id,
                                                  "new"
                                                );
                                                setCreatingVariant(false);
                                                return;
                                              }
                                              if (!selectedVariantGroupId) {
                                                showErrorToast(
                                                  "Selecciona o crea un grupo alterno"
                                                );
                                                return;
                                              }
                                              handleAssignVariant(
                                                card.id,
                                                isLinked
                                                  ? "none"
                                                  : selectedVariantGroupId
                                              );
                                            }}
                                            className={`w-full rounded-xl border p-2 text-left transition ${
                                              isLinked
                                                ? "border-emerald-300 bg-emerald-50"
                                                : isLinkedOther
                                                ? "border-amber-300 bg-amber-50"
                                                : "border-slate-200 bg-white hover:border-slate-300"
                                            }`}
                                          >
                                            <div className="flex flex-col gap-2">
                                              <div className="mx-auto w-full max-w-[110px] overflow-hidden rounded-xl border bg-slate-50">
                                                <div className="aspect-[63/88] w-full">
                                                  <img
                                                    src={
                                                      card.src ||
                                                      "/assets/images/backcard.webp"
                                                    }
                                                    alt={card.name}
                                                    className="h-full w-full object-contain"
                                                  />
                                                </div>
                                              </div>

                                              <div className="space-y-0.5">
                                                <p className="text-xs font-semibold text-slate-900">
                                                  {card.code}
                                                </p>
                                                <p className="text-[11px] text-slate-500">
                                                  {card.name}
                                                </p>
                                                {card.alternateArt ? (
                                                  <p className="text-[10px] text-slate-400">
                                                    {card.alternateArt}
                                                  </p>
                                                ) : null}
                                              </div>

                                              <Badge
                                                variant="outline"
                                                className="w-fit text-[10px]"
                                              >
                                                {creatingVariant
                                                  ? linkedLabel
                                                    ? `En ${linkedLabel}`
                                                    : "Crear grupo"
                                                  : isLinked
                                                  ? "Linked"
                                                  : isLinkedOther
                                                  ? `En ${
                                                      linkedLabel ?? "otro"
                                                    }`
                                                  : "Select"}
                                              </Badge>
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>{" "}
                          {/* ✅ cierre del listado */}
                        </div>
                      </div>
                    </div>
                  )}
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
