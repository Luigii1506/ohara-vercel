"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import SingleSelect, {
  Option as SingleSelectOption,
} from "@/components/SingleSelect";
import MultiSelect, {
  Option as MultiSelectOption,
} from "@/components/MultiSelect";
import { allRegions, altArtOptions } from "@/helpers/constants";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";
import { AlertCircle, Loader2, RefreshCw, X } from "lucide-react";

interface MissingCard {
  id: number;
  code: string;
  title: string;
  imageUrl: string;
}

interface BaseCard {
  id: number;
  code: string;
  name: string;
  src: string;
  setCode?: string | null;
  sets?: Array<{
    setId?: number;
    set?: {
      id?: number;
      title: string;
      code?: string | null;
      version?: string | null;
    } | null;
  }>;
}

interface AdminSet {
  id: number;
  title: string;
  code?: string | null;
  version?: string | null;
  image?: string | null;
}

interface CreateAlternateCardPanelProps {
  missingCard: MissingCard;
  onCancel: () => void;
  onSuccess: (newCardId: number) => void;
  isLocked?: boolean;
}

const formatSetLabel = (set: AdminSet) =>
  `${set.title}${set.code ? ` (${set.code})` : ""}`;

const fallbackCodeFromSet = (set: AdminSet) =>
  set.code?.trim() ||
  set.title?.trim().toUpperCase().replace(/\s+/g, "-") ||
  `SET-${set.id}`;

const buildSetCodeString = (sets: AdminSet[]) =>
  sets
    .map((set) => fallbackCodeFromSet(set))
    .filter((code) => code.length > 0)
    .join(", ");

