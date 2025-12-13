"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card as UICard,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Link as LinkIcon,
  Unlink,
  Search,
  Loader2,
  RefreshCcw,
  ExternalLink,
} from "lucide-react";
import DropdownSearch from "@/components/DropdownSearch";
import ClearFiltersButton from "@/components/ClearFiltersButton";
import MultiSelect from "@/components/MultiSelect";
import FiltersSidebar from "@/components/FiltersSidebar";
import { Transition } from "@headlessui/react";
import { setOptions, colorOptions, rarityOptions } from "@/helpers/constants";
import { CardWithCollectionData } from "@/types";
import { useAllCards } from "@/hooks/useCards";
import LazyImage from "@/components/LazyImage";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import type { CardsFilters } from "@/lib/cards/types";
import { matchesCardCode } from "@/lib/cardFilters";
import { Oswald } from "next/font/google";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const NO_COUNTER_LABEL = "No counter";
const NO_TRIGGER_LABEL = "No trigger";

const toLower = (value: string | null | undefined) =>
  value?.toLowerCase().trim() ?? "";

const matchesCardFilters = (
  card: CardWithCollectionData,
  filters: CardsFilters
) => {
  if (!card) return false;

  const {
    search,
    sets,
    setCodes,
    colors,
    rarities,
    categories,
    costs,
    power,
    attributes,
    types,
    effects,
    altArts,
    region,
    counter,
    trigger,
  } = filters;

  if (search) {
    const normalized = search.toLowerCase().trim();
    const codeMatch = matchesCardCode(card.code, search);
    const nameMatch = toLower(card.name).includes(normalized);
    const aliasMatch = toLower(card.alias).includes(normalized);
    const effectMatch =
      card.effects?.some((entry) =>
        toLower(entry.effect).includes(normalized)
      ) ?? false;
    const textMatch =
      card.texts?.some((entry) => toLower(entry.text).includes(normalized)) ??
      false;
    const setMatch =
      card.sets?.some((entry) =>
        toLower(entry.set.title).includes(normalized)
      ) ?? false;

    if (
      !codeMatch &&
      !nameMatch &&
      !aliasMatch &&
      !effectMatch &&
      !textMatch &&
      !setMatch
    ) {
      return false;
    }
  }

  if (sets?.length) {
    const normalizedSets = sets.map((value) => value.toLowerCase());
    const baseSetCodes = (card.setCode ?? "")
      .split(",")
      .map((code) => code.trim().toLowerCase())
      .filter(Boolean);
    const matchesBase = baseSetCodes.some((code) =>
      normalizedSets.includes(code)
    );
    const matchesAlternate =
      card.alternates?.some((alt) => {
        const altSetCodes = (alt.setCode ?? "")
          .split(",")
          .map((code) => code.trim().toLowerCase())
          .filter(Boolean);
        return altSetCodes.some((code) => normalizedSets.includes(code));
      }) ?? false;
    if (!matchesBase && !matchesAlternate) {
      return false;
    }
  }

  if (setCodes?.length) {
    const matchesSelectedCode = setCodes.some((selectedCode) =>
      matchesCardCode(card.code, selectedCode)
    );
    if (!matchesSelectedCode) {
      return false;
    }
  }

  if (colors?.length) {
    const normalizedSelected = colors.map((color) => color.toLowerCase());
    const cardColors =
      card.colors?.map((entry) => toLower(entry.color)).filter(Boolean) ?? [];
    if (!cardColors.some((color) => normalizedSelected.includes(color))) {
      return false;
    }
  }

  if (rarities?.length) {
    const normalized = rarities.map((value) => value.toLowerCase());
    if (!card.rarity || !normalized.includes(toLower(card.rarity))) {
      return false;
    }
  }

  if (categories?.length) {
    const normalized = categories.map((value) => value.toLowerCase());
    if (!normalized.includes(toLower(card.category))) {
      return false;
    }
  }

  if (costs?.length) {
    if (!card.cost || !costs.includes(card.cost)) {
      return false;
    }
  }

  if (power?.length) {
    if (!card.power || !power.includes(card.power)) {
      return false;
    }
  }

  if (attributes?.length) {
    const normalized = attributes.map((value) => value.toLowerCase());
    if (!normalized.includes(toLower(card.attribute))) {
      return false;
    }
  }

  if (types?.length) {
    const normalized = types.map((value) => value.toLowerCase());
    const cardTypes =
      card.types?.map((entry) => toLower(entry.type)).filter(Boolean) ?? [];
    if (!cardTypes.some((type) => normalized.includes(type))) {
      return false;
    }
  }

  if (effects?.length) {
    const normalized = effects.map((value) => value.toLowerCase());
    const cardEffects =
      card.effects?.map((entry) => toLower(entry.effect)).filter(Boolean) ?? [];
    if (!cardEffects.some((effect) => normalized.includes(effect))) {
      return false;
    }
  }

  if (altArts?.length) {
    const baseMatches =
      card.alternateArt && altArts.includes(card.alternateArt);
    const hasMatchingAlternate =
      card.alternates?.some(
        (alt) => alt.alternateArt && altArts.includes(alt.alternateArt)
      ) ?? false;
    if (!baseMatches && !hasMatchingAlternate) {
      return false;
    }
  }

  if (region) {
    if (toLower(card.region) !== toLower(region)) {
      return false;
    }
  }

  if (counter) {
    if (
      counter === NO_COUNTER_LABEL
        ? Boolean(card.counter && card.counter.trim().length)
        : !toLower(card.counter).includes(toLower(counter))
    ) {
      return false;
    }
  }

  if (trigger) {
    if (
      trigger === NO_TRIGGER_LABEL
        ? Boolean(card.triggerCard && card.triggerCard.trim().length)
        : toLower(card.triggerCard) !== toLower(trigger)
    ) {
      return false;
    }
  }

  return true;
};

