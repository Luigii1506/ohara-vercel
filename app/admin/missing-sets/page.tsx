"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  X,
  Edit3,
  Save,
  Trash2,
  Eye,
  ArrowUpRight,
  ArrowUpDown,
} from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";

interface MissingSetEventLink {
  linkId: number;
  eventId: number;
  createdAt: string;
  event?: {
    id: number;
    title: string;
    slug: string;
    sourceUrl?: string | null;
    region?: string | null;
    locale?: string | null;
  } | null;
}

interface MissingSet {
  id: number;
  title: string;
  translatedTitle?: string | null;
  versionSignature?: string | null;
  isProduct?: boolean;
  productType?: string | null;
  isApproved: boolean;
  images: string[];
  createdAt: string;
  updatedAt: string;
  events: MissingSetEventLink[];
}

const PRODUCT_TYPE_OPTIONS = [
  { value: "PLAYMAT", label: "Playmat" },
  { value: "SLEEVE", label: "Sleeve" },
  { value: "DECK_BOX", label: "Deck Box" },
  { value: "STORAGE_BOX", label: "Storage Box" },
  { value: "UNCUT_SHEET", label: "Uncut Sheet" },
  { value: "PROMO_PACK", label: "Promo Pack" },
  { value: "DISPLAY_BOX", label: "Display Box" },
  { value: "COLLECTORS_SET", label: "Collector Set" },
  { value: "TIN_PACK", label: "Tin Pack" },
  { value: "ILLUSTRATION_BOX", label: "Illustration Box" },
  { value: "ANNIVERSARY_SET", label: "Anniversary Set" },
  { value: "PREMIUM_CARD_COLLECTION", label: "Premium Card Collection" },
  { value: "DOUBLE_PACK", label: "Double Pack" },
  { value: "DEVIL_FRUIT", label: "Devil Fruit" },
  { value: "BOOSTER", label: "Booster" },
  { value: "DECK", label: "Deck" },
  { value: "STARTER_DECK", label: "Starter Deck" },
  { value: "PREMIUM_BOOSTER_BOX", label: "Premium Booster Box" },
  { value: "OTHER", label: "Other" },
];

