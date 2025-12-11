"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
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
  const [typeFilter, setTypeFilter] = useState<string>("all");

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

    // Filtro de tipo
    if (typeFilter !== "all") {
      filtered = filtered.filter((event) => event.eventType === typeFilter);
    }

    return filtered;
  }, [events, searchTerm, regionFilter, typeFilter]);

  // Extraer regiones y tipos únicos para los filtros
  const uniqueRegions = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.region))).sort();
  }, [events]);

  const uniqueTypes = useMemo(() => {
    return Array.from(new Set(events.map((e) => e.eventType))).sort();
  }, [events]);

  return (
    <div className="h-full bg-gradient-to-b from-background to-muted/20 w-full">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b bg-gradient-to-r from-red-500/10 via-purple-500/10 to-blue-500/10">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="container relative mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-6xl">
              One Piece TCG{" "}
              <span className="bg-gradient-to-r from-red-500 to-purple-600 bg-clip-text text-transparent">
                Events
              </span>
            </h1>
            <p className="text-lg text-muted-foreground md:text-xl">
              Discover tournaments, championships, and promotional events from
              around the world
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Filters Section */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search events by name, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-3">
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger className="w-[180px]">
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

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Showing{" "}
              <span className="font-semibold text-foreground">
                {filteredEvents.length}
              </span>{" "}
              {filteredEvents.length === 1 ? "event" : "events"}
            </p>
            {(searchTerm || regionFilter !== "all" || typeFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setRegionFilter("all");
                  setTypeFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {[...Array(10)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="aspect-[4/3] animate-pulse bg-muted" />
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredEvents.map((event) => {
              const thumbnail = event.eventThumbnail ?? event.imageUrl;

              return (
                <Link key={event.id} href={`/events/${event.slug}`}>
                  <Card className="group h-full overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                    {/* Image */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted flex items-center justify-center">
                      {thumbnail ? (
                        <Image
                          src={thumbnail}
                          alt={event.title}
                          fill
                          className="object-contain transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      {/* Status badge */}
                      <div className="absolute right-2 top-2 z-10">
                        <Badge
                          variant={
                            event.status === "UPCOMING"
                              ? "default"
                              : "secondary"
                          }
                          className="text-[10px] shadow-sm"
                        >
                          {event.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Content */}
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Title & Type */}
                        <div>
                          <h3 className="mb-1.5 line-clamp-2 text-sm font-semibold leading-tight transition-colors group-hover:text-primary">
                            {event.title}
                          </h3>
                          <div className="flex flex-wrap gap-1">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                            >
                              {event.eventType}
                            </Badge>
                            {event.category && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {event.category}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Meta info */}
                        <div className="space-y-1.5 text-[11px] text-muted-foreground">
                          {event.startDate && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3 w-3 flex-shrink-0" />
                              <span className="line-clamp-1">
                                {new Date(event.startDate).toLocaleDateString(
                                  "en-US",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  }
                                )}
                              </span>
                            </div>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="line-clamp-1">
                                {event.location}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Globe className="h-3 w-3 flex-shrink-0" />
                            <span className="line-clamp-1">{event.region}</span>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-3 border-t pt-2.5 text-[11px]">
                          <div className="flex items-center gap-1">
                            <Layers className="h-3 w-3 text-muted-foreground" />
                            <span className="font-semibold">
                              {event._count.sets}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ImageIcon className="h-3 w-3 text-muted-foreground" />
                            <span className="font-semibold">
                              {event._count.cards}
                            </span>
                          </div>
                          <div className="ml-auto">
                            <ArrowRight className="h-3 w-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
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
