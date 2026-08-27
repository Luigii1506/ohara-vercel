"use client";

import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Oswald } from "next/font/google";
import { toast } from "react-toastify";
import {
  BarChart3,
  ClipboardList,
  Loader2,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Receipt,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CardWithCollectionData } from "@/types";
import { cn } from "@/lib/utils";
import { useAllCards } from "@/hooks/useCards";
import { useCardStore } from "@/store/cardStore";
import type { CardsFilters } from "@/lib/cards/types";
import DropdownSearch from "@/components/DropdownSearch";
import FiltersSidebar from "@/components/FiltersSidebar";
import LazyImage from "@/components/LazyImage";
import { setOptions } from "@/helpers/constants";
import { highlightText } from "@/helpers/functions";
import { sortByCollectionOrder } from "@/lib/cards/sort";
import {
  matchesCardCode,
  baseCardMatches,
  getFilteredAlternates,
  cardMatchesActiveFilters,
} from "@/lib/cardFilters";

const oswald = Oswald({
  weight: ["200", "300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

const NO_COUNTER_LABEL = "No counter";
const NO_TRIGGER_LABEL = "No trigger";

type CardSearchItem = {
  id: number;
  name: string;
  code: string;
  src: string;
  rarity?: string | null;
  setCode: string;
  region?: string | null;
  marketPrice?: number | string | null;
  midPrice?: number | string | null;
  priceCurrency?: string | null;
  alternateArt?: string | null;
  sets?: Array<{ set: { title: string } }>;
};

type ProductSearchItem = {
  id: number;
  name: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  productType: string;
  marketPrice?: number | string | null;
  lowPrice?: number | string | null;
  priceCurrency?: string | null;
};

type BuylistPick =
  | { kind: "card"; card: CardSearchItem; quantity: number }
  | { kind: "product"; product: ProductSearchItem; quantity: number };

// Carrito interno del modal — mezcla cartas (catálogo completo, mismo store
// que /lists/[id]/add-cards) y productos (boosters, sleeves, playmats...).
type CartEntry =
  | { kind: "card"; card: CardWithCollectionData; quantity: number }
  | { kind: "product"; product: ProductSearchItem; quantity: number };

type BuylistItemDraft = {
  localId: string;
  cardId: number | null;
  productId: number | null;
  card: CardSearchItem | null;
  product: ProductSearchItem | null;
  quantity: number;
  condition: string;
  purchasePrice: number;
  purchaseCurrency: string;
  marketPriceSnapshot: number;
  midPriceSnapshot: number;
  market70Snapshot: number;
  market80Snapshot: number;
  median70Snapshot: number;
  median80Snapshot: number;
  notes: string;
};

type BuylistSession = {
  id: number;
  title: string;
  customerName: string | null;
  sourceType: "SINGLES" | "BINDER" | "MIXED";
  status: "DRAFT" | "COMPLETED" | "CANCELLED";
  currency: string;
  notes: string | null;
  totalItems: number;
  totalQuantity: number;
  totalPaid: number | string;
  totalMarket: number | string;
  totalMedian: number | string;
  totalMarket70: number | string;
  totalMarket80: number | string;
  totalMedian70: number | string;
  totalMedian80: number | string;
  updatedAt?: string;
  createdAt?: string;
  items: Array<{
    id: number;
    cardId: number | null;
    productId: number | null;
    quantity: number;
    condition: string | null;
    purchasePrice: number | string;
    purchaseCurrency: string;
    marketPriceSnapshot: number | string | null;
    midPriceSnapshot: number | string | null;
    market70Snapshot: number | string | null;
    market80Snapshot: number | string | null;
    median70Snapshot: number | string | null;
    median80Snapshot: number | string | null;
    notes: string | null;
    card: CardSearchItem | null;
    product: ProductSearchItem | null;
  }>;
};

const CONDITION_OPTIONS = ["NM", "LP", "MP", "HP", "DMG"];

const percentValue = (value: number, percent: number) =>
  Math.round(value * percent * 100) / 100;

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);

const formatDateTime = (value?: string) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const SOURCE_TYPE_LABELS: Record<BuylistSession["sourceType"], string> = {
  SINGLES: "Singles",
  BINDER: "Binder",
  MIXED: "Mixto",
};

const STATUS_STYLES: Record<BuylistSession["status"], string> = {
  DRAFT: "border-amber-200 bg-amber-50 text-amber-800",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-800",
};

const toCardSearchItem = (card: CardWithCollectionData): CardSearchItem => ({
  id: Number(card.id),
  name: card.name,
  code: card.code,
  src: card.src,
  rarity: card.rarity ?? null,
  setCode: card.setCode,
  region: card.region ?? null,
  marketPrice: card.marketPrice ?? null,
  midPrice: card.midPrice ?? null,
  priceCurrency: card.priceCurrency ?? null,
  alternateArt: card.alternateArt ?? null,
  sets: card.sets?.map((entry) => ({ set: { title: entry.set.title } })) ?? [],
});

const buildDraftItem = (
  pick: BuylistPick,
  currency: string
): BuylistItemDraft => {
  if (pick.kind === "card") {
    const { card, quantity } = pick;
    const market = roundCurrency(toNumber(card.marketPrice));
    const median = roundCurrency(toNumber(card.midPrice));
    return {
      localId: `card-${card.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      cardId: card.id,
      productId: null,
      card,
      product: null,
      quantity,
      condition: "NM",
      purchasePrice: percentValue(median || market, 0.8),
      purchaseCurrency: card.priceCurrency || currency,
      marketPriceSnapshot: market,
      midPriceSnapshot: median,
      market70Snapshot: percentValue(market, 0.7),
      market80Snapshot: percentValue(market, 0.8),
      median70Snapshot: percentValue(median, 0.7),
      median80Snapshot: percentValue(median, 0.8),
      notes: "",
    };
  }

  const { product, quantity } = pick;
  const market = roundCurrency(toNumber(product.marketPrice));
  const median = roundCurrency(toNumber(product.lowPrice ?? product.marketPrice));
  return {
    localId: `product-${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    cardId: null,
    productId: product.id,
    card: null,
    product,
    quantity,
    condition: "NM",
    purchasePrice: percentValue(median || market, 0.8),
    purchaseCurrency: product.priceCurrency || currency,
    marketPriceSnapshot: market,
    midPriceSnapshot: median,
    market70Snapshot: percentValue(market, 0.7),
    market80Snapshot: percentValue(market, 0.8),
    median70Snapshot: percentValue(median, 0.7),
    median80Snapshot: percentValue(median, 0.8),
    notes: "",
  };
};

const hydrateDraftItems = (
  session: BuylistSession | null
): BuylistItemDraft[] => {
  if (!session) return [];
  return session.items.map((item) => ({
    localId: `saved-${item.id}`,
    cardId: item.cardId,
    productId: item.productId,
    card: item.card,
    product: item.product,
    quantity: item.quantity,
    condition: item.condition || "NM",
    purchasePrice: roundCurrency(toNumber(item.purchasePrice)),
    purchaseCurrency: item.purchaseCurrency,
    marketPriceSnapshot: roundCurrency(toNumber(item.marketPriceSnapshot)),
    midPriceSnapshot: roundCurrency(toNumber(item.midPriceSnapshot)),
    market70Snapshot: roundCurrency(toNumber(item.market70Snapshot)),
    market80Snapshot: roundCurrency(toNumber(item.market80Snapshot)),
    median70Snapshot: roundCurrency(toNumber(item.median70Snapshot)),
    median80Snapshot: roundCurrency(toNumber(item.median80Snapshot)),
    notes: item.notes || "",
  }));
};

const getItemDisplay = (item: BuylistItemDraft) => {
  if (item.card) {
    return {
      src: item.card.src,
      name: item.card.name,
      code: item.card.code,
      subtitle: item.card.sets?.[0]?.set?.title || item.card.setCode,
    };
  }
  if (item.product) {
    return {
      src: item.product.imageUrl || item.product.thumbnailUrl || "",
      name: item.product.name,
      code: item.product.productType,
      subtitle: "Producto",
    };
  }
  return { src: "", name: "Item desconocido", code: "", subtitle: "" };
};

export default function AdminBuylistPage() {
  const router = useRouter();
  const { role, loading } = useUser();

  const [sessions, setSessions] = useState<BuylistSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [showAddCardsModal, setShowAddCardsModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCustomerName, setDraftCustomerName] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftCurrency, setDraftCurrency] = useState("USD");
  const [draftSourceType, setDraftSourceType] =
    useState<BuylistSession["sourceType"]>("MIXED");
  const [draftStatus, setDraftStatus] =
    useState<BuylistSession["status"]>("DRAFT");
  const [draftItems, setDraftItems] = useState<BuylistItemDraft[]>([]);
  // true mientras el draft* viene de re-hidratar `selectedSession` (carga
  // inicial, cambio de sesión, o el eco que regresa el propio autoguardado)
  // — evita que ese re-render dispare otro autoguardado en cadena.
  const isHydratingRef = useRef(true);
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);

  useEffect(() => {
    if (!loading && role !== "ADMIN") {
      router.push("/unauthorized");
    }
  }, [loading, role, router]);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const response = await fetch("/api/admin/buylist");
      if (!response.ok) throw new Error("Failed to load buylist sessions");
      const data = await response.json();
      const nextSessions = (data.sessions ?? []) as BuylistSession[];
      setSessions(nextSessions);
      if (!nextSessions.some((session) => session.id === selectedSessionId)) {
        setSelectedSessionId(nextSessions[0]?.id ?? null);
      } else if (!selectedSessionId && nextSessions.length > 0) {
        setSelectedSessionId(nextSessions[0].id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (role === "ADMIN") {
      void loadSessions();
    }
  }, [role]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );
  const hasCurrentEmptyDraft =
    selectedSession?.status === "DRAFT" && draftItems.length === 0;

  useEffect(() => {
    isHydratingRef.current = true;
    setDraftTitle(selectedSession?.title ?? "");
    setDraftCustomerName(selectedSession?.customerName ?? "");
    setDraftNotes(selectedSession?.notes ?? "");
    setDraftCurrency(selectedSession?.currency ?? "USD");
    setDraftSourceType(selectedSession?.sourceType ?? "MIXED");
    setDraftStatus(selectedSession?.status ?? "DRAFT");
    setDraftItems(hydrateDraftItems(selectedSession));
  }, [selectedSession]);

  // Autoguardado: cualquier cambio real del usuario en el draft (agregar
  // cartas, cambiar cantidad/condición/precio/notas, título, cliente, tipo
  // de entrada, estado) programa un guardado con un pequeño debounce, para
  // no mandar una petición por cada tecla. No hay botón "Guardar" — todo
  // movimiento se persiste solo.
  useEffect(() => {
    if (isHydratingRef.current) {
      isHydratingRef.current = false;
      return;
    }
    if (!selectedSessionId) return;

    const timer = setTimeout(() => {
      void saveSession();
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedSessionId,
    draftTitle,
    draftCustomerName,
    draftNotes,
    draftCurrency,
    draftSourceType,
    draftStatus,
    draftItems,
  ]);

  const summary = useMemo(() => {
    return draftItems.reduce(
      (acc, item) => {
        acc.totalItems += 1;
        acc.totalQuantity += item.quantity;
        acc.totalPaid += item.purchasePrice * item.quantity;
        acc.totalMarket += item.marketPriceSnapshot * item.quantity;
        acc.totalMedian += item.midPriceSnapshot * item.quantity;
        acc.totalMarket70 += item.market70Snapshot * item.quantity;
        acc.totalMarket80 += item.market80Snapshot * item.quantity;
        acc.totalMedian70 += item.median70Snapshot * item.quantity;
        acc.totalMedian80 += item.median80Snapshot * item.quantity;
        return acc;
      },
      {
        totalItems: 0,
        totalQuantity: 0,
        totalPaid: 0,
        totalMarket: 0,
        totalMedian: 0,
        totalMarket70: 0,
        totalMarket80: 0,
        totalMedian70: 0,
        totalMedian80: 0,
      }
    );
  }, [draftItems]);

  // Confirmación del modal "Agregar cartas": agrega cada carta/producto
  // elegido como su propia línea (con la cantidad acumulada en el modal),
  // sin tocar las líneas que ya estaban en el draft.
  const addCardsToDraft = (picks: BuylistPick[]) => {
    setDraftItems((prev) => [
      ...prev,
      ...picks.map((pick) => buildDraftItem(pick, draftCurrency)),
    ]);
  };

  const updateDraftItem = (
    localId: string,
    patch: Partial<BuylistItemDraft>
  ) => {
    setDraftItems((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item))
    );
  };

  const removeDraftItem = (localId: string) => {
    setDraftItems((prev) => prev.filter((item) => item.localId !== localId));
  };

  const createSession = async () => {
    if (hasCurrentEmptyDraft && selectedSessionId) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/buylist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Buylist ${new Date().toLocaleDateString("en-CA")}`,
          sourceType: "MIXED",
          currency: "USD",
        }),
      });
      if (!response.ok) throw new Error("Failed to create session");
      const data = await response.json();
      await loadSessions();
      setSelectedSessionId(data.session.id);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const saveSession = async () => {
    if (!selectedSessionId) return;
    // Si ya hay un guardado en curso, no mandamos dos PATCH en paralelo
    // (podrían pisarse) — solo marcamos que hace falta otro al terminar.
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }
    saveInFlightRef.current = true;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/buylist/${selectedSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle || "Buylist",
          customerName: draftCustomerName,
          notes: draftNotes,
          currency: draftCurrency,
          sourceType: draftSourceType,
          status: draftStatus,
          items: draftItems.map((item) => ({
            cardId: item.cardId,
            productId: item.productId,
            quantity: item.quantity,
            condition: item.condition,
            purchasePrice: item.purchasePrice,
            purchaseCurrency: item.purchaseCurrency,
            marketPriceSnapshot: item.marketPriceSnapshot,
            midPriceSnapshot: item.midPriceSnapshot,
            market70Snapshot: item.market70Snapshot,
            market80Snapshot: item.market80Snapshot,
            median70Snapshot: item.median70Snapshot,
            median80Snapshot: item.median80Snapshot,
            notes: item.notes,
          })),
        }),
      });
      if (!response.ok) throw new Error("Failed to save buylist session");
      const data = await response.json();
      setSessions((prev) =>
        prev.map((session) =>
          session.id === selectedSessionId ? (data.session as BuylistSession) : session
        )
      );
      setSelectedSessionId(data.session.id);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo guardar automáticamente — revisa tu conexión");
    } finally {
      setSaving(false);
      saveInFlightRef.current = false;
      if (saveQueuedRef.current) {
        saveQueuedRef.current = false;
        void saveSession();
      }
    }
  };

  const deleteSession = async (sessionId: number) => {
    setDeletingSessionId(sessionId);
    try {
      const response = await fetch(`/api/admin/buylist/${sessionId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete buylist session");
      const remainingSessions = sessions.filter((session) => session.id !== sessionId);
      setSessions(remainingSessions);
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(remainingSessions[0]?.id ?? null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setDeletingSessionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5eddc] px-4 py-5 sm:px-6 2xl:px-10">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6">
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.18),_transparent_35%),linear-gradient(135deg,#fffdf8_0%,#f8f1e4_100%)] px-6 py-6 sm:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Admin Buylist
                  </p>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    Mesa de compra
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-[15px]">
                    Diseñada para capturar singles, binders y lotes rápido, con
                    snapshots de precio, porcentajes de referencia y seguimiento
                    operativo de cada compra.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void loadSessions()}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${sessionsLoading ? "animate-spin" : ""}`} />
                    Refrescar
                  </Button>
                  <Button
                    onClick={() => void createSession()}
                    disabled={saving || hasCurrentEmptyDraft}
                    className="bg-slate-950 text-white hover:bg-slate-800"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Nueva compra
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-950 px-6 py-6 text-white xl:border-l xl:border-t-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">
                Vista rápida
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <HeroStat
                  icon={<ShoppingBag className="h-4 w-4" />}
                  label="Sesiones"
                  value={String(sessions.length)}
                />
                <HeroStat
                  icon={<ClipboardList className="h-4 w-4" />}
                  label="Items draft"
                  value={String(summary.totalItems)}
                />
                <HeroStat
                  icon={<Package className="h-4 w-4" />}
                  label="Cantidad"
                  value={String(summary.totalQuantity)}
                />
                <HeroStat
                  icon={<Receipt className="h-4 w-4" />}
                  label="Pagado"
                  value={formatCurrency(summary.totalPaid, draftCurrency)}
                />
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
          <aside className="space-y-4 xl:sticky xl:top-4">
            <Card className="overflow-hidden rounded-[28px] border-slate-200 shadow-sm xl:max-h-[calc(100vh-13rem)]">
              <CardHeader className="border-b border-slate-100 bg-slate-50">
                <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                  <ShoppingBag className="h-5 w-5" />
                  Sesiones de compra
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 overflow-y-auto p-4 xl:max-h-[calc(100vh-18rem)]">
                {sessionsLoading ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
                    Cargando sesiones...
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    No hay compras guardadas todavía.
                  </div>
                ) : (
                  sessions.map((session) => {
                    const active = selectedSessionId === session.id;
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => setSelectedSessionId(session.id)}
                        className={cn(
                          "w-full rounded-2xl border p-4 text-left transition-all",
                          active
                            ? "border-slate-900 bg-slate-900 text-white shadow-lg"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex flex-col items-start gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {session.title}
                            </p>
                            <p
                              className={cn(
                                "mt-1 truncate text-xs",
                                active ? "text-white/65" : "text-slate-500"
                              )}
                            >
                              {session.customerName || "Sin cliente"}
                            </p>
                          </div>
                          <div className="flex w-full items-center justify-between gap-3">
                            <Badge
                              className={cn(
                                "border",
                                active
                                  ? "border-white/20 bg-white/10 text-white"
                                  : STATUS_STYLES[session.status]
                              )}
                            >
                              {session.status}
                            </Badge>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void deleteSession(session.id);
                              }}
                              disabled={deletingSessionId === session.id}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                                active
                                  ? "bg-white/10 text-white hover:bg-white/15"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              )}
                            >
                              {deletingSessionId === session.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                              Eliminar
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-3 text-xs">
                          <div className="flex flex-col gap-1">
                            <p className={cn(active ? "text-white/50" : "text-slate-500")}>
                              Tipo
                            </p>
                            <p className="mt-1 font-medium">
                              {SOURCE_TYPE_LABELS[session.sourceType]}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className={cn(active ? "text-white/50" : "text-slate-500")}>
                              Cantidad
                            </p>
                            <p className="mt-1 font-medium">{session.totalQuantity}</p>
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className={cn(active ? "text-white/50" : "text-slate-500")}>
                              Total pagado
                            </p>
                            <p className="mt-1 text-sm font-semibold">
                              {formatCurrency(toNumber(session.totalPaid), session.currency)}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className={cn(active ? "text-white/50" : "text-slate-500")}>
                              Actualizada
                            </p>
                            <p className="mt-1 font-medium">
                              {formatDateTime(session.updatedAt || session.createdAt)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </aside>

          <main className="space-y-6 xl:min-w-0">
            {!selectedSession ? (
              <Card className="rounded-[28px] border-slate-200 shadow-sm">
                <CardContent className="py-20 text-center text-slate-500">
                  Selecciona una sesión o crea una nueva compra.
                </CardContent>
              </Card>
            ) : (
              <>
                <section className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
                  <Card className="overflow-hidden rounded-[28px] border-slate-200 shadow-sm">
                    <CardContent className="p-0">
                      <div className="border-b border-slate-100 bg-slate-950 px-5 py-4 text-white sm:px-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">
                              Resumen activo
                            </p>
                            <h2 className="mt-2 text-xl font-semibold">
                              {draftTitle || "Buylist en edición"}
                            </h2>
                          </div>
                          <Badge
                            className={cn("border", STATUS_STYLES[draftStatus])}
                          >
                            {draftStatus}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid gap-3 p-4 sm:grid-cols-2 2xl:grid-cols-4">
                        <WorkspaceMetric
                          icon={<Receipt className="h-4 w-4" />}
                          label="Total pagado"
                          value={formatCurrency(summary.totalPaid, draftCurrency)}
                          tone="dark"
                        />
                        <WorkspaceMetric
                          icon={<BarChart3 className="h-4 w-4" />}
                          label="Market total"
                          value={formatCurrency(summary.totalMarket, draftCurrency)}
                          tone="emerald"
                        />
                        <WorkspaceMetric
                          icon={<BarChart3 className="h-4 w-4" />}
                          label="Median total"
                          value={formatCurrency(summary.totalMedian, draftCurrency)}
                          tone="amber"
                        />
                        <WorkspaceMetric
                          icon={<Package className="h-4 w-4" />}
                          label="Cantidad"
                          value={`${summary.totalQuantity} cartas`}
                          tone="slate"
                        />
                      </div>

                      <div className="border-t border-slate-100 px-4 py-4 sm:px-6">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <MiniStat
                            label="Market 70%"
                            value={formatCurrency(summary.totalMarket70, draftCurrency)}
                          />
                          <MiniStat
                            label="Market 80%"
                            value={formatCurrency(summary.totalMarket80, draftCurrency)}
                          />
                          <MiniStat
                            label="Median 70%"
                            value={formatCurrency(summary.totalMedian70, draftCurrency)}
                          />
                          <MiniStat
                            label="Median 80%"
                            value={formatCurrency(summary.totalMedian80, draftCurrency)}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[28px] border-slate-200 shadow-sm">
                    <CardHeader className="border-b border-slate-100">
                      <CardTitle className="text-lg text-slate-900">
                        Datos de la compra
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 p-5 md:grid-cols-2">
                      <DetailField label="Nombre interno">
                        <Input
                          value={draftTitle}
                          onChange={(event) => setDraftTitle(event.target.value)}
                          placeholder="Nombre de la compra"
                        />
                      </DetailField>
                      <DetailField label="Cliente o vendedor">
                        <Input
                          value={draftCustomerName}
                          onChange={(event) => setDraftCustomerName(event.target.value)}
                          placeholder="Cliente / vendedor"
                        />
                      </DetailField>
                      <DetailField label="Tipo de entrada">
                        <Select
                          value={draftSourceType}
                          onValueChange={(value: BuylistSession["sourceType"]) =>
                            setDraftSourceType(value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Tipo de entrada" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SINGLES">Singles</SelectItem>
                            <SelectItem value="BINDER">Binder</SelectItem>
                            <SelectItem value="MIXED">Mixto</SelectItem>
                          </SelectContent>
                        </Select>
                      </DetailField>
                      <DetailField label="Estado">
                        <Select
                          value={draftStatus}
                          onValueChange={(value: BuylistSession["status"]) =>
                            setDraftStatus(value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Estado" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DRAFT">Draft</SelectItem>
                            <SelectItem value="COMPLETED">Completed</SelectItem>
                            <SelectItem value="CANCELLED">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </DetailField>
                      <div className="md:col-span-2">
                        <DetailField label="Notas internas">
                          <Textarea
                            value={draftNotes}
                            onChange={(event) => setDraftNotes(event.target.value)}
                            placeholder="Notas internas de la compra, trato, condición general, etc."
                            className="min-h-[120px]"
                          />
                        </DetailField>
                      </div>
                      <div className="md:col-span-2 flex items-center justify-end gap-2 text-sm text-slate-500">
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Guardando…
                          </>
                        ) : (
                          "Los cambios se guardan solos"
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </section>

                <Card className="overflow-hidden rounded-[28px] border-slate-200 shadow-sm">
                  <CardHeader className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-lg text-slate-900">
                        Mesa de captura
                      </CardTitle>
                      <p className="mt-1 text-sm text-slate-500">
                        Ajusta cantidad, condición y precio pagado sin perder de
                        vista market y median.
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowAddCardsModal(true)}
                      className="gap-2 bg-slate-950 text-white hover:bg-slate-800"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar cartas o productos
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[calc(100vh-18rem)] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-white">
                          <TableRow>
                            <TableHead>Carta</TableHead>
                            <TableHead className="w-20">Qty</TableHead>
                            <TableHead className="w-24">Cond.</TableHead>
                            <TableHead className="w-28">Pagado</TableHead>
                            <TableHead>Mkt / 70 / 80</TableHead>
                            <TableHead>Mid / 70 / 80</TableHead>
                            <TableHead>Notas</TableHead>
                            <TableHead className="w-14" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {draftItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="py-16 text-center text-slate-500">
                                Agrega cartas desde la búsqueda para empezar.
                              </TableCell>
                            </TableRow>
                          ) : (
                            draftItems.map((item) => {
                              const display = getItemDisplay(item);
                              return (
                                <TableRow key={item.localId} className="align-top">
                                  <TableCell>
                                    <div className="flex items-center gap-3">
                                      <img
                                        src={display.src}
                                        alt={display.name}
                                        className="h-16 w-12 rounded-xl border object-cover"
                                      />
                                      <div className="flex min-w-0 flex-col gap-0.5">
                                        <p className="truncate font-medium">
                                          {display.name}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                          {display.code}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                          {display.subtitle}
                                        </p>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      min={1}
                                      value={item.quantity}
                                      onChange={(event) =>
                                        updateDraftItem(item.localId, {
                                          quantity: Math.max(1, Number(event.target.value) || 1),
                                        })
                                      }
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={item.condition}
                                      onValueChange={(value) =>
                                        updateDraftItem(item.localId, { condition: value })
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {CONDITION_OPTIONS.map((option) => (
                                          <SelectItem key={option} value={option}>
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={item.purchasePrice}
                                      onChange={(event) =>
                                        updateDraftItem(item.localId, {
                                          purchasePrice: roundCurrency(
                                            Number(event.target.value) || 0
                                          ),
                                        })
                                      }
                                    />
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="flex flex-col gap-0.5">
                                      <span>{formatCurrency(item.marketPriceSnapshot, draftCurrency)}</span>
                                      <span className="text-muted-foreground">
                                        70% {formatCurrency(item.market70Snapshot, draftCurrency)}
                                      </span>
                                      <span className="text-muted-foreground">
                                        80% {formatCurrency(item.market80Snapshot, draftCurrency)}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="flex flex-col gap-0.5">
                                      <span>{formatCurrency(item.midPriceSnapshot, draftCurrency)}</span>
                                      <span className="text-muted-foreground">
                                        70% {formatCurrency(item.median70Snapshot, draftCurrency)}
                                      </span>
                                      <span className="text-muted-foreground">
                                        80% {formatCurrency(item.median80Snapshot, draftCurrency)}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={item.notes}
                                      onChange={(event) =>
                                        updateDraftItem(item.localId, {
                                          notes: event.target.value,
                                        })
                                      }
                                      placeholder="nota"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeDraftItem(item.localId)}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </main>
        </div>
      </div>
      
      <AddCardsModal
        open={showAddCardsModal}
        onClose={() => setShowAddCardsModal(false)}
        currency={draftCurrency}
        onConfirm={addCardsToDraft}
      />
    </div>
  );
}

function HeroStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2 text-white/60">
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">
          {label}
        </p>
      </div>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function WorkspaceMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "dark" | "emerald" | "amber" | "slate";
}) {
  const toneClass =
    tone === "dark"
      ? "border-slate-950 bg-slate-950 text-white"
      : tone === "emerald"
        ? "border-emerald-200 bg-emerald-50 text-emerald-950"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-slate-200 bg-slate-50 text-slate-950";

  const labelClass = tone === "dark" ? "text-white/65" : "text-slate-500";

  return (
    <div className={cn("rounded-2xl border p-4", toneClass)}>
      <div className={cn("flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]", labelClass)}>
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-3 text-xl font-semibold">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      {children}
    </div>
  );
}

// Modal de "Agregar cartas" — clon estructural del modal de Agregar cartas
// de /lists/[id]/add-cards: misma columna de Filtros (FiltersSidebar
// variant="inline"), mismo catálogo completo cacheado (useAllCards +
// useCardStore), mismos tiles de carta, mismo DropdownSearch, y pestañas
// Cartas / Sets / Productos (Productos = el equivalente de Sleeves aquí,
// pero con el catálogo general de productos en vez de solo sleeves).
function AddCardsModal({
  open,
  onClose,
  currency,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  currency: string;
  onConfirm: (picks: BuylistPick[]) => void;
}) {
  const [addModalTab, setAddModalTab] = useState<"cards" | "sets" | "products">(
    "cards"
  );
  const [search, setSearch] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedCosts, setSelectedCosts] = useState<string[]>([]);
  const [selectedPower, setSelectedPower] = useState<string[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedCounter, setSelectedCounter] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [selectedAltArts, setSelectedAltArts] = useState<string[]>([]);
  const [setsTabQuery, setSetsTabQuery] = useState("");
  const [productsTabQuery, setProductsTabQuery] = useState("");
  const [debouncedProductsQuery, setDebouncedProductsQuery] = useState("");
  const [products, setProducts] = useState<ProductSearchItem[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [cart, setCart] = useState<CartEntry[]>([]);

  useEffect(() => {
    if (open) return;
    setAddModalTab("cards");
    setSearch("");
    setSelectedColors([]);
    setSelectedSets([]);
    setSelectedRarities([]);
    setSelectedCosts([]);
    setSelectedPower([]);
    setSelectedAttributes([]);
    setSelectedCategories([]);
    setSelectedEffects([]);
    setSelectedTypes([]);
    setSelectedCounter("");
    setSelectedTrigger("");
    setSelectedCodes([]);
    setSelectedAltArts([]);
    setSetsTabQuery("");
    setProductsTabQuery("");
    setProducts([]);
    setCart([]);
  }, [open]);

  // Catálogo completo de cartas — mismo store/hook global que
  // /lists/[id]/add-cards (useAllCards + useCardStore, cacheado en IndexedDB
  // vía TanStack Query), así los filtros son instantáneos sin ir al server.
  const cachedCards = useCardStore((state) => state.allCards);
  const setAllCards = useCardStore((state) => state.setAllCards);
  const setIsFullyLoaded = useCardStore((state) => state.setIsFullyLoaded);
  const allCardsSignatureRef = useRef<string | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const hasActiveSearch = debouncedSearch.trim().length > 0;
  const fullQueryFilters = useMemo<CardsFilters>(
    () => ({ search: hasActiveSearch ? debouncedSearch.trim() : undefined }),
    [debouncedSearch, hasActiveSearch]
  );

  const { data: allCardsData, isFetching: isFetchingAllCards } = useAllCards(
    fullQueryFilters,
    {
      includeRelations: true,
      includeAlternates: true,
      includeCounts: false,
      enabled: open,
    }
  );

  useEffect(() => {
    if (!open || hasActiveSearch || !allCardsData) return;

    if (!allCardsData.length) {
      if (allCardsSignatureRef.current !== "empty") {
        allCardsSignatureRef.current = "empty";
        setAllCards([]);
      }
      return;
    }

    const first = allCardsData[0];
    const last = allCardsData[allCardsData.length - 1];
    const signature = `${allCardsData.length}-${first?.id ?? ""}-${last?.id ?? ""}`;
    if (allCardsSignatureRef.current !== signature) {
      allCardsSignatureRef.current = signature;
      setAllCards(allCardsData);
    }
    if (!isFetchingAllCards) setIsFullyLoaded(true);
  }, [open, hasActiveSearch, allCardsData, isFetchingAllCards, setAllCards, setIsFullyLoaded]);

  const cards = hasActiveSearch
    ? allCardsData ?? []
    : cachedCards.length > 0
      ? cachedCards
      : allCardsData ?? [];

  const allFilteredCards = useMemo(() => {
    if (!cards || cards.length === 0) return [];

    return cards
      .filter((card) => {
        const matchesWithAlternates = (
          predicate: (target: CardWithCollectionData) => boolean
        ) =>
          predicate(card) ||
          (card.alternates ?? []).some((alt) => predicate(alt));

        const matchesSearch =
          cardMatchesActiveFilters(card, {
            search,
            selectedSets,
            selectedCodes,
            selectedAltArts,
          }) ||
          (card.alternates ?? []).some((alt) =>
            cardMatchesActiveFilters(alt, {
              search,
              selectedSets,
              selectedCodes,
              selectedAltArts,
            })
          ) ||
          matchesCardCode(card.code, search) ||
          (card.alternates ?? []).some((alt) => matchesCardCode(alt.code, search));

        const matchesColors =
          selectedColors.length === 0 ||
          matchesWithAlternates((target) =>
            target.colors.some((col) =>
              selectedColors.includes(col.color.toLowerCase())
            )
          );

        const baseMatches = baseCardMatches(card, selectedSets, []);
        const altMatches = getFilteredAlternates(card, selectedSets, []).length > 0;
        const matchesSets = selectedSets.length === 0 ? true : baseMatches || altMatches;

        const matchesAltArts =
          selectedAltArts.length === 0 ||
          matchesWithAlternates((target) =>
            selectedAltArts.includes(target.alternateArt ?? "")
          );

        const matchesTypes =
          selectedTypes.length === 0 ||
          matchesWithAlternates((target) =>
            target.types.some((type) => selectedTypes.includes(type.type))
          );

        const matchesEffects =
          selectedEffects.length === 0 ||
          matchesWithAlternates((target) =>
            (target.effects ?? []).some((effect) =>
              selectedEffects.includes(effect.effect)
            )
          );

        const matchesRarities =
          selectedRarities.length === 0 ||
          matchesWithAlternates((target) =>
            selectedRarities.includes(target.rarity || "")
          );

        const matchesCategories =
          selectedCategories.length === 0 ||
          matchesWithAlternates((target) =>
            selectedCategories.includes(target.category || "")
          );

        const matchesCounter =
          selectedCounter === "" ||
          matchesWithAlternates((target) =>
            selectedCounter === NO_COUNTER_LABEL
              ? !target.counter
              : (target.counter?.toString() ?? "") === selectedCounter
          );

        const matchesTrigger =
          selectedTrigger === "" ||
          matchesWithAlternates((target) =>
            selectedTrigger === NO_TRIGGER_LABEL
              ? !target.triggerCard
              : Boolean(target.triggerCard)
          );

        const matchesCosts =
          selectedCosts.length === 0 ||
          matchesWithAlternates((target) => selectedCosts.includes(target.cost || ""));

        const matchesPower =
          selectedPower.length === 0 ||
          matchesWithAlternates((target) => selectedPower.includes(target.power || ""));

        const matchesAttributes =
          selectedAttributes.length === 0 ||
          matchesWithAlternates((target) =>
            selectedAttributes.includes(target.attribute || "")
          );

        const matchesCodes =
          selectedCodes.length === 0 ||
          matchesWithAlternates((target) =>
            selectedCodes.some((code) => target.code.includes(code))
          );

        return (
          matchesSearch &&
          matchesColors &&
          matchesSets &&
          matchesAltArts &&
          matchesRarities &&
          matchesTypes &&
          matchesCategories &&
          matchesCounter &&
          matchesTrigger &&
          matchesEffects &&
          matchesCosts &&
          matchesPower &&
          matchesAttributes &&
          matchesCodes
        );
      })
      .sort(sortByCollectionOrder);
  }, [
    cards,
    search,
    selectedColors,
    selectedSets,
    selectedTypes,
    selectedEffects,
    selectedRarities,
    selectedCategories,
    selectedCounter,
    selectedTrigger,
    selectedCosts,
    selectedPower,
    selectedAttributes,
    selectedCodes,
    selectedAltArts,
  ]);

  const VISIBLE_CAP = 120;
  const visibleCards = allFilteredCards.slice(0, VISIBLE_CAP);

  // Pestaña "Productos": búsqueda server-side (debounced) sobre el catálogo
  // general de productos — boosters, sleeves, playmats, etc.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedProductsQuery(productsTabQuery), 250);
    return () => clearTimeout(t);
  }, [productsTabQuery]);

  useEffect(() => {
    if (addModalTab !== "products" || !open) return;
    let cancelled = false;
    setIsLoadingProducts(true);
    const params = new URLSearchParams({ limit: "60", archived: "false" });
    if (debouncedProductsQuery.trim()) {
      params.set("search", debouncedProductsQuery.trim());
    }
    fetch(`/api/products?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setProducts((data.items ?? []) as ProductSearchItem[]);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProducts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addModalTab, open, debouncedProductsQuery]);

  const pickCard = (card: CardWithCollectionData) => {
    setCart((prev) => {
      const idx = prev.findIndex((e) => e.kind === "card" && e.card.id === card.id);
      if (idx >= 0) {
        const next = [...prev];
        const entry = next[idx];
        next[idx] = { ...entry, quantity: entry.quantity + 1 };
        return next;
      }
      return [...prev, { kind: "card", card, quantity: 1 }];
    });
  };

  const updateCardQuantity = (cardId: CardWithCollectionData["id"], delta: number) => {
    setCart((prev) =>
      prev
        .map((e) =>
          e.kind === "card" && e.card.id === cardId
            ? { ...e, quantity: e.quantity + delta }
            : e
        )
        .filter((e) => e.quantity > 0)
    );
  };

  const removeCard = (cardId: CardWithCollectionData["id"]) => {
    setCart((prev) => prev.filter((e) => !(e.kind === "card" && e.card.id === cardId)));
  };

  const handleAddAllFromSet = (setCards: CardWithCollectionData[]) => {
    setCart((prev) => {
      const next = [...prev];
      for (const card of setCards) {
        const idx = next.findIndex((e) => e.kind === "card" && e.card.id === card.id);
        if (idx >= 0) {
          const entry = next[idx];
          next[idx] = { ...entry, quantity: entry.quantity + 1 };
        } else {
          next.push({ kind: "card", card, quantity: 1 });
        }
      }
      return next;
    });
  };

  const pickProduct = (product: ProductSearchItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((e) => e.kind === "product" && e.product.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        const entry = next[idx];
        next[idx] = { ...entry, quantity: entry.quantity + 1 };
        return next;
      }
      return [...prev, { kind: "product", product, quantity: 1 }];
    });
  };

  const updateProductQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((e) =>
          e.kind === "product" && e.product.id === productId
            ? { ...e, quantity: e.quantity + delta }
            : e
        )
        .filter((e) => e.quantity > 0)
    );
  };

  const removeProduct = (productId: number) => {
    setCart((prev) =>
      prev.filter((e) => !(e.kind === "product" && e.product.id === productId))
    );
  };

  const cartCardEntries = useMemo(
    () => cart.filter((e): e is Extract<CartEntry, { kind: "card" }> => e.kind === "card"),
    [cart]
  );
  const cartProductEntries = useMemo(
    () =>
      cart.filter((e): e is Extract<CartEntry, { kind: "product" }> => e.kind === "product"),
    [cart]
  );
  const totalQuantity = cart.reduce((sum, e) => sum + e.quantity, 0);

  const handleConfirm = () => {
    if (cart.length === 0) return;
    const picks: BuylistPick[] = cart.map((entry) =>
      entry.kind === "card"
        ? { kind: "card" as const, quantity: entry.quantity, card: toCardSearchItem(entry.card) }
        : { kind: "product" as const, quantity: entry.quantity, product: entry.product }
    );
    onConfirm(picks);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex h-full w-full flex-col overflow-hidden p-0 sm:h-[85vh] sm:max-h-[800px] sm:w-[1200px] sm:max-w-[95vw]">
        <DialogHeader className="flex-shrink-0 border-b px-5 py-3">
          <DialogTitle>Agregar cartas</DialogTitle>
        </DialogHeader>

        <div className="flex border-b border-slate-200 bg-white flex-shrink-0">
          {(
            [
              { key: "cards", label: "Cartas" },
              { key: "sets", label: "Sets" },
              { key: "products", label: "Productos" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setAddModalTab(tab.key)}
              className={`flex-1 px-2 py-2 text-xs font-semibold border-b-2 transition-colors ${
                addModalTab === tab.key
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="hidden sm:flex w-64 flex-shrink-0 min-h-0 flex-col">
            {addModalTab === "cards" && (
              <FiltersSidebar
                variant="inline"
                isOpen={false}
                setIsOpen={() => {}}
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
                selectedAltArts={selectedAltArts}
                setSelectedAltArts={setSelectedAltArts}
                selectedCodes={selectedCodes}
                setSelectedCodes={setSelectedCodes}
              />
            )}
            {addModalTab === "sets" && (
              <div className="flex h-full w-full flex-col bg-white border-r border-slate-200">
                <div className="px-3 py-2.5 border-b border-slate-200 flex-shrink-0">
                  <input
                    type="text"
                    value={setsTabQuery}
                    onChange={(e) => setSetsTabQuery(e.target.value)}
                    placeholder="Buscar set..."
                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                  {setOptions
                    .filter((opt) =>
                      opt.label.toLowerCase().includes(setsTabQuery.toLowerCase())
                    )
                    .map((opt) => {
                      const isActive =
                        selectedSets.length === 1 && selectedSets[0] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSelectedSets(isActive ? [] : [opt.value])}
                          className={`text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
            {addModalTab === "products" && (
              <div className="flex h-full w-full flex-col bg-white border-r border-slate-200">
                <div className="px-3 py-2.5 border-b border-slate-200 flex-shrink-0">
                  <input
                    type="text"
                    value={productsTabQuery}
                    onChange={(e) => setProductsTabQuery(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-3 text-xs text-slate-400">
                  Busca boosters, sleeves, playmats y otros productos para
                  agregarlos como l&iacute;nea de compra.
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            {addModalTab === "products" ? (
              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                {isLoadingProducts ? (
                  <div className="flex items-center justify-center h-full gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando productos...
                  </div>
                ) : products.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-slate-400">
                    No hay productos disponibles
                  </div>
                ) : (
                  <div className="grid gap-3 grid-cols-3 sm:grid-cols-3 lg:grid-cols-5">
                    {products.map((p) => {
                      const qty = cartProductEntries.find((e) => e.product.id === p.id)?.quantity;
                      return (
                        <div
                          key={p.id}
                          className={cn(
                            "w-full rounded-lg border overflow-hidden bg-white transition-colors",
                            qty
                              ? "border-indigo-500 ring-1 ring-indigo-500"
                              : "border-slate-200 hover:border-slate-300"
                          )}
                        >
                          <div className="relative p-1.5">
                            <LazyImage
                              src={p.imageUrl ?? p.thumbnailUrl ?? "/assets/images/backcard.webp"}
                              fallbackSrc="/assets/images/backcard.webp"
                              alt={p.name}
                              className="w-full rounded-md"
                              size="small"
                            />
                            {qty ? (
                              <>
                                <div className="absolute inset-1.5 bg-black/30 rounded-md pointer-events-none" />
                                <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[11px] font-bold min-w-[1.375rem] h-[1.375rem] px-1 rounded-full shadow flex items-center justify-center">
                                  {qty}
                                </div>
                              </>
                            ) : null}
                          </div>
                          <div className="px-2 pb-2 flex flex-col gap-1.5">
                            <p className="text-xs font-medium text-zinc-700 truncate">{p.name}</p>
                            <p className="text-[10px] text-zinc-500 truncate">
                              {formatCurrency(toNumber(p.marketPrice), p.priceCurrency || currency)}
                            </p>
                            {qty ? (
                              <div className="flex items-stretch rounded-md overflow-hidden border border-zinc-300">
                                <button
                                  onClick={() => updateProductQuantity(p.id, -1)}
                                  className="flex-1 flex items-center justify-center py-1.5 hover:bg-zinc-100 transition-colors"
                                >
                                  <Minus className="h-3.5 w-3.5 text-zinc-600" />
                                </button>
                                <span className="flex items-center justify-center min-w-[1.75rem] text-xs font-semibold text-zinc-800">
                                  {qty}
                                </span>
                                <button
                                  onClick={() => updateProductQuantity(p.id, 1)}
                                  className="flex-1 flex items-center justify-center py-1.5 hover:bg-zinc-100 transition-colors"
                                >
                                  <Plus className="h-3.5 w-3.5 text-zinc-600" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => pickProduct(p)}
                                className="flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-[11px] font-medium py-1.5 rounded-md transition-colors"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Agregar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-[#f5f5f5] bg-white flex items-center gap-2 flex-shrink-0">
                  <div className="flex-1 min-w-0">
                    <DropdownSearch
                      search={search}
                      setSearch={setSearch}
                      placeholder="Busca por código, nombre o set..."
                      suggestionsEndpoint="/api/cards/search-suggestions"
                    />
                  </div>
                </div>

                {addModalTab === "sets" && selectedSets.length > 0 && (
                  <div className="px-4 py-2 border-b border-[#f5f5f5] bg-indigo-50 flex items-center justify-between flex-shrink-0 gap-2">
                    <p className="text-sm text-indigo-900 min-w-0 truncate">
                      <span className="font-semibold">
                        {setOptions.find((o) => o.value === selectedSets[0])?.label ??
                          selectedSets[0]}
                      </span>
                      {" — "}
                      {allFilteredCards.length} carta
                      {allFilteredCards.length !== 1 ? "s" : ""}
                    </p>
                    <Button
                      size="sm"
                      className="flex-shrink-0"
                      disabled={allFilteredCards.length === 0}
                      onClick={() => handleAddAllFromSet(allFilteredCards)}
                    >
                      Agregar todas
                    </Button>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 min-h-0">
                  {addModalTab === "sets" && selectedSets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-sm text-slate-400 gap-2 py-16">
                      <Package className="h-8 w-8 text-slate-300" />
                      Elige un set a la izquierda para ver sus cartas
                    </div>
                  ) : visibleCards.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-slate-400">
                      {isFetchingAllCards
                        ? "Cargando cartas..."
                        : "No hubo resultados para esa búsqueda."}
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-1.5 grid-cols-3 sm:grid-cols-3 lg:grid-cols-5">
                        {visibleCards.map((card) => {
                          const baseMatches = baseCardMatches(
                            card,
                            selectedSets,
                            selectedAltArts
                          );
                          const filteredAlts = getFilteredAlternates(
                            card,
                            selectedSets,
                            selectedAltArts
                          );
                          if (!baseMatches && filteredAlts.length === 0) return null;

                          return (
                            <Fragment key={card._id}>
                              {baseMatches &&
                                (() => {
                                  const qty = cartCardEntries.find(
                                    (e) => e.card.id === card.id
                                  )?.quantity;
                                  return (
                                    <div
                                      className={cn(
                                        "w-full rounded-lg border overflow-hidden bg-white transition-colors",
                                        qty
                                          ? "border-indigo-500 ring-1 ring-indigo-500"
                                          : "border-slate-200 hover:border-slate-300"
                                      )}
                                    >
                                      <div
                                        className="relative p-1.5 cursor-pointer"
                                        onClick={() => pickCard(card)}
                                      >
                                        <LazyImage
                                          src={card.src}
                                          fallbackSrc="/assets/images/backcard.webp"
                                          alt={card.name}
                                          className="w-full rounded-md"
                                          size="small"
                                        />
                                        {qty ? (
                                          <>
                                            <div className="absolute inset-1.5 bg-black/30 rounded-md pointer-events-none" />
                                            <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[11px] font-bold min-w-[1.375rem] h-[1.375rem] px-1 rounded-full shadow flex items-center justify-center">
                                              {qty}
                                            </div>
                                          </>
                                        ) : null}
                                      </div>
                                      <div className="px-2 pb-2 flex flex-col gap-1.5">
                                        <div className="min-w-0 flex flex-col">
                                          <p
                                            className={`${oswald.className} text-xs font-bold text-zinc-800 truncate`}
                                          >
                                            {highlightText(card.code, search)}
                                          </p>
                                          <p className="text-[10px] text-zinc-500 truncate">
                                            {highlightText(
                                              card.sets?.[0]?.set?.title || "Sin set",
                                              search
                                            )}
                                          </p>
                                        </div>
                                        {qty ? (
                                          <div className="flex items-stretch rounded-md overflow-hidden border border-zinc-300">
                                            <button
                                              onClick={() => updateCardQuantity(card.id, -1)}
                                              className="flex-1 flex items-center justify-center py-1.5 hover:bg-zinc-100 transition-colors"
                                            >
                                              <Minus className="h-3.5 w-3.5 text-zinc-600" />
                                            </button>
                                            <span className="flex items-center justify-center min-w-[1.75rem] text-xs font-semibold text-zinc-800">
                                              {qty}
                                            </span>
                                            <button
                                              onClick={() => updateCardQuantity(card.id, 1)}
                                              className="flex-1 flex items-center justify-center py-1.5 hover:bg-zinc-100 transition-colors"
                                            >
                                              <Plus className="h-3.5 w-3.5 text-zinc-600" />
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => pickCard(card)}
                                            className="flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-[11px] font-medium py-1.5 rounded-md transition-colors"
                                          >
                                            <Plus className="h-3.5 w-3.5" />
                                            Agregar
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}

                              {filteredAlts.map((alt) => {
                                const altQty = cartCardEntries.find(
                                  (e) => e.card.id === alt.id
                                )?.quantity;
                                return (
                                  <div
                                    key={alt._id}
                                    className={cn(
                                      "w-full rounded-lg border overflow-hidden bg-white transition-colors",
                                      altQty
                                        ? "border-indigo-500 ring-1 ring-indigo-500"
                                        : "border-slate-200 hover:border-slate-300"
                                    )}
                                  >
                                    <div
                                      className="relative p-1.5 cursor-pointer"
                                      onClick={() => pickCard(alt)}
                                    >
                                      <LazyImage
                                        src={alt.src}
                                        fallbackSrc="/assets/images/backcard.webp"
                                        alt={alt.alias}
                                        className="w-full rounded-md"
                                        size="small"
                                      />
                                      {altQty ? (
                                        <>
                                          <div className="absolute inset-1.5 bg-black/30 rounded-md pointer-events-none" />
                                          <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[11px] font-bold min-w-[1.375rem] h-[1.375rem] px-1 rounded-full shadow flex items-center justify-center">
                                            {altQty}
                                          </div>
                                        </>
                                      ) : null}
                                    </div>
                                    <div className="px-2 pb-2 flex flex-col gap-1.5">
                                      <div className="min-w-0 flex flex-col">
                                        <p
                                          className={`${oswald.className} text-xs font-bold text-zinc-800 truncate`}
                                        >
                                          {highlightText(card.code, search)}
                                        </p>
                                        <p className="text-[10px] text-zinc-500 truncate">
                                          {alt.sets?.[0]?.set?.title || "Sin set"}
                                        </p>
                                      </div>
                                      {altQty ? (
                                        <div className="flex items-stretch rounded-md overflow-hidden border border-zinc-300">
                                          <button
                                            onClick={() => updateCardQuantity(alt.id, -1)}
                                            className="flex-1 flex items-center justify-center py-1.5 hover:bg-zinc-100 transition-colors"
                                          >
                                            <Minus className="h-3.5 w-3.5 text-zinc-600" />
                                          </button>
                                          <span className="flex items-center justify-center min-w-[1.75rem] text-xs font-semibold text-zinc-800">
                                            {altQty}
                                          </span>
                                          <button
                                            onClick={() => updateCardQuantity(alt.id, 1)}
                                            className="flex-1 flex items-center justify-center py-1.5 hover:bg-zinc-100 transition-colors"
                                          >
                                            <Plus className="h-3.5 w-3.5 text-zinc-600" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => pickCard(alt)}
                                          className="flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-[11px] font-medium py-1.5 rounded-md transition-colors"
                                        >
                                          <Plus className="h-3.5 w-3.5" />
                                          Agregar
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </Fragment>
                          );
                        })}
                      </div>
                      {allFilteredCards.length > VISIBLE_CAP && (
                        <p className="mt-3 text-center text-xs text-slate-400">
                          Mostrando {VISIBLE_CAP} de {allFilteredCards.length} — refina la
                          búsqueda o los filtros para ver más.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="hidden sm:flex w-72 flex-shrink-0 border-l border-slate-200 flex-col min-h-0">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <p className="text-sm font-semibold text-zinc-900">
                Seleccionadas ({totalQuantity})
              </p>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs font-medium text-indigo-600 hover:underline"
                >
                  Limpiar
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-slate-400">
                  <ShoppingBag className="h-8 w-8 opacity-30" />
                  Las cartas y productos que elijas aparecerán aquí
                </div>
              ) : (
                cart.map((entry) => {
                  const isCard = entry.kind === "card";
                  const key = isCard ? `card-${entry.card.id}` : `product-${entry.product.id}`;
                  const src = isCard
                    ? entry.card.src
                    : entry.product.imageUrl ?? entry.product.thumbnailUrl ?? "";
                  const name = isCard ? entry.card.name : entry.product.name;
                  return (
                    <div key={key} className="flex items-center gap-2 rounded-md border p-1.5">
                      <div className="h-11 w-8 flex-shrink-0">
                        <LazyImage
                          src={src || "/assets/images/backcard.webp"}
                          fallbackSrc="/assets/images/backcard.webp"
                          alt={name}
                          className="w-full h-full rounded object-cover"
                          size="small"
                        />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">{name}</span>
                      <button
                        onClick={() =>
                          isCard
                            ? updateCardQuantity(entry.card.id, -1)
                            : updateProductQuantity(entry.product.id, -1)
                        }
                        className="flex h-6 w-6 items-center justify-center rounded bg-zinc-100 hover:bg-zinc-200"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-xs font-semibold">
                        {entry.quantity}
                      </span>
                      <button
                        onClick={() =>
                          isCard
                            ? updateCardQuantity(entry.card.id, 1)
                            : updateProductQuantity(entry.product.id, 1)
                        }
                        className="flex h-6 w-6 items-center justify-center rounded bg-zinc-100 hover:bg-zinc-200"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() =>
                          isCard ? removeCard(entry.card.id) : removeProduct(entry.product.id)
                        }
                        className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {cart.length > 0 && (
          <div className="flex flex-shrink-0 justify-end border-t bg-white p-3">
            <Button onClick={handleConfirm} className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar {totalQuantity} item{totalQuantity !== 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
