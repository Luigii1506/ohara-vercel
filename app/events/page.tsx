"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Image as ImageIcon,
  ArrowRight,
  SlidersHorizontal,
  X,
} from "lucide-react";
import EventPreviewDrawer from "@/components/events/EventPreviewDrawer";

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

  // Drawer state for event preview
  const [selectedEvent, setSelectedEvent] = useState<PublicEvent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Filter drawer state for mobile
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Detectar si es mobile para cambiar imagen del hero
  const isMobile = !useMediaQuery("(min-width: 768px)", false);

  // Handler to open event preview
  const handleEventClick = (event: PublicEvent) => {
    setSelectedEvent(event);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

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

  // Check for active filters
  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    regionFilter !== "all" ||
    categoryFilter !== "all" ||
    statusFilter !== "all";

  const activeFilterCount =
    (regionFilter !== "all" ? 1 : 0) +
    (categoryFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setRegionFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
  };

  return (
    <div className="h-full bg-gradient-to-b from-background to-muted/20 w-full">
      {/* Hero Section */}
      {/* <div className="relative overflow-hidden border-b py-8">
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
      </div> */}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Filters Section - Sticky on scroll */}
        <div className="sticky top-0 z-10 -mx-4 mb-4 space-y-3 bg-gradient-to-b from-background via-background to-background/95 px-4 pb-3 pt-2 sm:-mx-6 sm:px-6 md:top-0 lg:-mx-8 lg:px-8">
          {/* Search + Filter Button Row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search events by name, location..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Mobile Filter Button */}
            <button
              onClick={() => setIsFilterOpen(true)}
              className="relative flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 md:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">Filters</span>
              {activeFilterCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Desktop Filters - Hidden on mobile */}
          <div className="hidden space-y-3 md:block">
            <div className="flex flex-wrap gap-6">
              {/* Region Filter */}
              <div>
                <span className="text-xs font-semibold text-slate-500">
                  Region
                </span>
                <div className="mt-1 flex flex-wrap gap-2">
                  <button
                    onClick={() => setRegionFilter("all")}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      regionFilter === "all"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    All Regions
                  </button>
                  {uniqueRegions.slice(0, 5).map((region) => (
                    <button
                      key={region}
                      onClick={() => setRegionFilter(region)}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                        regionFilter === region
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {region}
                    </button>
                  ))}
                  {uniqueRegions.length > 5 && (
                    <Select
                      value={regionFilter}
                      onValueChange={setRegionFilter}
                    >
                      <SelectTrigger className="h-auto rounded-full border-slate-200 px-4 py-2 text-xs font-semibold">
                        <SelectValue placeholder="More..." />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueRegions.slice(5).map((region) => (
                          <SelectItem key={region} value={region}>
                            {region}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <span className="text-xs font-semibold text-slate-500">
                  Category
                </span>
                <div className="mt-1 flex flex-wrap gap-2">
                  <button
                    onClick={() => setCategoryFilter("all")}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      categoryFilter === "all"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    All Categories
                  </button>
                  {uniqueCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setCategoryFilter(category)}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                        categoryFilter === category
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {category.replace(/\b\w/g, (char) => char.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <span className="text-xs font-semibold text-slate-500">
                  Status
                </span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setStatusFilter(option.value)}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                        statusFilter === option.value
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {loading
                ? "Loading..."
                : `Showing ${filteredEvents.length} ${
                    filteredEvents.length === 1 ? "event" : "events"
                  }`}
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Mobile Filter Drawer */}
        {isFilterOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
              onClick={() => setIsFilterOpen(false)}
            />

            {/* Drawer */}
            <div className="absolute inset-x-0 bottom-0 max-h-[85vh] animate-in slide-in-from-bottom duration-300 overflow-y-auto rounded-t-3xl bg-white shadow-xl">
              {/* Handle */}
              <div className="sticky top-0 z-10 bg-white px-6 pb-2 pt-3">
                <div className="mx-auto h-1 w-10 rounded-full bg-slate-300" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Filters</h2>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Filter Sections */}
              <div className="space-y-6 p-6">
                {/* Region */}
                <div>
                  <span className="text-sm font-semibold text-slate-700">
                    Region
                  </span>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => setRegionFilter("all")}
                      className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                        regionFilter === "all"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      All Regions
                    </button>
                    {uniqueRegions.map((region) => (
                      <button
                        key={region}
                        onClick={() => setRegionFilter(region)}
                        className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                          regionFilter === region
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {region}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <span className="text-sm font-semibold text-slate-700">
                    Category
                  </span>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => setCategoryFilter("all")}
                      className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                        categoryFilter === "all"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      All Categories
                    </button>
                    {uniqueCategories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setCategoryFilter(category)}
                        className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                          categoryFilter === category
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {category.replace(/\b\w/g, (char) =>
                          char.toUpperCase()
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <span className="text-sm font-semibold text-slate-700">
                    Status
                  </span>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {statusOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setStatusFilter(option.value)}
                        className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                          statusFilter === option.value
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="sticky bottom-0 border-t border-slate-100 bg-white p-4">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setRegionFilter("all");
                      setCategoryFilter("all");
                      setStatusFilter("all");
                    }}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    className="flex-1 rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Apply filters
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Events Grid */}
        {loading ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="overflow-hidden border-border/50">
                <div className="aspect-[16/10] animate-pulse bg-gradient-to-br from-muted to-muted/50" />
                <CardContent className="p-3 sm:p-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="border-t border-border/50" />
                    <div className="space-y-2">
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
              <Calendar className="mb-4 h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground" />
              <h3 className="mb-2 text-base sm:text-lg font-semibold">
                No events found
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Try adjusting your filters or search terms
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredEvents.map((event) => {
              const thumbnail = event.eventThumbnail ?? event.imageUrl;

              return (
                <Card
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  className="group h-full overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 border-border/50 flex flex-1 flex-col cursor-pointer active:scale-[0.98]"
                >
                  {/* Image Container */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-muted/30">
                    {thumbnail ? (
                      <Image
                        src={thumbnail}
                        alt={event.title}
                        fill
                        className="object-contain transition-all duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                        <ImageIcon className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/40" />
                      </div>
                    )}

                    {/* Overlay gradient for better badge visibility */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* Status badge */}
                    <div className="absolute right-2 top-2 sm:right-3 sm:top-3 z-10">
                      <Badge
                        className={`text-[10px] sm:text-xs font-semibold shadow-lg border ${
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

                    {/* Category badge */}
                    {event.category && (
                      <div className="absolute left-2 top-2 sm:left-3 sm:top-3 z-10">
                        <Badge
                          variant="outline"
                          className="text-[10px] sm:text-xs font-semibold shadow-lg border bg-background/80 backdrop-blur-sm"
                        >
                          {event.category}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <CardContent className="flex h-full flex-col p-3 sm:p-4 flex-1">
                    <div className="flex flex-1 flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-col gap-0.5">
                          <h3 className="text-sm sm:text-base font-bold leading-snug line-clamp-2 transition-colors group-hover:text-primary">
                            {event.title}
                          </h3>
                          {event.eventTxt && (
                            <p className="line-clamp-1 text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">
                              {event.eventTxt}
                            </p>
                          )}
                        </div>
                        <div className="border-t border-border/50" />
                        <div className="space-y-2 text-xs sm:text-sm">
                          <div className="flex items-start gap-2">
                            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 text-primary mt-0.5" />
                            <span className="line-clamp-1 text-foreground/80 font-medium">
                              {event.rawDateText || "Date TBA"}
                            </span>
                          </div>

                          <div className="flex items-start gap-2">
                            <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 text-primary mt-0.5" />
                            <span className="line-clamp-1 text-foreground/80">
                              {event.location || "Location TBA"}
                            </span>
                          </div>

                          <div className="flex items-start gap-2">
                            <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 text-primary mt-0.5" />
                            <span className="line-clamp-1 text-foreground/80">
                              {event.region}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end pt-2">
                        <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-semibold text-primary transition-all group-hover:gap-2">
                          <span>View Details</span>
                          <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Event Preview Drawer */}
      <EventPreviewDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        event={selectedEvent}
      />
    </div>
  );
};

export default EventsPage;
