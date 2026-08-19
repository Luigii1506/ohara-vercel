"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Search,
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

type BuylistItemDraft = {
  localId: string;
  cardId: number;
  card: CardSearchItem;
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
    cardId: number;
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
    card: CardSearchItem;
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

const buildDraftItem = (card: CardSearchItem, currency: string): BuylistItemDraft => {
  const market = roundCurrency(toNumber(card.marketPrice));
  const median = roundCurrency(toNumber(card.midPrice));

  return {
    localId: `${card.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    cardId: card.id,
    card,
    quantity: 1,
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
};

const hydrateDraftItems = (
  session: BuylistSession | null
): BuylistItemDraft[] => {
  if (!session) return [];
  return session.items.map((item) => ({
    localId: `saved-${item.id}`,
    cardId: item.cardId,
    card: item.card,
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

export default function AdminBuylistPage() {
  const router = useRouter();
  const { role, loading } = useUser();

  const [sessions, setSessions] = useState<BuylistSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [showAddCardsModal, setShowAddCardsModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCustomerName, setDraftCustomerName] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftCurrency, setDraftCurrency] = useState("USD");
  const [draftSourceType, setDraftSourceType] =
    useState<BuylistSession["sourceType"]>("MIXED");
  const [draftStatus, setDraftStatus] =
    useState<BuylistSession["status"]>("DRAFT");
  const [draftItems, setDraftItems] = useState<BuylistItemDraft[]>([]);

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
      if (!selectedSessionId && nextSessions.length > 0) {
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

  useEffect(() => {
    setDraftTitle(selectedSession?.title ?? "");
    setDraftCustomerName(selectedSession?.customerName ?? "");
    setDraftNotes(selectedSession?.notes ?? "");
    setDraftCurrency(selectedSession?.currency ?? "USD");
    setDraftSourceType(selectedSession?.sourceType ?? "MIXED");
    setDraftStatus(selectedSession?.status ?? "DRAFT");
    setDraftItems(hydrateDraftItems(selectedSession));
  }, [selectedSession]);

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

  // Confirmación del modal "Agregar cartas": agrega cada carta elegida como
  // su propia línea (con la cantidad acumulada en el modal), sin tocar las
  // líneas que ya estaban en el draft.
  const addCardsToDraft = (
    picks: Array<{ card: CardSearchItem; quantity: number }>
  ) => {
    setDraftItems((prev) => [
      ...prev,
      ...picks.map((pick) => ({
        ...buildDraftItem(pick.card, draftCurrency),
        quantity: pick.quantity,
      })),
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full px-6 py-6 2xl:px-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold">Buylist</h1>
          <p className="text-muted-foreground">
            Captura compras r&aacute;pidas, guarda snapshots de precio y lleva
            historial operativo de colecciones y singles.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadSessions()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${sessionsLoading ? "animate-spin" : ""}`} />
            Refrescar
          </Button>
          <Button onClick={() => void createSession()} disabled={saving}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva compra
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingBag className="h-5 w-5" />
              Sesiones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sessionsLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Cargando sesiones...
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No hay compras guardadas todav&iacute;a.
              </div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedSessionId(session.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedSessionId === session.id
                      ? "border-blue-500 bg-blue-50"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="truncate font-medium">{session.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {session.customerName || "Sin cliente"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.totalQuantity} carta(s)
                      </p>
                    </div>
                    <Badge variant="outline" className="flex-shrink-0">
                      {session.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-col gap-0.5 text-xs text-muted-foreground">
                    <span>{session.sourceType}</span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(toNumber(session.totalPaid), session.currency)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {!selectedSession ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Selecciona una sesi&oacute;n o crea una nueva compra.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
                <SummaryCard
                  label="Total pagado"
                  value={formatCurrency(summary.totalPaid, draftCurrency)}
                />
                <SummaryCard
                  label="Market total"
                  value={formatCurrency(summary.totalMarket, draftCurrency)}
                />
                <SummaryCard
                  label="Median total"
                  value={formatCurrency(summary.totalMedian, draftCurrency)}
                />
                <SummaryCard
                  label="Cantidad"
                  value={`${summary.totalQuantity} carta(s)`}
                />
                <SummaryCard
                  label="Market 70%"
                  value={formatCurrency(summary.totalMarket70, draftCurrency)}
                />
                <SummaryCard
                  label="Market 80%"
                  value={formatCurrency(summary.totalMarket80, draftCurrency)}
                />
                <SummaryCard
                  label="Median 70%"
                  value={formatCurrency(summary.totalMedian70, draftCurrency)}
                />
                <SummaryCard
                  label="Median 80%"
                  value={formatCurrency(summary.totalMedian80, draftCurrency)}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Detalle de la compra</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    placeholder="Nombre de la compra"
                  />
                  <Input
                    value={draftCustomerName}
                    onChange={(event) => setDraftCustomerName(event.target.value)}
                    placeholder="Cliente / vendedor"
                  />
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
                  <div className="md:col-span-2">
                    <Textarea
                      value={draftNotes}
                      onChange={(event) => setDraftNotes(event.target.value)}
                      placeholder="Notas internas de la compra, trato, condición general, etc."
                    />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button onClick={() => void saveSession()} disabled={saving}>
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Guardar buylist
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                  <CardTitle>Items de compra</CardTitle>
                  <Button onClick={() => setShowAddCardsModal(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Agregar cartas
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
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
                          <TableCell colSpan={8} className="py-10 text-center">
                            Agrega cartas desde la búsqueda para empezar.
                          </TableCell>
                        </TableRow>
                      ) : (
                        draftItems.map((item) => (
                          <TableRow key={item.localId}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <img
                                  src={item.card.src}
                                  alt={item.card.name}
                                  className="h-16 w-12 rounded border object-cover"
                                />
                                <div className="flex min-w-0 flex-col gap-0.5">
                                  <p className="truncate font-medium">
                                    {item.card.name}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {item.card.code}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {item.card.sets?.[0]?.set?.title || item.card.setCode}
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
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

// Modal de "Agregar cartas" — mismo patrón que el carrito del modal de
// Agregar cartas en /lists/[id]/add-cards: búsqueda por botón explícito (no
// en vivo mientras se escribe), selección acumulable con +/- por carta, y
// un solo confirmar que agrega todo de golpe. Vive con su propio estado
// (búsqueda + carrito) para que crear/cambiar de sesión de compra no lo
// afecte para nada.
function AddCardsModal({
  open,
  onClose,
  currency,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  currency: string;
  onConfirm: (picks: Array<{ card: CardSearchItem; quantity: number }>) => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [results, setResults] = useState<CardSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [cart, setCart] = useState<
    Array<{ card: CardSearchItem; quantity: number }>
  >([]);

  useEffect(() => {
    if (!open) {
      setSearchInput("");
      setResults([]);
      setSearching(false);
      setHasSearched(false);
      setCart([]);
    }
  }, [open]);

  const runSearch = async () => {
    const term = searchInput.trim();
    if (term.length < 2) {
      setResults([]);
      setHasSearched(true);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({
        search: term,
        limit: "24",
        includeAlternates: "false",
        includeCounts: "false",
      });
      const response = await fetch(`/api/cards/full?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to search cards");
      const data = await response.json();
      setResults((data.items ?? []) as CardSearchItem[]);
    } catch (error) {
      console.error(error);
      setResults([]);
    } finally {
      setSearching(false);
      setHasSearched(true);
    }
  };

  const pickCard = (card: CardSearchItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((entry) => entry.card.id === card.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { card, quantity: 1 }];
    });
  };

  const updateQuantity = (cardId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((entry) =>
          entry.card.id === cardId
            ? { ...entry, quantity: entry.quantity + delta }
            : entry
        )
        .filter((entry) => entry.quantity > 0)
    );
  };

  const removeFromCart = (cardId: number) => {
    setCart((prev) => prev.filter((entry) => entry.card.id !== cardId));
  };

  const totalQuantity = cart.reduce((sum, entry) => sum + entry.quantity, 0);

  const handleConfirm = () => {
    if (cart.length === 0) return;
    onConfirm(cart);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex h-full w-full flex-col overflow-hidden p-0 sm:h-[85vh] sm:max-h-[800px] sm:w-[1100px] sm:max-w-[95vw]">
        <DialogHeader className="flex-shrink-0 border-b px-5 py-3">
          <DialogTitle>Agregar cartas</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-shrink-0 items-center gap-2 border-b px-4 py-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void runSearch();
                    }
                  }}
                  placeholder="Busca por código, nombre o set..."
                />
              </div>
              <Button onClick={() => void runSearch()} disabled={searching}>
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">Buscar</span>
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {searching ? (
                <div className="text-sm text-muted-foreground">
                  Buscando cartas...
                </div>
              ) : results.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
                  {results.map((card) => {
                    const inCart = cart.find((entry) => entry.card.id === card.id);
                    return (
                      <div
                        key={card.id}
                        className="flex flex-col gap-2 rounded-lg border p-2"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={card.src}
                            alt={card.name}
                            className="h-16 w-12 flex-shrink-0 rounded border object-cover"
                          />
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <p className="truncate text-sm font-medium">
                              {card.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {card.code}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {card.sets?.[0]?.set?.title || card.setCode}
                            </p>
                            <p className="truncate text-xs font-medium text-emerald-700">
                              Mkt {formatCurrency(toNumber(card.marketPrice), currency)}
                            </p>
                            <p className="truncate text-xs font-medium text-emerald-700">
                              Mid {formatCurrency(toNumber(card.midPrice), currency)}
                            </p>
                          </div>
                        </div>
                        {inCart ? (
                          <div className="flex items-stretch overflow-hidden rounded-md border">
                            <button
                              type="button"
                              onClick={() => updateQuantity(card.id, -1)}
                              className="flex flex-1 items-center justify-center py-1.5 hover:bg-muted"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="flex min-w-[2rem] items-center justify-center text-xs font-semibold">
                              {inCart.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(card.id, 1)}
                              className="flex flex-1 items-center justify-center py-1.5 hover:bg-muted"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="gap-1.5"
                            onClick={() => pickCard(card)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Agregar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : hasSearched ? (
                <div className="text-sm text-muted-foreground">
                  No hubo resultados para esa búsqueda.
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Escribe un código, nombre o set y presiona Buscar.
                </div>
              )}
            </div>
          </div>

          <div className="hidden min-h-0 w-72 flex-shrink-0 flex-col border-l sm:flex">
            <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold">
                Seleccionadas ({totalQuantity})
              </p>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  Limpiar
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-muted-foreground">
                  <ShoppingBag className="h-8 w-8 opacity-30" />
                  Las cartas que elijas aparecerán aquí
                </div>
              ) : (
                cart.map((entry) => (
                  <div
                    key={entry.card.id}
                    className="flex items-center gap-2 rounded-md border p-1.5"
                  >
                    <img
                      src={entry.card.src}
                      alt={entry.card.name}
                      className="h-11 w-8 flex-shrink-0 rounded object-cover"
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {entry.card.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(entry.card.id, -1)}
                      className="flex h-6 w-6 items-center justify-center rounded bg-muted hover:bg-muted/70"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-semibold">
                      {entry.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(entry.card.id, 1)}
                      className="flex h-6 w-6 items-center justify-center rounded bg-muted hover:bg-muted/70"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(entry.card.id)}
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {cart.length > 0 && (
          <div className="flex flex-shrink-0 justify-end border-t bg-white p-3">
            <Button onClick={handleConfirm} className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar {totalQuantity} carta{totalQuantity !== 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
