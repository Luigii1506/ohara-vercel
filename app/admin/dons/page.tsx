"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Image as ImageIcon,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import MultiSelect from "@/components/MultiSelect";
import { useSetsQuery } from "@/hooks/queries/useSetsQuery";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

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

type ImageMode = "external" | "r2-url" | "r2-file";

type DonFormData = {
  name: string;
  setIds: string[];
  imageSourceUrl: string;
  filename: string;
  finalImageUrl: string;
};

type StatusMessage = {
  type: "success" | "error" | null;
  message: string;
};

const INITIAL_FORM: DonFormData = {
  name: "",
  setIds: [],
  imageSourceUrl: "",
  filename: "",
  finalImageUrl: "",
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const AdminDonsPage = () => {
  const router = useRouter();
  const { role, loading } = useUser();

  const { data: sets = [], isLoading: setsLoading } = useSetsQuery();

  const [dons, setDons] = useState<DonRecord[]>([]);
  const [isFetchingList, setIsFetchingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [formData, setFormData] = useState<DonFormData>(INITIAL_FORM);
  const [imageMode, setImageMode] = useState<ImageMode>("r2-url");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formStatus, setFormStatus] = useState<StatusMessage>({
    type: null,
    message: "",
  });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const parseUploadResponse = useCallback(
    async (response: Response): Promise<any> => {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return response.json();
      }
      const text = await response.text();
      return { error: text || "Upload failed" };
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const handleInputChange = useCallback(
    <K extends keyof DonFormData>(field: K, value: DonFormData[K]) => {
      setFormData((previous) => {
        const currentValue = previous[field];
        const nextValue = value;

        const isSameValue =
          Array.isArray(currentValue) && Array.isArray(nextValue)
            ? currentValue.length === nextValue.length &&
              currentValue.every((entry, index) => entry === nextValue[index])
            : currentValue === nextValue;

        if (isSameValue) {
          return previous;
        }

        return {
          ...previous,
          [field]: Array.isArray(nextValue)
            ? ([...nextValue] as DonFormData[K])
            : nextValue,
        };
      });
      setFormStatus({ type: null, message: "" });
    },
    []
  );

  const setIdsLockRef = useRef(false);

  const handleSetSelection = useCallback(
    (setIds: string[]) => {
      if (setIdsLockRef.current) {
        return;
      }
      setIdsLockRef.current = true;
      handleInputChange("setIds", setIds);
      requestAnimationFrame(() => {
        setIdsLockRef.current = false;
      });
    },
    [handleInputChange]
  );

  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM);
    setEditingId(null);
    setFormStatus({ type: null, message: "" });
    setImageMode("r2-url");
    setSelectedFile(null);
  }, []);

  const populateForm = useCallback((don: DonRecord) => {
    setFormData({
      name: don.name ?? "",
      setIds: don.sets?.map((entry) => entry.set.id.toString()) ?? [],
      imageSourceUrl: "",
      filename: don.imageKey ?? "",
      finalImageUrl: don.src ?? "",
    });
    setEditingId(don.id);
    setFormStatus({ type: null, message: "" });
    setImageMode(don.imageKey ? "r2-url" : "external");
    setSelectedFile(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const setsDropdown = useMemo(
    () =>
      sets.map((set) => ({
        value: set.id?.toString?.() ?? String(set.id),
        label: set.code ? `${set.code} · ${set.title}` : set.title,
      })),
    [sets]
  );

  const selectedSetLabel = useMemo(() => {
    if (formData.setIds.length === 0) return "Selecciona un set";
    if (formData.setIds.length > 1) {
      return `${formData.setIds.length} sets seleccionados`;
    }
    return (
      setsDropdown.find((set) => set.value === formData.setIds[0])?.label ??
      "Selecciona un set"
    );
  }, [formData.setIds, setsDropdown]);

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
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los Don!!"
      );
    } finally {
      setIsFetchingList(false);
    }
  }, []);

  useEffect(() => {
    if (imageMode !== "r2-file") {
      setSelectedFile(null);
    }
  }, [imageMode]);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!loading && role !== "ADMIN") {
      router.push("/unauthorized");
    }
  }, [role, loading, router]);

  useEffect(() => {
    if (!loading && role === "ADMIN") {
      fetchDons();
    }
  }, [loading, role, fetchDons]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.name || formData.setIds.length === 0) {
      setFormStatus({
        type: "error",
        message: "Nombre y Set son obligatorios",
      });
      return;
    }

    setIsSaving(true);
    setFormStatus({ type: null, message: "" });

    try {
      const currentEditingDon = editingId
        ? dons.find((don) => don.id === editingId)
        : null;
      const isEditing = Boolean(editingId);

      let finalSrc = currentEditingDon?.src ?? "";
      let finalImageKey = currentEditingDon?.imageKey ?? null;

      const trimmedExternalUrl = formData.finalImageUrl.trim();
      const trimmedSourceUrl = formData.imageSourceUrl.trim();
      const trimmedFilename = formData.filename.trim();

      if (imageMode === "external") {
        if (trimmedExternalUrl) {
          finalSrc = trimmedExternalUrl;
          finalImageKey = null;
        } else if (!isEditing) {
          throw new Error("Debes proporcionar la URL final de la imagen");
        }
      } else if (imageMode === "r2-url") {
        if (trimmedSourceUrl) {
          if (!trimmedFilename) {
            throw new Error("Debes proporcionar un nombre de archivo");
          }
          const uploadResponse = await fetch("/api/upload-image-r2", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageUrl: trimmedSourceUrl,
              filename: trimmedFilename,
              overwrite: true,
            }),
          });
          const uploadData = await parseUploadResponse(uploadResponse);
          if (!uploadResponse.ok) {
            throw new Error(uploadData.error || "Error al subir la imagen");
          }
          finalSrc = uploadData.r2Url;
          finalImageKey = uploadData.filename;
        } else if (!isEditing) {
          throw new Error("Debes proporcionar una URL de origen para subir a R2");
        }
      } else if (imageMode === "r2-file") {
        if (selectedFile) {
          if (!trimmedFilename) {
            throw new Error("Debes proporcionar un nombre de archivo");
          }
          const uploadForm = new FormData();
          uploadForm.append("file", selectedFile);
          uploadForm.append("filename", trimmedFilename);
          uploadForm.append("overwrite", "true");

          const uploadResponse = await fetch("/api/upload-image-r2-file", {
            method: "POST",
            body: uploadForm,
          });
          const uploadData = await parseUploadResponse(uploadResponse);
          if (!uploadResponse.ok) {
            throw new Error(uploadData.error || "Error al subir la imagen");
          }
          finalSrc = uploadData.r2Url;
          finalImageKey = uploadData.filename;
        } else if (!isEditing) {
          throw new Error("Debes seleccionar un archivo para subir a R2");
        }
      }

      if (!finalSrc) {
        throw new Error("Debes proporcionar una imagen válida");
      }

      const selectedSet = sets.find(
        (set) => set.id.toString() === formData.setIds[0]
      );
      if (!selectedSet) {
        throw new Error("Set no encontrado");
      }

      const setCode = selectedSet.code || "DON";
      const inferDonCode = selectedSet.code
        ? `${selectedSet.code}-DON`
        : "DON-001";
      const payload = {
        name: formData.name,
        alias: null,
        code: inferDonCode,
        setCode,
        src: finalSrc,
        imageKey: finalImageKey ?? null,
        tcgUrl: null,
        order: "0",
        region: "Global",
        setIds: formData.setIds,
        isFirstEdition: true,
      };

      const endpoint = editingId
        ? `/api/admin/dons/${editingId}`
        : `/api/admin/dons`;
      const method = editingId ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
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
          error instanceof Error
            ? error.message
            : "No se pudo guardar el Don!!",
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

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  if (!loading && role !== "ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Verificando permisos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 w-full">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-gray-900">
                Admin · Don!!
              </h1>
              <p className="text-gray-600">
                Crea, actualiza y elimina Don!! manteniendo las imágenes en R2
                sincronizadas.
              </p>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              onClick={fetchDons}
              disabled={isFetchingList}
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetchingList ? "animate-spin" : ""}`}
              />
              Actualizar lista
            </button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-slate-50 p-4">
              <p className="text-xs uppercase text-gray-500">Total Don!!</p>
              <p className="text-2xl font-semibold text-gray-900">
                {dons.length}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-slate-50 p-4">
              <p className="text-xs uppercase text-gray-500">
                Sets disponibles
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {setsLoading ? "…" : sets.length}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-slate-50 p-4 flex items-center gap-3">
              <ClipboardList className="h-8 w-8 text-indigo-500" />
              <div>
                <p className="text-xs uppercase text-gray-500">
                  Estado formulario
                </p>
                <p className="text-sm text-gray-700">
                  {editingId ? `Editando ID ${editingId}` : "Nuevo registro"}
                </p>
              </div>
            </div>
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
                  value={formData.name}
                  onChange={(event) =>
                    handleInputChange("name", event.target.value)
                  }
                  placeholder="Nombre del Don!!"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Set <span className="text-red-500">*</span>
                </label>
                <MultiSelect
                  options={setsDropdown}
                  selected={formData.setIds}
                  setSelected={handleSetSelection}
                  buttonLabel="Selecciona un set"
                  searchPlaceholder="Buscar set..."
                  isSearchable
                  isSolid
                  isFullWidth
                  isDisabled={setsLoading}
                  displaySelectedAs={() => selectedSetLabel}
                />
                {formData.setIds.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedSetLabel}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-gray-300 p-4 space-y-4">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Upload className="h-5 w-5 text-indigo-600" />
                Elige cómo quieres manejar la imagen de este Don!!
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Origen de la imagen
                </p>
                <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      className="text-indigo-600"
                      value="external"
                      checked={imageMode === "external"}
                      onChange={() => setImageMode("external")}
                    />
                    Usar URL final (sin subir a R2)
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      className="text-indigo-600"
                      value="r2-url"
                      checked={imageMode === "r2-url"}
                      onChange={() => setImageMode("r2-url")}
                    />
                    Subir a R2 desde una URL
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      className="text-indigo-600"
                      value="r2-file"
                      checked={imageMode === "r2-file"}
                      onChange={() => setImageMode("r2-file")}
                    />
                    Subir un archivo a R2
                  </label>
                </div>
              </div>

              {imageMode === "external" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    URL final de la imagen {editingId ? "" : <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="url"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    value={formData.finalImageUrl}
                    onChange={(event) =>
                      handleInputChange("finalImageUrl", event.target.value)
                    }
                    placeholder="https://..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {editingId
                      ? "Opcional en modo edición; déjalo vacío para conservar la imagen actual."
                      : "Se guardará tal cual, sin subirla a R2."}
                  </p>
                </div>
              )}

              {imageMode === "r2-url" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      URL de origen para subir a R2 {editingId ? "" : <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="url"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      value={formData.imageSourceUrl}
                      onChange={(event) =>
                        handleInputChange("imageSourceUrl", event.target.value)
                      }
                      placeholder="https://..."
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {editingId
                        ? "Opcional en modo edición; ingresa una URL solo si quieres reemplazar la imagen."
                        : "Descargaremos la imagen desde esa URL y la subiremos a R2."}
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Nombre de archivo (sin extensión){" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      value={formData.filename}
                      onChange={(event) =>
                        handleInputChange(
                          "filename",
                          event.target.value.replace(
                            /\.(jpg|jpeg|png|webp)$/i,
                            ""
                          )
                        )
                      }
                      placeholder="OP01-DON"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Se usará para generar todas las variantes en R2.
                    </p>
                  </div>
                </div>
              )}

              {imageMode === "r2-file" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Archivo local {editingId ? "" : <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      onChange={(event) =>
                        setSelectedFile(event.target.files?.[0] ?? null)
                      }
                    />
                    {selectedFile && (
                      <p className="mt-1 text-xs text-gray-500">
                        Archivo seleccionado: {selectedFile.name}
                      </p>
                    )}
                    {editingId && (
                      <p className="mt-1 text-xs text-gray-500">
                        Opcional en modo edición; déjalo vacío para conservar la imagen actual.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Nombre de archivo (sin extensión){" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      value={formData.filename}
                      onChange={(event) =>
                        handleInputChange(
                          "filename",
                          event.target.value.replace(
                            /\.(jpg|jpeg|png|webp)$/i,
                            ""
                          )
                        )
                      }
                      placeholder="OP01-DON"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Se usará como base para las variantes en R2.
                    </p>
                  </div>
                </div>
              )}
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
              <h2 className="text-xl font-semibold text-gray-900">
                Listado de Don!!
              </h2>
              <p className="text-sm text-gray-500">
                Filtra desde la parte superior o administra cada registro.
              </p>
            </div>
            <span className="text-sm text-gray-500">Total: {dons.length}</span>
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
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-sm text-gray-500"
                    >
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                    </td>
                  </tr>
                )}
                {!isFetchingList && dons.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-sm text-gray-500"
                    >
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
                        <div className="font-medium text-gray-900">
                          {don.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {don.alias || "Sin alias"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        <div>{don.code}</div>
                        <div className="text-xs text-gray-500">
                          {don.imageKey || "Sin imageKey"}
                        </div>
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
