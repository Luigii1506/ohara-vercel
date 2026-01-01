"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Search,
  SlidersHorizontal,
  X,
  Grid3X3,
  LayoutList,
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
    null
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
      if (SECTION_ORDER.some((section) => section.key === product.productType)) {
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
    return order.map((key) => ({ key, title: key, products: groups.get(key) || [] }));
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

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setSort("recent");
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
    [handleMove]
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (event.touches.length > 0) {
        handleMove(event.touches[0].clientX, event.touches[0].clientY);
      }
    },
    [handleMove]
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
    <div className="min-h-screen bg-slate-50 w-full">
      <style jsx global>{`
        @keyframes product-float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        .product-float {
          animation: product-float 6s ease-in-out infinite;
        }
      `}</style>
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Productos
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-slate-900">
                  Catalogo de productos
                </h1>
                <p className="text-sm text-slate-500">
                  Playmats, sleeves, decks y coleccionables del juego.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{loading ? "Cargando..." : `${total} producto(s)`}</span>
                {hasActiveFilters && (
                  <Badge variant="secondary" className="text-[11px]">
                    {activeTypeLabel || "Filtrado"}
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
                    placeholder="Buscar productos..."
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

              <div className="hidden items-center justify-between text-xs text-slate-500 md:flex">
                <span>
                  Orden:{" "}
                  <span className="font-semibold text-slate-900">
                    {selectedSortLabel}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  {SORT_OPTIONS.map((option) => {
                    const isActive = sort === option.key;
                    return (
                      <button
                        key={option.key}
                        onClick={() => setSort(option.key)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
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
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {loading && products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              Cargando productos...
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No se encontraron productos con esos filtros.
            </div>
          ) : (
            <div className="space-y-10">
              {sections.map((section) => (
                <div key={section.key} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {section.label}
                    </h2>
                    <span className="text-xs text-slate-500">
                      {section.products.length} item(s)
                    </span>
                  </div>
                  <div className="space-y-5">
                    {groupBySet(section.products).map((group) => (
                      <div key={group.key} className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-semibold uppercase tracking-[0.18em]">
                            {group.title}
                          </span>
                          <span>{group.products.length} item(s)</span>
                        </div>
                        <div
                          className={
                            viewMode === "grid"
                              ? resolveGridClass(section.layoutKey)
                              : "w-full space-y-4"
                          }
                        >
                          {group.products.map((product) => (
                            <button
                              key={product.id}
                              onClick={() => setSelectedProduct(product)}
                              className="w-full text-left"
                            >
                              <div
                                className={`overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg ${
                                  viewMode === "list"
                                    ? "flex items-center gap-4"
                                    : ""
                                }`}
                              >
                                <div
                                  className={`relative ${
                                    viewMode === "list"
                                      ? `${resolveImageClass(
                                          product.productType,
                                          true
                                        )} flex-shrink-0`
                                      : resolveImageClass(
                                          product.productType,
                                          false
                                        )
                                  }`}
                                >
                                  <div className="h-full w-full">
                                    {product.imageUrl || product.thumbnailUrl ? (
                                      <img
                                        src={
                                          product.imageUrl ||
                                          product.thumbnailUrl ||
                                          ""
                                        }
                                        alt={product.name}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-slate-400">
                                        Sin imagen
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-1 flex-col gap-2 px-4 py-3">
                                  <div className="flex items-start justify-between gap-2 flex-col">
                                    <h3 className="text-sm font-semibold text-slate-900">
                                      {product.name}
                                    </h3>
                                    <Badge
                                      variant="outline"
                                      className="shrink-0 text-[10px]"
                                    >
                                      {product.productType}
                                    </Badge>
                                  </div>
                                  {product.description && (
                                    <p className="text-xs text-slate-500 line-clamp-2">
                                      {product.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
                      className="h-full w-full object-cover product-float"
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
                    <div className={!isHovering ? "product-float" : ""}>
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
                          className="relative w-44 aspect-[2.5/3.5] overflow-hidden rounded-xl"
                          style={{
                            boxShadow: isHovering
                              ? "0 24px 40px -12px rgba(15, 23, 42, 0.45)"
                              : "0 16px 30px -12px rgba(15, 23, 42, 0.35)",
                            transition: "box-shadow 0.2s ease",
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
                            className="pointer-events-none absolute inset-0"
                            style={{
                              background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, rgba(255,255,255,0.45), transparent 55%)`,
                              opacity: isHovering ? 0.7 : 0,
                              transition: "opacity 0.2s ease",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-center text-[11px] text-slate-500">
                      Toca la carta para ampliar
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

      <Dialog open={showLargeImage} onOpenChange={setShowLargeImage}>
        <DialogContent className="max-w-md bg-slate-900/95 p-4">
          {selectedProduct && (
            <div className="flex justify-center">
              {selectedProduct.imageUrl || selectedProduct.thumbnailUrl ? (
                <img
                  src={
                    selectedProduct.imageUrl ||
                    selectedProduct.thumbnailUrl ||
                    ""
                  }
                  alt={selectedProduct.name}
                  className="max-h-[70vh] w-auto rounded-xl"
                />
              ) : (
                <div className="text-sm text-slate-200">Sin imagen</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductsClient;
