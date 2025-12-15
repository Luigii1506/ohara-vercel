"use client";

import { ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Play,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Globe,
} from "lucide-react";
import {
  HoverImagePreviewOverlay,
  useHoverImagePreview,
} from "@/components/HoverImagePreview";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English / Global" },
  { value: "fr", label: "French / EU" },
  { value: "jp", label: "Japanese" },
  { value: "asia", label: "Asia (EN)" },
  { value: "cn", label: "Chinese (Simplified)" },
];

const RENDER_MODE_OPTIONS = [
  { value: "static", label: "Static (default)" },
  { value: "auto", label: "Auto detect" },
  { value: "force", label: "Force headless" },
];

const SOURCE_SCOPE_OPTIONS = [
  { value: "both", label: "Current + Past" },
  { value: "current", label: "Only Current" },
  { value: "past", label: "Only Past" },
];

const EVENT_REGION_OPTIONS = [
  { value: "auto", label: "Auto detect region" },
  { value: "NA", label: "North America" },
  { value: "EU", label: "Europe" },
  { value: "LA", label: "Latin America" },
  { value: "ASIA", label: "Asia" },
  { value: "JP", label: "Japan" },
];

type ScraperRunResult = {
  success: boolean;
  durationMs: number;
  eventsProcessed: number;
  setsLinked: number;
  errors: string[];
  events: Array<{
    slug: string;
    title: string;
    locale?: string | null;
    status: string;
    region: string;
    eventType: string;
    category?: string | null;
    sourceUrl: string;
    startDate?: string | null;
    endDate?: string | null;
    rawDateText?: string | null;
    eventTxt?: string | null;
    location?: string | null;
    eventThumbnail?: string | null;
    imageUrl?: string | null;
    listOrder?: number | null;
    sets: Array<{
      id: number;
      title: string;
      match: string;
      images: string[];
      cards: Array<{
        id: number;
        title: string;
        code: string | null;
        image: string | null;
      }>;
    }>;
    missingSets?: Array<{
      title: string;
      versionSignature: string | null;
      translatedTitle?: string;
      images: string[];
    }>;
    cards?: Array<{
      title: string;
      code: string;
      image?: string | null;
    }>;
  }>;
  error?: string;
};

const defaultFormState = {
  languages: ["en"] as string[],
  sourceScope: "both" as "both" | "current" | "past",
  maxEvents: "25",
  perSourceLimit: "25",
  renderMode: "static",
  renderWaitMs: "2000",
  delayMs: "1000",
  customUrls: "",
};

const defaultDetailForm = {
  url: "",
  locale: "en",
  region: "auto",
  renderMode: "static",
  renderWaitMs: "2000",
};

type EventDetailTestResult = {
  success: boolean;
  event?: {
    title: string;
    locale: string;
    region: string;
    status: string;
    eventType: string;
    category?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    sourceUrl: string;
    rawDateText?: string | null;
    eventTxt?: string | null;
    eventThumbnail?: string | null;
    imageUrl?: string | null;
    listOrder?: number | null;
    location?: string | null;
    detectedSets: Array<{
      title: string;
      versionSignature: string | null;
      translatedTitle?: string;
    }>;
    detectedCards: Array<{
      title: string;
      code: string;
    }>;
  };
  matchedSets?: Array<{
    id: number;
    title: string;
    matchedText: string;
    images?: string[];
    cards?: Array<{
      id: number;
      title: string;
      code: string | null;
      image: string | null;
    }>;
  }>;
  missingSets?: Array<{
    title: string;
    versionSignature: string | null;
    translatedTitle?: string;
    images: string[];
  }>;
  missingCards?: Array<{
    title: string;
    code: string;
    image?: string | null;
  }>;
  error?: string;
};

