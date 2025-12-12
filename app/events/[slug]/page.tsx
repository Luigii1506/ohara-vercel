"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import styles from "../event-content.module.scss";
import extraStyles from "../event.module.scss";
import {
  Calendar,
  MapPin,
  Globe,
  ArrowLeft,
  ExternalLink,
  Layers,
  Image as ImageIcon,
  Info,
} from "lucide-react";

interface StructuredDetail {
  label: string;
  value: string;
}

const EVENT_ASSET_ORIGIN = "https://en.onepiece-cardgame.com";

const resolveEventAssetUrl = (url?: string | null): string | null => {
  if (!url) {
    return null;
  }
  const trimmed = url.trim();
  if (
    !trimmed ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("#")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  try {
    const resolved = new URL(trimmed, EVENT_ASSET_ORIGIN);
    return resolved.toString();
  } catch {
    return trimmed;
  }
};

const normalizeEventContentHtml = (html?: string | null): string => {
  if (!html) {
    return "";
  }

  return html.replace(
    /(src|href)=["']([^"']+)["']/gi,
    (_, attr: string, value: string) => {
      const resolved = resolveEventAssetUrl(value);
      if (!resolved) {
        return `${attr}="${value}"`;
      }
      const sanitized = resolved.replace(/"/g, "&quot;");
      return `${attr}="${sanitized}"`;
    }
  );
};

const parseEventContent = (
  html?: string
): {
  entries: StructuredDetail[];
  remainingHtml: string;
} => {
  if (!html) {
    return { entries: [], remainingHtml: "" };
  }

  if (typeof window === "undefined") {
    return { entries: [], remainingHtml: html };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const entries: StructuredDetail[] = [];
    const leftover: string[] = [];

    Array.from(doc.body.children).forEach((node) => {
      if (
        node.tagName === "P" &&
        node.querySelector("strong") &&
        node.textContent
      ) {
        const strong = node.querySelector("strong");
        const label = strong?.textContent?.replace(/[:：]/g, "").trim();
        const value = node.textContent
          ?.replace(strong?.textContent ?? "", "")
          .replace(/[:：]/, "")
          .trim();

        if (label && value) {
          entries.push({ label, value });
          return;
        }
      }

      leftover.push(node.outerHTML || node.textContent || "");
    });

    const remainingHtml = leftover.join("");

    return {
      entries,
      remainingHtml: remainingHtml.length > 0 ? remainingHtml : html,
    };
  } catch {
    return { entries: [], remainingHtml: html };
  }
};

interface EventDetail {
  id: number;
  slug: string;
  title: string;
  description?: string | null;
  content?: string | null;
  originalContent?: string | null;
  locale?: string | null;
  region: string;
  status: string;
  eventType: string;
  category?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  rawDateText?: string | null;
  location?: string | null;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  eventThumbnail?: string | null;
  eventTxt?: string | null;
  sets: Array<{
    id: number;
    setId: number;
    eventId: number;
    set: {
      id: number;
      title: string;
      code?: string | null;
      version?: string | null;
      image?: string | null;
      attachments: Array<{
        id: number;
        imageUrl: string;
        type: string;
        order: number;
      }>;
      cards?: Array<{
        id: number;
        cardId: number;
        card: {
          id: number;
          name: string;
          code: string;
          src: string;
          alias?: string | null;
        };
      }>;
    };
  }>;
  cards: Array<{
    id: number;
    cardId: number;
    eventId: number;
    card: {
      id: number;
      name: string;
      code: string;
      src: string;
      alias?: string | null;
      setCode?: string | null;
      sets: Array<{
        setId: number;
        set: {
          id: number;
          title: string;
          code?: string | null;
        };
      }>;
    };
  }>;
}

interface ImagePreviewPayload {
  src: string;
  title: string;
  subtitle?: string;
}

const formatSourceHost = (url?: string | null): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const OriginalSourceBanner = ({
  title,
  sourceUrl,
}: {
  title?: string | null;
  sourceUrl?: string | null;
}) => {
  if (!sourceUrl) {
    return null;
  }
  const displayHost = formatSourceHost(sourceUrl) ?? "Official site";

  return (
    <div className="px-4 md:px-0">
      <div className="mb-8 rounded-2xl bg-gradient-to-r from-primary/90 via-primary to-primary/80 px-6 py-4 text-white shadow-lg shadow-black/15">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">
              Original material
            </p>
            <p className="text-base font-medium hidden md:block">
              <span> {title ? `${title} · ` : ""}</span>
              <span className="text-white/80">{displayHost}</span>
            </p>
          </div>
          <div className="flex justify-center md:justify-end flex-1">
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="!text-white inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-wide transition hover:bg-white/20"
            >
              Visit Source
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

const EventDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLargeImage, setShowLargeImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<ImagePreviewPayload | null>(
    null
  );
  const eventContentHtml = useMemo(() => {
    const raw = event?.originalContent ?? event?.content ?? "";
    return normalizeEventContentHtml(raw);
  }, [event?.originalContent, event?.content]);

  const parsedEventContent = useMemo(
    () => parseEventContent(eventContentHtml),
    [eventContentHtml]
  );

  console.log("eventevent", event);

  useEffect(() => {
    if (slug) {
      fetchEvent();
    }
  }, [slug]);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/public/events/${slug}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push("/events");
        }
        throw new Error("Failed to fetch event");
      }
      const data = await response.json();
      setEvent(data);
    } catch (error) {
      console.error("Error fetching event:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!showLargeImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowLargeImage(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLargeImage]);

  const openImagePreview = (payload: ImagePreviewPayload) => {
    setImagePreview(payload);
    setShowLargeImage(true);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-96 w-full animate-pulse rounded-lg bg-muted" />
          <div className="space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="mb-4 text-2xl font-bold">Event not found</h2>
        <Button onClick={() => router.push("/events")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Events
        </Button>
      </div>
    );
  }

  const heroImage = resolveEventAssetUrl(event.imageUrl);

  return (
    <>
      <div className="event-page min-h-screen bg-gradient-to-b from-background to-muted/20 w-full">
        <div className="mx-auto pt-3 pb-8  overflow-scroll max-w-[1050px]">
          <div className="flex flex-wrap items-center justify-between gap-4 py-4 mb-2 md:mb-0 ml-5 md:ml-0">
            <Button
              variant="secondary"
              size="lg"
              className="gap-2 rounded-full bg-white/90 px-6 py-4 text-base font-semibold text-black shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-white"
              onClick={() => router.push("/events")}
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Events
            </Button>
          </div>
          <OriginalSourceBanner
            title={event.title}
            sourceUrl={event.sourceUrl}
          />
          {/* Hero Banner */}
          {heroImage && (
            <div className="mb-8 overflow-hidden rounded-xl border shadow-lg container mx-auto w-[95%] md:w-full pb-5 md:pb-0 bg-white">
              <div className="relative w-full h-[300px] sm:h-[400px] lg:h-[500px] bg-muted ">
                <Image
                  src={heroImage}
                  alt={event.title}
                  fill
                  className="object-cover bg-background transition-transform duration-500"
                  priority
                  sizes="100vw"
                  quality={90}
                  fetchPriority="high"
                  placeholder="blur"
                  blurDataURL="data:image/webp;base64,UklGRlIAAABXRUJQVlA4WAoAAAAQAAAADwAADwAAQUxQSDIAAAARL0AmbZurmr57yyIiqE8oiG0bejIYEQTgQAAD+/gQAA"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
                {/* Title overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-white">
                  <div className="container mx-auto">
                    <div className="flex flex-wrap gap-2 mb-2 sm:mb-3">
                      <Badge
                        variant={
                          event.status === "UPCOMING" ? "default" : "secondary"
                        }
                        className="text-xs backdrop-blur-sm"
                      >
                        {event.status}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-xs backdrop-blur-sm border-white/40 text-white"
                      >
                        {event.eventType}
                      </Badge>
                      {event.category && (
                        <Badge
                          variant="outline"
                          className="text-xs backdrop-blur-sm border-white/40 text-white"
                        >
                          {event.category}
                        </Badge>
                      )}
                    </div>
                    <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold drop-shadow-lg">
                      {event.title}
                    </h1>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Event Info */}
          {!heroImage && (
            <div className="mb-8">
              <h1 className="mb-4 text-3xl font-bold lg:text-4xl">
                {event.title}
              </h1>
            </div>
          )}

          {/* Original Content */}
          {eventContentHtml && parsedEventContent.remainingHtml && (
            <div className="rounded-full">
              <div
                className={cn(
                  "rounded-full prose prose-sm max-w-none text-foreground/90 dark:prose-invert leading-relaxed [&>p]:mb-4 [&>p:last-child]:mb-0",
                  styles.eventContentHtml,
                  extraStyles.eventContentShell
                )}
                dangerouslySetInnerHTML={{
                  __html: parsedEventContent.remainingHtml,
                }}
              />

              <div className="mt-8 flex justify-center pb-8">
                <Button
                  variant="secondary"
                  size="lg"
                  className="gap-3 rounded-full bg-white/95 px-8 py-4 text-lg font-semibold text-black shadow-2xl shadow-black/25 transition hover:-translate-y-1 hover:bg-white"
                  onClick={() => router.push("/events")}
                >
                  <ArrowLeft className="h-5 w-5" />
                  Back to Events
                </Button>
              </div>
            </div>
          )}

          {/* {event.sets.length > 0 && (
            <div>
              <div className="mb-8">
                <h2 className="text-3xl font-bold flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Layers className="h-7 w-7 text-primary" />
                  </div>
                  Featured Sets & Cards
                </h2>
                <p className="text-muted-foreground ml-14">
                  {event.sets.length} {event.sets.length === 1 ? "set" : "sets"}{" "}
                  with {event.cards.length}{" "}
                  {event.cards.length === 1 ? "card" : "cards"}
                </p>
              </div>

              <div className="space-y-12">
                {event.sets.map((eventSet) => {
                  const set = eventSet.set;
                  const attachments = set.attachments || [];
                  const hasImages = attachments.length > 0 || set.image;

                  const eventLinkedCards = event.cards.filter((eventCard) =>
                    eventCard.card.sets.some(
                      (cardSet) => cardSet.setId === set.id
                    )
                  );
                  const fallbackSetCards =
                    set.cards?.map((cardSet) => ({
                      id: `set-${cardSet.id}`,
                      cardId: cardSet.card.id,
                      eventId: eventSet.eventId,
                      card: cardSet.card,
                    })) ?? [];

                  const setCards =
                    eventLinkedCards.length > 0
                      ? eventLinkedCards
                      : fallbackSetCards;

                  return (
                    <Card
                      key={eventSet.eventId + "-" + eventSet.setId}
                      className="overflow-hidden"
                    >
                      <CardHeader className="bg-gradient-to-r from-muted/80 via-muted/50 to-muted/30 border-b">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <CardTitle className="text-2xl mb-3">
                              {set.title}
                            </CardTitle>
                            {(set.code || set.version) && (
                              <div className="flex flex-wrap gap-2">
                                {set.code && (
                                  <Badge
                                    variant="secondary"
                                    className="font-mono text-sm"
                                  >
                                    {set.code}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {hasImages && (
                              <Badge variant="default" className="text-sm">
                                {attachments.length > 0
                                  ? attachments.length
                                  : 1}{" "}
                                {attachments.length === 1 ? "image" : "images"}
                              </Badge>
                            )}
                            {setCards.length > 0 && (
                              <Badge variant="secondary" className="text-sm">
                                {setCards.length}{" "}
                                {setCards.length === 1 ? "card" : "cards"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-6 space-y-8 ">
                        {hasImages && (
                          <div>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 justify-items-center">
                              {attachments.length === 0 && set.image && (
                                <div
                                  className="w-full group relative overflow-hidden rounded-xl border-2 bg-muted transition-all hover:shadow-2xl hover:border-primary/50 cursor-pointer"
                                  onClick={() =>
                                    openImagePreview({
                                      src:
                                        resolveEventAssetUrl(set.image) ??
                                        set.image!,
                                      title: set.title,
                                      subtitle: "Set cover",
                                    })
                                  }
                                >
                                  <div className="relative aspect-[3/4]">
                                    <Image
                                      src={
                                        resolveEventAssetUrl(set.image) ||
                                        set.image!
                                      }
                                      alt={set.title}
                                      fill
                                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                  </div>
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                                    <Badge
                                      variant="secondary"
                                      className="backdrop-blur-sm"
                                    >
                                      SET COVER
                                    </Badge>
                                  </div>
                                </div>
                              )}

                              {attachments.map((attachment) => {
                                const isPlaymat = attachment.type === "PLAYMAT";
                                const aspectClass = isPlaymat
                                  ? "aspect-[16/9]"
                                  : "aspect-[3/4]";
                                const imageClass = isPlaymat
                                  ? "object-contain"
                                  : "object-cover";
                                const attachmentUrl = resolveEventAssetUrl(
                                  attachment.imageUrl
                                );
                                if (!attachmentUrl) {
                                  return null;
                                }

                                return (
                                  <div
                                    key={attachment.id}
                                    className={`w-full group relative overflow-hidden rounded-xl border-2 bg-muted transition-all hover:shadow-2xl hover:border-primary/50 cursor-pointer ${
                                      isPlaymat
                                        ? "sm:col-span-2 lg:col-span-3"
                                        : ""
                                    }`}
                                    onClick={() =>
                                      openImagePreview({
                                        src: attachmentUrl,
                                        title: set.title,
                                        subtitle: attachment.type,
                                      })
                                    }
                                  >
                                    <div className={`relative ${aspectClass}`}>
                                      <Image
                                        src={attachmentUrl}
                                        alt={`${set.title} - ${attachment.type}`}
                                        fill
                                        className={`${imageClass} transition-transform duration-500 group-hover:scale-110`}
                                      />
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                                      <Badge
                                        variant="secondary"
                                        className="backdrop-blur-sm"
                                      >
                                        {attachment.type}
                                      </Badge>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {setCards.length > 0 && (
                          <div>
                            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                              {setCards.map((eventCard) => {
                                const card = eventCard.card;
                                const resolvedCardImage =
                                  resolveEventAssetUrl(card.src) || card.src;
                                return (
                                  <Card
                                    key={eventCard.id}
                                    className="group overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 cursor-pointer"
                                    onClick={() =>
                                      openImagePreview({
                                        src: resolvedCardImage,
                                        title: card.name,
                                        subtitle: card.code,
                                      })
                                    }
                                  >
                                    <div className="relative aspect-[2.5/3.5] overflow-hidden bg-muted">
                                      <Image
                                        src={resolvedCardImage}
                                        alt={card.name}
                                        fill
                                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                                      />
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    </div>
                                    <CardContent className="p-3 text-center">
                                      <div className="space-y-2">
                                        <Badge
                                          variant="secondary"
                                          className="font-mono text-xs"
                                        >
                                          {card.code}
                                        </Badge>
                                        <h4 className="line-clamp-2 text-sm font-semibold leading-tight">
                                          {card.name}
                                        </h4>
                                        {card.alias && (
                                          <p className="text-xs text-muted-foreground line-clamp-1">
                                            {card.alias}
                                          </p>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {setCards.length === 0 &&
                          event.cards.length === 0 &&
                          attachments.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                              <p className="text-sm font-medium mb-1">
                                No cards linked to this event yet
                              </p>
                              <p className="text-xs">
                                Cards need to be added to the event in the admin
                                panel
                              </p>
                            </div>
                          )}
                        {setCards.length === 0 &&
                          event.cards.length > 0 &&
                          attachments.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                              <p className="text-sm">
                                No cards from this set found in this event
                              </p>
                            </div>
                          )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {event.cards.length > 0 && (
            <div className="mt-16">
              <div className="mb-6">
                <h2 className="text-3xl font-bold flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <ImageIcon className="h-6 w-6 text-primary" />
                  </div>
                  Event Cards
                </h2>
                <p className="text-muted-foreground ml-14">
                  {event.cards.length}{" "}
                  {event.cards.length === 1 ? "card linked" : "cards linked"} to
                  this event
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {event.cards.map((eventCard) => {
                  const card = eventCard.card;
                  const cardSet =
                    card.sets?.[0]?.set?.title || card.setCode || "Set";
                  const resolvedCardImage =
                    resolveEventAssetUrl(card.src) || card.src;
                  return (
                    <Card
                      key={`event-card-${eventCard.id}`}
                      className="group overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 cursor-pointer"
                      onClick={() =>
                        openImagePreview({
                          src: resolvedCardImage,
                          title: card.name,
                          subtitle: card.code,
                        })
                      }
                    >
                      <div className="relative aspect-[2.5/3.5] overflow-hidden bg-muted">
                        <Image
                          src={resolvedCardImage}
                          alt={card.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </div>
                      <CardContent className="p-3 text-center">
                        <div className="space-y-2">
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs"
                          >
                            {card.code}
                          </Badge>
                          <h4 className="line-clamp-2 text-sm font-semibold leading-tight">
                            {card.name}
                          </h4>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {cardSet}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )} */}
        </div>
      </div>

      {showLargeImage && imagePreview && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/80 z-[9999] px-5 overflow-auto cursor-pointer"
          onClick={() => setShowLargeImage(false)}
          onTouchEnd={(e) => {
            e.preventDefault();
            setShowLargeImage(false);
          }}
        >
          <div className="w-full max-w-3xl pointer-events-none">
            <div className="text-white text-xl lg:text-2xl font-semibold text-center py-2 px-5">
              Tap to close
            </div>
            <div className="flex flex-col items-center gap-3 px-5 mb-3">
              <img
                src={imagePreview.src}
                className="max-w-full max-h-[calc(100dvh-130px)] object-contain"
                alt={imagePreview.title}
                loading="lazy"
              />
              <div className="text-white text-lg font-medium text-center px-5">
                <span>{imagePreview.title}</span>
                {imagePreview.subtitle && (
                  <>
                    <br />
                    <span className="text-sm text-white/80">
                      {imagePreview.subtitle}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EventDetailPage;
