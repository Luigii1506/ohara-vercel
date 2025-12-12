"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  X,
  Edit3,
  Save,
  Trash2,
  Eye,
  ArrowUpRight,
} from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";

interface MissingCardEventLink {
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

interface MissingCard {
  id: number;
  code: string;
  title: string;
  imageUrl: string;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
  events: MissingCardEventLink[];
}

const AdminMissingCardsPage = () => {
  const router = useRouter();
  const [missingCards, setMissingCards] = useState<MissingCard[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    code: "",
    title: "",
    imageUrl: "",
  });

  useEffect(() => {
    fetchMissingCards();
  }, []);

  const fetchMissingCards = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/missing-cards");
      if (!response.ok) throw new Error("Failed to fetch missing cards");
      const data = await response.json();
      setMissingCards(data);
    } catch (error) {
      console.error(error);
      showErrorToast("Error al cargar los missing cards");
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (missingCard: MissingCard) => {
    setEditingId(missingCard.id);
    setEditForm({
      code: missingCard.code,
      title: missingCard.title,
      imageUrl: missingCard.imageUrl,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: number) => {
    try {
      const response = await fetch(`/api/admin/missing-cards/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: editForm.code,
          title: editForm.title,
          imageUrl: editForm.imageUrl,
        }),
      });

      if (!response.ok) throw new Error("Failed to update");
      const updated = await response.json();
      setMissingCards((prev) =>
        prev.map((item) => (item.id === id ? updated : item))
      );
      showSuccessToast("Missing card actualizado");
      setEditingId(null);
    } catch (error) {
      console.error(error);
      showErrorToast("Error al actualizar el missing card");
    }
  };

  const deleteMissingCard = async (missingCard: MissingCard) => {
    if (
      !window.confirm(
        missingCard.events.length
          ? `¿Eliminar "${missingCard.code} - ${missingCard.title}" (referenciado por ${missingCard.events.length} evento(s))?`
          : `¿Eliminar "${missingCard.code} - ${missingCard.title}"?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/missing-cards/${missingCard.id}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) throw new Error("Failed to delete missing card");
      setMissingCards((prev) =>
        prev.filter((item) => item.id !== missingCard.id)
      );
      showSuccessToast("Missing card eliminado");
    } catch (error) {
      console.error(error);
      showErrorToast("Error al eliminar el missing card");
    }
  };

  const filteredCards = missingCards.filter((card) => {
    const term = search.toLowerCase();
    const matchesSearch =
      search.length === 0 ||
      card.code.toLowerCase().includes(term) ||
      card.title.toLowerCase().includes(term) ||
      card.events.some((event) => {
        const titleMatch = event.event?.title?.toLowerCase().includes(term);
        const slugMatch = event.event?.slug?.toLowerCase().includes(term);
        return titleMatch || slugMatch;
      });

    return matchesSearch;
  });

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Missing Cards</h1>
        <p className="text-muted-foreground">
          Gestiona las cartas faltantes detectadas en eventos
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 order-2 sm:order-1">
          <Input
            placeholder="Buscar por código, título o evento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 justify-end order-1 sm:order-2">
          <Button onClick={fetchMissingCards} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Lista de missing cards */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No se encontraron missing cards
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredCards.map((missingCard) => (
            <Card key={missingCard.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 flex gap-3">
                    {/* Imagen de la carta */}
                    {!editingId || editingId !== missingCard.id ? (
                      <div className="flex-shrink-0">
                        <img
                          src={missingCard.imageUrl}
                          alt={missingCard.title}
                          className="w-16 h-22 object-contain rounded border"
                        />
                      </div>
                    ) : null}

                    {/* Info de la carta */}
                    <div className="flex-1 min-w-0">
                      {editingId === missingCard.id ? (
                        <div className="space-y-2">
                          <Input
                            value={editForm.code}
                            onChange={(e) =>
                              setEditForm({ ...editForm, code: e.target.value })
                            }
                            placeholder="Código"
                            className="h-9"
                          />
                          <Input
                            value={editForm.title}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                title: e.target.value,
                              })
                            }
                            placeholder="Título"
                            className="h-9"
                          />
                          <Input
                            value={editForm.imageUrl}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                imageUrl: e.target.value,
                              })
                            }
                            placeholder="URL de imagen"
                            className="h-9"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-mono">
                              {missingCard.code}
                            </Badge>
                            <CardTitle className="text-lg truncate">
                              {missingCard.title}
                            </CardTitle>
                          </div>
                          {missingCard.events.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              📅 {missingCard.events.length} evento(s)
                              relacionados
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {/* Badges */}
                    <div className="flex items-start gap-1.5">
                      {missingCard.isApproved && (
                        <Badge variant="default" className="text-xs">
                          ✓
                        </Badge>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-1.5">
                      {editingId === missingCard.id ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => saveEdit(missingCard.id)}
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
                          {!missingCard.isApproved && (
                            <Button
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/admin/missing-cards/${missingCard.id}/approve`
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
                            onClick={() => startEditing(missingCard)}
                          >
                            <Edit3 className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteMissingCard(missingCard)}
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
                    {missingCard.events.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Este missing card no está vinculado a ningún evento.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {missingCard.events.map((eventLink) => (
                          <div
                            key={eventLink.linkId}
                            className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex flex-col">
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminMissingCardsPage;
