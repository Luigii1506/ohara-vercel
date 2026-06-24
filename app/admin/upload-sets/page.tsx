"use client";

import React, {
  FormEvent,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import { scrapeAmazonProduct } from "@/lib/scraper";
import { CardData } from "@/types";
import Select from "react-select";
import {
  Upload,
  Search,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Package,
  FileUp,
  Database,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";

interface Set {
  id: number;
  title: string;
  description?: string;
  code: string;
  region?: string | null;
}

const UploadSets = () => {
  const router = useRouter();
  const { role, loading: userLoading } = useUser();

  const [searchUrl, setSearchUrl] = useState("");
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null);
  const [availableSets, setAvailableSets] = useState<Set[]>([]);
  const [isLoadingSets, setIsLoadingSets] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    total: number;
    current: number;
    percentage: number;
  }>({ total: 0, current: 0, percentage: 0 });

  const [uploadResults, setUploadResults] = useState<{
    success: number;
    failed: number;
    skipped: number;
    errors: string[];
  }>({ success: 0, failed: 0, skipped: 0, errors: [] });

  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");

  // --- Sección "Corregir imágenes de un set existente" ---
  const [fixSetId, setFixSetId] = useState<number | null>(null);
  const [fixUrl, setFixUrl] = useState("");
  const [fixStatus, setFixStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [fixMessage, setFixMessage] = useState("");
  const [fixForce, setFixForce] = useState(false);
  const [fixProgress, setFixProgress] = useState<{
    total: number;
    current: number;
    percentage: number;
  }>({ total: 0, current: 0, percentage: 0 });
  const [fixResult, setFixResult] = useState<{
    updated: number;
    skipped: number;
    failed: number;
    details: {
      code: string;
      status: "updated" | "skipped" | "failed";
      reason?: string;
    }[];
  } | null>(null);
  const parseUploadResponse = useCallback(async (response: Response) => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    const text = await response.text();
    return { error: text || "Upload failed" };
  }, []);

  const extractFilenameFromUrl = (url: string): string | null => {
    if (!url) return null;
    try {
      const pathname = new URL(url).pathname;
      const raw = pathname.split("/").pop();
      if (!raw) return null;
      return raw.replace(/\.[^.]+$/, "");
    } catch {
      const segments = url.split("/");
      const raw = segments.pop();
      if (!raw) return null;
      return raw.replace(/\.[^.]+$/, "");
    }
  };

  const sanitizeFilename = (value: string | null | undefined) => {
    const fallback = `CARD-${Date.now()}`;
    if (!value || !value.trim()) return fallback;
    return value
      .toUpperCase()
      .replace(/[^A-Z0-9-_]/g, "-")
      .replace(/-+/g, "-");
  };

  const uploadImageToR2 = useCallback(
    async (imageUrl: string, baseFilename: string) => {
      if (!imageUrl) return null;
      try {
        const response = await fetch("/api/upload-image-r2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageUrl,
            filename: baseFilename,
            overwrite: false,
          }),
        });
        const data = await parseUploadResponse(response);
        const alreadyExists = Boolean(data?.exists);
        if (!response.ok && !alreadyExists) {
          throw new Error(data?.error || "Failed to upload image to R2");
        }
        const resolvedUrl =
          data?.r2Url || data?.existingUrl || data?.url || null;
        const resolvedFilename =
          data?.filename || data?.existingFilename || baseFilename;
        if (alreadyExists && !resolvedUrl) {
          throw new Error("Image already exists but url was not provided");
        }
        return {
          r2Url: resolvedUrl ?? "",
          filename: resolvedFilename,
        };
      } catch (error) {
        console.error("Error uploading to R2:", error);
        return null;
      }
    },
    [parseUploadResponse]
  );

  // Check admin permissions
  useEffect(() => {
    if (!userLoading && role !== "ADMIN") {
      router.push("/unauthorized");
    }
  }, [role, userLoading, router]);

  // Fetch available sets
  useEffect(() => {
    const fetchSets = async () => {
      try {
        const res = await fetch("/api/admin/sets");
        if (res.ok) {
          const data = await res.json();

          console.log(data);
          setAvailableSets(data);
        }
      } catch (error) {
        console.error("Error fetching sets:", error);
      } finally {
        setIsLoadingSets(false);
      }
    };

    fetchSets();
  }, []);

  // Custom styles for react-select to match your design
  const customStyles = {
    control: (provided: any, state: any) => ({
      ...provided,
      minHeight: "48px",
      borderColor: state.isFocused ? "#a855f7" : "#d1d5db",
      borderWidth: "2px",
      borderRadius: "0.5rem",
      boxShadow: state.isFocused ? "0 0 0 1px #a855f7" : "none",
      "&:hover": {
        borderColor: state.isFocused ? "#a855f7" : "#9ca3af",
      },
    }),
    option: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? "#a855f7"
        : state.isFocused
        ? "#f3f4f6"
        : "white",
      color: state.isSelected ? "white" : "#111827",
      padding: "12px 16px",
      cursor: "pointer",
      "&:hover": {
        backgroundColor: state.isSelected ? "#a855f7" : "#f3f4f6",
      },
    }),
    menuList: (provided: any) => ({
      ...provided,
      maxHeight: "300px",
    }),
    placeholder: (provided: any) => ({
      ...provided,
      color: "#9ca3af",
    }),
    singleValue: (provided: any) => ({
      ...provided,
      color: "#111827",
    }),
    input: (provided: any) => ({
      ...provided,
      color: "#111827",
    }),
  };

  const selectedSet = useMemo(
    () => availableSets.find((set) => set.id === selectedSetId) ?? null,
    [availableSets, selectedSetId]
  );

  const createCard = async (
    card: CardData
  ): Promise<{ ok: boolean; skipped: boolean }> => {
    try {
      const derivedFilename =
        extractFilenameFromUrl(card.src) ||
        card.code ||
        (card.setCode ? `${card.setCode}-${card._id}` : card._id);
      const baseFilename = sanitizeFilename(derivedFilename);
      const uploadResult = await uploadImageToR2(card.src, baseFilename);
      const res = await fetch("/api/admin/cards", {
        method: "POST",
        headers: {
          "Content-type": "application/json",
        },
        body: JSON.stringify({
          src: uploadResult?.r2Url || card.src,
          name: card.name,
          types: card.types.map((type) => type.type),
          colors: card.colors.map((color) => color.color),
          cost: card.cost,
          power: card.power,
          attribute: card.attribute,
          counter: card.counter,
          category: card.category,
          life: card.life,
          rarity: card.rarity,
          setIds: selectedSetId ? [selectedSetId] : [200], // Use selected set ID
          illustrator: card.illustrator,
          alternateArt: card.alternateArt,
          status: card.status,
          triggerCard: card.triggerCard,
          effects: (card.effects ?? []).map((effect) => effect.effect),
          texts: (card.texts ?? []).map((text) => text.text),
          conditions: (card.conditions ?? []).map((text) => text.condition),
          code: card._id,
          setCode: card.setCode,
          isFirstEdition: card.isFirstEdition,
          // Regla del Bulk Upload: toda carta nueva/alterna creada aquí es US.
          // Esto fuerza que (1) la base a la que se liga una alterna se busque
          // con region="US" (nunca una JP/CN), y (2) la carta nueva quede US.
          // Las otras regiones (JP/CN/KR/FR) se cargan con los scripts scrape-*.
          region: "US",
          alias: "",
          // Idempotencia: si la carta ya existe, el backend la omite
          // (no crea duplicado) y solo la vincula al set si faltara.
          skipIfExists: true,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: true, skipped: Boolean(data?.skipped) };
      } else {
        const error = await res.text();
        throw new Error(error || "Failed to create card");
      }
    } catch (error) {
      console.error("Error creating card:", error);
      return { ok: false, skipped: false };
    }
  };

  const processInBatches = async (cards: CardData[], batchSize = 5) => {
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (card) => {
          const result = await createCard(card);
          if (!result.ok) {
            results.errors.push(`Failed to upload: ${card.name} (${card._id})`);
          }
          return result;
        })
      );

      results.success += batchResults.filter((r) => r.ok).length;
      results.failed += batchResults.filter((r) => !r.ok).length;
      results.skipped += batchResults.filter((r) => r.ok && r.skipped).length;

      // Update progress
      setUploadProgress({
        total: cards.length,
        current: Math.min(i + batchSize, cards.length),
        percentage: Math.round(
          (Math.min(i + batchSize, cards.length) / cards.length) * 100
        ),
      });
    }

    return results;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!searchUrl.trim()) {
      setStatusMessage("Please enter a URL");
      setUploadStatus("error");
      return;
    }

    if (!selectedSetId) {
      setStatusMessage("Please select a set for the cards");
      setUploadStatus("error");
      return;
    }

    // Get the selected set's code
    if (!selectedSet) {
      setStatusMessage("Selected set not found");
      setUploadStatus("error");
      return;
    }

    try {
      setIsLoading(true);
      setUploadStatus("loading");
      setStatusMessage("Fetching cards from source...");
      setUploadResults({ success: 0, failed: 0, skipped: 0, errors: [] });
      setUploadProgress({ total: 0, current: 0, percentage: 0 });

      // Scrape cards from the URL
      const allCards = await scrapeAmazonProduct(searchUrl, selectedSet.code);

      if (!allCards || allCards.length === 0) {
        throw new Error("No cards found at the provided URL");
      }

      setStatusMessage(`Found ${allCards.length} cards. Starting upload...`);

      // Process cards in batches
      const results = await processInBatches(allCards, 5);
      setUploadResults(results);

      const created = results.success - results.skipped;
      if (results.failed === 0) {
        setUploadStatus("success");
        setStatusMessage(
          `Listo: ${created} nuevas creadas, ${results.skipped} ya existían (omitidas).`
        );
      } else if (results.success === 0) {
        setUploadStatus("error");
        setStatusMessage(
          "No se pudo subir ninguna carta. Revisa los errores."
        );
      } else {
        setUploadStatus("success");
        setStatusMessage(
          `${created} nuevas creadas, ${results.skipped} omitidas, ${results.failed} con error.`
        );
      }
    } catch (err) {
      console.error("Upload error:", err);
      setUploadStatus("error");
      setStatusMessage(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSearchUrl("");
    setSelectedSetId(null);
    setUploadStatus("idle");
    setStatusMessage("");
    setUploadResults({ success: 0, failed: 0, skipped: 0, errors: [] });
    setUploadProgress({ total: 0, current: 0, percentage: 0 });
  };

  const handleFixImages = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!fixUrl.trim() || !fixSetId) {
      setFixStatus("error");
      setFixMessage("Selecciona un set e ingresa la URL de Limitless");
      return;
    }

    try {
      setFixStatus("loading");
      setFixMessage("Analizando el set y emparejando cartas con Limitless...");
      setFixResult(null);
      setFixProgress({ total: 0, current: 0, percentage: 0 });

      // 1) Plan: scrape + match (sin escribir nada).
      const planRes = await fetch("/api/admin/fix-set-images/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Decisión: corregir solo la región US (base + alternas).
        body: JSON.stringify({
          url: fixUrl.trim(),
          setId: fixSetId,
          region: "US",
        }),
      });
      const plan = await planRes.json();
      if (!planRes.ok) {
        throw new Error(plan?.error || "No se pudo planificar la corrección");
      }

      const allItems: {
        code: string;
        alternateArt: string | null;
        cardId: number;
        limitlessSrc: string;
        alreadyVersioned: boolean;
      }[] = plan.items ?? [];

      // 2) Por defecto omitimos las ya corregidas (src versionado).
      const toProcess = fixForce
        ? allItems
        : allItems.filter((i) => !i.alreadyVersioned);
      const skippedAlready = allItems.length - toProcess.length;
      const noMatchCount = (plan.noMatch ?? []).length;

      if (toProcess.length === 0) {
        setFixStatus("success");
        setFixMessage(
          `No hay nada que corregir: ${skippedAlready} ya estaban corregidas, ` +
            `${noMatchCount} sin coincidencia en el set.`
        );
        setFixResult({
          updated: 0,
          skipped: skippedAlready + noMatchCount,
          failed: 0,
          details: (plan.noMatch ?? []).map((code: string) => ({
            code,
            status: "skipped" as const,
            reason: "Sin coincidencia en el set (US)",
          })),
        });
        return;
      }

      // 3) Procesar por lotes mostrando progreso. Una versión por corrida.
      const version = Date.now();
      const batchSize = 5;
      const details: {
        code: string;
        status: "updated" | "skipped" | "failed";
        reason?: string;
      }[] = (plan.noMatch ?? []).map((code: string) => ({
        code,
        status: "skipped" as const,
        reason: "Sin coincidencia en el set (US)",
      }));
      let updated = 0;
      let failed = 0;

      setFixProgress({ total: toProcess.length, current: 0, percentage: 0 });
      setFixMessage(
        `Corrigiendo ${toProcess.length} cartas (omitidas ${skippedAlready} ya corregidas, ${noMatchCount} sin match)...`
      );

      for (let i = 0; i < toProcess.length; i += batchSize) {
        const batch = toProcess.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (item) => {
            const label = item.alternateArt
              ? `${item.code} (${item.alternateArt})`
              : item.code;
            try {
              const res = await fetch("/api/admin/fix-set-images/apply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  cardId: item.cardId,
                  code: item.code,
                  limitlessSrc: item.limitlessSrc,
                  version,
                }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data?.error || "apply falló");
              updated++;
              details.push({ code: label, status: "updated" });
            } catch (err) {
              failed++;
              details.push({
                code: label,
                status: "failed",
                reason: err instanceof Error ? err.message : "Error",
              });
            }
          })
        );

        const current = Math.min(i + batchSize, toProcess.length);
        setFixProgress({
          total: toProcess.length,
          current,
          percentage: Math.round((current / toProcess.length) * 100),
        });
      }

      setFixResult({
        updated,
        skipped: skippedAlready + noMatchCount,
        failed,
        details,
      });
      setFixStatus(failed > 0 ? "error" : "success");
      setFixMessage(
        `Listo: ${updated} actualizadas, ${skippedAlready} ya estaban corregidas, ` +
          `${noMatchCount} sin match, ${failed} con error.`
      );
    } catch (err) {
      setFixStatus("error");
      setFixMessage(
        err instanceof Error ? err.message : "Ocurrió un error inesperado"
      );
    }
  };

  if (userLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto bg-gradient-to-b from-[#f2eede] to-[#e6d5b8] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-purple-500 rounded-xl shadow-lg">
              <Upload size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Bulk Upload Sets
              </h1>
              <p className="text-gray-600">
                Import multiple cards from external sources
              </p>
            </div>
          </div>
        </div>

        {/* Main Upload Form */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Set Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Set
              </label>
              <Select
                options={availableSets.map((set) => ({
                  value: set.id,
                  label: set.title,
                }))}
                value={
                  selectedSetId
                    ? {
                        value: selectedSetId,
                        label: availableSets.find((s) => s.id === selectedSetId)
                          ?.title,
                      }
                    : null
                }
                onChange={(option) => setSelectedSetId(option?.value || null)}
                placeholder="Search and select a set..."
                isClearable
                isSearchable
                isDisabled={isLoading || isLoadingSets}
                isLoading={isLoadingSets}
                loadingMessage={() => "Loading sets..."}
                noOptionsMessage={() => "No sets found"}
                styles={customStyles}
                theme={(theme) => ({
                  ...theme,
                  colors: {
                    ...theme.colors,
                    primary: "#a855f7",
                    primary75: "#c084fc",
                    primary50: "#e9d5ff",
                    primary25: "#f3e8ff",
                  },
                })}
              />
              <p className="mt-1 text-xs text-gray-500">
                Choose which set these cards will be added to
              </p>
            </div>

            {/* URL Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source URL
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Enter the URL containing card data"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  value={searchUrl}
                  onChange={(e) => setSearchUrl(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Enter the URL of a page containing card information to import
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isLoading || !searchUrl.trim() || !selectedSetId}
                className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Processing...
                  </>
                ) : (
                  <>
                    <FileUp size={20} />
                    Start Upload
                  </>
                )}
              </button>

              {uploadStatus !== "idle" && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </form>

          {/* Progress Bar */}
          {isLoading && uploadProgress.total > 0 && (
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Uploading cards...</span>
                <span>
                  {uploadProgress.current} / {uploadProgress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress.percentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Uploading to:{" "}
                {
                  availableSets.find((s) => s.id === Number(selectedSetId))
                    ?.title
                }
              </p>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`mt-6 p-4 rounded-lg flex items-start gap-3 ${
                uploadStatus === "success"
                  ? "bg-green-50 text-green-800"
                  : uploadStatus === "error"
                  ? "bg-red-50 text-red-800"
                  : "bg-blue-50 text-blue-800"
              }`}
            >
              {uploadStatus === "success" ? (
                <CheckCircle2 size={20} />
              ) : uploadStatus === "error" ? (
                <AlertCircle size={20} />
              ) : (
                <Loader2 size={20} className="animate-spin" />
              )}
              <div className="flex-1">
                <p className="font-medium">{statusMessage}</p>
                {uploadResults.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-sm cursor-pointer hover:underline">
                      View errors ({uploadResults.errors.length})
                    </summary>
                    <ul className="mt-2 text-sm space-y-1">
                      {uploadResults.errors.map((error, index) => (
                        <li key={index} className="text-red-600">
                          • {error}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ====== Corregir imágenes de un set existente ====== */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-2 border-purple-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Search size={20} className="text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">
              Corregir imágenes de un set existente
            </h2>
          </div>
          <p className="text-sm text-gray-600 mb-5">
            Reemplaza <strong>solo la imagen (src)</strong> de las cartas base ya
            creadas, con las imágenes correctas de una URL de Limitless. El resto
            de los datos de la carta no se modifica.
          </p>

          <form onSubmit={handleFixImages} className="space-y-5">
            {/* Set selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Set a corregir
              </label>
              <Select
                options={availableSets.map((set) => ({
                  value: set.id,
                  label: set.title,
                }))}
                value={
                  fixSetId
                    ? {
                        value: fixSetId,
                        label: availableSets.find((s) => s.id === fixSetId)
                          ?.title,
                      }
                    : null
                }
                onChange={(option) => setFixSetId(option?.value || null)}
                placeholder="Busca y selecciona el set..."
                isClearable
                isSearchable
                isDisabled={fixStatus === "loading" || isLoadingSets}
                isLoading={isLoadingSets}
                styles={customStyles}
                theme={(theme) => ({
                  ...theme,
                  colors: {
                    ...theme.colors,
                    primary: "#a855f7",
                    primary75: "#c084fc",
                    primary50: "#e9d5ff",
                    primary25: "#f3e8ff",
                  },
                })}
              />
            </div>

            {/* URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL de Limitless
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="https://onepiece.limitlesstcg.com/cards/eb03-...?display=full"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  value={fixUrl}
                  onChange={(e) => setFixUrl(e.target.value)}
                  disabled={fixStatus === "loading"}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={fixForce}
                onChange={(e) => setFixForce(e.target.checked)}
                disabled={fixStatus === "loading"}
                className="w-4 h-4 accent-purple-600"
              />
              Reprocesar también las que ya fueron corregidas (por defecto se
              omiten)
            </label>

            <button
              type="submit"
              disabled={
                fixStatus === "loading" || !fixUrl.trim() || !fixSetId
              }
              className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {fixStatus === "loading" ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Corrigiendo imágenes...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Corregir imágenes
                </>
              )}
            </button>
          </form>

          {fixStatus === "loading" && fixProgress.total > 0 && (
            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Corrigiendo imágenes...</span>
                <span>
                  {fixProgress.current} / {fixProgress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${fixProgress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {fixMessage && (
            <div
              className={`mt-5 p-4 rounded-lg flex items-start gap-3 ${
                fixStatus === "success"
                  ? "bg-green-50 text-green-800"
                  : fixStatus === "error"
                  ? "bg-red-50 text-red-800"
                  : "bg-blue-50 text-blue-800"
              }`}
            >
              {fixStatus === "success" ? (
                <CheckCircle2 size={20} />
              ) : fixStatus === "error" ? (
                <AlertCircle size={20} />
              ) : (
                <Loader2 size={20} className="animate-spin" />
              )}
              <div className="flex-1">
                <p className="font-medium">{fixMessage}</p>
                {fixResult && fixResult.details.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-sm cursor-pointer hover:underline">
                      Ver detalle ({fixResult.details.length})
                    </summary>
                    <ul className="mt-2 text-sm space-y-1 max-h-64 overflow-auto">
                      {fixResult.details.map((d, i) => (
                        <li
                          key={i}
                          className={
                            d.status === "updated"
                              ? "text-green-700"
                              : d.status === "skipped"
                              ? "text-yellow-700"
                              : "text-red-600"
                          }
                        >
                          • {d.code} — {d.status}
                          {d.reason ? `: ${d.reason}` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Upload Statistics */}
        {uploadStatus === "success" && uploadResults.success > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Database size={20} />
              Upload Summary
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">
                  {uploadResults.success - uploadResults.skipped}
                </p>
                <p className="text-sm text-gray-600 mt-1">Nuevas creadas</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-3xl font-bold text-yellow-600">
                  {uploadResults.skipped}
                </p>
                <p className="text-sm text-gray-600 mt-1">Ya existían</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-3xl font-bold text-red-600">
                  {uploadResults.failed}
                </p>
                <p className="text-sm text-gray-600 mt-1">Con error</p>
              </div>
            </div>
            {selectedSetId && (
              <p className="text-sm text-gray-600 mt-4 text-center">
                Added to:{" "}
                <span className="font-medium">
                  {
                    availableSets.find((s) => s.id === Number(selectedSetId))
                      ?.title
                  }
                </span>
              </p>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex gap-3">
            <AlertTriangle
              className="text-yellow-600 flex-shrink-0"
              size={20}
            />
            <div className="space-y-2 text-sm text-gray-700">
              <p className="font-medium text-gray-800">Important Notes:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Select the target set before starting the upload</li>
                <li>
                  Ensure the URL contains valid card data in the expected format
                </li>
                <li>Large uploads may take several minutes to complete</li>
                <li>Cards are uploaded in batches to prevent timeouts</li>
                <li>
                  Las cartas que ya existen se omiten automáticamente (no se
                  duplican). Puedes correr el scraper las veces que necesites de
                  forma segura; solo se crean las que faltan.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadSets;