type CardDetail = CardWithCollectionData;

interface TcgplayerProduct {
  productId: number;
  name: string;
  imageUrl?: string | null;
  groupName?: string | null;
  url?: string | null;
  categoryName?: string | null;
}

interface TcgplayerSearchResponse {
  results: TcgplayerProduct[];
  totalResults: number;
  nextOffset: number | null;
}

interface TcgplayerProductDetail {
  product: TcgplayerProduct | null;
  pricing: {
    marketPrice?: number | null;
    lowPrice?: number | null;
    highPrice?: number | null;
    midPrice?: number | null;
  } | null;
}

const fetchJSON = async <T,>(input: RequestInfo, init?: RequestInit) => {
  const res = await fetch(input, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Request failed");
  }
  return (await res.json()) as T;
};

export default function AdminTcgLinkerPage() {
  const [search, setSearch] = useState("");
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedAltArts, setSelectedAltArts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCosts, setSelectedCosts] = useState<string[]>([]);
  const [selectedPower, setSelectedPower] = useState<string[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [selectedCounter, setSelectedCounter] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState("");
  const [onlyLinked, setOnlyLinked] = useState(false);
  const [isInputClear, setIsInputClear] = useState(false);
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardDetail | null>(null);
  const [cardDetailLoading, setCardDetailLoading] = useState(false);

  const baseFilters = useMemo(() => ({}), []);

  const { data: allCardsData, isLoading: cardsLoading } = useAllCards(
    baseFilters,
    {
      includeRelations: true,
      includeAlternates: true,
      includeCounts: true,
    }
  );
  const [cards, setCards] = useState<CardWithCollectionData[]>([]);

  useEffect(() => {
    if (allCardsData) {
      setCards(allCardsData);
    }
  }, [allCardsData]);

  const [tcgSearch, setTcgSearch] = useState("");
  const [tcgResults, setTcgResults] = useState<TcgplayerProduct[]>([]);
  const [tcgLoading, setTcgLoading] = useState(false);
  const [tcgNextOffset, setTcgNextOffset] = useState<number | null>(null);

  const [linkedProduct, setLinkedProduct] =
    useState<TcgplayerProductDetail | null>(null);
  const [linking, setLinking] = useState(false);

  const updateLocalCard = (next: CardDetail) => {
    setCards((prev) =>
      prev.map((card) => (card.id === next.id ? { ...card, ...next } : card))
    );
  };

  const cardsFilters = useMemo<CardsFilters>(
    () => ({
      search,
      sets: selectedSets.length ? selectedSets : undefined,
      setCodes: selectedCodes.length ? selectedCodes : undefined,
      colors: selectedColors.length ? selectedColors : undefined,
      rarities: selectedRarities.length ? selectedRarities : undefined,
      categories: selectedCategories.length ? selectedCategories : undefined,
      costs: selectedCosts.length ? selectedCosts : undefined,
      power: selectedPower.length ? selectedPower : undefined,
      attributes: selectedAttributes.length ? selectedAttributes : undefined,
      types: selectedTypes.length ? selectedTypes : undefined,
      effects: selectedEffects.length ? selectedEffects : undefined,
      altArts: selectedAltArts.length ? selectedAltArts : undefined,
      counter: selectedCounter || undefined,
      trigger: selectedTrigger || undefined,
    }),
    [
      search,
      selectedSets,
      selectedCodes,
      selectedColors,
      selectedRarities,
      selectedCategories,
      selectedCosts,
      selectedPower,
      selectedAttributes,
      selectedTypes,
      selectedEffects,
      selectedAltArts,
      selectedCounter,
      selectedTrigger,
    ]
  );

  const filteredCards = useMemo(() => {
    if (!cards.length) return [];
    const matches = cards.filter((card) =>
      matchesCardFilters(card, cardsFilters)
    );
    return matches.filter((card) =>
      onlyLinked ? Boolean(card.tcgplayerProductId) : true
    );
  }, [cards, cardsFilters, onlyLinked]);

  const clearFilters = () => {
    setSearch("");
    setIsInputClear(true);
    setSelectedSets([]);
    setSelectedCodes([]);
    setSelectedColors([]);
    setSelectedRarities([]);
    setSelectedAltArts([]);
    setSelectedCategories([]);
    setSelectedCosts([]);
    setSelectedPower([]);
    setSelectedAttributes([]);
    setSelectedTypes([]);
    setSelectedEffects([]);
    setSelectedCounter("");
    setSelectedTrigger("");
    setOnlyLinked(false);
  };

  const totalFilters =
    (search ? 1 : 0) +
    (selectedSets.length ? 1 : 0) +
    (selectedCodes.length ? 1 : 0) +
    (selectedColors.length ? 1 : 0) +
    (selectedRarities.length ? 1 : 0) +
    (selectedAltArts.length ? 1 : 0) +
    (selectedCategories.length ? 1 : 0) +
    (selectedCosts.length ? 1 : 0) +
    (selectedPower.length ? 1 : 0) +
    (selectedAttributes.length ? 1 : 0) +
    (selectedTypes.length ? 1 : 0) +
    (selectedEffects.length ? 1 : 0) +
    (selectedCounter ? 1 : 0) +
    (selectedTrigger ? 1 : 0) +
    (onlyLinked ? 1 : 0);

  // Fetch card detail when selection changes
  useEffect(() => {
    if (!selectedCard?.id) return;
    const controller = new AbortController();
    const fetchDetail = async () => {
      setCardDetailLoading(true);
      try {
        const detail = await fetchJSON<{ card: CardDetail }>(
          `/api/admin/cards/${selectedCard.id}`,
          { signal: controller.signal }
        );
        setSelectedCard(detail.card);
        updateLocalCard(detail.card);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Failed to fetch card detail", error);
        }
      } finally {
        setCardDetailLoading(false);
      }
    };
    fetchDetail();
    return () => controller.abort();
  }, [selectedCard?.id]);

  // Fetch linked product info when card has productId
  useEffect(() => {
    if (!selectedCard?.tcgplayerProductId) {
      setLinkedProduct(null);
      return;
    }
    const controller = new AbortController();
    const fetchProduct = async () => {
      try {
        const detail = await fetchJSON<TcgplayerProductDetail>(
          `/api/admin/tcgplayer/products/${selectedCard.tcgplayerProductId}?includePricing=true`,
          { signal: controller.signal }
        );
        setLinkedProduct(detail);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Failed to load product detail", error);
        }
        setLinkedProduct(null);
      }
    };
    fetchProduct();
    return () => controller.abort();
  }, [selectedCard?.tcgplayerProductId]);

  const handleSelectCard = (card: CardWithCollectionData) => {
    setSelectedCard(card as CardDetail);
    setLinkedProduct(null);
    setTcgResults([]);
    const searchTerm = card.name || card.code;
    setTcgSearch(searchTerm ?? "");
    handleSearchTcg(0, searchTerm);
  };

  const handleSearchTcg = async (offset = 0, overrideQuery?: string | null) => {
    const query =
      overrideQuery?.trim() ||
      tcgSearch.trim() ||
      selectedCard?.name ||
      selectedCard?.code;
    if (!query) return;
    setTcgLoading(true);
    try {
      const body = {
        name: query,
        categoryId: undefined,
        offset,
        limit: 20,
        getExtendedFields: true,
      };
      const data = await fetchJSON<TcgplayerSearchResponse>(
        "/api/admin/tcgplayer/search",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );
      setTcgResults(
        offset === 0 ? data.results : [...tcgResults, ...data.results]
      );
      setTcgNextOffset(data.nextOffset);
    } catch (error) {
      console.error("TCGplayer search failed", error);
    } finally {
      setTcgLoading(false);
    }
  };

  const handleLinkProduct = async (product: TcgplayerProduct) => {
    if (!selectedCard) return;
    setLinking(true);
    try {
      const res = await fetchJSON<CardDetail>(
        `/api/admin/cards/${selectedCard.id}/tcgplayer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            productId: product.productId,
            tcgUrl: product.url,
          }),
        }
      );
      setSelectedCard(res);
      updateLocalCard(res);
      setLinkedProduct(null);
    } catch (error) {
      console.error("Failed to link card", error);
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkProduct = async () => {
    if (!selectedCard) return;
    setLinking(true);
    try {
      const res = await fetchJSON<CardDetail>(
        `/api/admin/cards/${selectedCard.id}/tcgplayer`,
        {
          method: "DELETE",
        }
      );
      setSelectedCard(res);
      updateLocalCard(res);
      setLinkedProduct(null);
    } catch (error) {
      console.error("Failed to unlink", error);
    } finally {
      setLinking(false);
    }
  };

  const snapshotInfo = useMemo(() => {
    if (!selectedCard?.marketPrice) return null;
    return {
      market: selectedCard.marketPrice,
      low: selectedCard.lowPrice,
      high: selectedCard.highPrice,
      updatedAt: selectedCard.priceUpdatedAt
        ? new Date(selectedCard.priceUpdatedAt).toLocaleString()
        : null,
      currency: selectedCard.priceCurrency || "USD",
    };
  }, [selectedCard]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f2eede] to-[#e6d5b8] py-6 px-4 w-full">
      <div className="mx-auto space-y-6 w-full">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <UICard className="flex flex-col">
            <CardHeader>
              <CardTitle>Local Cards</CardTitle>
              <p className="text-sm text-muted-foreground">
                Usa los filtros para encontrar rápidamente una carta base.
              </p>
            </CardHeader>
            <CardContent className="flex h-full flex-col gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[240px]">
                    <DropdownSearch
                      search={search}
                      setSearch={setSearch}
                      placeholder="Search cards..."
                      isInputClear={isInputClear}
                      setIsInputClear={setIsInputClear}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={() => setIsFiltersModalOpen(true)}
                  >
                    <Search className="h-4 w-4" />
                    Filters
                    {totalFilters > 0 && (
                      <Badge className="ml-1 text-xs">{totalFilters}</Badge>
                    )}
                  </Button>
                  <ClearFiltersButton
                    clearFilters={() => {
                      clearFilters();
                      setIsInputClear(true);
                    }}
                    isTouchable={totalFilters > 0}
                  />
                </div>
                <div className="grid gap-2">
                  <MultiSelect
                    options={setOptions}
                    selected={selectedSets}
                    setSelected={setSelectedSets}
                    buttonLabel="Sets"
                    isFullWidth
                    isSolid
                    isSearchable
                  />
                  <MultiSelect
                    options={colorOptions}
                    selected={selectedColors}
                    setSelected={setSelectedColors}
                    buttonLabel="Colors"
                    isColor
                    isFullWidth
                    isSolid
                  />
                  <MultiSelect
                    options={rarityOptions}
                    selected={selectedRarities}
                    setSelected={setSelectedRarities}
                    buttonLabel="Rarities"
                    isFullWidth
                    isSolid
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {cardsLoading
                      ? "Loading cards..."
                      : `${filteredCards.length} cards`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="linked-only"
                      checked={onlyLinked}
                      onCheckedChange={setOnlyLinked}
                    />
                    <label
                      htmlFor="linked-only"
                      className="cursor-pointer select-none"
                    >
                      Linked only
                    </label>
                  </div>
                </div>
              </div>
              <TooltipProvider delayDuration={200}>
                <div className="flex-1 overflow-y-auto">
                  {cardsLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredCards.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No cards found.
                    </p>
                  ) : (
                    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                      {filteredCards.map((card) => (
                        <div
                          key={card.id}
                          onClick={() => handleSelectCard(card)}
                          className={`cursor-pointer rounded-xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                            selectedCard?.id === card.id
                              ? "border-blue-500 ring-2 ring-blue-100"
                              : "border-gray-200"
                          }`}
                        >
                          <div className="relative rounded-t-xl bg-gray-50 p-2">
                            <LazyImage
                              src={card.src}
                              fallbackSrc="/assets/images/backcard.webp"
                              alt={card.name}
                              className="w-full rounded-lg object-contain"
                              size="small"
                              customOptions={{
                                width: 320,
                                height: 450,
                                quality: 70,
                                format: "webp",
                                fit: "contain",
                              }}
                            />
                            {card.tcgplayerProductId && (
                              <Badge className="absolute left-2 top-2 bg-green-600 text-white shadow">
                                Linked
                              </Badge>
                            )}
                            {card.numOfVariations !== undefined && (
                              <Badge className="absolute right-2 top-2 bg-black/70 text-white">
                                {(card.numOfVariations ?? 0) + 1} vars
                              </Badge>
                            )}
                          </div>
                          <div className="p-3 text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <p
                                    className={`${oswald.className} text-base font-semibold leading-tight`}
                                  >
                                    {card.code}
                                  </p>
                                  <p className="text-sm text-gray-600 line-clamp-2">
                                    {card.name}
                                  </p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{card.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {card.sets?.[0]?.set?.title ?? card.setCode}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                            <p className="mt-1 text-xs text-gray-500">
                              {card.rarity ?? "—"} •{" "}
                              {card.sets?.[0]?.set?.title ?? card.setCode}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TooltipProvider>
            </CardContent>
          </UICard>

          <div className="col-span-1 lg:col-span-2 space-y-6">
            <UICard>
              <CardHeader>
                <CardTitle>Card Detail</CardTitle>
              </CardHeader>
              <CardContent>
                {cardDetailLoading ? (
                  <div className="flex justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : selectedCard ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold">
                        {selectedCard.name}
                      </h2>
                      <Badge variant="outline">{selectedCard.code}</Badge>
                      {selectedCard.tcgplayerProductId && (
                        <Badge>TCG linked</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Set: {selectedCard.setCode} • Rarity:{" "}
                      {selectedCard.rarity ?? "—"}
                    </p>
                    {snapshotInfo ? (
                      <div className="rounded-lg border p-3 bg-white/70 space-y-1 text-sm">
                        <div className="flex gap-4">
                          <span>
                            Market: {snapshotInfo.market}{" "}
                            {snapshotInfo.currency}
                          </span>
                          {snapshotInfo.low && (
                            <span>
                              Low: {snapshotInfo.low} {snapshotInfo.currency}
                            </span>
                          )}
                          {snapshotInfo.high && (
                            <span>
                              High: {snapshotInfo.high} {snapshotInfo.currency}
                            </span>
                          )}
                        </div>
                        {snapshotInfo.updatedAt && (
                          <p className="text-xs text-muted-foreground">
                            Updated at {snapshotInfo.updatedAt}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No price snapshot yet.
                      </p>
                    )}
                    {selectedCard.tcgUrl && (
                      <a
                        href={selectedCard.tcgUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-primary text-sm"
                      >
                        View on TCGplayer <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Select a card to view details.
                  </p>
                )}
              </CardContent>
            </UICard>

            <UICard>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>TCGplayer Search</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Use the card’s name or adjust keywords to find matches.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSearchTcg()}
                  disabled={tcgLoading || !tcgSearch.trim()}
                >
                  {tcgLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" /> Search
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  value={tcgSearch}
                  onChange={(e) => setTcgSearch(e.target.value)}
                  placeholder="Search TCGplayer catalog..."
                />

                {selectedCard?.tcgplayerProductId && (
                  <div className="rounded-lg border bg-white/70 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">Linked product</p>
                        <p className="text-xs text-muted-foreground">
                          ID: {selectedCard.tcgplayerProductId}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleUnlinkProduct}
                        disabled={linking}
                      >
                        {linking ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Unlink className="h-4 w-4 mr-2" />
                            Unlink
                          </>
                        )}
                      </Button>
                    </div>
                    {linkedProduct?.product && (
                      <div className="flex gap-3 text-sm">
                        {linkedProduct.product.imageUrl && (
                          <img
                            src={linkedProduct.product.imageUrl}
                            alt={linkedProduct.product.name}
                            className="w-16 h-24 object-contain rounded"
                          />
                        )}
                        <div>
                          <p className="font-semibold">
                            {linkedProduct.product.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {linkedProduct.product.categoryName} •{" "}
                            {linkedProduct.product.groupName}
                          </p>
                          {linkedProduct.product.url && (
                            <a
                              href={linkedProduct.product.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary inline-flex items-center gap-1"
                            >
                              View product <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  {tcgResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {tcgLoading
                        ? "Searching TCGplayer..."
                        : "No results yet. Try searching above."}
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                      {tcgResults.map((product) => (
                        <div
                          key={product.productId}
                          className="border rounded-lg p-3 bg-white/80 flex gap-3"
                        >
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-16 h-24 object-contain rounded"
                            />
                          ) : (
                            <div className="w-16 h-24 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                              No image
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex justify-between">
                              <div>
                                <p className="font-semibold">{product.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {product.groupName || "Unknown Set"}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleLinkProduct(product)}
                                disabled={
                                  linking ||
                                  selectedCard?.tcgplayerProductId ===
                                    String(product.productId)
                                }
                              >
                                {linking ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <LinkIcon className="h-4 w-4 mr-2" />
                                    Link
                                  </>
                                )}
                              </Button>
                            </div>
                            {product.url && (
                              <a
                                href={product.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary inline-flex items-center gap-1"
                              >
                                View on TCGplayer{" "}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                      {tcgNextOffset !== null && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => handleSearchTcg(tcgNextOffset!)}
                          disabled={tcgLoading}
                        >
                          {tcgLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <RefreshCcw className="h-4 w-4 mr-2" />
                              Load more
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </UICard>
          </div>
        </div>
      </div>
      <Transition
        show={isFiltersModalOpen}
        enter="transition transform duration-300"
        enterFrom="-translate-x-full"
        enterTo="translate-x-0"
        leave="transition transform duration-200"
        leaveFrom="translate-x-0"
        leaveTo="-translate-x-full"
      >
        <FiltersSidebar
          isOpen={isFiltersModalOpen}
          setIsOpen={setIsFiltersModalOpen}
          search={search}
          setSearch={setSearch}
          selectedColors={selectedColors}
          setSelectedColors={setSelectedColors}
          selectedRarities={selectedRarities}
          setSelectedRarities={setSelectedRarities}
          selectedCategories={selectedCategories}
          setSelectedCategories={setSelectedCategories}
          selectedCounter={selectedCounter}
          setSelectedCounter={setSelectedCounter}
          selectedTrigger={selectedTrigger}
          setSelectedTrigger={setSelectedTrigger}
          selectedEffects={selectedEffects}
          setSelectedEffects={setSelectedEffects}
          selectedTypes={selectedTypes}
          setSelectedTypes={setSelectedTypes}
          selectedSets={selectedSets}
          setSelectedSets={setSelectedSets}
          selectedCosts={selectedCosts}
          setSelectedCosts={setSelectedCosts}
          selectedPower={selectedPower}
          setSelectedPower={setSelectedPower}
          selectedAttributes={selectedAttributes}
          setSelectedAttributes={setSelectedAttributes}
          disabledColors={[]}
          selectedAltArts={selectedAltArts}
          setSelectedAltArts={setSelectedAltArts}
          selectedCodes={selectedCodes}
          setSelectedCodes={setSelectedCodes}
          disabledTypes={[]}
        />
      </Transition>
    </div>
  );
}
