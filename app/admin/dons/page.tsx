"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import {
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type AdminSetOption = {
  id: number;
  title: string;
  code?: string | null;
};

type DonRecord = {
  id: number;
  name: string;
  alias: string | null;
  code: string;
  setCode: string;
  src: string;
  imageKey?: string | null;
  tcgUrl?: string | null;
  order?: string | null;
  region?: string | null;
  updatedAt: string;
  sets: {
    set: {
      id: number;
      title: string;
      code?: string | null;
    };
  }[];
};

type DonFormState = {
  name: string;
  setId: number | null;
  src: string;
  imageKey: string;
};

type StatusMessage = {
  type: "success" | "error" | "warning" | null;
  message: string;
};

const EMPTY_FORM: DonFormState = {
  name: "",
  setId: null,
  src: "",
  imageKey: "",
};

const AdminDonsPage = () => {
  const router = useRouter();
  const { role, loading } = useUser();

  const [sets, setSets] = useState<AdminSetOption[]>([]);
  const [dons, setDons] = useState<DonRecord[]>([]);
  const [isFetchingList, setIsFetchingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [form, setForm] = useState<DonFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formStatus, setFormStatus] = useState<StatusMessage>({
    type: null,
    message: "",
  });

  const [imageSourceUrl, setImageSourceUrl] = useState("");
  const [filenameInput, setFilenameInput] = useState("");

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchSets = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sets");
      if (!res.ok) {
        throw new Error("No se pudieron obtener los sets");
      }
      const data = await res.json();
      setSets(data ?? []);
    } catch (error) {
      console.error("Error fetching sets", error);
    }
  }, []);

  const fetchDons = useCallback(async () => {
    setIsFetchingList(true);
    setListError(null);
    try {
      const res = await fetch("/api/admin/dons?limit=200", {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("No se pudieron cargar los Don!!");
      }
      const data = await res.json();
      setDons(data.items ?? []);
    } catch (error) {
      console.error("Error fetching Don!!", error);
      setListError(
        error instanceof Error ? error.message : "No se pudieron cargar los Don!!"
      );
    } finally {
      setIsFetchingList(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && role !== "ADMIN") {
      router.push("/unauthorized");
    }
  }, [role, loading, router]);

  useEffect(() => {
    if (!loading && role === "ADMIN") {
      fetchSets();
      fetchDons();
    }
  }, [loading, role, fetchDons, fetchSets]);

  const handleInputChange = (
    field: keyof DonFormState,
    value: string | number | null
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value as never,
    }));
  };

  const handleSetChange = (value: string) => {
    const setId = value ? Number(value) : null;
    setForm((prev) => ({
      ...prev,
      setId,
    }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormStatus({ type: null, message: "" });
    setFilenameInput("");
    setImageSourceUrl("");
  };

  const populateForm = (don: DonRecord) => {
    setForm({
      name: don.name ?? "",
      setId: don.sets?.[0]?.set?.id ?? null,
      src: don.src ?? "",
      imageKey: don.imageKey ?? "",
    });
    setFilenameInput(don.imageKey ?? "");
    setImageSourceUrl("");
    setEditingId(don.id);
    setFormStatus({ type: null, message: "" });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name || !form.setId) {
      setFormStatus({
        type: "error",
        message: "Nombre y Set son obligatorios",
      });
      return;
    }

    if (!imageSourceUrl || !filenameInput) {
      setFormStatus({
        type: "error",
        message: "Debes proporcionar una URL de imagen y un nombre de archivo",
      });
      return;
    }

    setIsSaving(true);
    setFormStatus({ type: null, message: "" });

    try {
      // 1. Primero subir la imagen a R2
      const uploadResponse = await fetch("/api/upload-image-r2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: imageSourceUrl,
          filename: filenameInput,
          overwrite: true, // Siempre sobrescribir en modo automático
        }),
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || "Error al subir la imagen");
      }

      // 2. Obtener el set seleccionado para generar código y setCode
      const selectedSet = sets.find((s) => s.id === form.setId);
      if (!selectedSet) {
        throw new Error("Set no encontrado");
      }

      const setCode = selectedSet.code || "DON";
      const code = `${setCode}-DON`;

      // 3. Crear/actualizar el Don!! con la imagen subida
      const payload: Record<string, unknown> = {
        name: form.name,
        alias: null,
        code: code,
        setCode: setCode,
        src: uploadData.r2Url,
        imageKey: uploadData.filename,
        tcgUrl: null,
        order: "0",
        region: "Global",
        setIds: [form.setId],
      };

      const endpoint = editingId
        ? `/api/admin/dons/${editingId}`
        : "/api/admin/dons";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo guardar el Don!!");
      }

      await fetchDons();
      resetForm();
      setFormStatus({
        type: "success",
        message: editingId ? "Don!! actualizado" : "Don!! creado exitosamente",
      });
    } catch (error) {
      setFormStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "No se pudo guardar el Don!!",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (don: DonRecord) => {
    if (!confirm(`¿Eliminar ${don.name}? Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeletingId(don.id);
    try {
      const res = await fetch(`/api/admin/dons/${don.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Error al eliminar el Don!!");
      }
      if (editingId === don.id) {
        resetForm();
      }
      await fetchDons();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  const selectedSetName = useMemo(() => {
    if (!form.setId) return "";
    const selected = sets.find((set) => set.id === form.setId);
    if (!selected) return "";
    return selected.code ? `${selected.code} · ${selected.title}` : selected.title;
  }, [form.setId, sets]);

  if (!loading && role !== "ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Verificando permisos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin · Don!!</h1>
              <p className="text-gray-600">
                Crea, actualiza y elimina Don!! manteniendo las imágenes en R2 sincronizadas.
              </p>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              onClick={() => fetchDons()}
              disabled={isFetchingList}
            >
              <RefreshCw className={`h-4 w-4 ${isFetchingList ? "animate-spin" : ""}`} />
              Actualizar lista
            </button>
          </div>
        </header>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <ImageIcon className="h-6 w-6 text-indigo-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {editingId ? "Editar Don!!" : "Nuevo Don!!"}
              </h2>
              <p className="text-sm text-gray-500">
                Completa la información y sube la imagen a R2 antes de guardar.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={form.name}
                  onChange={(event) => handleInputChange("name", event.target.value)}
                  placeholder="Nombre del Don!!"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Set <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={form.setId ?? ""}
                  onChange={(event) => handleSetChange(event.target.value)}
                  required
                >
                  <option value="">Selecciona un set</option>
                  {sets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.code ? `${set.code} · ${set.title}` : set.title}
                    </option>
                  ))}
                </select>
                {selectedSetName && (
                  <p className="mt-1 text-xs text-gray-500">Seleccionado: {selectedSetName}</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-gray-300 p-4">
              <div className="mb-4 flex items-center gap-3">
                <Upload className="h-5 w-5 text-indigo-600" />
                <p className="text-sm text-gray-600">
                  La imagen se subirá automáticamente cuando crees el Don!!
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    URL de imagen fuente <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={imageSourceUrl}
                    onChange={(event) => setImageSourceUrl(event.target.value)}
                    placeholder="https://..."
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Nombre de archivo (sin extensión) <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={filenameInput}
                    onChange={(event) => setFilenameInput(event.target.value.replace(/\.(jpg|jpeg|png|webp)$/i, ""))}
                    placeholder="OP01-DON"
                    required
                  />
                </div>
              </div>
            </div>

            {formStatus.type && (
              <div
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  formStatus.type === "success"
                    ? "bg-green-50 text-green-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {formStatus.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                {formStatus.message}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-white hover:bg-indigo-700 disabled:bg-indigo-300"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingId ? (
                  <Pencil className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isSaving
                  ? "Subiendo imagen y guardando..."
                  : editingId
                    ? "Actualizar Don!!"
                    : "Crear Don!!"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-5 py-2 text-gray-700 hover:bg-gray-50"
              >
                <RotateCcw className="h-4 w-4" />
                Limpiar formulario
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Listado de Don!!</h2>
              <p className="text-sm text-gray-500">
                Filtra desde la parte superior o administra cada registro.
              </p>
            </div>
            <span className="text-sm text-gray-500">
              Total: {dons.length}
            </span>
          </div>
          {listError && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertTriangle className="h-4 w-4" />
              {listError}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Imagen
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Nombre
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Código
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Set
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actualizado
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {isFetchingList && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                    </td>
                  </tr>
                )}
                {!isFetchingList && dons.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                      No hay Don!! registrados todavía.
                    </td>
                  </tr>
                )}
                {!isFetchingList &&
                  dons.map((don) => (
                    <tr key={don.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="h-16 w-12 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                          {don.src ? (
                            <img
                              src={don.src}
                              alt={don.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="mx-auto mt-5 h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{don.name}</div>
                        <div className="text-sm text-gray-500">
                          {don.alias || "Sin alias"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        <div>{don.code}</div>
                        <div className="text-xs text-gray-500">{don.imageKey || "Sin imageKey"}</div>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        <div>{don.setCode}</div>
                        <div className="text-xs text-gray-500">
                          {don.sets?.[0]?.set?.title ?? "Sin relación"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {new Date(don.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => populateForm(don)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(don)}
                            disabled={deletingId === don.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            {deletingId === don.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDonsPage;
