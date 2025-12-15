"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import { Clock3, PlusCircle, RefreshCcw } from "lucide-react";
import {
  Card as UICard,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AlertThresholdType = "ABOVE_VALUE" | "BELOW_VALUE" | "PERCENT_CHANGE";
type AlertNotificationMethod = "IN_APP" | "EMAIL" | "SLACK";

type AlertItem = {
  id: number;
  cardId: number;
  card: {
    id: number;
    name: string;
    code: string;
    setCode: string | null;
    marketPrice?: number | null;
    priceCurrency?: string | null;
  };
  thresholdType: AlertThresholdType;
  thresholdValue: number | null;
  percentChange: number | null;
  percentWindowHours: number | null;
  notificationMethod: AlertNotificationMethod;
  isActive: boolean;
  updatedAt: string;
  lastTriggeredAt?: string | null;
  lastTriggerPrice?: number | null;
};

type AlertLog = {
  id: number;
  card: {
    id: number;
    name: string;
    code: string;
    priceCurrency?: string | null;
  };
  alert: {
    id: number;
    thresholdType: AlertThresholdType;
    notificationMethod: AlertNotificationMethod;
  };
  price: number;
  priceType: string;
  triggeredAt: string;
};

type AlertStats = {
  activeAlerts: number;
  inactiveAlerts: number;
  alertsTriggered24h: number;
  unreadNotifications: number;
  lastTriggerAt: string | null;
};

type CardOption = {
  id: number;
  name: string;
  code: string;
  setCode?: string | null;
};

const emptyForm = {
  id: null as number | null,
  cardId: null as number | null,
  cardLabel: "",
  thresholdType: "ABOVE_VALUE" as AlertThresholdType,
  thresholdValue: "",
  percentChange: "",
  percentWindowHours: "24",
  notificationMethod: "IN_APP" as AlertNotificationMethod,
  isActive: true,
};

const thresholdLabels: Record<AlertThresholdType, string> = {
  ABOVE_VALUE: "Above",
  BELOW_VALUE: "Below",
  PERCENT_CHANGE: "% Change",
};

const notificationLabels: Record<AlertNotificationMethod, string> = {
  IN_APP: "In App",
  EMAIL: "Email",
  SLACK: "Slack",
};

const currencyFormatter = (value: number, currency?: string | null) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency || "USD"} ${value.toFixed(2)}`;
  }
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const AdminAlertsPage = () => {
  const router = useRouter();
  const { role, loading: userLoading } = useUser();

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [recentLogs, setRecentLogs] = useState<AlertLog[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [formState, setFormState] = useState({ ...emptyForm });
  const [cardSearch, setCardSearch] = useState("");
  const [cardOptions, setCardOptions] = useState<CardOption[]>([]);
  const [cardSearchLoading, setCardSearchLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && role !== "ADMIN") {
      router.push("/unauthorized");
    }
  }, [role, userLoading, router]);

  const loadAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/alerts?includeLogs=true");
      if (!res.ok) {
        throw new Error("No se pudieron cargar las alertas");
      }
      const data = await res.json();
      setAlerts(data.alerts ?? []);
      setRecentLogs(data.recentLogs ?? []);
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch("/api/admin/alerts/stats");
      if (!res.ok) {
        throw new Error("No se pudieron cargar las estadísticas");
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadAlerts(), loadStats()]);
  };

  useEffect(() => {
    if (role === "ADMIN") {
      refreshAll();
    }
  }, [role]);

  useEffect(() => {
    if (!cardSearch.trim()) {
      setCardOptions([]);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      setCardSearchLoading(true);
      try {
        const params = new URLSearchParams({
          search: cardSearch.trim(),
          includeRelations: "false",
          includeAlternates: "false",
        });
        const res = await fetch(`/api/admin/cards?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("No se pudieron buscar cartas");
        }
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.items ?? [];
        setCardOptions(
          items.map((item: any) => ({
            id: item.id,
            name: item.name,
            code: item.code,
            setCode: item.setCode,
          }))
        );
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error(err);
        }
      } finally {
        setCardSearchLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [cardSearch]);

  const handleSelectCard = (option: CardOption) => {
    setFormState((prev) => ({
      ...prev,
      cardId: option.id,
      cardLabel: `${option.name} (${option.code})`,
    }));
    setCardOptions([]);
    setCardSearch("");
  };

  const handleEditAlert = (alert: AlertItem) => {
    setFormState({
      id: alert.id,
      cardId: alert.card.id,
      cardLabel: `${alert.card.name} (${alert.card.code})`,
      thresholdType: alert.thresholdType,
      thresholdValue:
        alert.thresholdType !== "PERCENT_CHANGE" && alert.thresholdValue !== null
          ? String(alert.thresholdValue)
          : "",
      percentChange:
        alert.thresholdType === "PERCENT_CHANGE" && alert.percentChange !== null
          ? String(alert.percentChange)
          : "",
      percentWindowHours:
        alert.percentWindowHours !== null
          ? String(alert.percentWindowHours)
          : "24",
      notificationMethod: alert.notificationMethod,
      isActive: alert.isActive,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteAlert = async (alertId: number) => {
    if (!confirm("¿Eliminar esta alerta?")) return;
    try {
      await fetch(`/api/admin/alerts/${alertId}`, {
        method: "DELETE",
      });
      refreshAll();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleActive = async (alert: AlertItem, nextValue: boolean) => {
    try {
      await fetch(`/api/admin/alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: alert.card.id,
          thresholdType: alert.thresholdType,
          thresholdValue:
            alert.thresholdType === "PERCENT_CHANGE"
              ? null
              : alert.thresholdValue,
          percentChange:
            alert.thresholdType === "PERCENT_CHANGE"
              ? alert.percentChange
              : null,
          percentWindowHours:
            alert.thresholdType === "PERCENT_CHANGE"
              ? alert.percentWindowHours ?? 24
              : null,
          notificationMethod: alert.notificationMethod,
          isActive: nextValue,
        }),
      });
      refreshAll();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.cardId) {
      alert("Selecciona una carta para la alerta.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        cardId: formState.cardId,
        thresholdType: formState.thresholdType,
        notificationMethod: formState.notificationMethod,
        isActive: formState.isActive,
      };

      if (formState.thresholdType === "PERCENT_CHANGE") {
        payload.percentChange = Number(formState.percentChange);
        payload.percentWindowHours = Number(formState.percentWindowHours) || 24;
      } else {
        payload.thresholdValue = Number(formState.thresholdValue);
      }

      const endpoint = formState.id
        ? `/api/admin/alerts/${formState.id}`
        : "/api/admin/alerts";
      const method = formState.id ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "No se pudo guardar la alerta");
      }

      setFormState({ ...emptyForm });
      refreshAll();
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const activeAlerts = useMemo(
    () => alerts.filter((alert) => alert.isActive),
    [alerts]
  );

  if (userLoading || role !== "ADMIN") {
    return (
      <div className="flex h-full items-center justify-center bg-neutral-50">
        <div className="text-lg text-gray-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f2eede] to-[#e6d5b8] px-4 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase text-gray-500">Market Alerts</p>
            <h1 className="text-3xl font-bold text-gray-900">
              Price Alert Center
            </h1>
            <p className="text-gray-600">
              Gestiona alertas automáticas y revisa los últimos disparos.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setFormState({ ...emptyForm })}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Nueva alerta
            </Button>
            <Button variant="secondary" onClick={refreshAll}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <UICard>
            <CardHeader className="pb-2">
              <CardDescription>Alertas activas</CardDescription>
              <CardTitle className="text-3xl">
                {stats?.activeAlerts ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-500">
              {activeAlerts.length} configuradas actualmente
            </CardContent>
          </UICard>
          <UICard>
            <CardHeader className="pb-2">
              <CardDescription>Alertas desactivadas</CardDescription>
              <CardTitle className="text-3xl">
                {stats?.inactiveAlerts ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-500">
              Mantén tu set limpio
            </CardContent>
          </UICard>
          <UICard>
            <CardHeader className="pb-2">
              <CardDescription>Disparos 24h</CardDescription>
              <CardTitle className="text-3xl">
                {stats?.alertsTriggered24h ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-500">
              Último disparo: {formatDateTime(stats?.lastTriggerAt)}
            </CardContent>
          </UICard>
          <UICard>
            <CardHeader className="pb-2">
              <CardDescription>Notificaciones pendientes</CardDescription>
              <CardTitle className="text-3xl">
                {stats?.unreadNotifications ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-500">
              En bandeja de admin
            </CardContent>
          </UICard>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <UICard className="border-blue-100 shadow-lg">
            <CardHeader>
              <CardTitle>Alertas configuradas</CardTitle>
              <CardDescription>
                Administra umbrales y estado de cada alerta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>
                    {loading ? "Cargando..." : "Alertas activas e históricas"}
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Carta</TableHead>
                      <TableHead>Condición</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Último disparo</TableHead>
                      <TableHead className="text-center">Activo</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell className="min-w-[150px]">
                          <div className="font-semibold">
                            {alert.card.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {alert.card.code}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {thresholdLabels[alert.thresholdType]}
                          </Badge>
                          <div className="text-sm text-gray-600">
                            {alert.thresholdType === "PERCENT_CHANGE"
                              ? `${alert.percentChange ?? 0}% en ${
                                  alert.percentWindowHours ?? 24
                                }h`
                              : alert.thresholdValue !== null
                                ? currencyFormatter(
                                    alert.thresholdValue,
                                    alert.card.priceCurrency
                                  )
                                : "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {notificationLabels[alert.notificationMethod]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm text-gray-600">
                            <span>{formatDateTime(alert.lastTriggeredAt)}</span>
                            {alert.lastTriggerPrice !== undefined &&
                              alert.lastTriggerPrice !== null && (
                                <span className="text-xs text-gray-500">
                                  Último precio:{" "}
                                  {currencyFormatter(
                                    alert.lastTriggerPrice,
                                    alert.card.priceCurrency
                                  )}
                                </span>
                              )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={alert.isActive}
                            onCheckedChange={(checked) =>
                              handleToggleActive(alert, checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditAlert(alert)}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteAlert(alert.id)}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!alerts.length && !loading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">
                          No hay alertas configuradas.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </UICard>

          <UICard className="border-orange-100 shadow-lg">
            <CardHeader>
              <CardTitle>Disparos recientes</CardTitle>
              <CardDescription>
                Últimas alertas registradas automáticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentLogs.length === 0 && (
                <p className="text-sm text-gray-500">
                  Aún no hay disparos registrados.
                </p>
              )}
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-gray-100 bg-white/80 p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{log.card.name}</p>
                      <p className="text-xs text-gray-500">{log.card.code}</p>
                    </div>
                    <Badge variant="secondary">
                      {thresholdLabels[log.alert.thresholdType]}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-gray-700">
                    {currencyFormatter(
                      log.price,
                      log.card.priceCurrency || "USD"
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <Clock3 className="h-4 w-4" />
                    {formatDateTime(log.triggeredAt)}
                  </div>
                </div>
              ))}
            </CardContent>
          </UICard>
        </div>

        <UICard className="border border-gray-200 bg-white/90 shadow-xl">
          <CardHeader>
            <CardTitle>
              {formState.id ? "Editar alerta" : "Crear nueva alerta"}
            </CardTitle>
            <CardDescription>
              Define la carta, el tipo de umbral y cómo recibirás la alerta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2 rounded-lg border border-dashed border-gray-200 p-4">
                <Label>Selecciona carta</Label>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
                    {formState.cardLabel || "Sin carta seleccionada"}
                  </span>
                  {formState.cardLabel && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFormState((prev) => ({
                          ...prev,
                          cardId: null,
                          cardLabel: "",
                        }))
                      }
                    >
                      Limpiar
                    </Button>
                  )}
                </div>
                <Input
                  value={cardSearch}
                  onChange={(e) => setCardSearch(e.target.value)}
                  placeholder="Buscar carta por nombre o código"
                />
                {cardSearchLoading && (
                  <p className="text-xs text-gray-500">Buscando...</p>
                )}
                {cardOptions.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-lg border bg-white">
                    {cardOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleSelectCard(option)}
                        className="flex w-full flex-col items-start border-b px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        <span className="font-medium">{option.name}</span>
                        <span className="text-xs text-gray-500">
                          {option.code} {option.setCode ? `· ${option.setCode}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de umbral</Label>
                  <Select
                    value={formState.thresholdType}
                    onValueChange={(value: AlertThresholdType) =>
                      setFormState((prev) => ({
                        ...prev,
                        thresholdType: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ABOVE_VALUE">Precio superior</SelectItem>
                      <SelectItem value="BELOW_VALUE">Precio inferior</SelectItem>
                      <SelectItem value="PERCENT_CHANGE">
                        Cambio porcentual
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Método de notificación</Label>
                  <Select
                    value={formState.notificationMethod}
                    onValueChange={(value: AlertNotificationMethod) =>
                      setFormState((prev) => ({
                        ...prev,
                        notificationMethod: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IN_APP">Panel admin</SelectItem>
                      <SelectItem value="EMAIL">Email</SelectItem>
                      <SelectItem value="SLACK">Slack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formState.thresholdType === "PERCENT_CHANGE" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>% de cambio</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formState.percentChange}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          percentChange: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ventana (horas)</Label>
                    <Input
                      type="number"
                      value={formState.percentWindowHours}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          percentWindowHours: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Valor mínimo/máximo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formState.thresholdValue}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        thresholdValue: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <p className="font-medium text-gray-800">
                    Activar inmediatamente
                  </p>
                  <p className="text-sm text-gray-500">
                    Podrás pausar la alerta en cualquier momento.
                  </p>
                </div>
                <Switch
                  checked={formState.isActive}
                  onCheckedChange={(checked) =>
                    setFormState((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setFormState({ ...emptyForm })}
                >
                  Limpiar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar alerta"}
                </Button>
              </div>
            </form>
          </CardContent>
        </UICard>
      </div>
    </div>
  );
};

export default AdminAlertsPage;