export default function CreateAlternateCardPanel({
  missingCard,
  onCancel,
  onSuccess,
  isLocked = false,
}: CreateAlternateCardPanelProps) {
  const [loading, setLoading] = useState(false);
  const [setsLoading, setSetsLoading] = useState(false);
  const [baseCardLoading, setBaseCardLoading] = useState(false);
  const [baseCard, setBaseCard] = useState<BaseCard | null>(null);
  const [availableSets, setAvailableSets] = useState<AdminSet[]>([]);
  const [selectedSetIds, setSelectedSetIds] = useState<string[]>([]);
  const [showCreateSetForm, setShowCreateSetForm] = useState(false);
  const [newSetTitle, setNewSetTitle] = useState("");
  const [creatingQuickSet, setCreatingQuickSet] = useState(false);

  const [form, setForm] = useState({
    alias: "",
    region: "",
    alternateArt: "",
    tcgUrl: "",
    imageUrl: missingCard.imageUrl,
    isFirstEdition: false,
  });

  const setOptions = useMemo<SingleSelectOption[]>(
    () =>
      availableSets.map((set) => ({
        value: String(set.id),
        label: formatSetLabel(set),
      })),
    [availableSets]
  );

  const multiSelectOptions = useMemo<MultiSelectOption[]>(
    () =>
      setOptions.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    [setOptions]
  );

  const isR2Url = (url: string) =>
    /images\.oharatcg\.com|\.r2\.dev|\.workers\.dev/i.test(url);

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const generateImageFilename = () => {
    const codeSlug = slugify(missingCard.code || "");
    const aliasSlug = form.alias ? slugify(form.alias) : "";
    const artSlug = form.alternateArt ? slugify(form.alternateArt) : "";
    const titleSlug = slugify(missingCard.title || "");
    const timestamp = Date.now().toString(36);

    const parts = [
      codeSlug,
      aliasSlug,
      artSlug,
      titleSlug,
      `alt-${missingCard.id}`,
    ].filter((part) => part.length > 0);

    const base =
      parts.length > 0 ? parts.join("-") : `missing-card-${timestamp}`;
    return `${base}-${timestamp}`;
  };

  const uploadSourceImageToR2 = async (): Promise<{
    imageUrl: string;
    imageKey: string | null;
  }> => {
    const sourceUrl = form.imageUrl.trim();
    if (!sourceUrl) {
      throw new Error("Proporciona una URL de imagen");
    }

    if (isR2Url(sourceUrl)) {
      return { imageUrl: sourceUrl, imageKey: null };
    }

    const filename = generateImageFilename();
    const response = await fetch("/api/upload-image-r2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: sourceUrl,
        filename,
        overwrite: false,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Error al subir la imagen a R2");
    }

    return {
      imageUrl: data.r2Url as string,
      imageKey: data.filename as string,
    };
  };

  useEffect(() => {
    const fetchSets = async () => {
      try {
        setSetsLoading(true);
        const response = await fetch("/api/admin/sets");
        if (!response.ok) throw new Error("Failed to fetch sets");
        const data = await response.json();
        const normalized = Array.isArray(data) ? data : [];
        setAvailableSets(normalized);
      } catch (error) {
        console.error("Error fetching sets:", error);
        showErrorToast("Error al cargar sets");
      } finally {
        setSetsLoading(false);
      }
    };

    fetchSets();
  }, []);

  useEffect(() => {
    setForm({
      alias: "",
      region: "",
      alternateArt: "",
      tcgUrl: "",
      imageUrl: missingCard.imageUrl,
      isFirstEdition: false,
    });
    setSelectedSetIds([]);
    setBaseCard(null);

    let isMounted = true;
    const fetchBaseCard = async () => {
      try {
        setBaseCardLoading(true);
        const response = await fetch(
          `/api/admin/cards/by-code/${encodeURIComponent(missingCard.code)}`
        );
        if (!response.ok) throw new Error("Failed to fetch base card");

        const data = await response.json();
        if (!isMounted) return;

        if (Array.isArray(data) && data.length > 0) {
          const base =
            data.find((card: any) => !card.alias) || (data[0] as BaseCard);
          setBaseCard(base as BaseCard);

          const baseSetIds =
            (base?.sets || [])
              .map((s: any) => s?.set?.id)
              .filter((id: any) => typeof id === "number")
              .map((id: number) => String(id)) ?? [];

          setSelectedSetIds(baseSetIds);
        } else {
          setBaseCard(null);
          setSelectedSetIds([]);
        }
      } catch (error) {
        console.error("Error fetching base card:", error);
        if (isMounted) {
          showErrorToast("No se encontró carta base para el código dado");
        }
      } finally {
        if (isMounted) {
          setBaseCardLoading(false);
        }
      }
    };

    fetchBaseCard();

    return () => {
      isMounted = false;
    };
  }, [missingCard.code, missingCard.imageUrl]);

  const handleRemoveSet = (setId: string) => {
    setSelectedSetIds((prev) => prev.filter((id) => id !== setId));
  };

  const handleFormChange = (
    field: keyof typeof form,
    value: string | boolean
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const selectedSetsMetadata = useMemo(
    () =>
      selectedSetIds
        .map((id) => availableSets.find((set) => String(set.id) === String(id)))
        .filter((set): set is AdminSet => Boolean(set)),
    [availableSets, selectedSetIds]
  );

  const canSubmit =
    !loading &&
    !setsLoading &&
    !baseCardLoading &&
    !!baseCard &&
    selectedSetIds.length > 0 &&
    form.imageUrl.trim().length > 0;

  const handleCreateQuickSet = async () => {
    if (!newSetTitle.trim()) {
      showErrorToast("Ingresa un nombre para el nuevo set");
      return;
    }

    try {
      setCreatingQuickSet(true);
      const response = await fetch("/api/admin/sets/quick-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSetTitle.trim(),
          imageUrl: "",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "No se pudo crear el set");
      }

      const createdSet = await response.json();
      setAvailableSets((prev) => [createdSet, ...prev]);
      const createdId = String(createdSet.id);
      setSelectedSetIds((prev) =>
        prev.includes(createdId) ? prev : [...prev, createdId]
      );
      showSuccessToast(`Set "${createdSet.title}" creado y seleccionado`);
      setShowCreateSetForm(false);
      setNewSetTitle("");
    } catch (error) {
      console.error("Error creating quick set:", error);
      showErrorToast(
        error instanceof Error ? error.message : "Error al crear el nuevo set"
      );
    } finally {
      setCreatingQuickSet(false);
    }
  };

  const handleCreateAlternate = async () => {
    if (!baseCard) {
      showErrorToast("No se encontró una carta base");
      return;
    }
    if (selectedSetIds.length === 0) {
      showErrorToast("Selecciona al menos un set antes de aprobar");
      return;
    }

    try {
      setLoading(true);

      const { imageUrl: uploadedImageUrl, imageKey } =
        await uploadSourceImageToR2();

      const setCodeString = buildSetCodeString(selectedSetsMetadata);

      const payload = {
        alias: form.alias.trim() || null,
        setIds: selectedSetIds,
        region: form.region || null,
        alternateArt: form.alternateArt || null,
        tcgUrl: form.tcgUrl.trim() || null,
        src: uploadedImageUrl,
        imageKey: imageKey || null,
        isFirstEdition: form.isFirstEdition,
        isPro: false,
        code: missingCard.code,
        setCode: setCodeString || null,
        baseCardId: baseCard.id,
      };

      const response = await fetch("/api/admin/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create alternate card");
      }

      const result = await response.json();
      showSuccessToast("Carta alterna creada exitosamente");
      onSuccess(result.id);
    } catch (error) {
      console.error("Error creating alternate:", error);
      showErrorToast(
        error instanceof Error
          ? error.message
          : "Error al crear la carta alterna"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {isLocked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Procesando aprobación...
          </div>
        </div>
      )}
      <CardHeader className="space-y-2">
        <CardTitle>Crear carta alterna y aprobar</CardTitle>
        <p className="text-sm text-muted-foreground">
          Completa la información del nuevo arte alterno y se aprobará la
          tarjeta automáticamente.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Carta detectada
              </p>
              <div className="flex flex-col items-center gap-3">
                <img
                  src={missingCard.imageUrl}
                  alt={missingCard.title}
                  className="w-full max-w-[220px] rounded-lg border"
                />
                <div className="text-center">
                  <Badge variant="secondary" className="font-mono mb-1">
                    {missingCard.code}
                  </Badge>
                  <p className="text-sm font-medium">{missingCard.title}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-background p-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                    Carta base
                  </p>
                  {baseCardLoading && (
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {baseCard ? (
                  <>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <img
                        src={baseCard.src}
                        alt={baseCard.name}
                        className="w-32 rounded-lg border shadow-sm"
                      />
                      <div className="flex-1 space-y-4">
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-col gap-1">
                              <p className="text-xs uppercase text-muted-foreground tracking-wide">
                                Código
                              </p>
                              <Badge
                                variant="outline"
                                className="font-mono w-fit"
                              >
                                {baseCard.code}
                              </Badge>
                            </div>
                            <div className="flex flex-col gap-1">
                              <p className="text-xs uppercase text-muted-foreground tracking-wide">
                                Nombre
                              </p>
                              <p className="text-base font-semibold leading-tight">
                                {baseCard.name}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {baseCard.sets && baseCard.sets.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-muted-foreground uppercase">
                          Sets detectados
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {baseCard.sets.map((entry, idx) =>
                            entry.set ? (
                              <Badge
                                key={`${entry.set.id}-${idx}`}
                                variant="secondary"
                                className="text-xs"
                              >
                                {entry.set.title}
                                {entry.set.version
                                  ? ` (${entry.set.version})`
                                  : ""}
                              </Badge>
                            ) : null
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Esta carta base no tiene sets asociados aún.
                      </p>
                    )}
                  </>
                ) : baseCardLoading ? null : (
                  <div className="flex gap-2 items-start rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div className="text-xs text-amber-800">
                      <p className="font-semibold">No se encontró carta base</p>
                      <p>
                        Asegúrate de que exista una carta con el código{" "}
                        <span className="font-mono">{missingCard.code}</span>.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border p-4 space-y-4">
              {setsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-muted-foreground">
                      Selecciona sets
                    </Label>
                    <MultiSelect
                      options={multiSelectOptions}
                      selected={selectedSetIds}
                      setSelected={(values) => setSelectedSetIds(values)}
                      buttonLabel="Buscar set por título o código"
                      displaySelectedAs={(values) =>
                        values.length
                          ? `${values.length} set(s) elegidos`
                          : "Selecciona sets"
                      }
                      isSearchable
                      isFullWidth
                    />
                    <p className="text-xs text-muted-foreground">
                      Si no encuentras el set en la lista puedes crearlo aquí
                      mismo.
                    </p>
                  </div>

                  <div className="space-y-2 flex flex-col">
                    <Label className="text-xs uppercase text-muted-foreground">
                      Sets seleccionados
                    </Label>
                    {selectedSetsMetadata.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedSetsMetadata.map((set) => (
                          <span
                            key={set.id}
                            className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs"
                          >
                            {formatSetLabel(set)}
                            <button
                              type="button"
                              onClick={() => handleRemoveSet(String(set.id))}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Aún no seleccionas ningún set.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs uppercase text-muted-foreground">
                        Crear nuevo set
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCreateSetForm((prev) => !prev)}
                      >
                        {showCreateSetForm ? "Ocultar" : "Crear"}
                      </Button>
                    </div>
                    {showCreateSetForm && (
                      <div className="space-y-2">
                        <Input
                          value={newSetTitle}
                          onChange={(e) => setNewSetTitle(e.target.value)}
                          placeholder="Nombre del nuevo set"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleCreateQuickSet}
                            disabled={creatingQuickSet}
                          >
                            {creatingQuickSet ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Guardando...
                              </>
                            ) : (
                              "Guardar y seleccionar"
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowCreateSetForm(false);
                              setNewSetTitle("");
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Se creará con la fecha actual y se seleccionará para
                          esta carta.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="grid gap-4">
              <div>
                <Label htmlFor="alias">Alias (opcional)</Label>
                <Input
                  id="alias"
                  value={form.alias}
                  onChange={(e) => handleFormChange("alias", e.target.value)}
                  placeholder="Ej: Alternate Art, Promo, etc."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Región (opcional)</Label>
                  <SingleSelect
                    options={allRegions}
                    selected={form.region || null}
                    setSelected={(value) => handleFormChange("region", value)}
                    buttonLabel="Selecciona región"
                    isFullWidth
                    isSearchable
                  />
                </div>
                <div>
                  <Label>Alternate Art</Label>
                  <SingleSelect
                    options={altArtOptions}
                    selected={form.alternateArt || null}
                    setSelected={(value) =>
                      handleFormChange("alternateArt", value)
                    }
                    buttonLabel="Tipo de arte"
                    isFullWidth
                    isSearchable
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="tcgUrl">TCG URL (opcional)</Label>
                <Input
                  id="tcgUrl"
                  value={form.tcgUrl}
                  onChange={(e) => handleFormChange("tcgUrl", e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div>
                <Label htmlFor="imageUrl">URL de imagen *</Label>
                <Input
                  id="imageUrl"
                  value={form.imageUrl}
                  onChange={(e) => handleFormChange("imageUrl", e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="rounded-lg border p-4 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">First Edition</p>
                  <p className="text-xs text-muted-foreground">
                    Marca si esta versión corresponde a la primera edición.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Switch
                    checked={form.isFirstEdition}
                    onCheckedChange={(checked) =>
                      handleFormChange("isFirstEdition", checked)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Activar solo cuando la carta alterna sea 1st edition.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          type="button"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleCreateAlternate}
          disabled={!canSubmit}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando...
            </>
          ) : (
            "Crear carta y aprobar"
          )}
        </Button>
      </CardFooter>
    </div>
  );
}
