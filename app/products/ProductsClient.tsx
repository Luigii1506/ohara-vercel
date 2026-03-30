"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Search,
  SlidersHorizontal,
  X,
  Grid3X3,
  LayoutList,
  ZoomIn,
  Boxes,
  Package2,
  Layers3,
  Sparkles,
  ScrollText,
  WalletCards,
  LucideIcon,
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

type ProductItem = {
  id: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  productType: string;
  releaseDate?: string | null;
  officialPrice?: string | number | null;
  officialPriceCurrency?: string | null;
  set?: { id: number; title: string } | null;
  createdAt: string;
};

type ProductsResponse = {
  items: ProductItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type ViewMode = "grid" | "list";

const PRODUCT_TYPES = [
  { key: "all", label: "Todos" },
  { key: "PLAYMAT", label: "Playmat" },
  { key: "SLEEVE", label: "Sleeve" },
  { key: "DECK_BOX", label: "Deck Box" },
  { key: "STORAGE_BOX", label: "Storage Box" },
  { key: "UNCUT_SHEET", label: "Uncut Sheet" },
  { key: "PROMO_PACK", label: "Promo Pack" },
  { key: "DISPLAY_BOX", label: "Display Box" },
  { key: "COLLECTORS_SET", label: "Collector Set" },
  { key: "TIN_PACK", label: "Tin Pack" },
  { key: "ILLUSTRATION_BOX", label: "Illustration Box" },
  { key: "ANNIVERSARY_SET", label: "Anniversary Set" },
  { key: "PREMIUM_CARD_COLLECTION", label: "Premium Card Collection" },
  { key: "DOUBLE_PACK", label: "Double Pack" },
  { key: "DEVIL_FRUIT", label: "Devil Fruit" },
  { key: "BOOSTER", label: "Booster" },
  { key: "DECK", label: "Deck" },
  { key: "STARTER_DECK", label: "Starter Deck" },
  { key: "PREMIUM_BOOSTER_BOX", label: "Premium Booster Box" },
  { key: "OTHER", label: "Other" },
];

const SORT_OPTIONS = [
  { key: "recent", label: "Recientes" },
  { key: "name", label: "Nombre" },
  { key: "type", label: "Tipo" },
];

const SECTION_ORDER = [
  { key: "SLEEVE", label: "Sleeves" },
  { key: "PLAYMAT", label: "Playmats" },
  { key: "UNCUT_SHEET", label: "Uncut Sheets" },
];

const TYPE_METADATA: Record<
  string,
  {
    label: string;
    shortLabel: string;
    description: string;
    icon: LucideIcon;
    accent: string;
    surface: string;
  }
> = {
  SLEEVE: {
    label: "Sleeves",
    shortLabel: "Sleeves",
    description: "Protectores pensados para deck play y colección.",
    icon: Layers3,
    accent: "from-amber-500 via-orange-500 to-rose-500",
    surface: "from-amber-50 via-orange-50 to-rose-50",
  },
  PLAYMAT: {
    label: "Playmats",
    shortLabel: "Playmats",
    description: "Superficie de juego premium para mesa y exhibición.",
    icon: ScrollText,
    accent: "from-cyan-500 via-sky-500 to-blue-600",
    surface: "from-cyan-50 via-sky-50 to-blue-50",
  },
  UNCUT_SHEET: {
    label: "Uncut Sheets",
    shortLabel: "Uncut",
    description: "Piezas de display para colección y wall art.",
    icon: Sparkles,
    accent: "from-fuchsia-500 via-pink-500 to-rose-500",
    surface: "from-fuchsia-50 via-pink-50 to-rose-50",
  },
  DECK: {
    label: "Decks",
    shortLabel: "Decks",
    description: "Productos listos para jugar o expandir arquetipos.",
    icon: WalletCards,
    accent: "from-emerald-500 via-teal-500 to-cyan-600",
    surface: "from-emerald-50 via-teal-50 to-cyan-50",
  },
  STARTER_DECK: {
    label: "Starter Decks",
    shortLabel: "Starter",
    description: "Punto de entrada rápido para nuevos jugadores.",
    icon: WalletCards,
    accent: "from-emerald-500 via-teal-500 to-cyan-600",
    surface: "from-emerald-50 via-teal-50 to-cyan-50",
  },
  BOOSTER: {
    label: "Boosters",
    shortLabel: "Booster",
    description: "Sobres y cajas para abrir, coleccionar o vender.",
    icon: Package2,
    accent: "from-violet-500 via-indigo-500 to-blue-600",
    surface: "from-violet-50 via-indigo-50 to-blue-50",
  },
  DISPLAY_BOX: {
    label: "Display Boxes",
    shortLabel: "Display",
    description: "Cajas selladas pensadas para retail y apertura masiva.",
    icon: Boxes,
    accent: "from-violet-500 via-indigo-500 to-blue-600",
    surface: "from-violet-50 via-indigo-50 to-blue-50",
  },
  PREMIUM_CARD_COLLECTION: {
    label: "Premium Collections",
    shortLabel: "Premium",
    description: "Ediciones especiales con foco visual y coleccionable.",
    icon: Sparkles,
    accent: "from-rose-500 via-pink-500 to-fuchsia-500",
    surface: "from-rose-50 via-pink-50 to-fuchsia-50",
  },
  OTHER: {
    label: "Otros",
    shortLabel: "Otros",
    description:
      "Accesorios y formatos especiales fuera de las líneas principales.",
    icon: Boxes,
    accent: "from-slate-500 via-slate-600 to-slate-800",
    surface: "from-slate-50 via-slate-100 to-slate-100",
  },
};

const getTypeMeta = (type: string) =>
  TYPE_METADATA[type] ?? {
    label:
      PRODUCT_TYPES.find((item) => item.key === type)?.label ??
      type.replaceAll("_", " "),
    shortLabel:
      PRODUCT_TYPES.find((item) => item.key === type)?.label ??
      type.replaceAll("_", " "),
    description: "Producto oficial del juego y sus líneas coleccionables.",
    icon: Boxes,
    accent: "from-slate-500 via-slate-600 to-slate-800",
    surface: "from-slate-50 via-slate-100 to-slate-100",
  };

const formatPrice = (
  value?: string | number | null,
  currency?: string | null,
) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/[^0-9.-]+/g, ""));

  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(numeric);
};

const formatReleaseDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

const ProductsClient = () => {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(
    null,
  );
  const productCardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);
  const [showLargeImage, setShowLargeImage] = useState(false);

  const debouncedSearch = useDebounce(search, 350);

  const fetchProducts = async (nextPage: number) => {
    const params = new URLSearchParams();
    params.set("page", nextPage.toString());
    params.set("limit", "24");
    params.set("type", typeFilter);
    params.set("sort", sort);
    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }

    const response = await fetch(`/api/products?${params.toString()}`);
    if (!response.ok) {
      throw new Error("No se pudieron cargar los productos");
    }
    return (await response.json()) as ProductsResponse;
  };

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchProducts(1)
      .then((data) => {
        setProducts(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      })
      .catch(() => {
        setProducts([]);
        setTotal(0);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  }, [typeFilter, sort, debouncedSearch]);

  useEffect(() => {
    if (!selectedProduct) {
      setShowLargeImage(false);
    }
  }, [selectedProduct]);

  const loadMore = async () => {
    if (page >= totalPages || loading) return;
    const nextPage = page + 1;
    setLoading(true);
    try {
      const data = await fetchProducts(nextPage);
      setProducts((prev) => [...prev, ...data.items]);
      setPage(data.page);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  };

  const hasActiveFilters = typeFilter !== "all" || search.trim().length > 0;

  const activeTypeLabel = useMemo(() => {
    return PRODUCT_TYPES.find((item) => item.key === typeFilter)?.label ?? "";
  }, [typeFilter]);

  const selectedSortLabel = useMemo(() => {
    return SORT_OPTIONS.find((item) => item.key === sort)?.label ?? "";
  }, [sort]);

  const featuredCategories = useMemo(() => {
    return SECTION_ORDER.map((section) => {
      const meta = getTypeMeta(section.key);
      const count = products.filter(
        (product) => product.productType === section.key,
      ).length;

      return {
        ...section,
        ...meta,
        count,
      };
    }).filter((section) => section.count > 0);
  }, [products]);

  const sections = useMemo(() => {
    const hasQuery = debouncedSearch.trim().length > 0;
    if (typeFilter !== "all" || hasQuery) {
      return [
        {
          key: "results",
          label: "Resultados",
          products,
          layoutKey: typeFilter !== "all" ? typeFilter : "mixed",
        },
      ];
    }

    const grouped = new Map<string, ProductItem[]>();
    const other: ProductItem[] = [];

    products.forEach((product) => {
      if (
        SECTION_ORDER.some((section) => section.key === product.productType)
      ) {
        const list = grouped.get(product.productType) ?? [];
        list.push(product);
        grouped.set(product.productType, list);
      } else {
        other.push(product);
      }
    });

    const ordered = SECTION_ORDER.map((section) => ({
      key: section.key,
      label: section.label,
      products: grouped.get(section.key) ?? [],
      layoutKey: section.key,
    })).filter((section) => section.products.length > 0);

    if (other.length > 0) {
      ordered.push({
        key: "OTHER",
        label: "Otros",
        products: other,
        layoutKey: "mixed",
      });
    }

    return ordered;
  }, [products, typeFilter, debouncedSearch]);

  const groupBySet = useCallback((items: ProductItem[]) => {
    const groups = new Map<string, ProductItem[]>();
    const order: string[] = [];
    items.forEach((product) => {
      const key = product.set?.title?.trim() || "Sin set";
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)?.push(product);
    });
    return order.map((key) => ({
      key,
      title: key,
      products: groups.get(key) || [],
    }));
  }, []);

  const resolveImageClass = (productType: string, isList: boolean) => {
    if (isList) {
      if (productType === "PLAYMAT") return "h-20 w-28";
      if (productType === "UNCUT_SHEET") return "h-20 w-24";
      return "h-24 w-20";
    }
    if (productType === "PLAYMAT") return "aspect-[16/10]";
    if (productType === "UNCUT_SHEET") return "aspect-[4/3]";
    return "aspect-[3/4]";
  };

  const resolveGridClass = (productType: string) => {
    if (productType === "PLAYMAT") {
      return "grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";
    }
    if (productType === "UNCUT_SHEET") {
      return "grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";
    }
    return "grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";
  };

  const resolvePreviewSize = (productType: string) => {
    if (productType === "PLAYMAT") {
      return "w-72 sm:w-80 aspect-[16/10]";
    }
    if (productType === "UNCUT_SHEET") {
      return "w-64 sm:w-72 aspect-[4/3]";
    }
    return "w-52 sm:w-60 aspect-[2.5/3.5]";
  };

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setSort("recent");
  };

  const renderProductCard = (product: ProductItem, isList: boolean) => {
    const meta = getTypeMeta(product.productType);
    const priceLabel = formatPrice(
      product.officialPrice,
      product.officialPriceCurrency,
    );
    const releaseLabel = formatReleaseDate(product.releaseDate);

    return (
      <button
        key={product.id}
        onClick={() => setSelectedProduct(product)}
        className="group w-full text-left"
      >
        <div
          className={`relative overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_48px_rgba(15,23,42,0.12)] ${
            isList ? "flex items-center gap-4 p-3 sm:p-4" : ""
          }`}
        >
          {!isList && (
            <div
              className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-r ${meta.surface} opacity-80`}
            />
          )}

          <div
            className={`relative ${
              isList
                ? `${resolveImageClass(product.productType, true)} flex-shrink-0`
                : resolveImageClass(product.productType, false)
            } ${!isList ? "m-3 mb-0 sm:m-4 sm:mb-0" : ""} overflow-hidden rounded-[22px] border border-white/70 bg-slate-100 shadow-sm`}
          >
            {product.imageUrl || product.thumbnailUrl ? (
              <img
                src={product.imageUrl || product.thumbnailUrl || ""}
                alt={product.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-slate-400">
                Sin imagen
              </div>
            )}
          </div>

          <div
            className={`relative flex flex-1 flex-col ${
              isList ? "gap-3" : "gap-3 px-4 pb-4 pt-4 sm:px-5 sm:pb-5"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={`border-0 bg-gradient-to-r ${meta.surface} text-slate-700`}
                  >
                    {meta.shortLabel}
                  </Badge>
                  {product.set?.title && (
                    <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                      {product.set.title}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold leading-snug text-slate-900 sm:text-[15px]">
                  {product.name}
                </h3>
              </div>
            </div>

            <p className="text-sm leading-6 text-slate-600 line-clamp-2">
              {product.description || meta.description}
            </p>

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
              {releaseLabel && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1">
                  {releaseLabel}
                </span>
              )}
              {priceLabel && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                  {priceLabel}
                </span>
              )}
              <span className="inline-flex items-center rounded-full px-2 py-1 font-medium text-slate-700">
                Ver detalle
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  };

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!productCardRef.current) return;
    const rect = productCardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const tiltX = ((clientY - centerY) / (rect.height / 2)) * -12;
    const tiltY = ((clientX - centerX) / (rect.width / 2)) * 12;

    const glareX = ((clientX - rect.left) / rect.width) * 100;
    const glareY = ((clientY - rect.top) / rect.height) * 100;

    setTilt({ x: tiltX, y: tiltY });
    setGlarePosition({ x: glareX, y: glareY });
  }, []);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      handleMove(event.clientX, event.clientY);
    },
    [handleMove],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (event.touches.length > 0) {
        handleMove(event.touches[0].clientX, event.touches[0].clientY);
      }
    },
    [handleMove],
  );

  const handleEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  const handleLeave = useCallback(() => {
    setIsHovering(false);
    setTilt({ x: 0, y: 0 });
    setGlarePosition({ x: 50, y: 50 });
  }, []);

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(255,237,213,0.85),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(219,234,254,0.85),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)]">
      <div className="mx-auto max-w-7xl px-4 pb-14 pt-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <Card className="border-white/70 bg-white/85 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur">
            <CardContent className="space-y-5 p-4 sm:p-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nombre, línea o set..."
                    className="h-11 rounded-2xl border-slate-200 bg-white pl-10"
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
                  <Button
                    variant={viewMode === "grid" ? "default" : "outline"}
                    size="icon"
                    onClick={() => setViewMode("grid")}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "outline"}
                    size="icon"
                    onClick={() => setViewMode("list")}
                  >
                    <LayoutList className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="hidden items-center justify-between gap-4 md:flex">
                <div className="flex flex-wrap gap-2">
                  {SORT_OPTIONS.map((option) => {
                    const isActive = sort === option.key;
                    return (
                      <button
                        key={option.key}
                        onClick={() => setSort(option.key)}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                          isActive
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>
                    {loading ? "Cargando..." : `${total} producto(s)`}
                  </span>
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="text-[11px]">
                      {activeTypeLabel || "Filtrado"}
                    </Badge>
                  )}
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

              <div className="hidden flex-wrap gap-2 md:flex">
                {PRODUCT_TYPES.map((filter) => {
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
            </CardContent>
          </Card>

          {loading && products.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/80 p-10 text-center text-sm text-slate-500">
              Cargando productos...
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/80 p-10 text-center text-sm text-slate-500">
              No se encontraron productos con esos filtros.
            </div>
          ) : (
            <div className="space-y-10">
              {sections.map((section) => (
                <section key={section.key} className="space-y-5">
                  <div className="flex flex-col gap-3 rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br ${
                          getTypeMeta(section.layoutKey).surface
                        } text-slate-800`}
                      >
                        {(() => {
                          const SectionIcon = getTypeMeta(
                            section.layoutKey,
                          ).icon;
                          return <SectionIcon className="h-6 w-6" />;
                        })()}
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-xl font-semibold text-slate-950">
                          {section.label}
                        </h2>
                        <p className="max-w-2xl text-sm leading-6 text-slate-600">
                          {getTypeMeta(section.layoutKey).description}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {section.products.length} item(s)
                    </span>
                  </div>

                  <div className="space-y-6">
                    {groupBySet(section.products).map((group) => (
                      <div
                        key={group.key}
                        className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:p-5"
                      >
                        <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
                          <div>
                            <span className="font-semibold uppercase tracking-[0.18em]">
                              {group.title}
                            </span>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {group.products.length} producto(s) agrupados por
                              set
                            </p>
                          </div>
                        </div>
                        <div
                          className={
                            viewMode === "grid"
                              ? resolveGridClass(section.layoutKey)
                              : "w-full space-y-4"
                          }
                        >
                          {group.products.map((product) =>
                            renderProductCard(product, viewMode === "list"),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {page < totalPages && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={loading}>
                {loading ? "Cargando..." : "Cargar mas"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      <BaseDrawer isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)}>
        <div className="space-y-6 px-6 pb-8 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Filtros</h2>
            <button
              onClick={() => setIsFilterOpen(false)}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Tipo
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRODUCT_TYPES.map((filter) => {
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
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Orden
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SORT_OPTIONS.map((option) => {
                const isActive = sort === option.key;
                return (
                  <button
                    key={option.key}
                    onClick={() => setSort(option.key)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
      </BaseDrawer>

      {/* Product Detail */}
      {isDesktop ? (
        <Dialog
          open={Boolean(selectedProduct)}
          onOpenChange={(open) => {
            if (!open) setSelectedProduct(null);
          }}
        >
          <DialogContent className="max-w-3xl bg-gradient-to-b from-slate-50 to-white">
            {selectedProduct && (
              <div className="grid gap-6 md:grid-cols-[240px_1fr]">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-lg">
                  {selectedProduct.imageUrl || selectedProduct.thumbnailUrl ? (
                    <img
                      src={
                        selectedProduct.imageUrl ||
                        selectedProduct.thumbnailUrl ||
                        ""
                      }
                      alt={selectedProduct.name}
                      className="h-full w-full object-cover animate-card-float"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                      Sin imagen
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <DialogHeader>
                    <DialogTitle className="text-xl">
                      {selectedProduct.name}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {selectedProduct.productType}
                    </Badge>
                    <Badge variant="outline">Producto oficial</Badge>
                  </div>
                  {selectedProduct.description ? (
                    <p className="text-sm text-slate-600">
                      {selectedProduct.description}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Sin descripcion adicional.
                    </p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      ) : (
        <BaseDrawer
          isOpen={Boolean(selectedProduct)}
          onClose={() => setSelectedProduct(null)}
          maxHeight="85vh"
        >
          {selectedProduct && (
            <div className="space-y-5 px-6 pb-8 pt-4">
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-100 to-white p-4">
                <div className="flex justify-center">
                  <div
                    ref={productCardRef}
                    className="relative cursor-pointer"
                    style={{ perspective: "1000px", touchAction: "none" }}
                    onMouseMove={handleMouseMove}
                    onMouseEnter={handleEnter}
                    onMouseLeave={handleLeave}
                    onTouchMove={handleTouchMove}
                    onTouchStart={handleEnter}
                    onTouchEnd={handleLeave}
                    onClick={() => setShowLargeImage(true)}
                  >
                    <div
                      className={!isHovering ? "animate-card-float" : ""}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <div
                        className="relative transition-transform duration-150 ease-out"
                        style={{
                          transform: isHovering
                            ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.02)`
                            : "rotateX(0deg) rotateY(0deg) scale(1)",
                          transformStyle: "preserve-3d",
                        }}
                      >
                        <div
                          className={`relative ${resolvePreviewSize(
                            selectedProduct.productType,
                          )} overflow-hidden rounded-xl`}
                          style={{
                            boxShadow: isHovering
                              ? "0 30px 60px -15px rgba(0, 0, 0, 0.45), 0 15px 30px -10px rgba(0, 0, 0, 0.3)"
                              : "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 10px 25px -8px rgba(0, 0, 0, 0.2)",
                            transition: "box-shadow 0.3s ease",
                          }}
                        >
                          {selectedProduct.imageUrl ||
                          selectedProduct.thumbnailUrl ? (
                            <img
                              src={
                                selectedProduct.imageUrl ||
                                selectedProduct.thumbnailUrl ||
                                ""
                              }
                              alt={selectedProduct.name}
                              className="h-full w-full object-cover"
                              draggable={false}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                              Sin imagen
                            </div>
                          )}
                          <div
                            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                            style={{
                              opacity: isHovering ? 0.6 : 0,
                              background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.4) 20%, transparent 60%)`,
                            }}
                          />
                          <div
                            className="absolute inset-0 pointer-events-none transition-opacity duration-300 mix-blend-color-dodge"
                            style={{
                              opacity: isHovering ? 0.15 : 0,
                              background: `linear-gradient(
                                ${45 + tilt.y * 2}deg,
                                rgba(255, 0, 0, 0.5) 0%,
                                rgba(255, 154, 0, 0.5) 10%,
                                rgba(208, 222, 33, 0.5) 20%,
                                rgba(79, 220, 74, 0.5) 30%,
                                rgba(63, 218, 216, 0.5) 40%,
                                rgba(47, 201, 226, 0.5) 50%,
                                rgba(28, 127, 238, 0.5) 60%,
                                rgba(95, 21, 242, 0.5) 70%,
                                rgba(186, 12, 248, 0.5) 80%,
                                rgba(251, 7, 217, 0.5) 90%,
                                rgba(255, 0, 0, 0.5) 100%
                              )`,
                            }}
                          />
                        </div>
                        <div
                          className={`absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 transition-opacity duration-200 ${
                            isHovering ? "opacity-100" : "opacity-0"
                          }`}
                        >
                          <ZoomIn className="h-3 w-3" />
                          <span>Toca para ampliar</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">
                  {selectedProduct.name}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {selectedProduct.productType}
                  </Badge>
                  <Badge variant="outline">Producto oficial</Badge>
                </div>
                {selectedProduct.description ? (
                  <p className="text-sm text-slate-600">
                    {selectedProduct.description}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">
                    Sin descripcion adicional.
                  </p>
                )}
              </div>
            </div>
          )}
        </BaseDrawer>
      )}

      {showLargeImage && selectedProduct && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-[9999] px-5 cursor-pointer"
          onClick={() => setShowLargeImage(false)}
          onTouchEnd={(event) => {
            event.preventDefault();
            setShowLargeImage(false);
          }}
        >
          <div className="w-full max-w-md pointer-events-none animate-in zoom-in-95 fade-in duration-200">
            <div className="text-white/80 text-sm font-medium text-center py-3">
              Toca para cerrar
            </div>
            <div className="flex flex-col items-center gap-4">
              <img
                src={
                  selectedProduct.imageUrl || selectedProduct.thumbnailUrl || ""
                }
                className="max-w-full max-h-[calc(100dvh-150px)] object-contain rounded-lg shadow-2xl"
                alt={selectedProduct.name}
              />
              <div className="text-white text-center">
                <span className="font-medium text-lg">
                  {selectedProduct.name}
                </span>
                {selectedProduct.set?.title && (
                  <p className="text-white/70 text-sm mt-1">
                    {selectedProduct.set.title}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsClient;