const AdminMissingSetsPage = () => {
  const router = useRouter();
  const [missingSets, setMissingSets] = useState<MissingSet[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    translatedTitle: "",
    versionSignature: "",
    imagesText: "",
    isProduct: false,
    productType: "",
  });

  useEffect(() => {
    fetchMissingSets();
  }, [sortOrder]);

  const fetchMissingSets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/missing-sets?order=${sortOrder}`);
      if (!response.ok) throw new Error("Failed to fetch missing sets");
      const data = await response.json();
      setMissingSets(data);
    } catch (error) {
      console.error(error);
      showErrorToast("Error al cargar los missing sets");
    } finally {
      setLoading(false);
    }
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  const startEditing = (missingSet: MissingSet) => {
    setEditingId(missingSet.id);
    setEditForm({
      title: missingSet.title,
      translatedTitle: missingSet.translatedTitle || "",
      versionSignature: missingSet.versionSignature || "",
      imagesText: missingSet.images.join("\n"),
      isProduct: Boolean(missingSet.isProduct),
      productType: missingSet.productType || "",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: number) => {
    try {
      const images = editForm.imagesText
        .split("\n")
        .map((url) => url.trim())
        .filter((url) => url.length > 0);

      const response = await fetch(`/api/admin/missing-sets/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editForm.title,
          translatedTitle: editForm.translatedTitle || null,
          versionSignature: editForm.versionSignature || null,
          images,
          isProduct: editForm.isProduct,
          productType: editForm.isProduct ? editForm.productType || null : null,
        }),
      });

      if (!response.ok) throw new Error("Failed to update");
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

  const deleteMissingSet = async (missingSet: MissingSet) => {
    if (
      !window.confirm(
        missingSet.events.length
          ? `¿Eliminar "${missingSet.title}" (referenciado por ${missingSet.events.length} evento(s))?`
          : `¿Eliminar "${missingSet.title}"?`
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

  const filteredSets = missingSets.filter((set) => {
    // Como los aprobados se eliminan, solo filtramos por búsqueda
    // El filtro "pending" muestra todos (ya que todos son pending)
    const term = search.toLowerCase();
    const matchesSearch =
      search.length === 0 ||
      set.title.toLowerCase().includes(term) ||
      set.translatedTitle?.toLowerCase().includes(term) ||
      set.events.some((event) => {
        const titleMatch = event.event?.title?.toLowerCase().includes(term);
        const slugMatch = event.event?.slug?.toLowerCase().includes(term);
        return titleMatch || slugMatch;
      });

    return matchesSearch;
  });

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Missing Sets</h1>
        <p className="text-muted-foreground">
          Gestiona sets y productos faltantes detectados en eventos
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 order-2 sm:order-1">
          <Input
            placeholder="Buscar por título o evento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 justify-end order-1 sm:order-2">
          <Button
            onClick={toggleSortOrder}
            variant="outline"
            size="icon"
            title={
              sortOrder === "desc"
                ? "Ordenar: Más recientes primero"
                : "Ordenar: Más antiguos primero"
            }
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          <Button onClick={fetchMissingSets} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Lista de missing sets */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No se encontraron missing sets
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredSets.map((missingSet) => (
            <Card key={missingSet.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {editingId === missingSet.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editForm.title}
                          onChange={(e) =>
                            setEditForm({ ...editForm, title: e.target.value })
                          }
                          placeholder="Título original"
                          className="h-9"
                        />
                        <Input
                          value={editForm.translatedTitle}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              translatedTitle: e.target.value,
                            })
                          }
                          placeholder="Título traducido (opcional)"
                          className="h-9"
                        />
                        <Input
                          value={editForm.versionSignature}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              versionSignature: e.target.value,
                            })
                          }
                          placeholder="Versión (opcional)"
                          className="h-9"
                        />
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={editForm.isProduct}
                            onCheckedChange={(checked) =>
                              setEditForm({
                                ...editForm,
                                isProduct: checked === true,
                                productType:
                                  checked === true
                                    ? editForm.productType
                                    : "",
                              })
                            }
                            id={`is-product-${missingSet.id}`}
                          />
                          <label
                            htmlFor={`is-product-${missingSet.id}`}
                            className="text-xs text-muted-foreground"
                          >
                            Marcar como producto
                          </label>
                        </div>
                        {editForm.isProduct && (
                          <Select
                            value={editForm.productType}
                            onValueChange={(value) =>
                              setEditForm({
                                ...editForm,
                                productType: value,
                              })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Tipo de producto" />
                            </SelectTrigger>
                            <SelectContent>
                              {PRODUCT_TYPE_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    ) : (
                      <>
                        <CardTitle className="text-lg truncate">
                          {missingSet.title}
                        </CardTitle>
                        {missingSet.translatedTitle && (
                          <p className="text-sm text-muted-foreground mt-0.5 truncate">
                            {missingSet.translatedTitle}
                          </p>
                        )}
                        {missingSet.events.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            📅 {missingSet.events.length} evento(s) relacionados
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {/* Badges */}
                    <div className="flex items-start gap-1.5">
                      {missingSet.versionSignature && (
                        <Badge variant="secondary" className="text-xs">
                          {missingSet.versionSignature}
                        </Badge>
                      )}
                      {missingSet.isProduct && (
                        <Badge variant="outline" className="text-xs">
                          Producto
                        </Badge>
                      )}
                      {missingSet.productType && (
                        <Badge variant="outline" className="text-xs">
                          {missingSet.productType}
                        </Badge>
                      )}
                      {missingSet.isApproved && (
                        <Badge variant="default" className="text-xs">
                          ✓
                        </Badge>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-1.5">
                      {editingId === missingSet.id ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => saveEdit(missingSet.id)}
                          >
                            <Save className="mr-2 h-4 w-4" />
                            Guardar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEditing}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          {!missingSet.isApproved && (
                            <Button
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/admin/missing-sets/${missingSet.id}/approve`
                                )
                              }
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Aprobar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditing(missingSet)}
                          >
                            <Edit3 className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteMissingSet(missingSet)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-2.5">
                <div className="space-y-2.5">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Eventos relacionados
                    </div>
                    {missingSet.events.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Este missing set no está vinculado a ningún evento.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {missingSet.events.map((eventLink) => (
                          <div
                            key={eventLink.linkId}
                            className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex flex-col gap-1">
                              <p className="text-sm font-semibold">
                                {eventLink.event?.title ??
                                  `Evento ${eventLink.eventId}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {eventLink.event?.slug}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {eventLink.event?.sourceUrl ? (
                                <Button size="sm" variant="outline" asChild>
                                  <a
                                    href={eventLink.event.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ArrowUpRight className="mr-2 h-4 w-4" />
                                    Ver evento
                                  </a>
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" asChild>
                                  <Link
                                    href={`/admin/events/${eventLink.eventId}`}
                                  >
                                    <ArrowUpRight className="mr-2 h-4 w-4" />
                                    Ver evento
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Imágenes */}
                  {editingId === missingSet.id ? (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Imágenes (una URL por línea)
                      </div>
                      <Textarea
                        value={editForm.imagesText}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            imagesText: e.target.value,
                          })
                        }
                        rows={3}
                        className="text-xs"
                        placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                      />
                    </div>
                  ) : (
                    missingSet.images.length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1.5">
                          {missingSet.images.length}{" "}
                          {missingSet.images.length === 1
                            ? "imagen"
                            : "imágenes"}
                        </div>
                        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                          {missingSet.images.slice(0, 10).map((img, idx) => (
                            <a
                              key={idx}
                              href={img}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 w-14 h-18 rounded border overflow-hidden hover:ring-2 hover:ring-primary transition-all group relative"
                              title={`Ver imagen ${idx + 1}`}
                            >
                              <img
                                src={img}
                                alt={`${idx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                            </a>
                          ))}
                          {missingSet.images.length > 10 && (
                            <div className="flex-shrink-0 w-14 h-18 rounded border flex items-center justify-center bg-muted/50">
                              <span className="text-xs font-medium text-muted-foreground">
                                +{missingSet.images.length - 10}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminMissingSetsPage;
