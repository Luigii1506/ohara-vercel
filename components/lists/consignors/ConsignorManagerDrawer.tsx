"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Users, Pencil, Trash2, UserX, Check } from "lucide-react";
import BaseDrawer from "@/components/ui/BaseDrawer";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { toast } from "react-toastify";
import { CONSIGNOR_COLOR_PALETTE } from "@/lib/consignors/colorPalette";

interface ManagedConsignor {
  id: number;
  name: string;
  color: string | null;
  totalCards: number;
  totalQuantity: number;
  totalValue: number;
}

interface ConsignorManagerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  listId: number;
  /** El nombre y/o color de un consignatario cambió — refleja el cambio en la grilla sin refetch. */
  onConsignorUpdated?: (consignor: { id: number; name: string; color: string | null }) => void;
  /** Se desligaron todas sus cartas de esta carpeta, o se eliminó por completo — en ambos casos sus cartas locales vuelven a ser "Yo". */
  onConsignorClearedFromFolder?: (consignorId: number) => void;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Popover de color: paleta grande y espaciada (no la anterior grilla de 6
// columnas apretujada) montada en un Portal, así nunca queda recortada por
// el scroll del drawer.
const ColorPickerPopover = ({
  color,
  onPick,
  disabled,
}: {
  color: string | null;
  onPick: (color: string) => void;
  disabled?: boolean;
}) => (
  <Popover>
    <PopoverTrigger asChild disabled={disabled}>
      <button
        type="button"
        className="h-8 w-8 shrink-0 rounded-full border-2 border-white shadow ring-1 ring-slate-200 transition-transform hover:scale-105 disabled:opacity-40"
        style={{ backgroundColor: color || "#94a3b8" }}
        title="Cambiar color"
      />
    </PopoverTrigger>
    <PopoverContent align="start" className="w-56 p-3">
      <p className="mb-2 text-xs font-semibold text-slate-500">Elegir color</p>
      <div className="grid grid-cols-4 gap-3">
        {CONSIGNOR_COLOR_PALETTE.map((paletteColor) => (
          <button
            key={paletteColor}
            type="button"
            onClick={() => onPick(paletteColor)}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110"
            style={{ backgroundColor: paletteColor }}
            title={paletteColor}
          >
            {color === paletteColor && <Check className="h-4 w-4 text-white drop-shadow" />}
          </button>
        ))}
      </div>
    </PopoverContent>
  </Popover>
);

// Panel de gestión de consignatarios: a diferencia del reporte (que es solo
// preview + descarga) y del picker de asignación (que solo resuelve "a
// quién le asigno estas N cartas seleccionadas"), este es el lugar para ver
// de un vistazo a los consignatarios QUE YA TIENEN algo en esta carpeta —
// su color, cuánto tienen — y gestionarlos: cambiar color, renombrar,
// desligarlos de esta carpeta de golpe, o eliminarlos por completo. Si
// alguien no tiene ninguna carta asignada aquí, simplemente no aparece
// (misma regla que el reporte de consignación).
const ConsignorManagerDrawer: React.FC<ConsignorManagerDrawerProps> = ({
  isOpen,
  onClose,
  listId,
  onConsignorUpdated,
  onConsignorClearedFromFolder,
}) => {
  const [loading, setLoading] = useState(false);
  const [consignors, setConsignors] = useState<ManagedConsignor[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lists/${listId}/consignment-report`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const managed: ManagedConsignor[] = (data.groups ?? [])
        .filter((g: any) => g.consignorId != null)
        .map((g: any) => ({
          id: g.consignorId,
          name: g.name,
          color: g.color,
          totalCards: g.totalCards,
          totalQuantity: g.totalQuantity,
          totalValue: g.totalValue,
        }));
      setConsignors(managed);
    } catch {
      toast.error("Error al cargar consignatarios");
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    if (isOpen) fetchAll();
  }, [isOpen, fetchAll]);

  const handleRename = useCallback(
    async (id: number) => {
      const name = editingName.trim();
      if (!name) return;
      setBusyId(id);
      try {
        const res = await fetch(`/api/consignors/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Error al renombrar");
        setConsignors((prev) =>
          prev
            .map((c) => (c.id === id ? { ...c, name } : c))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        setEditingId(null);
        const color = consignors.find((c) => c.id === id)?.color ?? null;
        onConsignorUpdated?.({ id, name, color });
        toast.success("Renombrado");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al renombrar");
      } finally {
        setBusyId(null);
      }
    },
    [editingName, consignors, onConsignorUpdated]
  );

  const handleColorChange = useCallback(
    async (id: number, color: string) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/consignors/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ color }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Error al cambiar el color");
        setConsignors((prev) => prev.map((c) => (c.id === id ? { ...c, color } : c)));
        const name = consignors.find((c) => c.id === id)?.name ?? "";
        onConsignorUpdated?.({ id, name, color });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al cambiar el color");
      } finally {
        setBusyId(null);
      }
    },
    [consignors, onConsignorUpdated]
  );

  const handleRemoveFromFolder = useCallback(
    async (id: number, name: string) => {
      if (
        !window.confirm(
          `¿Quitar a "${name}" de TODAS sus cartas en esta carpeta? Las cartas no se borran, solo vuelven a contar como tuyas.`
        )
      )
        return;
      setBusyId(id);
      try {
        const res = await fetch(`/api/lists/${listId}/consignors/${id}/unassign-all`, {
          method: "PUT",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Error al deslindar");
        setConsignors((prev) => prev.filter((c) => c.id !== id));
        onConsignorClearedFromFolder?.(id);
        toast.success(`${body.updated ?? 0} carta(s) desligadas de ${name}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al deslindar");
      } finally {
        setBusyId(null);
      }
    },
    [listId, onConsignorClearedFromFolder]
  );

  const handleDelete = useCallback(
    async (id: number, name: string) => {
      if (
        !window.confirm(
          `¿Eliminar a "${name}" por completo? Sus cartas en TODAS tus carpetas quedarán sin asignar (vuelven a ser tuyas).`
        )
      )
        return;
      setBusyId(id);
      try {
        const res = await fetch(`/api/consignors/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Error al eliminar");
        setConsignors((prev) => prev.filter((c) => c.id !== id));
        onConsignorClearedFromFolder?.(id);
        toast.success("Consignatario eliminado");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al eliminar");
      } finally {
        setBusyId(null);
      }
    },
    [onConsignorClearedFromFolder]
  );

  return (
    <BaseDrawer
      isOpen={isOpen}
      onClose={onClose}
      desktopModal
      desktopMaxWidth="max-w-lg"
      maxHeight="85vh"
    >
      <div onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 text-white">
            <Users className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900">Consignatarios</h3>
            <p className="text-xs text-slate-500">Colores, totales y gestión en esta carpeta</p>
          </div>
        </div>

        <div className="max-h-[70vh] space-y-2 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
            </div>
          ) : consignors.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Nadie tiene cartas asignadas en esta carpeta todavía. Usa "Modo
              asignar consignatario" para asignarles alguna.
            </p>
          ) : (
            consignors.map((c) => (
              <div key={c.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <ColorPickerPopover
                    color={c.color}
                    disabled={busyId === c.id}
                    onPick={(color) => handleColorChange(c.id, color)}
                  />

                  {editingId === c.id ? (
                    <div className="flex flex-1 items-center gap-1">
                      <Input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(c.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="h-7 text-xs"
                      />
                      <button
                        onClick={() => handleRename(c.id)}
                        disabled={busyId === c.id}
                        className="shrink-0 px-1 text-xs font-semibold text-emerald-600"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="flex-1 truncate text-sm font-bold text-slate-900">
                        {c.name}
                      </p>
                      <button
                        onClick={() => {
                          setEditingId(c.id);
                          setEditingName(c.name);
                        }}
                        className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Renombrar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => handleDelete(c.id, c.name)}
                    disabled={busyId === c.id}
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    title="Eliminar consignatario"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="mt-1.5 text-xs text-slate-500">
                  {c.totalCards} carta(s) · {c.totalQuantity} unid. ·{" "}
                  {formatCurrency(c.totalValue)} en esta carpeta
                </p>

                <button
                  onClick={() => handleRemoveFromFolder(c.id, c.name)}
                  disabled={busyId === c.id}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:opacity-40"
                >
                  <UserX className="h-3.5 w-3.5" />
                  {busyId === c.id ? "Quitando…" : `Quitar de esta carpeta (${c.totalCards})`}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </BaseDrawer>
  );
};

export default ConsignorManagerDrawer;
