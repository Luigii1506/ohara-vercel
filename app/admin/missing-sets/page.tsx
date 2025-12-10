"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  RefreshCw,
  X,
  Edit3,
  Save,
  Trash2,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";

interface MissingSet {
  id: number;
  eventId: number;
  title: string;
  translatedTitle?: string | null;
  versionSignature?: string | null;
  isApproved: boolean;
  images: string[];
  createdAt: string;
  updatedAt: string;
  event?: {
    id: number;
    title: string;
    slug: string;
    sourceUrl?: string | null;
    region?: string | null;
    locale?: string | null;
  } | null;
}

type StatusFilter = "all" | "pending" | "approved";

const AdminMissingSetsPage = () => {
  const [missingSets, setMissingSets] = useState<MissingSet[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [approvingSet, setApprovingSet] = useState<MissingSet | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    translatedTitle: "",
    versionSignature: "",
    imagesText: "",
  });

  useEffect(() => {
    fetchMissingSets();
  }, [statusFilter]);

  const fetchMissingSets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.set("approved", statusFilter === "approved" ? "true" : "false");
      }
      const url = `/api/admin/missing-sets${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch missing sets");
      }
      const data = await response.json();
      setMissingSets(data);
    } catch (error) {
      console.error(error);
      showErrorToast("Error cargando missing sets");
    } finally {
      setLoading(false);
    }
  };

  const filteredSets = useMemo(() => {
    if (!search) return missingSets;
    return missingSets.filter((item) => {
      const term = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(term) ||
        (item.translatedTitle &&
          item.translatedTitle.toLowerCase().includes(term)) ||
        (item.event?.title && item.event.title.toLowerCase().includes(term))
      );
    });
  }, [missingSets, search]);

  const startEditing = (missingSet: MissingSet) => {
    setEditingId(missingSet.id);
    setEditForm({
      title: missingSet.title,
      translatedTitle: missingSet.translatedTitle || "",
      versionSignature: missingSet.versionSignature || "",
      imagesText: missingSet.images.join("\n"),
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleSave = async (id: number) => {
    try {
      const payload = {
        title: editForm.title,
        translatedTitle: editForm.translatedTitle,
        versionSignature: editForm.versionSignature || null,
        images: editForm.imagesText
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
      };

      const response = await fetch(`/api/admin/missing-sets/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to update missing set");
      }

      const updated = await response.json();
      setMissingSets((prev) =>
        prev.map((item) => (item.id === id ? updated : item))
      );
      showSuccessToast("Missing set actualizado");
      setEditingId(null);
    } catch (error) {
      console.error(error);
      showErrorToast("Error al actualizar el missing set");
    }
  };

  const openApprovalView = (missingSet: MissingSet) => {
    setApprovingSet(missingSet);
  };

  const closeApprovalView = () => {
    setApprovingSet(null);
  };

  const toggleApproval = async (missingSet: MissingSet) => {
    try {
      const response = await fetch(`/api/admin/missing-sets/${missingSet.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isApproved: !missingSet.isApproved }),
      });
      if (!response.ok) throw new Error("Failed to toggle approval");
      const updated = await response.json();
      setMissingSets((prev) =>
        prev.map((item) => (item.id === missingSet.id ? updated : item))
      );
      showSuccessToast(
        updated.isApproved
          ? "Missing set aprobado"
          : "Missing set marcado como pendiente"
      );
    } catch (error) {
      console.error(error);
      showErrorToast("Error al actualizar el estado");
    }
  };

  const deleteMissingSet = async (missingSet: MissingSet) => {
    if (
      !window.confirm(
        `¿Eliminar "${missingSet.title}" del evento "${missingSet.event?.title}"?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/missing-sets/${missingSet.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete missing set");
      setMissingSets((prev) =>
        prev.filter((item) => item.id !== missingSet.id)
      );
      showSuccessToast("Missing set eliminado");
    } catch (error) {
      console.error(error);
      showErrorToast("Error al eliminar el missing set");
    }
  };

  // Si estamos en la vista de aprobación, mostrar solo esa vista
  if (approvingSet) {
    return (
      <div className="min-h-screen bg-background w-full">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          {/* Header con botón de regreso */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={closeApprovalView}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a la lista
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Aprobar Missing Set</h1>
                <p className="text-muted-foreground">
                  Revisa toda la información antes de aprobar el set
                </p>
              </div>
              <Badge
                variant={approvingSet.isApproved ? "default" : "secondary"}
                className="text-lg px-4 py-2"
              >
                {approvingSet.isApproved ? "Aprobado" : "Pendiente"}
              </Badge>
            </div>
          </div>

          {/* Información del Set */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Columna principal - Información del set */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card de información básica */}
              <Card>
                <CardHeader>
                  <CardTitle>Información del Set</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Título Original
                    </p>
                    <p className="text-lg font-semibold">
                      {approvingSet.title}
                    </p>
                  </div>

                  {approvingSet.translatedTitle && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Título Traducido
                      </p>
                      <p className="text-lg">{approvingSet.translatedTitle}</p>
                    </div>
                  )}

                  {approvingSet.versionSignature && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Versión
                      </p>
                      <Badge variant="outline" className="text-base">
                        {approvingSet.versionSignature}
                      </Badge>
                    </div>
                  )}

                  {approvingSet.event && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Evento Asociado
                      </p>
                      <div className="flex flex-col gap-1">
                        <p className="text-lg font-medium">
                          {approvingSet.event.title}
                        </p>
                        {approvingSet.event.region && (
                          <Badge variant="secondary" className="w-fit">
                            {approvingSet.event.region}
                          </Badge>
                        )}
                        {approvingSet.event.sourceUrl && (
                          <a
                            href={approvingSet.event.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline w-fit"
                          >
                            Ver evento original →
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Detectado:</span>{" "}
                        {new Date(approvingSet.createdAt).toLocaleDateString(
                          "es-MX",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </div>
                      <div>
                        <span className="font-medium">Actualizado:</span>{" "}
                        {new Date(approvingSet.updatedAt).toLocaleDateString(
                          "es-MX",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card de imágenes */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    Imágenes del Set ({approvingSet.images.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {approvingSet.images.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      No se detectaron imágenes para este set.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {approvingSet.images.map((image, index) => (
                        <div
                          key={index}
                          className="group relative aspect-[3/4] rounded-lg overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow"
                        >
                          <a
                            href={image}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full h-full"
                          >
                            <img
                              src={image}
                              alt={`${approvingSet.title} - Imagen ${
                                index + 1
                              }`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                              <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Columna lateral - Acciones */}
            <div className="lg:col-span-1">
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle>Acciones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full"
                    size="lg"
                    variant={approvingSet.isApproved ? "secondary" : "default"}
                    onClick={() => {
                      toggleApproval(approvingSet);
                      setApprovingSet({
                        ...approvingSet,
                        isApproved: !approvingSet.isApproved,
                      });
                    }}
                  >
                    {approvingSet.isApproved ? (
                      <>
                        <EyeOff className="mr-2 h-5 w-5" />
                        Marcar como Pendiente
                      </>
                    ) : (
                      <>
                        <Eye className="mr-2 h-5 w-5" />
                        Aprobar Set
                      </>
                    )}
                  </Button>

                  <Button
                    className="w-full"
                    size="lg"
                    variant="outline"
                    onClick={() => startEditing(approvingSet)}
                  >
                    <Edit3 className="mr-2 h-5 w-5" />
                    Editar Información
                  </Button>

                  <Button
                    className="w-full"
                    size="lg"
                    variant="destructive"
                    onClick={() => {
                      deleteMissingSet(approvingSet);
                      closeApprovalView();
                    }}
                  >
                    <Trash2 className="mr-2 h-5 w-5" />
                    Eliminar Set
                  </Button>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">
                      Aquí podrás realizar más acciones próximamente
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Missing Sets</h1>
          <p className="text-muted-foreground">
            Revisa y aprueba los sets detectados por el scraper antes de
            publicarlos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
          >
            Todos
          </Button>
          <Button
            variant={statusFilter === "pending" ? "default" : "outline"}
            onClick={() => setStatusFilter("pending")}
          >
            Pendientes
          </Button>
          <Button
            variant={statusFilter === "approved" ? "default" : "outline"}
            onClick={() => setStatusFilter("approved")}
          >
            Aprobados
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          placeholder="Buscar por título o evento..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full md:w-1/2"
        />
        <Button variant="outline" onClick={fetchMissingSets}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refrescar
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Cargando missing sets...
          </CardContent>
        </Card>
      ) : filteredSets.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No hay missing sets que coincidan con los filtros actuales.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredSets.map((missingSet) => (
            <Card key={missingSet.id} className="border border-muted shadow-sm">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl">
                      {missingSet.title}
                    </CardTitle>
                    <Badge
                      variant={missingSet.isApproved ? "default" : "secondary"}
                    >
                      {missingSet.isApproved ? "Aprobado" : "Pendiente"}
                    </Badge>
                    {missingSet.versionSignature && (
                      <Badge variant="outline">
                        Versión: {missingSet.versionSignature}
                      </Badge>
                    )}
                  </div>
                  {missingSet.translatedTitle && (
                    <p className="text-sm text-muted-foreground">
                      {missingSet.translatedTitle}
                    </p>
                  )}
                  {missingSet.event && (
                    <p className="text-sm text-muted-foreground">
                      Evento:{" "}
                      <a
                        className="underline"
                        href={missingSet.event.sourceUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {missingSet.event.title}
                      </a>
                      {missingSet.event.region
                        ? ` • ${missingSet.event.region}`
                        : ""}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      editingId === missingSet.id
                        ? cancelEditing()
                        : startEditing(missingSet)
                    }
                  >
                    {editingId === missingSet.id ? (
                      <>
                        <X className="mr-2 h-4 w-4" /> Cancelar
                      </>
                    ) : (
                      <>
                        <Edit3 className="mr-2 h-4 w-4" /> Editar
                      </>
                    )}
                  </Button>
                  <Button
                    variant={missingSet.isApproved ? "secondary" : "default"}
                    size="sm"
                    onClick={() => openApprovalView(missingSet)}
                  >
                    {missingSet.isApproved ? (
                      <>
                        <Eye className="mr-2 h-4 w-4" /> Ver Detalles
                      </>
                    ) : (
                      <>
                        <Eye className="mr-2 h-4 w-4" /> Aprobar
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteMissingSet(missingSet)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingId === missingSet.id ? (
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1 text-sm font-medium">Título</p>
                      <Input
                        value={editForm.title}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            title: event.target.value,
                          }))
                        }
                        placeholder="Título del set"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-sm font-medium">
                        Título traducido
                      </p>
                      <Input
                        value={editForm.translatedTitle}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            translatedTitle: event.target.value,
                          }))
                        }
                        placeholder="Traducción al inglés"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-sm font-medium">
                        Firma de versión
                      </p>
                      <Input
                        value={editForm.versionSignature}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            versionSignature: event.target.value,
                          }))
                        }
                        placeholder="Ej: 1, 2, 2025"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-sm font-medium">
                        URLs de imágenes (una por línea)
                      </p>
                      <Textarea
                        value={editForm.imagesText}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            imagesText: event.target.value,
                          }))
                        }
                        rows={4}
                      />
                    </div>
                    <Button onClick={() => handleSave(missingSet.id)}>
                      <Save className="mr-2 h-4 w-4" /> Guardar cambios
                    </Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Imágenes detectadas
                      </p>
                      {missingSet.images.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No se detectaron imágenes para este set.
                        </p>
                      ) : (
                        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                          {missingSet.images.map((image, index) => (
                            <a
                              key={index}
                              href={image}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group relative"
                            >
                              <img
                                src={image}
                                alt={missingSet.title}
                                className="h-32 w-full rounded-md object-cover shadow"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>
                        Detectado:{" "}
                        {new Date(missingSet.createdAt).toLocaleString()}
                      </span>
                      <span>
                        Actualizado:{" "}
                        {new Date(missingSet.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminMissingSetsPage;
