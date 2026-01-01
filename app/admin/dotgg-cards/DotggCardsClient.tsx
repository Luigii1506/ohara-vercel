"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Search,
  SlidersHorizontal,
  X,
  ExternalLink,
  Sparkles,
  PlusCircle,
} from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BaseDrawer from "@/components/ui/BaseDrawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";

type DotggCard = {
  id: string;
  code: string;
  name: string;
  rarity: string | null;
  cardType: string | null;
  cost: string | null;
  attribute: string | null;
  power: string | null;
  counter: string | null;
  life: string | null;
  trigger: string | null;
  colors: string[];
  types: string[];
  effect: string | null;
  setCode: string | null;
  setLabel: string | null;
  language: string | null;
  cmurl: string | null;
  slug: string | null;
};

type DotggFilters = {
  sets: string[];
  colors: string[];
};

type DotggResponse = {
  items: DotggCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: DotggFilters;
};

type AdminSetOption = {
  id: number;
  code: string | null;
  title: string;
};

type BaseCardOption = {
  id: number;
  code: string;
  name: string;
  setCode: string;
  isFirstEdition: boolean;
  alias?: string | null;
};

const normalizeSetCode = (value: string) =>
  value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

const isR2Url = (url: string) =>
  /images\.oharatcg\.com|\.r2\.dev|\.workers\.dev/i.test(url);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

