"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  MapPin,
  Globe,
  Search,
  Layers,
  Image as ImageIcon,
  ArrowRight,
  Filter,
  Users,
} from "lucide-react";

interface PublicEvent {
  id: number;
  slug: string;
  title: string;
  description?: string | null;
  locale?: string | null;
  region: string;
  status: string;
  eventType: string;
  category?: string | null;
  eventTxt?: string | null;
  rawDateText?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  imageUrl?: string | null;
  eventThumbnail?: string | null;
  _count: {
    sets: number;
    cards: number;
  };
}

const EventsPage = () => {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Detectar si es mobile para cambiar imagen del hero
  const isMobile = !useMediaQuery("(min-width: 768px)", false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/public/events");
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    // Filtro de búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (event) =>
          event.title.toLowerCase().includes(term) ||
          event.description?.toLowerCase().includes(term) ||
          event.location?.toLowerCase().includes(term)
      );
    }

    // Filtro de región
    if (regionFilter !== "all") {
      filtered = filtered.filter((event) => event.region === regionFilter);
    }

    // Filtro de categoría
    if (categoryFilter !== "all") {
      filtered = filtered.filter(
        (event) => event.category?.toLowerCase() === categoryFilter
      );
    }

    if (statusFilter === "current") {
      filtered = filtered.filter((event) =>
        ["UPCOMING", "ONGOING"].includes(event.status)
      );
    } else if (statusFilter === "past") {
      filtered = filtered.filter((event) => event.status === "COMPLETED");
    }

    return filtered;
  }, [events, searchTerm, regionFilter, categoryFilter, statusFilter]);

  // Extraer regiones y tipos únicos para los filtros
  const uniqueRegions = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.region))).sort();
  }, [events]);

  const uniqueCategories = useMemo(() => {
    return Array.from(
      new Set(
        events
          .map((e) => e.category?.trim().toLowerCase())
          .filter((category): category is string => Boolean(category))
      )
    ).sort();
  }, [events]);

  const statusOptions = [
    { value: "all", label: "All Events" },
    { value: "current", label: "Current" },
    { value: "past", label: "Past" },
  ];

  return (
    <div className="h-full bg-gradient-to-b from-background to-muted/20 w-full">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b py-8">
        <div className="absolute inset-0">
          <Image
            src={isMobile ? "/assets/images/Onepiecebanner_30x192.jpg" : "/assets/images/banner_2.jpg"}
            alt="Events banner"
            fill
            priority
            className="object-fit"
          />
        </div>
        <div className="relative mx-auto flex h-full w-full items-center justify-center px-4 py-16 md:py-24">
          <div className="sr-only">
            <h1>One Piece TCG Events</h1>
            <p>
              Discover tournaments, championships and promotional events across
              the globe.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Filters Section */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            {/* Search */}
            <div className="relative w-full flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search events by name, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {uniqueRegions.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.replace(/\b\w/g, (char) => char.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results count */}
          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p className="text-base sm:text-sm">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {filteredEvents.length}
              </span>{" "}
              {filteredEvents.length === 1 ? "event" : "events"}
            </p>
            {(searchTerm ||
              regionFilter !== "all" ||
              categoryFilter !== "all" ||
              statusFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  setSearchTerm("");
                  setRegionFilter("all");
                  setCategoryFilter("all");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="overflow-hidden border-border/50">
                <div className="aspect-[16/10] animate-pulse bg-gradient-to-br from-muted to-muted/50" />
                <CardContent className="p-5">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="border-t border-border/50" />
                    <div className="space-y-2.5">
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="border-t border-border/50 pt-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-16 animate-pulse rounded-lg bg-muted/30" />
                        <div className="h-16 animate-pulse rounded-lg bg-muted/30" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No events found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters or search terms
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredEvents.map((event) => {
              const thumbnail = event.eventThumbnail ?? event.imageUrl;

              return (
                <Link
                  key={event.id}
                  href={`/events/${event.slug}`}
                  className="no-underline"
                >
                  <Card className="group h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 border-border/50 flex flex-1 flex-col">
                    {/* Image Container */}
                    <div className="relative aspect-[16/10] overflow-hidden bg-muted/30">
                      {thumbnail ? (
                        <Image
                          src={thumbnail}
                          alt={event.title}
                          fill
                          className="object-contain transition-all duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                          <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                        </div>
                      )}

                      {/* Overlay gradient for better badge visibility */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                      {/* Status badge */}
                      <div className="absolute right-3 top-3 z-10">
                        <Badge
                          className={`text-xs font-semibold shadow-lg border ${
                            event.status === "UPCOMING"
                              ? "bg-slate-900 text-white border-slate-900"
                              : event.status === "ONGOING"
                              ? "bg-amber-200 text-amber-900 border-amber-200"
                              : "bg-emerald-200 text-emerald-900 border-emerald-200"
                          }`}
                        >
                          {event.status}
                        </Badge>
                      </div>

                      {/* Type badge */}
                      <div className="absolute left-3 top-3 z-10">
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold shadow-lg border bg-background/80 backdrop-blur-sm"
                        >
                          {event.category}
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="flex h-full flex-col p-5 flex-1">
                      <div className="flex flex-1 flex-col justify-between">
                        <div className="space-y-4">
                          <div className="flex flex-col gap-1">
                            <h3 className="mb-1 text-base font-bold leading-snug line-clamp-2 transition-colors group-hover:text-primary">
                              {event.title}
                            </h3>
                            {event.eventTxt && (
                              <p className="line-clamp-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                                {event.eventTxt}
                              </p>
                            )}
                          </div>
                          <div className="border-t border-border/50" />
                          <div className="space-y-2.5 text-sm">
                            <div className="flex items-start gap-2.5">
                              <Calendar className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
                              <span className="line-clamp-1 text-foreground/80 font-medium">
                                {event.rawDateText || "Date TBA"}
                              </span>
                            </div>

                            <div className="flex items-start gap-2.5">
                              <MapPin className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
                              <span className="line-clamp-2 text-foreground/80">
                                {event.location || "Location TBA"}
                              </span>
                            </div>

                            <div className="flex items-start gap-2.5">
                              <Globe className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
                              <span className="line-clamp-1 text-foreground/80">
                                {event.region}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end  pt-2">
                          <div className=" flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-all group-hover:gap-2">
                            <span>View Details</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventsPage;
