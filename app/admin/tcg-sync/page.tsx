"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDebounce } from "use-debounce";
import { RefreshCcw, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import {
  Card as UICard,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";
import { cn } from "@/lib/utils";

const CLASSIFICATION_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "cards", label: "Cartas" },
  { value: "sealed", label: "Sellados" },
] as const;

const STATUS_OPTIONS = [
  { value: "missing", label: "Sin link" },
  { value: "linked", label: "Linkeados" },
  { value: "all", label: "Catálogo" },
  { value: "orphan", label: "Huérfanos" },
  { value: "removed", label: "Removidos" },
] as const;

type Classification = (typeof CLASSIFICATION_OPTIONS)[number]["value"];
type SyncView = (typeof STATUS_OPTIONS)[number]["value"];

type LinkedCardPayload = {
  type: "card";
  id: number;
  name: string;
  code: string;
  setCode: string | null;
  tcgplayerProductId: number;
  tcgplayerLinkStatus: boolean | null;
  imageUrl: string | null;
};

type CatalogItemPayload = {
  type: "catalog";
  productId: number;
  name: string;
  cleanName?: string | null;
  productLineName?: string;
  cardType?: string | null;
  rarity?: string | null;
  isSealed?: boolean | null;
  url?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  lastSyncedAt?: string | null;
  productStatus?: string | null;
  linkedAt?: string | null;
  linkedById?: number | null;
  linkedCard: LinkedCardPayload | null;
};

type SyncSummary = {
  totalCatalog: number;
  totalCards: number;
  totalSealed: number;
  totalLinked: number;
  totalMissing: number;
  totalOrphaned: number;
  totalRemoved: number;
  lastCatalogSyncAt?: string | null;
};

type SyncResponse = {
  summary: SyncSummary;
  result: {
    status: SyncView;
    page: number;
    pageSize: number;
    totalItems: number;
    items: Array<CatalogItemPayload | LinkedCardPayload>;
  };
};

type AdminSetOption = {
  id: number;
  title: string;
  code?: string | null;
};

type UnlinkedCardPayload = {
  id: number;
  name: string;
  code: string;
  setCode?: string | null;
  imageUrl?: string | null;
  rarity?: string | null;
  alternateArt?: string | null;
  tcgplayerLinkStatus?: boolean | null;
  tcgplayerProductId?: string | null;
  sets: Array<{ id: number; title: string; code?: string | null }>;
};

type BaseCardOption = {
  id: number;
  name: string;
  code: string;
  src: string | null;
  setCode?: string | null;
  illustrator?: string | null;
};

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const formatNumber = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const buildTcgplayerUrl = (productId: number, url?: string | null) => {
  if (url && url.startsWith("http")) {
    return url;
  }
  return `https://www.tcgplayer.com/product/${productId}`;
};

