"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { ArrowLeft, Eye, RefreshCw, AlertCircle, Trash2 } from "lucide-react";
import SingleSelect, { type Option as SingleSelectOption } from "@/components/SingleSelect";
import { showErrorToast, showSuccessToast } from "@/lib/toastify";
import { setCodesOptions } from "@/helpers/constants";

interface MissingSet {
  id: number;
  title: string;
  translatedTitle?: string | null;
  versionSignature?: string | null;
  isApproved: boolean;
  images: string[];
  createdAt: string;
  updatedAt: string;
  events: MissingSetEventLink[];
}

interface MissingSetEventLink {
  linkId: number;
  eventId: number;
  event: {
    id: number;
    title: string;
    slug?: string | null;
    region?: string | null;
    eventType?: string | null;
    startDate?: string | null;
    sourceUrl?: string | null;
    locale?: string | null;
  } | null;
}

type ImageClassification =
  | "CARD"
  | "DON"
  | "UNCUT_SHEET"
  | "PLAYMAT"
  | "SLEEVE"
  | "COVER"
  | "";

interface CardData {
  id: number;
  name: string;
  code: string;
  src: string;
  setCode: string;
  alias?: string | null;
}

interface EventCardOption extends CardData {
  baseCardId?: number | null;
  isFirstEdition?: boolean;
  sets?: Array<{
    set: {
      id?: number;
      title: string;
      code?: string | null;
      version?: string | null;
    };
  }>;
}

interface AttachmentData {
  id: number;
  title: string;
  type: string;
  imageUrl?: string | null;
}

interface CardSelection {
  setCode: string;
  cardId: number | null;
  cardData: CardData | null;
  selectedVariantId?: number | null;
}

type ImageClassificationPayload = Record<
  string,
  {
    type: ImageClassification;
    cardId?: number;
  }
>;

interface ApprovalRequestPayload {
  imageClassifications: ImageClassificationPayload;
  action: "createNew" | "linkExisting" | "createAndReassign" | "eventCardOnly";
  existingSetId?: number | null;
  overrideTitle?: string | null;
  overrideVersion?: string | null;
  setCode?: string | null;
  reassignCardIds?: number[];
  eventCardPayload?: {
    imageUrl: string;
    mode: "existing" | "alternate";
    cardId?: number;
    baseCardId?: number;
    classification?: ImageClassification;
  };
}

interface ExistingSetPreview {
  id: number;
  title: string;
  code?: string | null;
  version?: string | null;
  image?: string | null;
}

type ApprovalMode =
  | "createNew"
  | "linkExisting"
  | "reassign"
  | "eventCardOnly";

