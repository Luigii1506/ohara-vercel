"use client";

import { useState, useCallback } from "react";
import { Loader2, User, Check, Pencil, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { toast } from "react-toastify";

export interface Consignor {
  id: number;
  name: string;
  color: string | null;
}

interface ConsignorPickerProps {
  listId: number;
  /** Ids de fila (UserListCard.id) a las que se les va a asignar el consignatario. */
  selectedListCardIds: number[];
  /** Se llama tras asignar con éxito, con el consignatario elegido (null = "Yo"). */
  onAssigned: (consignor: Consignor | null) => void;
  trigger: React.ReactNode;
  disabled?: boolean;
}

// Popover para asignar (o quitar) el consignatario de varias cartas
// seleccionadas de golpe. Lista los consignatarios existentes del dueño de
// la cuenta (compartidos entre todas sus carpetas) y permite crear uno
// nuevo escribiendo su nombre.
const ConsignorPicker: React.FC<ConsignorPickerProps> = ({
  listId,
  selectedListCardIds,
  onAssigned,
  trigger,
  disabled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consignors, setConsignors] = useState<Consignor[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const fetchConsignors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/consignors");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setConsignors(data.consignors ?? []);
    } catch {
      toast.error("Error al cargar consignatarios");
    } finally {
      setLoading(false);
    }
  }, []);

  const assign = useCallback(
    async (consignorId: number | null, consignor: Consignor | null) => {
      if (selectedListCardIds.length === 0) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/lists/${listId}/cards/assign-consignor`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listCardIds: selectedListCardIds, consignorId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Error al asignar");
        }
        toast.success(
          consignor
            ? `${selectedListCardIds.length} carta(s) asignadas a ${consignor.name}`
            : `${selectedListCardIds.length} carta(s) marcadas como tuyas`
        );
        onAssigned(consignor);
        setIsOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al asignar");
      } finally {
        setBusy(false);
      }
    },
    [listId, selectedListCardIds, onAssigned]
  );

  const handleCreateAndAssign = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await fetch("/api/consignors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 409: ya existe con ese nombre -> usar el existente en vez de fallar
        if (res.status === 409 && data.consignor) {
          setNewName("");
          await assign(data.consignor.id, data.consignor);
          return;
        }
        throw new Error(data.error || "Error al crear consignatario");
      }
      setNewName("");
      setConsignors((prev) => [...prev, data.consignor].sort((a, b) => a.name.localeCompare(b.name)));
      await assign(data.consignor.id, data.consignor);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear consignatario");
      setBusy(false);
    }
  }, [newName, assign]);

  const handleRename = useCallback(
    async (consignorId: number, e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      const name = editingName.trim();
      if (!name) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/consignors/${consignorId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Error al renombrar");
        setConsignors((prev) =>
          prev
            .map((c) => (c.id === consignorId ? { ...c, name } : c))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        setEditingId(null);
        toast.success("Renombrado");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al renombrar");
      } finally {
        setBusy(false);
      }
    },
    [editingName]
  );

  const handleDelete = useCallback(async (consignorId: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar a "${name}"? Sus cartas quedarán sin asignar (vuelven a ser tuyas).`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/consignors/${consignorId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      setConsignors((prev) => prev.filter((c) => c.id !== consignorId));
      toast.success("Consignatario eliminado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al eliminar");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) fetchConsignors();
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="px-1 pb-1.5 text-xs font-semibold text-slate-500">
          Asignar {selectedListCardIds.length} carta(s) a…
        </p>

        <div
          onClick={() => !busy && assign(null, null)}
          className="flex items-center gap-2 px-2 py-2 rounded-md text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          <User className="h-3.5 w-3.5 text-slate-400" />
          <span>Yo (quitar asignación)</span>
        </div>

        <div className="border-t border-slate-100 my-1" />

        <div className="max-h-40 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
            </div>
          ) : consignors.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-slate-400">
              Aún no tienes consignatarios — crea uno abajo.
            </p>
          ) : (
            consignors.map((c) =>
              editingId === c.id ? (
                <div key={c.id} className="flex items-center gap-1 px-2 py-1.5">
                  <Input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(c.id, e);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-7 text-xs"
                  />
                  <button
                    onClick={(e) => handleRename(c.id, e)}
                    disabled={busy}
                    className="shrink-0 text-xs font-semibold text-emerald-600 px-1"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <div
                  key={c.id}
                  onClick={() => !busy && assign(c.id, c)}
                  className="group flex items-center gap-2 px-2 py-2 rounded-md text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: c.color || "#94a3b8" }}
                  />
                  <span className="truncate flex-1">{c.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(c.id);
                      setEditingName(c.name);
                    }}
                    className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                    title="Renombrar"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(c.id, c.name, e)}
                    className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )
            ))}
        </div>

        <div className="border-t border-slate-100 my-1" />

        <div className="flex gap-1.5 px-1 pt-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateAndAssign();
            }}
            placeholder="Nuevo consignatario…"
            className="h-8 text-xs"
            disabled={busy}
          />
          <button
            type="button"
            onClick={handleCreateAndAssign}
            disabled={busy || !newName.trim()}
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-md bg-slate-900 text-white disabled:opacity-40"
            title="Crear y asignar"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ConsignorPicker;