const AdminTcgSyncPage = () => {
  const [classification, setClassification] = useState<Classification>("all");
  const [view, setView] = useState<SyncView>("missing");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch] = useDebounce(searchInput, 400);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SyncResponse | null>(null);
  const [isCopyingCommand, setIsCopyingCommand] = useState(false);
  const [statusReloadKey, setStatusReloadKey] = useState(0);
  const [availableSets, setAvailableSets] = useState<AdminSetOption[]>([]);
  const [setsLoading, setSetsLoading] = useState(false);
  const [unlinkedSearchInput, setUnlinkedSearchInput] = useState("");
  const [debouncedUnlinkedSearch] = useDebounce(unlinkedSearchInput, 400);
  const [unlinkedSetId, setUnlinkedSetId] = useState<string>("all");
  const [unlinkedCards, setUnlinkedCards] = useState<UnlinkedCardPayload[]>([]);
  const [unlinkedLoading, setUnlinkedLoading] = useState(false);
  const [unlinkedError, setUnlinkedError] = useState<string | null>(null);

  const refreshData = () => setStatusReloadKey((prev) => prev + 1);

  useEffect(() => {
    setPage(1);
  }, [classification, view, debouncedSearch]);

  useEffect(() => {
    const loadSets = async () => {
      try {
        setSetsLoading(true);
        const res = await fetch("/api/admin/sets");
        if (!res.ok) {
          throw new Error("No se pudieron cargar los sets");
        }
        const data = (await res.json()) as Array<{
          id: number;
          title: string;
          code?: string | null;
        }>;
        setAvailableSets(
          data.map((set) => ({
            id: set.id,
            title: set.title,
            code: set.code,
          }))
        );
      } catch (err) {
        console.error(err);
        showErrorToast("Error al cargar los sets disponibles");
      } finally {
        setSetsLoading(false);
      }
    };

    loadSets();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadStatus = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          classification,
          status: view,
          page: String(page),
          pageSize: String(pageSize),
        });
        if (debouncedSearch.trim()) {
          params.set("search", debouncedSearch.trim());
        }

        const res = await fetch(
          `/api/admin/tcg-sync-status?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        if (!res.ok) {
          throw new Error("No se pudo cargar el estado del catálogo");
        }
        const data = (await res.json()) as SyncResponse;
        setResponse(data);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error(err);
        const message = (err as Error).message || "Error desconocido";
        setError(message);
        showErrorToast(message);
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
    return () => controller.abort();
  }, [classification, view, page, pageSize, debouncedSearch, statusReloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    const loadUnlinkedCards = async () => {
      try {
        setUnlinkedLoading(true);
        setUnlinkedError(null);
        const params = new URLSearchParams({ limit: "30" });
        if (debouncedUnlinkedSearch.trim()) {
          params.set("search", debouncedUnlinkedSearch.trim());
        }
        if (unlinkedSetId !== "all") {
          params.set("setId", unlinkedSetId);
          const selectedSet = availableSets.find(
            (set) => String(set.id) === unlinkedSetId
          );
          if (selectedSet?.code) {
            params.set("setCode", selectedSet.code);
          }
        }

        const res = await fetch(
          `/api/admin/cards/unlinked?${params.toString()}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          throw new Error("No se pudieron cargar las cartas sin link");
        }
        const data = (await res.json()) as { items: UnlinkedCardPayload[] };
        setUnlinkedCards(data.items);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error(err);
        const message =
          (err as Error).message || "Error al cargar cartas sin link";
        setUnlinkedError(message);
        showErrorToast(message);
      } finally {
        setUnlinkedLoading(false);
      }
    };

    loadUnlinkedCards();
    return () => controller.abort();
  }, [
    debouncedUnlinkedSearch,
    unlinkedSetId,
    availableSets,
    statusReloadKey,
  ]);

  const totalPages = useMemo(() => {
    if (!response?.result.totalItems) return 1;
    return Math.max(1, Math.ceil(response.result.totalItems / pageSize));
  }, [response?.result.totalItems, pageSize]);

  const handleCopyCommand = async () => {
    const command = `TCG_CATALOG_DRY_RUN=0 npm run sync:tcg-catalog -- --limit=6000`;
    try {
      setIsCopyingCommand(true);
      await navigator.clipboard.writeText(command);
      showSuccessToast(
        "Comando copiado. Ejecútalo en la terminal del servidor."
      );
    } catch (err) {
      console.error(err);
      showErrorToast("No se pudo copiar el comando");
    } finally {
      setIsCopyingCommand(false);
    }
  };

  const currentItems = response?.result.items ?? [];

  return (
    <div className="space-y-6 w-full px-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">TCGplayer Link Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Monitorea qué productos ya están vinculados y cuáles faltan.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleCopyCommand}
          disabled={isCopyingCommand}
        >
          {isCopyingCommand ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="mr-2 h-4 w-4" />
          )}
          Copiar comando de re-sync
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <SummaryCard
          title="Catálogo"
          value={response?.summary.totalCatalog ?? 0}
        />
        <SummaryCard title="Cartas" value={response?.summary.totalCards ?? 0} />
        <SummaryCard
          title="Sellados"
          value={response?.summary.totalSealed ?? 0}
          variant="secondary"
        />
        <SummaryCard
          title="Vinculados"
          value={response?.summary.totalLinked ?? 0}
          variant="success"
        />
        <SummaryCard
          title="Faltantes"
          value={response?.summary.totalMissing ?? 0}
          variant="warning"
        />
        <SummaryCard
          title="Huérfanos"
          value={response?.summary.totalOrphaned ?? 0}
          variant="danger"
        />
        <SummaryCard
          title="Removidos"
          value={response?.summary.totalRemoved ?? 0}
        />
      </div>

      <UICard>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Cartas sin link</CardTitle>
            <CardDescription>
              Busca cartas locales que aún no tienen producto asignado.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Input
              placeholder="Buscar por nombre o código"
              value={unlinkedSearchInput}
              onChange={(event) => setUnlinkedSearchInput(event.target.value)}
              className="md:w-64"
            />
            <Select
              value={unlinkedSetId}
              onValueChange={(value) => setUnlinkedSetId(value)}
              disabled={setsLoading}
            >
              <SelectTrigger className="md:w-64">
                <SelectValue placeholder="Filtrar por set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los sets</SelectItem>
                {availableSets.map((set) => (
                  <SelectItem key={set.id} value={String(set.id)}>
                    {set.title}
                    {set.code ? ` (${set.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={refreshData}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {unlinkedError && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> {unlinkedError}
            </div>
          )}
          <div className="relative min-h-[150px]">
            {unlinkedLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/70">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {!unlinkedCards.length && !unlinkedLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No hay cartas pendientes con los filtros actuales.
              </div>
            ) : null}
            {unlinkedCards.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {unlinkedCards.map((card) => (
                  <UnlinkedCardCard key={`unlinked-${card.id}`} card={card} />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </UICard>

      <UICard>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Productos TCGplayer</CardTitle>
            <CardDescription>
              Último sync: {formatDateTime(response?.summary.lastCatalogSyncAt)}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex flex-wrap gap-2">
              {CLASSIFICATION_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={
                    classification === option.value ? "default" : "outline"
                  }
                  onClick={() => setClassification(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={view === option.value ? "default" : "outline"}
                  onClick={() => setView(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Input
              placeholder="Buscar por nombre o product ID"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="md:w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 pb-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Mostrar</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => setPageSize(Number(value))}
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>por página</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </Button>
              <span>
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                Siguiente
              </Button>
            </div>
          </div>

          {error ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          ) : null}

          <div className="relative min-h-[200px]">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}

            {!currentItems.length && !loading ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center">
                <p className="text-base font-medium">No hay resultados</p>
                <p className="text-sm text-muted-foreground">
                  Ajusta los filtros o ejecuta un re-sync del catálogo.
                </p>
              </div>
            ) : null}

            {currentItems.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {currentItems.map((item) =>
                  item.type === "catalog" ? (
                    <CatalogProductCard
                      key={`catalog-${item.productId}`}
                      item={item}
                      sets={availableSets}
                      onActionComplete={refreshData}
                    />
                  ) : (
                    <OrphanCard key={`orphan-${item.id}`} item={item} />
                  )
                )}
              </div>
            )}
          </div>
        </CardContent>
      </UICard>
    </div>
  );
};

const ProductImage = ({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) => (
  <div
    className={cn(
      "flex h-40 w-full max-w-[9rem] items-center justify-center overflow-hidden rounded-md border bg-muted/40",
      className
    )}
  >
    {src ? (
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain p-1"
        loading="lazy"
      />
    ) : (
      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
        N/A
      </div>
    )}
  </div>
);

const SummaryCard = ({
  title,
  value,
  variant,
}: {
  title: string;
  value: number;
  variant?: "success" | "warning" | "danger" | "secondary";
}) => {
  const variantClass =
    variant === "success"
      ? "text-emerald-600"
      : variant === "warning"
      ? "text-amber-600"
      : variant === "danger"
      ? "text-rose-600"
      : variant === "secondary"
      ? "text-slate-500"
      : "text-foreground";

  return (
    <UICard>
      <CardHeader className="py-3">
        <CardDescription>{title}</CardDescription>
        <CardTitle className={`text-2xl ${variant ? variantClass : ""}`}>
          {formatNumber(value)}
        </CardTitle>
      </CardHeader>
    </UICard>
  );
};

const StatusBadge = ({ status }: { status: boolean | null }) => {
  if (status === true) {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-700">Link OK</Badge>
    );
  }
  if (status === false) {
    return <Badge variant="destructive">Marcado como faltante</Badge>;
  }
  return <Badge variant="outline">Sin verificar</Badge>;
};

const CatalogProductCard = ({
  item,
  sets,
  onActionComplete,
}: {
  item: CatalogItemPayload;
  sets: AdminSetOption[];
  onActionComplete: () => void;
}) => {
  const linkedCard = item.linkedCard;
  return (
    <UICard className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">
              {item.name}
            </CardTitle>
            <CardDescription>Product ID: {item.productId}</CardDescription>
          </div>
          {item.isSealed ? (
            <Badge variant="secondary">Sellado</Badge>
          ) : (
            <Badge variant="outline">Carta</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex gap-4">
          <ProductImage src={item.imageUrl} alt={item.name} />
          <div className="text-sm text-muted-foreground">
            <div>SKU: {item.sku ?? "—"}</div>
            <div>Tipo: {item.cardType || (item.isSealed ? "Sellado" : "Carta")}</div>
            <div>Estado: {item.productStatus ?? "active"}</div>
            <div>Último sync: {formatDateTime(item.lastSyncedAt)}</div>
          </div>
        </div>
        <div className="rounded-md bg-muted/30 p-3 text-sm">
          {linkedCard ? (
            <div className="space-y-1">
              <p className="font-medium">{linkedCard.name}</p>
              <p className="text-xs text-muted-foreground">{linkedCard.code}</p>
              <StatusBadge status={linkedCard.tcgplayerLinkStatus} />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Sin carta vinculada
            </div>
          )}
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" asChild>
            <a
              href={buildTcgplayerUrl(item.productId, item.url)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" /> TCGplayer
            </a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={
                linkedCard
                  ? `/admin/tcg-linker?cardId=${linkedCard.id}`
                  : `/admin/tcg-linker?productId=${item.productId}`
              }
              prefetch={false}
            >
              <ExternalLink className="mr-2 h-4 w-4" /> Tcg Linker
            </Link>
          </Button>
          {!item.isSealed && (
            <CreateAlternateDialog
              product={item}
              sets={sets}
              onCreated={onActionComplete}
            />
          )}
          {!item.isSealed &&
            (!item.linkedCard ||
              item.linkedCard.tcgplayerLinkStatus === false) && (
            <LinkExistingCardDialog
              product={item}
              onLinked={onActionComplete}
            />
          )}
        </div>
      </CardContent>
    </UICard>
  );
};

const OrphanCard = ({ item }: { item: LinkedCardPayload }) => (
  <UICard className="flex h-full flex-col">
    <CardHeader>
      <CardTitle className="text-base font-semibold">{item.name}</CardTitle>
      <CardDescription>Código: {item.code}</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col gap-3">
      <div className="flex gap-4">
        <ProductImage src={item.imageUrl} alt={item.name} />
        <div className="text-sm text-muted-foreground">
          <div>Set: {item.setCode || "—"}</div>
          <div>Product ID: {item.tcgplayerProductId || "—"}</div>
        </div>
      </div>
      <StatusBadge status={item.tcgplayerLinkStatus} />
      <p className="text-xs text-muted-foreground">
        Este producto fue eliminado del catálogo, pero la carta aún tiene un
        ID vinculado.
      </p>
      <div className="mt-auto">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/tcg-linker?cardId=${item.id}`} prefetch={false}>
            <ExternalLink className="mr-2 h-4 w-4" /> Revisar
          </Link>
        </Button>
      </div>
    </CardContent>
  </UICard>
);

const UnlinkedCardCard = ({ card }: { card: UnlinkedCardPayload }) => (
  <UICard className="flex h-full flex-col">
    <CardHeader>
      <div className="flex items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base font-semibold">{card.name}</CardTitle>
          <CardDescription>Código: {card.code}</CardDescription>
        </div>
        <StatusBadge status={card.tcgplayerLinkStatus ?? null} />
      </div>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col gap-3">
      <div className="flex gap-4">
        <ProductImage src={card.imageUrl} alt={card.name} />
        <div className="text-sm text-muted-foreground space-y-1">
          <div>Set principal: {card.setCode || "—"}</div>
          {card.sets.length > 0 && (
            <div>
              Sets vinculados:
              <ul className="list-disc pl-4">
                {card.sets.map((set) => (
                  <li key={set.id}>{set.title}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <div className="mt-auto">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/tcg-linker?cardId=${card.id}`} prefetch={false}>
            <ExternalLink className="mr-2 h-4 w-4" /> Abrir en Tcg Linker
          </Link>
        </Button>
      </div>
    </CardContent>
  </UICard>
);

const CreateAlternateDialog = ({
  product,
  sets,
  onCreated,
}: {
  product: CatalogItemPayload;
  sets: AdminSetOption[];
  onCreated: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [baseCode, setBaseCode] = useState("");
  const [baseCards, setBaseCards] = useState<BaseCardOption[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState<number | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const [alias, setAlias] = useState(product.cleanName || product.name);
  const [alternateArt, setAlternateArt] = useState("Release Event");
  const [imageUrl, setImageUrl] = useState(product.imageUrl || "");

  const resetForm = () => {
    setBaseCode("");
    setBaseCards([]);
    setSelectedBaseId(null);
    setSelectedSetId("");
    setAlias(product.cleanName || product.name);
    setAlternateArt("Release Event");
    setImageUrl(product.imageUrl || "");
    setLookupLoading(false);
    setSubmitLoading(false);
  };

  const fetchBaseCards = async () => {
    if (!baseCode.trim()) {
      showErrorToast("Ingresa un código base");
      return;
    }
    try {
      setLookupLoading(true);
      const res = await fetch(
        `/api/admin/cards/by-code/${encodeURIComponent(baseCode.trim())}`
      );
      if (!res.ok) {
        throw new Error("No se encontraron cartas con ese código");
      }
      const data = await res.json();
      const mapped: BaseCardOption[] = data.map((card: any) => ({
        id: card.id,
        name: card.name,
        code: card.code,
        src: card.src ?? null,
        setCode: card.setCode ?? card.sets?.[0]?.set?.code ?? null,
        illustrator: card.illustrator ?? null,
      }));
      setBaseCards(mapped);
      setSelectedBaseId(mapped[0]?.id ?? null);
    } catch (error) {
      console.error(error);
      showErrorToast(
        (error as Error).message || "Error al buscar la carta base"
      );
      setBaseCards([]);
      setSelectedBaseId(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedBaseId) {
      showErrorToast("Selecciona la carta base");
      return;
    }
    if (!imageUrl.trim()) {
      showErrorToast("Debes proporcionar una imagen para la alterna");
      return;
    }
    try {
      setSubmitLoading(true);
      const selectedSet =
        selectedSetId && selectedSetId !== ""
          ? sets.find((set) => String(set.id) === selectedSetId)
          : null;
      const selectedBase = baseCards.find((card) => card.id === selectedBaseId);
      const response = await fetch("/api/admin/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseCardId: selectedBaseId,
          src: imageUrl.trim(),
          imageKey: null,
          illustrator: selectedBase?.illustrator ?? null,
          alternateArt: alternateArt.trim() || product.cardType || "Alternate",
          setCode: selectedSet?.code ?? selectedBase?.setCode ?? null,
          alias: alias.trim() || product.name,
          setIds: selectedSet ? [selectedSet.id] : undefined,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "No se pudo crear la carta alterna");
      }
      showSuccessToast("Carta alterna creada correctamente");
      onCreated();
      setOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
      showErrorToast((error as Error).message);
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          resetForm();
        }
      }}
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={submitLoading}
      >
        Crear carta
      </Button>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Crear alterna para {product.name}</DialogTitle>
          <DialogDescription>
            Usa la información del catálogo para registrar rápidamente una
            carta alterna.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="base-code">Código de la carta base</Label>
            <div className="flex gap-2">
              <Input
                id="base-code"
                placeholder="Ej. OP08-001"
                value={baseCode}
                onChange={(event) => setBaseCode(event.target.value)}
              />
              <Button
                variant="outline"
                onClick={fetchBaseCards}
                disabled={lookupLoading}
              >
                {lookupLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Buscar"
                )}
              </Button>
            </div>
            {baseCards.length > 0 && (
              <Select
                value={selectedBaseId ? String(selectedBaseId) : undefined}
                onValueChange={(value) => setSelectedBaseId(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la carta base" />
                </SelectTrigger>
                <SelectContent>
                  {baseCards.map((card) => (
                    <SelectItem key={card.id} value={String(card.id)}>
                      {card.code} - {card.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Asignar al set</Label>
            <Select
              value={selectedSetId}
              onValueChange={(value) => setSelectedSetId(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Usar set del template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Usar set del template</SelectItem>
                {sets.map((set) => (
                  <SelectItem key={set.id} value={String(set.id)}>
                    {set.title}
                    {set.code ? ` (${set.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Alias mostrado</Label>
            <Input
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Etiqueta de alternate art</Label>
            <Input
              value={alternateArt}
              onChange={(event) => setAlternateArt(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Imagen (URL)</Label>
            <Input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={submitLoading || lookupLoading}
          >
            {submitLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Crear alterna"
            )}
          </Button>
        </DialogFooter>
  </DialogContent>
</Dialog>
  );
};

const LinkExistingCardDialog = ({
  product,
  onLinked,
}: {
  product: CatalogItemPayload;
  onLinked: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch] = useDebounce(searchInput, 400);
  const [cards, setCards] = useState<UnlinkedCardPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const loadCards = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          limit: "40",
        });
        if (debouncedSearch.trim()) {
          params.set("search", debouncedSearch.trim());
        }
        const res = await fetch(
          `/api/admin/cards/unlinked?${params.toString()}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          throw new Error("No se pudieron cargar las cartas");
        }
        const data = (await res.json()) as { items: UnlinkedCardPayload[] };
        setCards(data.items);
        if (data.items.length) {
          setSelectedCardId(data.items[0].id);
        } else {
          setSelectedCardId(null);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error(error);
        showErrorToast(
          (error as Error).message || "Error al cargar cartas sin link"
        );
      } finally {
        setLoading(false);
      }
    };
    loadCards();
    return () => controller.abort();
  }, [open, debouncedSearch]);

  const handleLink = async () => {
    if (!selectedCardId) {
      showErrorToast("Selecciona una carta para vincular");
      return;
    }
    try {
      setLinking(true);
      const response = await fetch(`/api/admin/cards/${selectedCardId}/tcgplayer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.productId,
          tcgUrl: product.url ?? null,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "No se pudo vincular la carta");
      }
      showSuccessToast("Carta vinculada correctamente");
      setOpen(false);
      onLinked();
    } catch (error) {
      console.error(error);
      showErrorToast(
        (error as Error).message || "Error al vincular la carta seleccionada"
      );
    } finally {
      setLinking(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          setSearchInput("");
          setSelectedCardId(null);
          setCards([]);
        }
      }}
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={linking}
      >
        Vincular carta existente
      </Button>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Vincular carta existente</DialogTitle>
          <DialogDescription>
            Selecciona una carta de tu base de datos que aún no tenga TCGplayer
            asignado y vincúlala al producto #{product.productId}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Buscar por nombre o código local"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <div className="relative min-h-[200px]">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/70">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {!cards.length && !loading ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No encontramos cartas sin link con los filtros actuales.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {cards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setSelectedCardId(card.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 text-left transition",
                      selectedCardId === card.id
                        ? "border-primary ring-2 ring-primary/50"
                        : "hover:border-primary/40"
                    )}
                  >
                    <ProductImage
                      src={card.imageUrl}
                      alt={card.name}
                      className="h-24 w-24"
                    />
                    <div className="text-sm">
                      <p className="font-semibold">{card.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {card.code}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {card.setCode || "Sin set"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleLink} disabled={linking || !selectedCardId}>
            {linking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Vincular carta"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminTcgSyncPage;