export default function ApproveMissingSetPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [missingSet, setMissingSet] = useState<MissingSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>("createNew");
  const [customTitle, setCustomTitle] = useState("");
  const [customVersion, setCustomVersion] = useState("");
  const [customSetCode, setCustomSetCode] = useState("");
  const [imageClassifications, setImageClassifications] = useState<
    Record<string, ImageClassification>
  >({});
  const [cardSelections, setCardSelections] = useState<
    Record<string, CardSelection>
  >({});
  const [availableCards, setAvailableCards] = useState<
    Record<string, CardData[]>
  >({});
  const [allSets, setAllSets] = useState<ExistingSetPreview[]>([]);
  const [loadingSetOptions, setLoadingSetOptions] = useState(false);
  const [selectedExistingSetId, setSelectedExistingSetId] = useState<string | null>(null);
  const [selectedExistingSetCards, setSelectedExistingSetCards] = useState<CardData[]>([]);
  const [selectedExistingSetAttachments, setSelectedExistingSetAttachments] = useState<AttachmentData[]>([]);
  const [loadingExistingSetAttachments, setLoadingExistingSetAttachments] = useState(false);
  const [loadingExistingSetCards, setLoadingExistingSetCards] = useState(false);
  const [variantOptions, setVariantOptions] = useState<Record<string, CardData[]>>({});
  const [variantLoading, setVariantLoading] = useState<Record<string, boolean>>({});
  const [donCards, setDonCards] = useState<CardData[]>([]);
  const [loadingDonCards, setLoadingDonCards] = useState(false);
  const [selectedReassignCards, setSelectedReassignCards] = useState<
    number[]
  >([]);
  const [eventCardImageUrl, setEventCardImageUrl] = useState<string | null>(null);
  const [eventCardModeOption, setEventCardModeOption] = useState<
    "existing" | "alternate"
  >("existing");
  const [eventCardCodeQuery, setEventCardCodeQuery] = useState("");
  const [eventCardOptions, setEventCardOptions] = useState<EventCardOption[]>([]);
  const [eventCardOptionsLoading, setEventCardOptionsLoading] = useState(false);
  const [eventCardSearchExecuted, setEventCardSearchExecuted] = useState(false);
  const [eventCardSelectedCardId, setEventCardSelectedCardId] = useState<
    number | null
  >(null);
  const selectedExistingSet = useMemo(() => {
    if (!selectedExistingSetId) return null;
    const numericId = Number(selectedExistingSetId);
    if (!Number.isFinite(numericId)) return null;
    return allSets.find((set) => set.id === numericId) ?? null;
  }, [selectedExistingSetId, allSets]);

  const eventCardSelectedOption = useMemo(() => {
    if (!eventCardSelectedCardId) return null;
    return (
      eventCardOptions.find((card) => card.id === eventCardSelectedCardId) ??
      null
    );
  }, [eventCardSelectedCardId, eventCardOptions]);

  const eventCardBaseCardId = useMemo(() => {
    if (!eventCardSelectedOption) return null;
    return eventCardSelectedOption.baseCardId || eventCardSelectedOption.id;
  }, [eventCardSelectedOption]);

  const mapVariantCard = (card: any): CardData => ({
    id: card.id,
    name: card.name,
    code: card.code,
    src: card.src,
    alias: card.alias ?? null,
    setCode:
      card.setCode ||
      card.sets?.find((entry: any) => entry.set?.code)?.set?.code ||
      "",
  });

  const clearVariantState = (imageUrl: string) => {
    setVariantOptions((prev) => {
      if (!(imageUrl in prev)) return prev;
      const next = { ...prev };
      delete next[imageUrl];
      return next;
    });
    setVariantLoading((prev) => {
      if (!(imageUrl in prev)) return prev;
      const next = { ...prev };
      delete next[imageUrl];
      return next;
    });
  };

  useEffect(() => {
    fetchMissingSet();
    fetchSetOptions();
    fetchDonCards();
  }, [id]);

  const fetchMissingSet = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/missing-sets/${id}`);
      if (!response.ok) throw new Error("Failed to fetch missing set");

      const data = await response.json();
      setMissingSet(data);
      setCustomTitle(data.translatedTitle || data.title || "");
      setCustomVersion(data.versionSignature || "");
      setCustomSetCode("");
      setSelectedExistingSetId(null);
      setSelectedExistingSetCards([]);
      setSelectedExistingSetAttachments([]);
      setVariantOptions({});
      setVariantLoading({});
      setEventCardImageUrl(null);
      setEventCardModeOption("existing");
      setEventCardCodeQuery("");
      setEventCardOptions([]);
      setEventCardSelectedCardId(null);
      setEventCardSearchExecuted(false);
      setApprovalMode("createNew");

      // Inicializar clasificaciones vacías para cada imagen
      const initialClassifications: Record<string, ImageClassification> = {};
      const initialCardSelections: Record<string, CardSelection> = {};

      data.images.forEach((url: string) => {
        initialClassifications[url] = "";
        initialCardSelections[url] = {
          setCode: "",
          cardId: null,
          cardData: null,
          selectedVariantId: null,
        };
      });

      setImageClassifications(initialClassifications);
      setCardSelections(initialCardSelections);
      setAvailableCards({});
    } catch (error) {
      console.error("Error fetching missing set:", error);
      showErrorToast("Error al cargar el missing set");
      router.push("/admin/missing-sets");
    } finally {
      setLoading(false);
    }
  };

  const fetchSetOptions = async () => {
    try {
      setLoadingSetOptions(true);
      const response = await fetch(`/api/admin/sets`);
      if (!response.ok) {
        throw new Error("Failed to load sets");
      }
      const data = (await response.json()) as ExistingSetPreview[];
      setAllSets(data);
    } catch (error) {
      console.error("Error fetching sets:", error);
      showErrorToast("No se pudieron cargar los sets existentes");
    } finally {
      setLoadingSetOptions(false);
    }
  };

  const fetchDonCards = async () => {
    try {
      setLoadingDonCards(true);
      const response = await fetch(`/api/admin/dons?limit=500`);
      if (!response.ok) {
        throw new Error("Failed to load Don cards");
      }
      const data = await response.json();
      const items = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : [];
      const mapped = items.map((card: any) => mapVariantCard(card));
      setDonCards(mapped);
    } catch (error) {
      console.error("Error fetching Don cards:", error);
      showErrorToast("No se pudieron cargar los Don!!");
    } finally {
      setLoadingDonCards(false);
    }
  };

  useEffect(() => {
    if (approvalMode !== "eventCardOnly") {
      setEventCardImageUrl(null);
      setEventCardModeOption("existing");
      setEventCardCodeQuery("");
      setEventCardOptions([]);
      setEventCardSelectedCardId(null);
      setEventCardSearchExecuted(false);
    }
  }, [approvalMode]);

  const handleClassificationChange = (
    url: string,
    value: ImageClassification
  ) => {
    setImageClassifications((prev) => ({
      ...prev,
      [url]: value,
    }));

    // Siempre reiniciar la selección cuando cambia la clasificación
    setCardSelections((prev) => ({
      ...prev,
      [url]: {
        setCode: "",
        cardId: null,
        cardData: null,
        selectedVariantId: null,
      },
    }));
    clearVariantState(url);
    if (
      eventCardImageUrl === url &&
      value !== "CARD" &&
      value !== "DON"
    ) {
      setEventCardImageUrl(null);
    }
  };

  const handleSetCodeChange = async (imageUrl: string, setCode: string) => {
    setCardSelections((prev) => ({
      ...prev,
      [imageUrl]: {
        setCode,
        cardId: null,
        cardData: null,
        selectedVariantId: null,
      },
    }));
    clearVariantState(imageUrl);

    // Fetch cards for this set code
    try {
      const response = await fetch(
        `/api/admin/cards/by-set?setCode=${setCode}&firstEditionOnly=true&baseCardsOnly=true`
      );
      if (!response.ok) throw new Error("Failed to fetch cards");
      const cards = await response.json();

      setAvailableCards((prev) => ({
        ...prev,
        [imageUrl]: cards,
      }));
    } catch (error) {
      console.error("Error fetching cards:", error);
      showErrorToast("Error al cargar las cartas del set");
    }
  };

  const loadVariantOptions = useCallback(
    async (imageUrl: string, baseCardId: number) => {
      setVariantLoading((prev) => ({ ...prev, [imageUrl]: true }));
      try {
        const response = await fetch(
          `/api/admin/cards/${baseCardId}?includeAlternates=true`
        );
        if (!response.ok) {
          throw new Error("No se pudieron cargar las variantes");
        }
        const data = await response.json();
        const variants = [
          mapVariantCard(data.card),
          ...(Array.isArray(data.alternates)
            ? data.alternates.map(mapVariantCard)
            : []),
        ];
        setVariantOptions((prev) => ({ ...prev, [imageUrl]: variants }));
        setCardSelections((prev) => {
          const current = prev[imageUrl] ?? {
            setCode: "",
            cardId: null,
            cardData: null,
            selectedVariantId: null,
          };
          const preferred =
            variants.find(
              (variant) => variant.id === current.selectedVariantId
            ) || variants[0] || current.cardData;
          return {
            ...prev,
            [imageUrl]: {
              ...current,
              selectedVariantId: preferred?.id ?? null,
              cardData: preferred ?? current.cardData,
            },
          };
        });
      } catch (error) {
        console.error(error);
        showErrorToast("Error al cargar variantes de la carta");
        clearVariantState(imageUrl);
      } finally {
        setVariantLoading((prev) => ({ ...prev, [imageUrl]: false }));
      }
    },
    [showErrorToast]
  );

  const handleCardChange = (imageUrl: string, cardId: string) => {
    const cards = availableCards[imageUrl] || [];
    const numericId = Number(cardId);
    const selectedCard = cards.find((c) => c.id === numericId);

    setCardSelections((prev) => ({
      ...prev,
      [imageUrl]: {
        ...prev[imageUrl],
        cardId: numericId,
        cardData: selectedCard || null,
        selectedVariantId: selectedCard?.id ?? null,
      },
    }));
    clearVariantState(imageUrl);

    if (approvalMode === "reassign" && Number.isFinite(numericId)) {
      loadVariantOptions(imageUrl, numericId);
    }
  };

  const handleVariantSelect = (imageUrl: string, variant: CardData) => {
    setCardSelections((prev) => ({
      ...prev,
      [imageUrl]: {
        ...prev[imageUrl],
        selectedVariantId: variant.id,
        cardData: variant,
      },
    }));
  };

  const handleDonSelect = (imageUrl: string, value: string) => {
    const numericId = Number(value);
    const selectedCard = donCards.find((card) => card.id === numericId);
    if (!selectedCard) return;
    setCardSelections((prev) => ({
      ...prev,
      [imageUrl]: {
        setCode: selectedCard.setCode ?? "",
        cardId: numericId,
        cardData: selectedCard,
        selectedVariantId: numericId,
      },
    }));
  };

  const handleEventCardSearch = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const code = eventCardCodeQuery.trim();
    if (!code.length) {
      showErrorToast("Ingresa un código de carta para buscar");
      return;
    }

    try {
      setEventCardOptionsLoading(true);
      setEventCardSearchExecuted(true);
      setEventCardSelectedCardId(null);

      const response = await fetch(
        `/api/admin/cards/by-code/${encodeURIComponent(code)}`
      );
      if (!response.ok) {
        throw new Error("No se encontraron cartas para ese código");
      }

      const data = (await response.json()) as EventCardOption[];
      setEventCardOptions(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length === 1) {
        setEventCardSelectedCardId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching cards by code", error);
      setEventCardOptions([]);
      showErrorToast(
        error instanceof Error
          ? error.message
          : "Error al buscar cartas por código"
      );
    } finally {
      setEventCardOptionsLoading(false);
    }
  };

  useEffect(() => {
    if (approvalMode !== "reassign") return;
    Object.entries(cardSelections).forEach(([imageUrl, selection]) => {
      if (
        selection.cardId &&
        !variantOptions[imageUrl] &&
        !variantLoading[imageUrl]
      ) {
        loadVariantOptions(imageUrl, selection.cardId);
      }
    });
  }, [
    approvalMode,
    cardSelections,
    variantOptions,
    variantLoading,
    loadVariantOptions,
  ]);

  const handleExistingSetSelect = async (value: string) => {
    setSelectedExistingSetId(value || null);
    setSelectedExistingSetCards([]);
    setSelectedExistingSetAttachments([]);
    if (!value) return;
    const numericId = Number(value);
    if (!Number.isFinite(numericId)) return;
    try {
      setLoadingExistingSetCards(true);
      setLoadingExistingSetAttachments(true);
      const [cardsResponse, setDetailResponse] = await Promise.all([
        fetch(`/api/admin/cards/by-set-id/${numericId}`),
        fetch(`/api/admin/sets/${numericId}`),
      ]);

      if (!cardsResponse.ok) {
        throw new Error("No se pudieron cargar las cartas del set");
      }
      const cards = (await cardsResponse.json()) as CardData[];
      setSelectedExistingSetCards(cards);

      if (setDetailResponse.ok) {
        const setDetail = await setDetailResponse.json();
        setSelectedExistingSetAttachments(
          Array.isArray(setDetail.attachments) ? setDetail.attachments : []
        );
      } else {
        setSelectedExistingSetAttachments([]);
      }
    } catch (error) {
      console.error(error);
      showErrorToast("Error al cargar datos del set existente");
    } finally {
      setLoadingExistingSetCards(false);
      setLoadingExistingSetAttachments(false);
    }
  };

  const toggleReassignCard = (cardId: number, checked: boolean) => {
    setSelectedReassignCards((prev) => {
      if (checked) {
        if (prev.includes(cardId)) return prev;
        return [...prev, cardId];
      }
      return prev.filter((id) => id !== cardId);
    });
  };

  const allImagesClassified = useMemo(() => {
    if (!missingSet) return false;
    return missingSet.images.every((url) => {
      const classification = imageClassifications[url];

      // Debe tener una clasificación
      if (!classification || classification.length === 0) {
        return false;
      }

      // Si es CARD, debe tener setCode y cardId seleccionados
      if (classification === "CARD") {
        const cardSelection = cardSelections[url];
        return (
          cardSelection &&
          cardSelection.setCode &&
          cardSelection.cardId !== null
        );
      }

      if (classification === "DON") {
        const cardSelection = cardSelections[url];
        return Boolean(cardSelection && cardSelection.cardId !== null);
      }

      // Para otros tipos, solo necesita la clasificación
      return true;
    });
  }, [missingSet, imageClassifications, cardSelections]);

  const selectedCardList = useMemo(() => {
    const map = new Map<number, CardData>();
    Object.values(cardSelections).forEach((selection) => {
      if (selection.cardData) {
        map.set(selection.cardData.id, selection.cardData);
      }
    });
    return Array.from(map.values());
  }, [cardSelections]);

  useEffect(() => {
    setSelectedReassignCards(selectedCardList.map((card) => card.id));
  }, [selectedCardList]);

  const existingSetOptions: SingleSelectOption[] = useMemo(() => {
    return allSets.map((set) => ({
      value: set.id.toString(),
      label: set.title,
      description: set.code ?? undefined,
    }));
  }, [allSets]);

  const classificationEditable = approvalMode !== "linkExisting";
  const requiresClassification =
    approvalMode === "createNew" || approvalMode === "reassign";
  const meetsClassification = requiresClassification ? allImagesClassified : true;
  const eventCardSelectionValid =
    eventCardModeOption === "existing"
      ? Boolean(eventCardSelectedCardId && eventCardImageUrl)
      : Boolean(eventCardBaseCardId && eventCardImageUrl);

  const modeConstraintsMet =
    approvalMode === "linkExisting"
      ? Boolean(selectedExistingSetId)
      : approvalMode === "eventCardOnly"
      ? eventCardSelectionValid
      : approvalMode === "reassign"
      ? selectedReassignCards.length > 0
      : true;

  const approveDisabled =
    !meetsClassification || isApproving || missingSet?.isApproved || !modeConstraintsMet;

  const buildApprovalPayload = (): ApprovalRequestPayload => {
    const payload: ImageClassificationPayload = {};

    Object.entries(imageClassifications).forEach(([url, classification]) => {
      if (classification && classification.length > 0) {
        payload[url] = {
          type: classification,
          cardId:
            classification === "CARD" || classification === "DON"
              ? cardSelections[url]?.cardId || undefined
              : undefined,
        };
      }
    });

    let eventCardPayload: ApprovalRequestPayload["eventCardPayload"] | undefined;
    if (approvalMode === "eventCardOnly" && eventCardImageUrl) {
      eventCardPayload = {
        imageUrl: eventCardImageUrl,
        mode: eventCardModeOption,
        cardId:
          eventCardModeOption === "existing"
            ? eventCardSelectedCardId ?? undefined
            : undefined,
        baseCardId:
          eventCardModeOption === "alternate"
            ? eventCardBaseCardId ?? undefined
            : undefined,
        classification: imageClassifications[eventCardImageUrl],
      };
    }

    const action: ApprovalRequestPayload["action"] =
      approvalMode === "linkExisting"
        ? "linkExisting"
        : approvalMode === "eventCardOnly"
        ? "eventCardOnly"
        : approvalMode === "reassign"
        ? "createAndReassign"
        : "createNew";

    return {
      imageClassifications: payload,
      action,
      existingSetId: selectedExistingSet?.id ?? null,
      overrideTitle: customTitle.trim(),
      overrideVersion: customVersion.trim(),
      setCode: customSetCode.trim(),
      reassignCardIds:
        approvalMode === "reassign" ? selectedReassignCards : [],
      eventCardPayload,
    };
  };

  const submitApproval = async (payload: ApprovalRequestPayload) => {
    if (!missingSet) return;

    const response = await fetch(
      `/api/admin/missing-sets/${missingSet.id}/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to approve missing set");
    }

    const result = await response.json();
    if (payload.action === "linkExisting") {
      showSuccessToast(
        `Set "${result.setTitle}" vinculado correctamente a los eventos seleccionados.`
      );
    } else if (payload.action === "eventCardOnly") {
      showSuccessToast(
        `Carta del evento registrada correctamente para "${result.setTitle}".`
      );
    } else if (payload.action === "createAndReassign") {
      showSuccessToast(
        `Set "${result.setTitle}" creado y ${result.reassignedCards ?? 0} cartas reasignadas.`
      );
    } else {
      showSuccessToast(
        `Set "${result.setTitle}" creado exitosamente! ${result.alternatesCount ?? 0} cartas alternas y ${result.attachmentsCount ?? 0} attachments agregados.`
      );
    }

    router.push("/admin/missing-sets");
  };

  const handleApprove = async () => {
    if (!missingSet) return;

    const payload = buildApprovalPayload();

    try {
      setIsApproving(true);
      await submitApproval(payload);
    } catch (error) {
      console.error(error);
      showErrorToast(
        error instanceof Error ? error.message : "Error al aprobar el set"
      );
    } finally {
      setIsApproving(false);
    }
  };

  const handleDelete = async () => {
    if (!missingSet) return;

    const eventLabel = primaryEvent?.title ?? "los eventos relacionados";

    if (
      !window.confirm(
        `¿Eliminar "${missingSet.title}" del evento "${eventLabel}"?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/missing-sets/${missingSet.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete missing set");

      showSuccessToast("Missing set eliminado exitosamente");
      router.push("/admin/missing-sets");
    } catch (error) {
      console.error(error);
      showErrorToast("Error al eliminar el missing set");
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

  if (!missingSet) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Missing set no encontrado</p>
          <Button
            onClick={() => router.push("/admin/missing-sets")}
            className="mt-4"
          >
            Volver a la lista
          </Button>
        </div>
      </div>
    );
  }

  const primaryEvent = missingSet.events[0]?.event ?? null;

  const pageTitle = missingSet.translatedTitle || missingSet.title;

  return (
    <>
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin/missing-sets")}
              className="mb-2 px-0"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Missing Sets
            </Button>
            <h1 className="text-3xl font-bold leading-tight">{pageTitle}</h1>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span>{missingSet.events.length} evento(s)</span>
              <span>•</span>
              <span>{missingSet.images.length} imagen(es) por clasificar</span>
              {missingSet.versionSignature && (
                <>
                  <span>•</span>
                  <span>Versión: {missingSet.versionSignature}</span>
                </>
              )}
            </div>
          </div>
          {missingSet.isApproved && (
            <Badge variant="default" className="text-sm">
              ✓ Aprobado
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Contenido principal */}
        <div className="lg:col-span-3 space-y-6">
          {/* Card de información */}
          <Card>
            <CardHeader>
              <CardTitle>Información del Set</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Evento principal
                  </p>
                  {primaryEvent ? (
                    <div className="space-y-1 flex flex-col">
                      <p className="text-lg font-semibold leading-tight">
                        {primaryEvent.title}
                      </p>
                      {primaryEvent.slug && (
                        <p className="text-sm text-muted-foreground break-all">
                          {primaryEvent.slug}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Este missing set no está vinculado a ningún evento.
                    </p>
                  )}
                  {missingSet.events.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      Vinculado a {missingSet.events.length} evento(s)
                    </p>
                  )}
                </div>
              </div>

              {primaryEvent && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4">
                    <div className="text-xs uppercase text-muted-foreground mb-1">
                      Región
                    </div>
                    <p className="text-lg font-semibold">
                      {primaryEvent.region || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-xs uppercase text-muted-foreground mb-1">
                      Fecha de inicio
                    </div>
                    <p className="text-lg font-semibold">
                      {primaryEvent.startDate
                        ? new Date(primaryEvent.startDate).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalles editables</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Nombre del set
                  </label>
                  <Input
                    value={customTitle}
                    onChange={(event) => setCustomTitle(event.target.value)}
                    placeholder="Título del set"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Versión
                  </label>
                  <Input
                    value={customVersion}
                    onChange={(event) => setCustomVersion(event.target.value)}
                    placeholder="Ej. JP, EN, Release"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Código del set
                </label>
                <Input
                  value={customSetCode}
                  onChange={(event) => setCustomSetCode(event.target.value)}
                  placeholder="Ej. OP08, EB01..."
                />
                <p className="text-xs text-muted-foreground">
                  Opcional. Si lo dejas vacío, el set se creará sin código asignado.
                </p>
              </div>
            </CardContent>
          </Card>

      {approvalMode === "linkExisting" && (
            <Card>
              <CardHeader>
                <div className="flex flex-col">
                  <CardTitle>Cartas del set seleccionado</CardTitle>
                  {selectedExistingSet && (
                    <p className="text-sm font-semibold mt-1">
                      {selectedExistingSet.title}
                    </p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Verifica que las cartas coincidan con las imágenes detectadas antes de aprobar.
                </p>
              </CardHeader>
              <CardContent>
                {!selectedExistingSet ? (
                  <div className="py-8 text-center text-muted-foreground">
                    Selecciona un set para mostrar sus cartas.
                  </div>
                ) : loadingExistingSetCards ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Cargando cartas de {selectedExistingSet.title}...
                  </div>
                ) : selectedExistingSetCards.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    Este set no tiene cartas asociadas.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {selectedExistingSetCards.slice(0, 4).map((card) => (
                      <div
                        key={card.id}
                        className="space-y-2 rounded-lg border p-3 shadow-sm bg-card"
                      >
                        <div className="aspect-[2/3] rounded-md overflow-hidden border bg-muted">
                          <img
                            src={card.src}
                            alt={card.name}
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="font-semibold">{card.code}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {card.name}
                          </p>
                        </div>
                      </div>
                    ))}
                    {selectedExistingSetCards.length > 4 && (
                      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        <p>
                          +{selectedExistingSetCards.length - 4} cartas más en este set
                        </p>
                        <p className="text-xs">
                          Usa el visualizador de sets para ver el listado completo.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

      {approvalMode === "linkExisting" && (
            <Card>
              <CardHeader>
                <div className="flex flex-col">
                  <CardTitle>Attachments del set seleccionado</CardTitle>
                  {selectedExistingSet && (
                    <p className="text-sm font-semibold mt-1">
                      {selectedExistingSet.title}
                    </p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Algunos productos oficiales sólo incluyen playmats, sleeves u otros extras.
                </p>
              </CardHeader>
              <CardContent>
                {!selectedExistingSet ? (
                  <div className="py-6 text-center text-muted-foreground">
                    Selecciona un set para mostrar sus attachments.
                  </div>
                ) : loadingExistingSetAttachments ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Cargando attachments de {selectedExistingSet.title}...
                  </div>
                ) : selectedExistingSetAttachments.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground">
                    Este set no tiene attachments registrados.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedExistingSetAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="space-y-2 rounded-lg border p-3 bg-card"
                      >
                        <div className="aspect-[3/2] rounded-md overflow-hidden border bg-muted">
                          {attachment.imageUrl ? (
                            <img
                              src={attachment.imageUrl}
                              alt={attachment.title}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                              Sin imagen
                            </div>
                          )}
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="font-semibold">{attachment.title}</p>
                          <Badge variant="secondary">
                            {attachment.type.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Card de imágenes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  Imágenes del Set ({missingSet.images.length})
                </CardTitle>
                {requiresClassification && allImagesClassified && (
                  <Badge variant="default" className="gap-1">
                    ✓ Todas clasificadas
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {missingSet.images.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No se detectaron imágenes para este set.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {missingSet.images.map((image, index) => (
                    <div key={index} className="space-y-2 flex flex-col">
                      <div className="pt-3 pb-3 group relative aspect-[2/3] max-h-72 rounded-lg overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow">
                        <a
                          href={image}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full h-full"
                        >
                          <img
                            src={image}
                            alt={`${missingSet.title} - Imagen ${index + 1}`}
                            className="mx-auto h-full w-auto object-contain group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </a>
                      </div>

                      {/* Selector de clasificación */}
                      <div className="space-y-2">
                        <div className="space-y-1 flex flex-col">
                          <Select
                            value={imageClassifications[image] || ""}
                            onValueChange={(value) =>
                              handleClassificationChange(
                                image,
                                value as ImageClassification
                              )
                            }
                            disabled={!classificationEditable}
                          >
                            <SelectTrigger
                              className={
                                requiresClassification && !imageClassifications[image]
                                  ? "border-destructive"
                                  : ""
                              }
                            >
                              <SelectValue placeholder="Selecciona tipo..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CARD">Card</SelectItem>
                              <SelectItem value="DON">Don</SelectItem>
                              <SelectItem value="UNCUT_SHEET">
                                Uncut Sheet
                              </SelectItem>
                              <SelectItem value="PLAYMAT">Playmat</SelectItem>
                              <SelectItem value="SLEEVE">Sleeve</SelectItem>
                              <SelectItem value="COVER">Cover</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Selectores adicionales para CARD */}
                        {requiresClassification &&
                          approvalMode !== "eventCardOnly" &&
                          imageClassifications[image] === "CARD" && (
                            <div className="space-y-2 pt-2 border-t">
                              {/* Selector de Set Code */}
                              <div className="space-y-1 flex flex-col">
                                <label className="text-xs font-medium text-muted-foreground">
                                  Código del Set
                                </label>
                                <Select
                                  value={cardSelections[image]?.setCode || ""}
                                  onValueChange={(value) =>
                                    handleSetCodeChange(image, value)
                                  }
                                >
                                  <SelectTrigger
                                    className={
                                      !cardSelections[image]?.setCode
                                        ? "border-destructive"
                                        : ""
                                    }
                                  >
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

                              {/* Selector de Carta */}
                              {cardSelections[image]?.setCode && (
                                <div className="space-y-1 flex flex-col">
                                  <label className="text-xs font-medium text-muted-foreground">
                                    Carta
                                  </label>
                                  <Select
                                    value={
                                      cardSelections[image]?.cardId?.toString() ||
                                      ""
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
                                      {(availableCards[image] || []).map(
                                        (card) => (
                                          <SelectItem
                                            key={card.id}
                                            value={card.id.toString()}
                                          >
                                            {card.code} - {card.name}
                                          </SelectItem>
                                        )
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {/* Preview de la carta seleccionada */}
                                {cardSelections[image]?.cardData && (
                                  <div className="space-y-1 flex flex-col">
                                    <label className="text-xs font-medium text-muted-foreground">
                                      Preview
                                    </label>
                                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden border-2 border-primary">
                                    <img
                                      src={cardSelections[image].cardData!.src}
                                      alt={cardSelections[image].cardData!.name}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <p className="text-xs text-center text-muted-foreground">
                                    {cardSelections[image].cardData!.code} -{" "}
                                    {cardSelections[image].cardData!.name}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                        {requiresClassification &&
                          imageClassifications[image] === "DON" && (
                            <div className="space-y-2 pt-2 border-t">
                              <div className="space-y-1 flex flex-col">
                                <label className="text-xs font-medium text-muted-foreground">
                                  Selecciona el Don!!
                                </label>
                                <Select
                                  value={
                                    cardSelections[image]?.cardId?.toString() ||
                                    ""
                                  }
                                  onValueChange={(value) =>
                                    handleDonSelect(image, value)
                                  }
                                  disabled={loadingDonCards}
                                >
                                  <SelectTrigger
                                    className={
                                      !cardSelections[image]?.cardId
                                        ? "border-destructive"
                                        : ""
                                    }
                                  >
                                    <SelectValue placeholder="Selecciona Don..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {loadingDonCards ? (
                                      <SelectItem value="loading">
                                        <div className="flex items-center gap-2">
                                          <RefreshCw className="h-3 w-3 animate-spin" />
                                          Cargando Don!!
                                        </div>
                                      </SelectItem>
                                    ) : donCards.length ? (
                                      donCards.map((card) => (
                                        <SelectItem
                                          key={card.id}
                                          value={card.id.toString()}
                                        >
                                          {card.alias || card.name}
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <SelectItem value="empty" disabled>
                                        No hay Don!! registrados
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                              {cardSelections[image]?.cardData && (
                                <div className="space-y-1 flex flex-col">
                                  <label className="text-xs font-medium text-muted-foreground">
                                    Preview
                                  </label>
                                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden border-2 border-primary">
                                    <img
                                      src={cardSelections[image].cardData!.src}
                                      alt={cardSelections[image].cardData!.name}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <p className="text-xs text-center text-muted-foreground">
                                    {cardSelections[image].cardData!.name}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                        {approvalMode === "eventCardOnly" && (
                            <div className="space-y-2 pt-2 border-t">
                              <Button
                                type="button"
                                variant={
                                  eventCardImageUrl === image
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                onClick={() => {
                                  setEventCardImageUrl(image);
                                  setEventCardModeOption("existing");
                                  setImageClassifications((prev) => ({
                                    ...prev,
                                    [image]: prev[image] || "CARD",
                                  }));
                                }}
                              >
                                {eventCardImageUrl === image
                                  ? "Carta de evento seleccionada"
                                  : "Usar para carta del evento"}
                              </Button>
                            </div>
                          )}

                        {approvalMode === "reassign" &&
                          cardSelections[image]?.cardId &&
                          imageClassifications[image] === "CARD" && (
                            <div className="space-y-2 pt-2 border-t">
                              <label className="text-xs font-medium text-muted-foreground">
                                Selecciona la carta exacta
                              </label>
                              {variantLoading[image] ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                  Cargando variantes...
                                </div>
                              ) : (variantOptions[image] || []).length ? (
                                <div className="grid grid-cols-2 gap-2">
                                  {(variantOptions[image] || []).map(
                                    (variant) => {
                                      const isSelected =
                                        cardSelections[image]?.selectedVariantId ===
                                        variant.id;
                                      return (
                                        <button
                                          key={variant.id}
                                          type="button"
                                          onClick={() =>
                                            handleVariantSelect(image, variant)
                                          }
                                          className={`rounded-lg border p-2 text-left text-xs transition ${
                                            isSelected
                                              ? "border-primary ring-2 ring-primary/40"
                                              : "hover:border-primary/50"
                                          }`}
                                        >
                                          <div className="aspect-[3/4] overflow-hidden rounded bg-muted mb-2">
                                            <img
                                              src={variant.src}
                                              alt={variant.name}
                                              className="h-full w-full object-contain"
                                            />
                                          </div>
                                          <p className="font-semibold">
                                            {variant.code}
                                          </p>
                                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                                            {variant.name}
                                          </p>
                                        </button>
                                      );
                                    }
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  Selecciona una carta base para cargar sus
                                  variantes y elegir la correcta.
                                </p>
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Columna lateral - Acciones */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Modo de aprobación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={approvalMode}
                onValueChange={(value) =>
                  setApprovalMode(value as ApprovalMode)
                }
                className="space-y-3"
              >
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="createNew" id="mode-create" />
                  <div>
                    <label
                      htmlFor="mode-create"
                      className="text-sm font-medium leading-none"
                    >
                      Crear nuevo set
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Genera un nuevo set usando las imágenes clasificadas y crea
                      cartas alternas.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="linkExisting" id="mode-link" />
                  <div>
                    <label
                      htmlFor="mode-link"
                      className="text-sm font-medium leading-none"
                    >
                      Usar set existente
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Vincula este missing set a un set que ya existe en la base
                      de datos sin crear cartas nuevas.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="eventCardOnly" id="mode-event" />
                  <div>
                    <label
                      htmlFor="mode-event"
                      className="text-sm font-medium leading-none"
                    >
                      Solo carta de evento
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Este missing set corresponde a un producto especial como
                      playmat/sleeve; selecciona o crea la carta y solo
                      registraremos la relación de EventCard.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="reassign" id="mode-reassign" />
                  <div>
                    <label
                      htmlFor="mode-reassign"
                      className="text-sm font-medium leading-none"
                    >
                      Crear set y reasignar cartas
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Crea un set nuevo y mueve cartas existentes al set correcto
                      sin duplicarlas.
                    </p>
                  </div>
                </div>
              </RadioGroup>

              {approvalMode === "linkExisting" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Selecciona un set existente
                    </label>
                    <SingleSelect
                      options={existingSetOptions}
                      selected={selectedExistingSetId}
                      setSelected={(value) => handleExistingSetSelect(value)}
                      buttonLabel="Selecciona set..."
                      searchPlaceholder="Busca por nombre o código"
                      isSearchable
                      isFullWidth
                      isDisabled={loadingSetOptions}
                    />
                    {loadingSetOptions && (
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        Cargando sets...
                      </p>
                    )}
                  </div>
                  {selectedExistingSet && (
                    <div className="rounded-lg border p-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold leading-tight">
                            {selectedExistingSet.title}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                            {selectedExistingSet.code && (
                              <Badge variant="outline">
                                {selectedExistingSet.code}
                              </Badge>
                            )}
                            {selectedExistingSet.version && (
                              <Badge variant="secondary">
                                Versión {selectedExistingSet.version}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExistingSetSelect("")}
                        >
                          Quitar
                        </Button>
                      </div>
                      {loadingExistingSetCards && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          Cargando cartas del set...
                        </div>
                      )}
                      {!loadingExistingSetCards &&
                        !selectedExistingSetCards.length && (
                          <p className="text-xs text-muted-foreground">
                            Selecciona el set para ver sus cartas y confirmar que
                            coinciden con las imágenes detectadas.
                          </p>
                        )}
                    </div>
                  )}
                </div>
              )}

              {approvalMode === "eventCardOnly" && (
                <div className="rounded-lg border p-3 space-y-4 text-sm">
                  <div className="space-y-1">
                    <p className="font-semibold">Solo carta de evento</p>
                    <p className="text-xs text-muted-foreground">
                      Usa esta opción cuando el missing set en realidad era una
                      sola carta. Busca el código correspondiente, elige la
                      variante correcta o crea una alterna con la imagen
                      seleccionada.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Imagen de referencia
                    </label>
                    {eventCardImageUrl ? (
                      <div className="flex items-center gap-3">
                        <div className="w-16 aspect-[2/3] overflow-hidden rounded border bg-muted">
                          <img
                            src={eventCardImageUrl}
                            alt="Carta de evento seleccionada"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEventCardImageUrl(null)}
                        >
                          Cambiar imagen
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Selecciona una imagen en la galería y marca
                        &quot;Usar para carta del evento&quot; para continuar.
                      </p>
                    )}
                  </div>

                  <form className="space-y-2" onSubmit={handleEventCardSearch}>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Código de la carta
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={eventCardCodeQuery}
                        onChange={(event) =>
                          setEventCardCodeQuery(event.target.value.toUpperCase())
                        }
                        placeholder="Ej. OP07-001"
                        autoComplete="off"
                      />
                      <Button type="submit" disabled={eventCardOptionsLoading}>
                        {eventCardOptionsLoading ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Buscando
                          </>
                        ) : (
                          "Buscar"
                        )}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Ingresa el código exacto tal como aparece en la carta para
                      cargar todas sus variantes registradas.
                    </p>
                  </form>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Resultados
                    </p>
                    {eventCardOptionsLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Buscando cartas...
                      </div>
                    ) : eventCardOptions.length ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {eventCardOptions.map((card) => {
                          const isSelected = card.id === eventCardSelectedCardId;
                          const primarySet = card.sets?.[0]?.set;
                          return (
                            <button
                              type="button"
                              key={card.id}
                              onClick={() => setEventCardSelectedCardId(card.id)}
                              className={`w-full rounded-lg border p-2 text-left transition ${
                                isSelected
                                  ? "border-primary ring-2 ring-primary/40"
                                  : "hover:border-primary/50"
                              }`}
                            >
                              <div className="flex gap-3">
                                <div className="w-16 aspect-[2/3] overflow-hidden rounded bg-muted">
                                  <img
                                    src={card.src}
                                    alt={card.name}
                                    className="h-full w-full object-contain"
                                  />
                                </div>
                                <div className="flex-1 space-y-1 text-xs">
                                  <div className="flex items-center justify-between">
                                    <p className="font-semibold text-sm text-foreground">
                                      {card.code}
                                    </p>
                                    <div className="flex gap-1">
                                      <Badge variant={card.baseCardId ? "outline" : "default"}>
                                        {card.baseCardId ? "Alterna" : "Base"}
                                      </Badge>
                                      {card.isFirstEdition && (
                                        <Badge variant="secondary">1st Ed.</Badge>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-muted-foreground line-clamp-2">
                                    {card.name}
                                  </p>
                                  {card.alias && (
                                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                                      {card.alias}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-1">
                                    {primarySet ? (
                                      <Badge variant="outline">
                                        {primarySet.code || primarySet.title}
                                      </Badge>
                                    ) : card.setCode ? (
                                      <Badge variant="outline">{card.setCode}</Badge>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : eventCardSearchExecuted ? (
                      <p className="text-xs text-muted-foreground">
                        No encontramos cartas con ese código. Verifica que esté
                        escrito correctamente o intenta con otra variante.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Busca un código para mostrar las cartas disponibles.
                      </p>
                    )}
                  </div>

                  {eventCardOptions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">
                        ¿Tienes esta carta físicamente?
                      </p>
                      <RadioGroup
                        value={eventCardModeOption}
                        onValueChange={(value) =>
                          setEventCardModeOption(value as "existing" | "alternate")
                        }
                        className="space-y-1"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="existing" id="event-mode-existing" />
                          <label
                            htmlFor="event-mode-existing"
                            className="text-xs font-medium leading-none"
                          >
                            Sí, usaré una carta existente
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="alternate" id="event-mode-alternate" />
                          <label
                            htmlFor="event-mode-alternate"
                            className="text-xs font-medium leading-none"
                          >
                            No, crearé una alterna con la imagen seleccionada
                          </label>
                        </div>
                      </RadioGroup>
                      {eventCardModeOption === "alternate" && (
                        <p className="text-[11px] text-muted-foreground">
                          Usaremos la imagen seleccionada para subirla a R2 y
                          generar una alterna basada en la carta elegida.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {approvalMode === "reassign" && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">
                    Cartas seleccionadas ({selectedCardList.length})
                  </p>
                  {selectedCardList.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Asigna cartas en la sección de imágenes para poder
                      reasignarlas a este nuevo set.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
                      {selectedCardList.map((card) => (
                        <div
                          key={card.id}
                          className="flex items-center gap-3 rounded-lg border p-2 text-sm"
                        >
                          <Checkbox
                            checked={selectedReassignCards.includes(card.id)}
                            onCheckedChange={(checked) =>
                              toggleReassignCard(card.id, checked === true)
                            }
                          />
                          <div>
                            <p className="font-semibold leading-tight">
                              {card.code}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {card.name}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {requiresClassification && !allImagesClassified && !missingSet.isApproved && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex gap-2 items-start">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-destructive">
                      Debes clasificar todas las imágenes antes de aprobar el
                      set.
                    </p>
                  </div>
                </div>
              )}

              {missingSet.events.length === 0 && (
                <div className="p-3 bg-muted border rounded-lg text-xs text-muted-foreground">
                  Este missing set no está vinculado a ningún evento.
                </div>
              )}

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
                    Aprobar Set
                  </>
                )}
              </Button>

              <Button
                className="w-full"
                size="lg"
                variant="destructive"
                onClick={handleDelete}
                disabled={isApproving}
              >
                <Trash2 className="mr-2 h-5 w-5" />
                Eliminar Set
              </Button>

              <div className="pt-4 border-t space-y-3">
                <div>
                  <p className="text-sm font-medium mb-2">
                    Progreso de clasificación
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Clasificadas
                      </span>
                      <span className="font-medium">
                        {
                          Object.values(imageClassifications).filter(
                            (c) => c && c.length > 0
                          ).length
                        }{" "}
                        / {missingSet.images.length}
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{
                          width: `${
                            missingSet.images.length > 0
                              ? (Object.values(imageClassifications).filter(
                                  (c) => c && c.length > 0
                                ).length /
                                  missingSet.images.length) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Resumen de clasificaciones */}
                {Object.values(imageClassifications).some(
                  (c) => c && c.length > 0
                ) && (
                  <div>
                    <p className="text-sm font-medium mb-2">Resumen</p>
                    <div className="space-y-1 flex flex-col text-xs">
                      {Object.entries(
                        Object.values(imageClassifications).reduce(
                          (acc, classification) => {
                            if (classification && classification.length > 0) {
                              acc[classification] =
                                (acc[classification] || 0) + 1;
                            }
                            return acc;
                          },
                          {} as Record<string, number>
                        )
                      ).map(([type, count]) => (
                        <div
                          key={type}
                          className="flex justify-between items-center"
                        >
                          <span className="text-muted-foreground">
                            {type === "CARD"
                              ? "Cards"
                              : type === "UNCUT_SHEET"
                              ? "Uncut Sheets"
                              : type === "PLAYMAT"
                              ? "Playmats"
                              : type === "SLEEVE"
                              ? "Sleeves"
                              : "Covers"}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {count}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>

    </>
  );
}