const AdminEventScraperPage = () => {
  const [formState, setFormState] = useState(defaultFormState);
  const [result, setResult] = useState<ScraperRunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailForm, setDetailForm] = useState(defaultDetailForm);
  const [detailResult, setDetailResult] =
    useState<EventDetailTestResult | null>(null);
  const [isDetailRunning, setIsDetailRunning] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailSetMediaOpen, setDetailSetMediaOpen] = useState<
    Record<string, boolean>
  >({});
  const [bulkSetMediaOpen, setBulkSetMediaOpen] = useState<
    Record<string, boolean>
  >({});
  const [detailCollectionsOpen, setDetailCollectionsOpen] = useState(true);
  const [bulkCollectionsOpen, setBulkCollectionsOpen] = useState<
    Record<string, boolean>
  >({});
  const {
    preview: imagePreview,
    showPreview: handlePreviewEnter,
    hidePreview: handlePreviewLeave,
  } = useHoverImagePreview();

  const formatHost = (url?: string) => {
    if (!url) return null;
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  };

  const previewImages = detailResult?.event
    ? [detailResult.event.eventThumbnail, detailResult.event.imageUrl].filter(
        (value): value is string => Boolean(value)
      )
    : [];

  const matchedSets = detailResult?.matchedSets ?? [];
  const missingSets = detailResult?.missingSets ?? [];
  const missingCards = detailResult?.missingCards ?? [];

  const InfoBlock = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );

  const toggleDetailSetMedia = (key: string) => {
    setDetailSetMediaOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleBulkSetMedia = (key: string) => {
    setBulkSetMediaOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleBulkCollections = (key: string) => {
    setBulkCollectionsOpen((prev) => {
      const current = prev[key];
      const next = current === undefined ? false : !current;
      return { ...prev, [key]: next };
    });
  };

  const toggleLanguage = (value: string) => {
    setFormState((prev) => {
      const set = new Set(prev.languages);
      if (set.has(value)) {
        set.delete(value);
      } else {
        set.add(value);
      }
      const next = Array.from(set);
      return {
        ...prev,
        languages: next.length > 0 ? next : [value],
      };
    });
  };

  const customUrlsArray = useMemo(() => {
    return formState.customUrls
      .split(/\n|,/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [formState.customUrls]);

  const runScraper = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const includeCurrent = formState.sourceScope !== "past";
      const includePast = formState.sourceScope !== "current";

      const payload = {
        languages: formState.languages,
        includeCurrent,
        includePast,
        maxEvents: Number(formState.maxEvents) || undefined,
        perSourceLimit: Number(formState.perSourceLimit) || undefined,
        renderMode: formState.renderMode as "static" | "auto" | "force",
        renderWaitMs: Number(formState.renderWaitMs) || undefined,
        delayMs: Number(formState.delayMs) || undefined,
        customUrls: customUrlsArray,
        dryRun: true,
      };

      const response = await fetch("/api/admin/event-scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to run scraper");
      }

      const data = (await response.json()) as ScraperRunResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsRunning(false);
    }
  };

  const resetForm = () => {
    setFormState(defaultFormState);
  };

  const runDetailScraper = async () => {
    if (!detailForm.url.trim()) {
      setDetailError("Provide an event URL to test.");
      return;
    }
    setIsDetailRunning(true);
    setDetailError(null);
    setDetailResult(null);

    try {
      const payload = {
        eventUrl: detailForm.url.trim(),
        locale: detailForm.locale || "en",
        region:
          detailForm.region && detailForm.region !== "auto"
            ? detailForm.region
            : undefined,
        renderMode: detailForm.renderMode as "static" | "auto" | "force",
        renderWaitMs: Number(detailForm.renderWaitMs) || undefined,
      };

      const response = await fetch("/api/admin/event-scraper/detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to scrape event detail");
      }

      const data = (await response.json()) as EventDetailTestResult;
      if (!data.success) {
        throw new Error(data.error || "Event scrape failed");
      }
      setDetailResult(data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsDetailRunning(false);
    }
  };

  const resetDetailForm = () => {
    setDetailForm(defaultDetailForm);
    setDetailResult(null);
    setDetailError(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
            Tools
          </p>
          <h1 className="text-3xl font-bold">Event Scraper Lab</h1>
          <p className="text-muted-foreground">
            Run dry-run scrapes with custom parameters to inspect the raw output
            without persisting data.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetForm} disabled={isRunning}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button onClick={runScraper} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run dry-run
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="mb-3 text-sm font-medium uppercase text-muted-foreground">
              Languages
            </p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((lang) => {
                const active = formState.languages.includes(lang.value);
                return (
                  <Button
                    key={lang.value}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleLanguage(lang.value)}
                  >
                    <Globe className="mr-2 h-4 w-4" />
                    {lang.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Source scope
            </p>
            <Select
              value={formState.sourceScope}
              onValueChange={(value: "both" | "current" | "past") =>
                setFormState((prev) => ({ ...prev, sourceScope: value }))
              }
            >
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue placeholder="Select source scope" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_SCOPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              Choose whether to scrape the live event list, the historic list,
              or both at the same time. Past feeds (list_end.php) can contain
              hundreds of entries.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Max events
              </label>
              <Input
                type="number"
                min="0"
                value={formState.maxEvents}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    maxEvents: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Limits the total number of events processed across all feeds.
                Leave blank or use 0 to rely on the scraper defaults.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Per-source limit
              </label>
              <Input
                type="number"
                min="0"
                value={formState.perSourceLimit}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    perSourceLimit: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Number of entries consumed from each list feed before moving on.
                Helpful to isolate just the top of a list.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Render mode
              </label>
              <div className="flex flex-wrap gap-2">
                {RENDER_MODE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={
                      formState.renderMode === option.value
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    onClick={() =>
                      setFormState((prev) => ({
                        ...prev,
                        renderMode: option.value,
                      }))
                    }
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Static = plain HTTP requests. Auto enables the headless browser
                only on known dynamic pages. Force renders everything.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Render wait (ms)
              </label>
              <Input
                type="number"
                min="0"
                value={formState.renderWaitMs}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    renderWaitMs: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Delay after the page finishes loading before we read the DOM
                when render mode is auto/force.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Delay between requests (ms)
              </label>
              <Input
                type="number"
                min="0"
                value={formState.delayMs}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    delayMs: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Adds a pause between list/detail fetches to mimic a real user
                and avoid hitting rate limits.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Custom URLs (optional)
            </label>
            <Textarea
              rows={3}
              placeholder="https://example.com/events/abc&#10;https://example.com/events/xyz"
              value={formState.customUrls}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  customUrls: event.target.value,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Inject extra list endpoints or direct event pages into this run.
              Each line (or comma) is treated as a separate source.
            </p>
            {customUrlsArray.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {customUrlsArray.length} custom{" "}
                {customUrlsArray.length === 1 ? "URL" : "URLs"} ready to test.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Single Event Tester</CardTitle>
          <p className="text-sm text-muted-foreground">
            Provide a direct event URL to run the detail parser in isolation.
            Useful to debug HTML tweaks or translation issues without touching
            the listings.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Event URL
              </label>
              <Input
                placeholder="https://en.onepiece-cardgame.com/events/..."
                value={detailForm.url}
                onChange={(event) =>
                  setDetailForm((prev) => ({
                    ...prev,
                    url: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Paste any full event detail URL (from any supported locale).
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Locale
              </label>
              <Select
                value={detailForm.locale}
                onValueChange={(value) =>
                  setDetailForm((prev) => ({ ...prev, locale: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Locale" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Region override
              </label>
              <Select
                value={detailForm.region}
                onValueChange={(value) =>
                  setDetailForm((prev) => ({ ...prev, region: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auto detect region" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_REGION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Render mode
              </label>
              <Select
                value={detailForm.renderMode}
                onValueChange={(value: "static" | "auto" | "force") =>
                  setDetailForm((prev) => ({ ...prev, renderMode: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Render mode" />
                </SelectTrigger>
                <SelectContent>
                  {RENDER_MODE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Render wait (ms)
              </label>
              <Input
                type="number"
                min="0"
                value={detailForm.renderWaitMs}
                onChange={(event) =>
                  setDetailForm((prev) => ({
                    ...prev,
                    renderWaitMs: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              variant="outline"
              onClick={resetDetailForm}
              disabled={isDetailRunning}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset tester
            </Button>
            <Button
              onClick={runDetailScraper}
              disabled={isDetailRunning}
              className="w-full sm:w-auto"
            >
              {isDetailRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fetching…
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run event detail
                </>
              )}
            </Button>
          </div>

          {detailError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {detailError}
            </div>
          )}

          {detailResult?.event && (
            <div className="space-y-4 rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold">
                  {detailResult.event.title}
                </p>
                <Badge
                  variant={
                    detailResult.event.status === "UPCOMING"
                      ? "default"
                      : "secondary"
                  }
                >
                  {detailResult.event.status}
                </Badge>
                <Badge variant="outline">{detailResult.event.region}</Badge>
                <Badge variant="outline">
                  Locale: {detailResult.event.locale}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {detailResult.event.eventType}
                {detailResult.event.category
                  ? ` · ${detailResult.event.category}`
                  : ""}{" "}
                {formatHost(detailResult.event.sourceUrl)
                  ? `· ${formatHost(detailResult.event.sourceUrl)}`
                  : ""}
              </p>
              {detailResult.event.sourceUrl && (
                <a
                  href={detailResult.event.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-primary underline"
                >
                  View source
                </a>
              )}

              <div className="flex gap-5 justify-center items-center">
                {previewImages.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {previewImages.map((src, index) => (
                      <img
                        key={`${src}-${index}`}
                        src={src}
                        alt={`Event visual ${index + 1}`}
                        className="h-40 w-40 rounded-lg border object-cover"
                        onMouseEnter={() =>
                          handlePreviewEnter(src, `Event visual ${index + 1}`)
                        }
                        onMouseLeave={handlePreviewLeave}
                      />
                    ))}
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-3 flex-1">
                  <InfoBlock
                    label="Start date"
                    value={formatDate(detailResult.event.startDate)}
                  />
                  <InfoBlock
                    label="End date"
                    value={formatDate(detailResult.event.endDate)}
                  />
                  <InfoBlock
                    label="Raw date text"
                    value={detailResult.event.rawDateText || "—"}
                  />
                  <InfoBlock
                    label="Event text (list)"
                    value={detailResult.event.eventTxt || "—"}
                  />
                  <InfoBlock
                    label="Location"
                    value={detailResult.event.location || "—"}
                  />
                  <InfoBlock
                    label="List order"
                    value={
                      typeof detailResult.event.listOrder === "number"
                        ? `#${detailResult.event.listOrder}`
                        : "—"
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Collections & matches</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDetailCollectionsOpen((prev) => !prev)}
                >
                  {detailCollectionsOpen ? "Collapse" : "Expand"}
                </Button>
              </div>

              {detailCollectionsOpen && (
                <>
                  <div>
                    <p className="text-sm font-semibold">
                      Matched sets ({matchedSets.length})
                    </p>
                    {matchedSets.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No catalog sets matched this event yet.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-3">
                        {matchedSets.map((set) => {
                          const detailKey = `detail-${set.id}`;
                          const isMediaOpen = detailSetMediaOpen[detailKey];
                          return (
                            <div
                              key={set.id}
                              className="space-y-3 rounded-lg border bg-muted/20 p-3"
                            >
                              <div className="flex flex-col">
                                <p className="font-semibold">{set.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Matched text:{" "}
                                  <span className="font-mono text-black font-bold">
                                    {set.matchedText}
                                  </span>
                                </p>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Assets
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    toggleDetailSetMedia(detailKey)
                                  }
                                >
                                  {isMediaOpen ? "Hide media" : "Show media"}
                                </Button>
                              </div>
                              {isMediaOpen && (
                                <>
                                  {set.images && set.images.length > 0 && (
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                      {set.images
                                        .slice(0, 4)
                                        .map((img: string, index: number) => (
                                          <img
                                            key={`${set.id}-img-${index}`}
                                            src={img}
                                            alt={`${set.title} image ${
                                              index + 1
                                            }`}
                                            className="h-28 w-full rounded-lg border bg-white object-contain p-1"
                                            onMouseEnter={() =>
                                              handlePreviewEnter(
                                                img,
                                                `${set.title} image ${
                                                  index + 1
                                                }`
                                              )
                                            }
                                            onMouseLeave={handlePreviewLeave}
                                          />
                                        ))}
                                    </div>
                                  )}
                                  {set.cards && set.cards.length > 0 && (
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                      {set.cards.slice(0, 8).map((card) => (
                                        <div
                                          key={`${set.id}-card-${card.id}`}
                                          className="flex flex-col items-center gap-2 rounded-lg border bg-background p-2 text-center"
                                        >
                                          {card.image ? (
                                            <img
                                              src={card.image}
                                              alt={card.title}
                                              className="h-48 w-full rounded bg-white object-contain p-1"
                                              onMouseEnter={() =>
                                                handlePreviewEnter(
                                                  card.image,
                                                  `${card.title} (${
                                                    card.code || "No code"
                                                  })`
                                                )
                                              }
                                              onMouseLeave={handlePreviewLeave}
                                            />
                                          ) : (
                                            <div className="flex h-48 w-full items-center justify-center rounded border text-xs text-muted-foreground">
                                              No image
                                            </div>
                                          )}
                                          <div className="text-[11px] text-muted-foreground">
                                            <p className="font-semibold text-foreground">
                                              {card.code || "No code"}
                                            </p>
                                            <p className="line-clamp-2">
                                              {card.title}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-semibold">
                      Missing sets ({missingSets.length})
                    </p>
                    {missingSets.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No unmatched set references detected.
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-col gap-2">
                        {missingSets.map((set, index) => (
                          <div
                            key={`${set.title}-${index}`}
                            className="space-y-2 rounded-lg border p-3"
                          >
                            <p className="font-semibold">{set.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {set.versionSignature || "No signature"}{" "}
                              {set.translatedTitle
                                ? `→ ${set.translatedTitle}`
                                : ""}
                            </p>
                            {set.images && set.images.length > 0 && (
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {set.images
                                  .slice(0, 4)
                                  .map((img: string, imgIndex: number) => (
                                    <img
                                      key={`${img}-${imgIndex}`}
                                      src={img}
                                      alt={`${set.title} preview ${
                                        imgIndex + 1
                                      }`}
                                      className="h-56 w-full rounded-lg border bg-white object-contain p-1"
                                      onMouseEnter={() =>
                                        handlePreviewEnter(
                                          img,
                                          `${set.title} preview ${imgIndex + 1}`
                                        )
                                      }
                                      onMouseLeave={handlePreviewLeave}
                                    />
                                  ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-semibold">
                      Missing cards ({missingCards.length})
                    </p>
                    {missingCards.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No unmatched card references detected.
                      </p>
                    ) : (
                      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        {missingCards.map((card, index) => (
                          <div
                            key={`${card.code}-card-${index}`}
                            className="flex items-center gap-3 rounded border bg-muted/20 p-3 flex-col"
                          >
                            {card.image ? (
                              <img
                                src={card.image}
                                alt={card.title}
                                onMouseEnter={() =>
                                  handlePreviewEnter(
                                    card.image,
                                    `${card.title} (${card.code || "No code"})`
                                  )
                                }
                                onMouseLeave={handlePreviewLeave}
                                className="rounded bg-white object-contain p-1"
                              />
                            ) : (
                              <div className="flex h-40 w-28 items-center justify-center rounded border text-xs text-muted-foreground">
                                No image
                              </div>
                            )}
                            <div className="flex flex-col w-full fle-1">
                              <p className="font-medium text-center">
                                {card.title}
                              </p>
                              <p className="text-medium text-muted-foreground text-center">
                                {card.code || "No code"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Dry-run results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Duration
                </p>
                <p className="text-2xl font-bold">
                  {(result.durationMs / 1000).toFixed(2)}s
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Events processed
                </p>
                <p className="text-2xl font-bold">{result.eventsProcessed}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Sets linked
                </p>
                <p className="text-2xl font-bold">{result.setsLinked}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Errors
                </p>
                <p className="text-2xl font-bold text-red-500">
                  {result.errors.length}
                </p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div>
                <p className="text-sm font-semibold">Warnings</p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {result.errors.map((warn, index) => (
                    <li key={index}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm font-semibold">
                Events ({result.events.length})
              </p>
              {result.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No events returned for the current configuration.
                </p>
              ) : (
                <div className="space-y-4">
                  {result.events.map((event) => {
                    const eventImage =
                      event.eventThumbnail || event.imageUrl || null;
                    const matchedSets = event.sets || [];
                    const missingSets = event.missingSets || [];
                    const missingCards = event.cards || [];
                    const isCollectionsOpen =
                      bulkCollectionsOpen[event.slug] ?? true;

                    return (
                      <div
                        key={event.slug}
                        className="space-y-4 rounded-xl border p-4 transition hover:bg-muted/30"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold">
                            {event.title}
                          </p>
                          <Badge
                            variant={
                              event.status === "UPCOMING"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {event.status}
                          </Badge>
                          <Badge variant="outline">{event.region}</Badge>
                          {event.locale && (
                            <Badge variant="outline">
                              Locale: {event.locale}
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <p className="text-xs text-muted-foreground">
                            {event.eventType}
                            {event.category ? ` · ${event.category}` : ""} ·
                            {formatHost(event.sourceUrl)
                              ? ` ${formatHost(event.sourceUrl)}`
                              : ` ${event.slug}`}
                          </p>
                          {event.sourceUrl && (
                            <a
                              href={event.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold text-primary underline"
                            >
                              View source
                            </a>
                          )}
                        </div>

                        <div className="flex gap-5 justify-center items-center">
                          {eventImage && (
                            <div className="flex flex-wrap gap-3">
                              <img
                                src={eventImage}
                                alt={`${event.title} visual`}
                                className="h-40 w-40 rounded-lg border object-cover"
                                onMouseEnter={() =>
                                  handlePreviewEnter(
                                    eventImage,
                                    `${event.title} visual`
                                  )
                                }
                                onMouseLeave={handlePreviewLeave}
                              />
                            </div>
                          )}

                          <div className="grid gap-3 md:grid-cols-3 flex-1">
                            <InfoBlock
                              label="Start date"
                              value={formatDate(event.startDate)}
                            />
                            <InfoBlock
                              label="End date"
                              value={formatDate(event.endDate)}
                            />
                            <InfoBlock
                              label="Raw date text"
                              value={event.rawDateText || "—"}
                            />
                            <InfoBlock
                              label="Event text"
                              value={event.eventTxt || "—"}
                            />
                            <InfoBlock
                              label="Location"
                              value={event.location || "—"}
                            />
                            <InfoBlock
                              label="List order"
                              value={
                                typeof event.listOrder === "number"
                                  ? `#${event.listOrder}`
                                  : "—"
                              }
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">
                            Collections & matches
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleBulkCollections(event.slug)}
                          >
                            {isCollectionsOpen ? "Collapse" : "Expand"}
                          </Button>
                        </div>

                        {isCollectionsOpen && (
                          <>
                            <div>
                              <p className="text-sm font-semibold">
                                Matched sets ({matchedSets.length})
                              </p>
                              {matchedSets.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  No catalog sets matched this event.
                                </p>
                              ) : (
                                <div className="mt-2 space-y-3">
                                  {matchedSets.map((set) => {
                                    const bulkKey = `${event.slug}-${set.id}`;
                                    const isMediaOpen =
                                      bulkSetMediaOpen[bulkKey];
                                    return (
                                      <div
                                        key={`${event.slug}-${set.id}`}
                                        className="space-y-3 rounded-lg border bg-muted/20 p-3"
                                      >
                                        <div className="flex flex-col">
                                          <p className="font-semibold">
                                            {set.title}
                                          </p>
                                          <p className="text-xs text-muted-foreground mt-1">
                                            Matched text:{" "}
                                            <span className="font-mono text-black font-bold">
                                              {set.match}
                                            </span>
                                          </p>
                                        </div>

                                        <div className="flex items-center justify-between">
                                          <span className="text-xs text-muted-foreground">
                                            Assets
                                          </span>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              toggleBulkSetMedia(bulkKey)
                                            }
                                          >
                                            {isMediaOpen
                                              ? "Hide media"
                                              : "Show media"}
                                          </Button>
                                        </div>
                                        {isMediaOpen && (
                                          <>
                                            {set.images &&
                                              set.images.length > 0 && (
                                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                                  {set.images
                                                    .slice(0, 4)
                                                    .map(
                                                      (
                                                        img: string,
                                                        imgIndex: number
                                                      ) => (
                                                        <img
                                                          key={`${set.id}-img-${imgIndex}`}
                                                          src={img}
                                                          alt={`${
                                                            set.title
                                                          } image ${
                                                            imgIndex + 1
                                                          }`}
                                                          className="h-28 w-full rounded-lg border bg-white object-contain p-1"
                                                          onMouseEnter={() =>
                                                            handlePreviewEnter(
                                                              img,
                                                              `${
                                                                set.title
                                                              } image ${
                                                                imgIndex + 1
                                                              }`
                                                            )
                                                          }
                                                          onMouseLeave={
                                                            handlePreviewLeave
                                                          }
                                                        />
                                                      )
                                                    )}
                                                </div>
                                              )}
                                            {set.cards &&
                                              set.cards.length > 0 && (
                                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                                                  {set.cards
                                                    .slice(0, 8)
                                                    .map((card) => (
                                                      <div
                                                        key={`${event.slug}-${set.id}-card-${card.id}`}
                                                        className="flex flex-col items-center gap-2 rounded-lg border bg-background p-2 text-center"
                                                      >
                                                        {card.image ? (
                                                          <img
                                                            src={card.image}
                                                            alt={card.title}
                                                            className="h-48 w-full rounded bg-white object-contain p-1"
                                                          />
                                                        ) : (
                                                          <div className="flex h-48 w-full items-center justify-center rounded border text-xs text-muted-foreground">
                                                            No image
                                                          </div>
                                                        )}
                                                        <div className="text-[11px] text-muted-foreground">
                                                          <p className="font-semibold text-foreground">
                                                            {card.code ||
                                                              "No code"}
                                                          </p>
                                                          <p className="line-clamp-2">
                                                            {card.title}
                                                          </p>
                                                        </div>
                                                      </div>
                                                    ))}
                                                </div>
                                              )}
                                          </>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div>
                              <p className="text-sm font-semibold">
                                Missing sets ({missingSets.length})
                              </p>
                              {missingSets.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  No unmatched set references detected.
                                </p>
                              ) : (
                                <div className="mt-2 flex flex-col gap-2">
                                  {missingSets.map((set, index) => (
                                    <div
                                      key={`${event.slug}-missing-${index}`}
                                      className="space-y-2 rounded-lg border p-3"
                                    >
                                      <div className="flex flex-col">
                                        <p className="font-semibold">
                                          {set.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {set.translatedTitle
                                            ? ` → ${set.translatedTitle}`
                                            : ""}
                                        </p>
                                      </div>

                                      {set.images && set.images.length > 0 && (
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                          {set.images
                                            .slice(0, 4)
                                            .map(
                                              (
                                                img: string,
                                                imgIndex: number
                                              ) => (
                                                <img
                                                  key={`${img}-${imgIndex}`}
                                                  src={img}
                                                  alt={`${set.title} preview ${
                                                    imgIndex + 1
                                                  }`}
                                                  className="h-56 w-full rounded bg-white object-contain p-1"
                                                  onMouseEnter={() =>
                                                    handlePreviewEnter(
                                                      img,
                                                      `${set.title} preview ${
                                                        imgIndex + 1
                                                      }`
                                                    )
                                                  }
                                                  onMouseLeave={
                                                    handlePreviewLeave
                                                  }
                                                />
                                              )
                                            )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <p className="text-sm font-semibold">
                                Missing cards ({missingCards.length})
                              </p>
                              {missingCards.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  No unmatched card references detected.
                                </p>
                              ) : (
                                <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                                  {missingCards.map((card, index) => (
                                    <div
                                      key={`${event.slug}-card-${index}`}
                                      className="flex items-center gap-3 rounded border bg-muted/20 p-3 flex-col"
                                    >
                                      {card.image ? (
                                        <img
                                          src={card.image}
                                          alt={card.title}
                                          onMouseEnter={() =>
                                            handlePreviewEnter(
                                              card.image,
                                              `${card.title} (${
                                                card.code || "No code"
                                              })`
                                            )
                                          }
                                          onMouseLeave={handlePreviewLeave}
                                          className="rounded bg-white object-contain p-1"
                                        />
                                      ) : (
                                        <div className="flex h-40 w-28 items-center justify-center rounded border text-xs text-muted-foreground">
                                          No image
                                        </div>
                                      )}
                                      <div className="flex flex-col w-full fle-1">
                                        <p className="font-medium">
                                          {card.title}
                                        </p>
                                        <p className="text-medium text-muted-foreground text-center">
                                          {card.code || "No code"}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      <HoverImagePreviewOverlay preview={imagePreview} />
    </div>
  );
};

export default AdminEventScraperPage;
