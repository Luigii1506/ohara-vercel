"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, ArrowLeft, Eye, Plus, X } from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";
import { setCodesOptions } from "@/helpers/constants";

type ImageClassification = "PRODUCT" | "CARD" | "IGNORE" | "";

interface MissingProduct {
  id: number;
  title: string;
  sourceUrl?: string | null;
  productType?: string | null;
  category?: string | null;
  releaseDate?: string | null;
  officialPrice?: string | number | null;
  officialPriceCurrency?: string | null;
  thumbnailUrl?: string | null;
  images: string[];
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CardData {
  id: number;
  name: string;
  code: string;
  src: string;
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

const ApproveMissingProductPage = () => {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [missingProduct, setMissingProduct] = useState<MissingProduct | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customProductType, setCustomProductType] = useState("");
  const [customReleaseDate, setCustomReleaseDate] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customCurrency, setCustomCurrency] = useState("");
  const [imageClassifications, setImageClassifications] = useState<
    Record<string, ImageClassification>
  >({});
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageUrls, setNewImageUrls] = useState("");
  const [cardSelections, setCardSelections] = useState<
    Record<string, { setCode: string; cardId: number | null; cardData: CardData | null }>
  >({});
  const [availableCards, setAvailableCards] = useState<
    Record<string, CardData[]>
  >({});

  useEffect(() => {
    fetchMissingProduct();
  }, [id]);

  const fetchMissingProduct = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/missing-products/${id}`);
      if (!response.ok) throw new Error("Failed to fetch missing product");
      const data = await response.json();
      setMissingProduct(data);
      setCustomTitle(data.title || "");
      setCustomProductType(data.productType || "");
      setCustomReleaseDate(
        data.releaseDate ? data.releaseDate.slice(0, 10) : ""
      );
      setCustomPrice(
        data.officialPrice !== null && data.officialPrice !== undefined
          ? String(data.officialPrice)
          : ""
      );
      setCustomCurrency(data.officialPriceCurrency || "USD");

      const initialClassifications: Record<string, ImageClassification> = {};
      const initialSelections: Record<
        string,
        { setCode: string; cardId: number | null; cardData: CardData | null }
      > = {};
      const images = Array.isArray(data.images) ? data.images : [];
      setImageUrls(images);
      images.forEach((url: string) => {
        initialClassifications[url] = "";
        initialSelections[url] = { setCode: "", cardId: null, cardData: null };
      });
      setImageClassifications(initialClassifications);
      setCardSelections(initialSelections);
      setAvailableCards({});
    } catch (error) {
      console.error(error);
      showErrorToast("Error al cargar el missing product");
      router.push("/admin/missing-products");
    } finally {
      setLoading(false);
    }
  };

  const handleClassificationChange = (
    imageUrl: string,
    value: ImageClassification
  ) => {
    setImageClassifications((prev) => ({ ...prev, [imageUrl]: value }));
    if (value !== "CARD") {
      setCardSelections((prev) => ({
        ...prev,
        [imageUrl]: { setCode: "", cardId: null, cardData: null },
      }));
    }
  };

  const handleSetCodeChange = async (imageUrl: string, setCode: string) => {
    setCardSelections((prev) => ({
      ...prev,
      [imageUrl]: { setCode, cardId: null, cardData: null },
    }));
    try {
      const isPromo = setCode === "PROMO";
      const actualSetCode = isPromo ? "" : setCode;
      const baseCardsParam = isPromo ? "" : "&baseCardsOnly=true";
      const encodedSetCode = encodeURIComponent(actualSetCode);
      const response = await fetch(
        `/api/admin/cards/by-set?setCode=${encodedSetCode}&firstEditionOnly=true${baseCardsParam}`
      );
      if (!response.ok) throw new Error("Failed to fetch cards");
      const cards = await response.json();
      setAvailableCards((prev) => ({ ...prev, [imageUrl]: cards }));
    } catch (error) {
      console.error(error);
      showErrorToast("Error al cargar las cartas del set");
    }
  };

  const handleCardChange = (imageUrl: string, cardId: string) => {
    const cards = availableCards[imageUrl] || [];
    const numericId = Number(cardId);
    const selectedCard = cards.find((card) => card.id === numericId) || null;
    setCardSelections((prev) => ({
      ...prev,
      [imageUrl]: {
        ...prev[imageUrl],
        cardId: numericId,
        cardData: selectedCard,
      },
    }));
  };

  const addImageUrls = () => {
    const parsed = newImageUrls
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (!parsed.length) return;
    setImageUrls((prev) => {
      const existing = new Set(prev);
      const next = [...prev];
      parsed.forEach((url) => {
        if (!existing.has(url)) {
          existing.add(url);
          next.push(url);
        }
      });
      return next;
    });
    setImageClassifications((prev) => {
      const next = { ...prev };
      parsed.forEach((url) => {
        if (!(url in next)) next[url] = "";
      });
      return next;
    });
    setCardSelections((prev) => {
      const next = { ...prev };
      parsed.forEach((url) => {
        if (!(url in next)) {
          next[url] = { setCode: "", cardId: null, cardData: null };
        }
      });
      return next;
    });
    setNewImageUrls("");
  };

  const removeImageUrl = (url: string) => {
    setImageUrls((prev) => prev.filter((value) => value !== url));
    setImageClassifications((prev) => {
      const next = { ...prev };
      delete next[url];
      return next;
    });
    setCardSelections((prev) => {
      const next = { ...prev };
      delete next[url];
      return next;
    });
    setAvailableCards((prev) => {
      const next = { ...prev };
      delete next[url];
      return next;
    });
  };

  const allImagesClassified = useMemo(() => {
    if (!missingProduct) return false;
    return imageUrls.length > 0 && imageUrls.every((url) => {
      const classification = imageClassifications[url];
      if (!classification) return false;
      if (classification === "CARD") {
        return Boolean(cardSelections[url]?.cardId);
      }
      return true;
    });
  }, [missingProduct, imageUrls, imageClassifications, cardSelections]);

  const approveDisabled =
    !allImagesClassified || isApproving || missingProduct?.isApproved;

  const handleApprove = async () => {
    if (!missingProduct) return;
    const payload = {
      imageClassifications: Object.fromEntries(
        Object.entries(imageClassifications)
          .filter(([url]) => imageUrls.includes(url))
          .filter(([, value]) => value && value.length > 0)
          .map(([url, value]) => [
            url,
            {
              type: value,
              cardId: value === "CARD" ? cardSelections[url]?.cardId : undefined,
            },
          ])
      ),
      overrideTitle: customTitle.trim(),
      overrideProductType: customProductType || null,
      overrideReleaseDate: customReleaseDate || null,
      overrideOfficialPrice: customPrice || null,
      overrideOfficialPriceCurrency: customCurrency || null,
      overrideImages: imageUrls,
      thumbnailUrl: missingProduct.thumbnailUrl || null,
    };

    try {
      setIsApproving(true);
      const response = await fetch(
        `/api/admin/missing-products/${missingProduct.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve missing product");
      }
      const result = await response.json();
      showSuccessToast(
        `Producto aprobado. Productos relacionados: ${result.linkedProducts}, cartas: ${result.linkedCards}`
      );
      router.push("/admin/missing-products");
    } catch (error) {
      console.error(error);
      showErrorToast(
        error instanceof Error ? error.message : "Error al aprobar producto"
      );
    } finally {
      setIsApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!missingProduct) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Missing product no encontrado</p>
          <Button
            onClick={() => router.push("/admin/missing-products")}
            className="mt-4"
          >
            Volver a la lista
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/admin/missing-products")}
          className="mb-2 px-0"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a Missing Products
        </Button>
        <h1 className="text-3xl font-bold leading-tight">
          {missingProduct.title}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalles editables</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Nombre del producto
                  </label>
                  <Input
                    value={customTitle}
                    onChange={(event) => setCustomTitle(event.target.value)}
                    placeholder="Nombre del producto"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Tipo
                  </label>
                  <Select
                    value={customProductType}
                    onValueChange={setCustomProductType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Fecha de lanzamiento
                  </label>
                  <Input
                    type="date"
                    value={customReleaseDate}
                    onChange={(event) =>
                      setCustomReleaseDate(event.target.value)
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Precio oficial
                    </label>
                    <Input
                      value={customPrice}
                      onChange={(event) => setCustomPrice(event.target.value)}
                      placeholder="9.99"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Moneda
                    </label>
                    <Input
                      value={customCurrency}
                      onChange={(event) => setCustomCurrency(event.target.value)}
                      placeholder="USD"
                    />
                  </div>
                </div>
              </div>
              {missingProduct.sourceUrl && (
                <a
                  href={missingProduct.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline"
                >
                  Ver fuente
                </a>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Imágenes ({imageUrls.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <label className="text-xs font-semibold text-muted-foreground">
                  Agregar imágenes (una por línea o separadas por coma)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Textarea
                    value={newImageUrls}
                    onChange={(event) => setNewImageUrls(event.target.value)}
                    placeholder="https://...&#10;https://..."
                    className="min-h-[90px]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="sm:self-start"
                    onClick={addImageUrls}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {imageUrls.map((image, index) => (
                  <div key={index} className="space-y-2">
                    <div className="pt-3 pb-3 group relative aspect-[2/3] max-h-72 rounded-lg overflow-hidden border border-border shadow-sm">
                      <a
                        href={image}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full h-full"
                      >
                        <img
                          src={image}
                          alt={`${missingProduct.title} ${index + 1}`}
                          className="mx-auto h-full w-auto object-contain"
                        />
                      </a>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center text-xs text-muted-foreground"
                      onClick={() => removeImageUrl(image)}
                    >
                      <X className="mr-2 h-3.5 w-3.5" />
                      Quitar imagen
                    </Button>

                    <Select
                      value={imageClassifications[image] || ""}
                      onValueChange={(value) =>
                        handleClassificationChange(
                          image,
                          value as ImageClassification
                        )
                      }
                    >
                      <SelectTrigger
                        className={
                          !imageClassifications[image]
                            ? "border-destructive"
                            : ""
                        }
                      >
                        <SelectValue placeholder="Clasifica..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRODUCT">Producto</SelectItem>
                        <SelectItem value="CARD">Carta</SelectItem>
                        <SelectItem value="IGNORE">Ignorar</SelectItem>
                      </SelectContent>
                    </Select>

                    {imageClassifications[image] === "CARD" && (
                      <div className="space-y-2 border-t pt-2">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-muted-foreground">
                            Set
                          </label>
                          <Select
                            value={cardSelections[image]?.setCode || ""}
                            onValueChange={(value) =>
                              handleSetCodeChange(image, value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona set..." />
                            </SelectTrigger>
                            <SelectContent>
                              {setCodesOptions.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {cardSelections[image]?.setCode && (
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground">
                              Carta
                            </label>
                            <Select
                              value={
                                cardSelections[image]?.cardId?.toString() || ""
                              }
                              onValueChange={(value) =>
                                handleCardChange(image, value)
                              }
                            >
                              <SelectTrigger
                                className={
                                  !cardSelections[image]?.cardId
                                    ? "border-destructive"
                                    : ""
                                }
                              >
                                <SelectValue placeholder="Selecciona carta..." />
                              </SelectTrigger>
                              <SelectContent>
                                {(availableCards[image] || []).map((card) => (
                                  <SelectItem
                                    key={card.id}
                                    value={card.id.toString()}
                                  >
                                    {card.code} - {card.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {cardSelections[image]?.cardData && (
                          <div className="text-xs text-muted-foreground">
                            {cardSelections[image]?.cardData?.code} -{" "}
                            {cardSelections[image]?.cardData?.name}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                size="lg"
                variant="default"
                disabled={approveDisabled}
                onClick={handleApprove}
              >
                {isApproving ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-5 w-5" />
                    Aprobar producto
                  </>
                )}
              </Button>
              <div className="pt-4 border-t space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Clasificadas</span>
                  <span>
                    {
                      Object.values(imageClassifications).filter(
                        (value) => value && value.length > 0
                      ).length
                    }{" "}
                    / {imageUrls.length}
                  </span>
                </div>
                {customProductType && (
                  <Badge variant="outline" className="text-[10px]">
                    {customProductType}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ApproveMissingProductPage;
