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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";

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

  useEffect(() => {
    setPage(1);
  }, [classification, view, debouncedSearch]);

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
  }, [classification, view, page, pageSize, debouncedSearch]);

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
  const isOrphanView = view === "orphan";

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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {isOrphanView ? "Carta" : "Producto"}
                      </TableHead>
                      <TableHead>
                        {isOrphanView ? "Código" : "Product ID"}
                      </TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>
                        {isOrphanView ? "Estado" : "Vínculo"}
                      </TableHead>
                      <TableHead>
                        {isOrphanView ? "Notas" : "Último sync"}
                      </TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentItems.map((item) =>
                      item.type === "catalog" ? (
                        <TableRow key={`catalog-${item.productId}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <ProductImage src={item.imageUrl} alt={item.name} />
                              <div>
                                <div className="font-medium">{item.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {item.cleanName || "—"}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code>{item.productId}</code>
                            <div className="text-xs text-muted-foreground">
                              SKU: {item.sku ?? "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.isSealed ? (
                              <Badge variant="secondary">Sellado</Badge>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                {item.cardType || "Carta"}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.linkedCard ? (
                              <div>
                                <div className="font-medium">
                                  {item.linkedCard.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {item.linkedCard.code}
                                </div>
                                <StatusBadge
                                  status={item.linkedCard.tcgplayerLinkStatus}
                                />
                              </div>
                            ) : (
                              <Badge variant="outline">Sin vínculo</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDateTime(item.lastSyncedAt)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Estado catálogo: {item.productStatus ?? "active"}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" asChild>
                                <a
                                  href={buildTcgplayerUrl(
                                    item.productId,
                                    item.url
                                  )}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  TCGplayer
                                </a>
                              </Button>
                              <Button variant="ghost" size="sm" asChild>
                                <Link
                                  href={`/admin/tcg-linker?productId=${item.productId}`}
                                  prefetch={false}
                                >
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Tcg Linker
                                </Link>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <TableRow key={`orphan-${item.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <ProductImage src={item.imageUrl} alt={item.name} />
                              <div>
                                <div className="font-medium">{item.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {item.setCode || "—"}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code>{item.code}</code>
                            <div className="text-xs text-muted-foreground">
                              Product ID: {item.tcgplayerProductId}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">Carta</Badge>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={item.tcgplayerLinkStatus} />
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              Este ID ya no existe en el catálogo.
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link
                                href={`/admin/tcg-linker?cardId=${item.id}`}
                                prefetch={false}
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Revisar
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </UICard>
    </div>
  );
};

const ProductImage = ({ src, alt }: { src?: string | null; alt: string }) => (
  <div className="h-12 w-12 overflow-hidden rounded-md border bg-muted">
    {src ? (
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
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

export default AdminTcgSyncPage;