const DotggCardsClient = () => {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [search, setSearch] = useState("");
  const [setFilter, setSetFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<DotggCard[]>([]);
  const [filters, setFilters] = useState<DotggFilters>({
    sets: [],
    colors: [],
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedCard, setSelectedCard] = useState<DotggCard | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sets, setSets] = useState<AdminSetOption[]>([]);
  const [baseCards, setBaseCards] = useState<BaseCardOption[]>([]);
  const [baseCardsLoading, setBaseCardsLoading] = useState(false);
  const [alternateForm, setAlternateForm] = useState({
    imageUrl: "",
    alias: "",
    alternateArt: "",
    setCode: "",
    region: "US",
    language: "en",
  });
  const [newCardForm, setNewCardForm] = useState({
    imageUrl: "",
    setCode: "",
    region: "US",
    language: "en",
  });
  const [selectedBaseCardId, setSelectedBaseCardId] = useState<string>("");
  const [submittingAlternate, setSubmittingAlternate] = useState(false);
  const [submittingNewCard, setSubmittingNewCard] = useState(false);

  const debouncedSearch = useDebounce(search, 350);

  const setIdLookup = useMemo(() => {
    const map = new Map<string, number>();
    sets.forEach((set) => {
      if (set.code) {
        map.set(normalizeSetCode(set.code), set.id);
      }
    });
    return map;
  }, [sets]);

  const hasActiveFilters =
    setFilter !== "all" || colorFilter !== "all" || search.trim().length > 0;

  const fetchCards = async (nextPage: number) => {
    const params = new URLSearchParams();
    params.set("page", nextPage.toString());
    params.set("limit", "54");
    params.set("set", setFilter);
    params.set("color", colorFilter);
    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }

    const response = await fetch(`/api/admin/dotgg-cards?${params.toString()}`);
    if (!response.ok) {
      throw new Error("No se pudieron cargar las cartas");
    }
    return (await response.json()) as DotggResponse;
  };

  useEffect(() => {
    let isMounted = true;
    const loadSets = async () => {
      try {
        const response = await fetch("/api/admin/sets");
        if (!response.ok) throw new Error("Failed to fetch sets");
        const data = (await response.json()) as AdminSetOption[];
        if (!isMounted) return;
        setSets(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(error);
      }
    };
    loadSets();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchCards(1)
      .then((data) => {
        setCards(data.items);
        setFilters(data.filters);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      })
      .catch(() => {
        setCards([]);
        setTotal(0);
        setTotalPages(1);
        showErrorToast("Error al cargar cartas");
      })
      .finally(() => setLoading(false));
  }, [setFilter, colorFilter, debouncedSearch]);

  const loadMore = async () => {
    if (page >= totalPages || loading) return;
    const nextPage = page + 1;
    setLoading(true);
    try {
      const data = await fetchCards(nextPage);
      setCards((prev) => [...prev, ...data.items]);
      setPage(data.page);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedCard) return;
    const defaultSetCode = selectedCard.setCode ?? "";
    const language = selectedCard.language ?? "en";

    setAlternateForm((prev) => ({
      ...prev,
      setCode: defaultSetCode,
      language,
    }));
    setNewCardForm((prev) => ({
      ...prev,
      setCode: defaultSetCode,
      language,
    }));
  }, [selectedCard]);

  useEffect(() => {
    if (!selectedCard?.code) {
      setBaseCards([]);
      setSelectedBaseCardId("");
      return;
    }

    let isMounted = true;
    const loadBaseCards = async () => {
      try {
        setBaseCardsLoading(true);
        const response = await fetch(
          `/api/admin/cards/by-code/${encodeURIComponent(selectedCard.code)}`
        );
        if (!response.ok) throw new Error("Failed to fetch base cards");
        const data = (await response.json()) as BaseCardOption[];
        if (!isMounted) return;
        const normalized = Array.isArray(data) ? data : [];
        setBaseCards(normalized);

        const defaultBase =
          normalized.find((card) => card.isFirstEdition && !card.alias) ||
          normalized[0];
        setSelectedBaseCardId(defaultBase ? String(defaultBase.id) : "");

        if (defaultBase) {
          setAlternateForm((prev) =>
            prev.setCode
              ? prev
              : {
                  ...prev,
                  setCode: defaultBase.setCode ?? "",
                }
          );
        }
      } catch (error) {
        console.error(error);
        if (!isMounted) return;
        setBaseCards([]);
        setSelectedBaseCardId("");
      } finally {
        if (isMounted) setBaseCardsLoading(false);
      }
    };

    loadBaseCards();
    return () => {
      isMounted = false;
    };
  }, [selectedCard]);

  const clearFilters = () => {
    setSearch("");
    setSetFilter("all");
    setColorFilter("all");
  };

  const uploadImageUrlToR2 = async (url: string, nameSeed: string) => {
    if (!url.trim()) {
      throw new Error("Proporciona una URL de imagen");
    }

    if (isR2Url(url)) {
      return { imageUrl: url, imageKey: null as string | null };
    }

    const filename = `dotgg-${slugify(nameSeed)}-${Date.now().toString(36)}`;
    const response = await fetch("/api/upload-image-r2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: url,
        filename,
        overwrite: false,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Error al subir la imagen a R2");
    }

    return { imageUrl: data.r2Url as string, imageKey: data.filename as string };
  };

  const handleCreateAlternate = async () => {
    if (!selectedCard) return;
    if (!selectedBaseCardId) {
      showErrorToast("Selecciona una carta base");
      return;
    }

    try {
      setSubmittingAlternate(true);
      const { imageUrl, imageKey } = await uploadImageUrlToR2(
        alternateForm.imageUrl.trim(),
        `${selectedCard.code || selectedCard.name}-alt`
      );

      const setCode =
        alternateForm.setCode.trim() ||
        selectedCard.setCode ||
        baseCards.find((card) => String(card.id) === selectedBaseCardId)
          ?.setCode ||
        "";

      const normalizedSetCode = setCode ? normalizeSetCode(setCode) : "";
      const setId = normalizedSetCode
        ? setIdLookup.get(normalizedSetCode)
        : undefined;

      const response = await fetch("/api/admin/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseCardId: Number(selectedBaseCardId),
          src: imageUrl,
          imageKey,
          alias: alternateForm.alias.trim() || null,
          alternateArt: alternateForm.alternateArt.trim() || null,
          setCode: setCode || selectedCard.setCode || "UNKNOWN",
          tcgUrl: selectedCard.cmurl || null,
          region: alternateForm.region || "US",
          language: alternateForm.language || "en",
          setIds: setId ? [setId] : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "No se pudo crear la alterna");
      }

      showSuccessToast("Alterna creada");
    } catch (error) {
      console.error(error);
      showErrorToast("Error al crear alterna");
    } finally {
      setSubmittingAlternate(false);
    }
  };

  const handleCreateNewCard = async () => {
    if (!selectedCard) return;
    try {
      setSubmittingNewCard(true);
      const { imageUrl, imageKey } = await uploadImageUrlToR2(
        newCardForm.imageUrl.trim(),
        `${selectedCard.code || selectedCard.name}-base`
      );

      const setCode = newCardForm.setCode.trim() || selectedCard.setCode || "";
      const normalizedSetCode = setCode ? normalizeSetCode(setCode) : "";
      const setId = normalizedSetCode
        ? setIdLookup.get(normalizedSetCode)
        : undefined;

      const response = await fetch("/api/admin/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          src: imageUrl,
          imageKey,
          name: selectedCard.name,
          code: selectedCard.code,
          setCode: setCode || "UNKNOWN",
          category: selectedCard.cardType || "OTHER",
          rarity: selectedCard.rarity,
          cost: selectedCard.cost,
          power: selectedCard.power,
          attribute: selectedCard.attribute,
          counter: selectedCard.counter,
          life: selectedCard.life,
          triggerCard: selectedCard.trigger,
          effects: selectedCard.effect ? [selectedCard.effect] : [],
          colors: selectedCard.colors,
          types: selectedCard.types,
          tcgUrl: selectedCard.cmurl || null,
          isFirstEdition: true,
          region: newCardForm.region || "US",
          language: newCardForm.language || "en",
          setIds: setId ? [setId] : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "No se pudo crear la carta");
      }

      showSuccessToast("Carta creada");
    } catch (error) {
      console.error(error);
      showErrorToast("Error al crear carta");
    } finally {
      setSubmittingNewCard(false);
    }
  };

  const detailContent = selectedCard ? (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold text-slate-900">
            {selectedCard.name}
          </h2>
          {selectedCard.rarity && (
            <Badge variant="secondary">{selectedCard.rarity}</Badge>
          )}
          {selectedCard.cardType && (
            <Badge className="bg-slate-900 text-white">
              {selectedCard.cardType}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>{selectedCard.code}</span>
          {selectedCard.setCode && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {selectedCard.setCode}
            </span>
          )}
          {selectedCard.setLabel && (
            <span className="text-xs text-slate-400">
              {selectedCard.setLabel}
            </span>
          )}
        </div>
        {selectedCard.cmurl && (
          <a
            href={selectedCard.cmurl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600"
          >
            Ver en Cardmarket <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {selectedCard.colors.map((color) => (
          <Badge key={color} variant="outline">
            {color}
          </Badge>
        ))}
        {selectedCard.types.map((type) => (
          <Badge key={type} variant="secondary">
            {type}
          </Badge>
        ))}
      </div>

      {selectedCard.effect && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {selectedCard.effect}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <InfoItem label="Coste" value={selectedCard.cost} />
        <InfoItem label="Power" value={selectedCard.power} />
        <InfoItem label="Counter" value={selectedCard.counter} />
        <InfoItem label="Attribute" value={selectedCard.attribute} />
        <InfoItem label="Life" value={selectedCard.life} />
        <InfoItem label="Trigger" value={selectedCard.trigger} />
      </div>

      <Card className="border-slate-200">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Crear alterna
              </h3>
              <p className="text-xs text-slate-500">
                Usa la carta base existente y sube la imagen a R2.
              </p>
            </div>
            <Sparkles className="h-4 w-4 text-slate-400" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">
                Carta base
              </label>
              <Select
                value={selectedBaseCardId}
                onValueChange={setSelectedBaseCardId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      baseCardsLoading
                        ? "Buscando..."
                        : baseCards.length === 0
                          ? "Sin carta base"
                          : "Selecciona base"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {baseCards.map((card) => (
                    <SelectItem key={card.id} value={String(card.id)}>
                      {card.name} ({card.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {baseCards.length === 0 && (
                <p className="text-xs text-amber-600">
                  No hay carta base, crea una nueva.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">
                Set code
              </label>
              <Input
                value={alternateForm.setCode}
                onChange={(event) =>
                  setAlternateForm((prev) => ({
                    ...prev,
                    setCode: event.target.value,
                  }))
                }
                placeholder="OP01"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">
                Alias (opcional)
              </label>
              <Input
                value={alternateForm.alias}
                onChange={(event) =>
                  setAlternateForm((prev) => ({
                    ...prev,
                    alias: event.target.value,
                  }))
                }
                placeholder="Alt art"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">
                Alternate art (opcional)
              </label>
              <Input
                value={alternateForm.alternateArt}
                onChange={(event) =>
                  setAlternateForm((prev) => ({
                    ...prev,
                    alternateArt: event.target.value,
                  }))
                }
                placeholder="Treasure"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-slate-600">
                Imagen (URL)
              </label>
              <Input
                value={alternateForm.imageUrl}
                onChange={(event) =>
                  setAlternateForm((prev) => ({
                    ...prev,
                    imageUrl: event.target.value,
                  }))
                }
                placeholder="https://..."
              />
            </div>
          </div>

          <Button
            onClick={handleCreateAlternate}
            disabled={submittingAlternate || baseCards.length === 0}
          >
            {submittingAlternate ? "Creando..." : "Crear alterna"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Crear carta nueva
              </h3>
              <p className="text-xs text-slate-500">
                Genera la carta base desde DotGG.
              </p>
            </div>
            <PlusCircle className="h-4 w-4 text-slate-400" />
          </div>

          {baseCards.length > 0 && (
            <p className="text-xs text-amber-600">
              Ya existe carta base, solo crea alternas si aplica.
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">
                Set code
              </label>
              <Input
                value={newCardForm.setCode}
                onChange={(event) =>
                  setNewCardForm((prev) => ({
                    ...prev,
                    setCode: event.target.value,
                  }))
                }
                placeholder="OP01"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-slate-600">
                Imagen (URL)
              </label>
              <Input
                value={newCardForm.imageUrl}
                onChange={(event) =>
                  setNewCardForm((prev) => ({
                    ...prev,
                    imageUrl: event.target.value,
                  }))
                }
                placeholder="https://..."
              />
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={handleCreateNewCard}
            disabled={submittingNewCard}
          >
            {submittingNewCard ? "Creando..." : "Crear carta base"}
          </Button>
        </CardContent>
      </Card>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Admin · DotGG
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-slate-900">
                  Catalogo de cartas DotGG
                </h1>
                <p className="text-sm text-slate-500">
                  Filtra, revisa y crea alternas desde la base de DotGG.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  {loading ? "Cargando..." : `${total} carta(s)`}
                </span>
                {hasActiveFilters && (
                  <Badge variant="secondary" className="text-[11px]">
                    Filtrado
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Card className="border-slate-200">
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nombre, set o codigo..."
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="md:hidden"
                    onClick={() => setIsFilterOpen(true)}
                  >
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Filtros
                  </Button>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="mr-1 h-4 w-4" />
                      Limpiar
                    </Button>
                  )}
                </div>
              </div>

              <div className="hidden flex-col gap-4 md:flex">
                <FilterRow
                  label="Set"
                  options={filters.sets}
                  selected={setFilter}
                  onChange={setSetFilter}
                />
                <FilterRow
                  label="Color"
                  options={filters.colors}
                  selected={colorFilter}
                  onChange={setColorFilter}
                  normalizeOption={(value) => value.toLowerCase()}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <button
                key={`${card.id}-${card.code}`}
                className="text-left"
                onClick={() => {
                  setSelectedCard(card);
                  setDetailOpen(true);
                }}
              >
                <Card className="h-full border-slate-200 transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-md">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {card.name}
                        </h3>
                        <p className="text-xs text-slate-500">{card.code}</p>
                      </div>
                      {card.setCode && (
                        <Badge variant="secondary">{card.setCode}</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {card.colors.map((color) => (
                        <Badge key={color} variant="outline">
                          {color}
                        </Badge>
                      ))}
                      {card.cardType && (
                        <Badge className="bg-slate-900 text-white">
                          {card.cardType}
                        </Badge>
                      )}
                    </div>
                    {card.effect && (
                      <p className="line-clamp-2 text-xs text-slate-500">
                        {card.effect}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>

          {page < totalPages && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={loading}>
                {loading ? "Cargando..." : "Cargar mas"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <BaseDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
      >
        <div className="space-y-6 px-4 pb-8 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Filtros</h2>
            <Button variant="ghost" size="icon" onClick={clearFilters}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <FilterRow
            label="Set"
            options={filters.sets}
            selected={setFilter}
            onChange={setSetFilter}
          />
          <FilterRow
            label="Color"
            options={filters.colors}
            selected={colorFilter}
            onChange={setColorFilter}
            normalizeOption={(value) => value.toLowerCase()}
          />
          <Button className="w-full" onClick={() => setIsFilterOpen(false)}>
            Ver resultados
          </Button>
        </div>
      </BaseDrawer>

      {isDesktop ? (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Detalle DotGG</DialogTitle>
            </DialogHeader>
            {detailContent}
          </DialogContent>
        </Dialog>
      ) : (
        <BaseDrawer
          isOpen={detailOpen}
          onClose={() => setDetailOpen(false)}
          maxHeight="92vh"
        >
          <div className="px-4 pb-8 pt-6">
            {detailContent}
          </div>
        </BaseDrawer>
      )}
    </div>
  );
};

const InfoItem = ({ label, value }: { label: string; value?: string | null }) => {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="text-sm text-slate-700">{value || "—"}</p>
    </div>
  );
};

type FilterRowProps = {
  label: string;
  options: string[];
  selected: string;
  onChange: (value: string) => void;
  normalizeOption?: (value: string) => string;
};

const FilterRow = ({
  label,
  options,
  selected,
  onChange,
  normalizeOption,
}: FilterRowProps) => {
  const normalizedSelected = normalizeOption
    ? normalizeOption(selected)
    : selected;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        <FilterPill
          active={normalizedSelected === "all"}
          onClick={() => onChange("all")}
        >
          Todos
        </FilterPill>
        {options.map((option) => {
          const normalized = normalizeOption
            ? normalizeOption(option)
            : option;
          return (
            <FilterPill
              key={option}
              active={normalized === normalizedSelected}
              onClick={() => onChange(option)}
            >
              {option}
            </FilterPill>
          );
        })}
      </div>
    </div>
  );
};

const FilterPill = ({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) => {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
};

export default DotggCardsClient;
