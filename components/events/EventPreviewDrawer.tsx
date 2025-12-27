"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, Calendar, MapPin, Globe, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import BaseDrawer from "@/components/ui/BaseDrawer";

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

interface EventPreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  event: PublicEvent | null;
}

const EventPreviewDrawer: React.FC<EventPreviewDrawerProps> = ({
  isOpen,
  onClose,
  event,
}) => {
  const router = useRouter();

  if (!event) return null;

  const thumbnail = event.eventThumbnail ?? event.imageUrl;

  const handleViewDetails = () => {
    onClose();
    router.push(`/events/${event.slug}`);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "UPCOMING":
        return "bg-slate-900 text-white border-slate-900";
      case "ONGOING":
        return "bg-amber-200 text-amber-900 border-amber-200";
      default:
        return "bg-emerald-200 text-emerald-900 border-emerald-200";
    }
  };

  return (
    <BaseDrawer
      isOpen={isOpen}
      onClose={onClose}
      maxHeight="92vh"
      desktopModal
      desktopMaxWidth="max-w-lg"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-3 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
              <Badge
                className={`font-semibold ${getStatusBadgeClass(event.status)}`}
              >
                {event.status}
              </Badge>
              {event.category && (
                <Badge variant="outline" className="font-medium">
                  {event.category}
                </Badge>
              )}
              <Badge variant="secondary" className="font-medium">
                {event.eventType}
              </Badge>
            </div>
            {/* Title */}
            <h2 className="text-lg font-bold text-slate-900 leading-tight line-clamp-2">
              {event.title}
            </h2>
            {/* Event subtitle */}
            {event.eventTxt && (
              <p className="text-xs uppercase tracking-widest text-slate-500 mt-1">
                {event.eventTxt}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        className="overflow-y-auto flex-1 pb-4"
        style={{ maxHeight: "calc(92vh - 180px)" }}
      >
        {/* Event Image */}
        {thumbnail && (
          <div className="relative aspect-[16/10] w-full bg-slate-100">
            <Image
              src={thumbnail}
              alt={event.title}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 512px"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
        )}

        {/* Event Info */}
        <div className="px-4 py-4 space-y-4">
          {/* Date */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Date
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {event.rawDateText || "Date TBA"}
              </p>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Location
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {event.location || "Location TBA"}
              </p>
            </div>
          </div>

          {/* Region */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Region
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {event.region}
              </p>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="pt-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Description
              </p>
              <p className="text-sm text-slate-700 leading-relaxed line-clamp-4">
                {event.description}
              </p>
            </div>
          )}

          {/* Stats */}
          {(event._count.sets > 0 || event._count.cards > 0) && (
            <div className="flex gap-4 pt-2">
              {event._count.sets > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
                  <span className="text-lg font-bold text-slate-900">
                    {event._count.sets}
                  </span>
                  <span className="text-xs text-slate-500">
                    {event._count.sets === 1 ? "Set" : "Sets"}
                  </span>
                </div>
              )}
              {event._count.cards > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
                  <span className="text-lg font-bold text-slate-900">
                    {event._count.cards}
                  </span>
                  <span className="text-xs text-slate-500">
                    {event._count.cards === 1 ? "Card" : "Cards"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer - View Details Button */}
      <div className="sticky bottom-0 border-t border-slate-200 bg-white p-4">
        <Button
          onClick={handleViewDetails}
          className="w-full h-12 gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl"
        >
          View Full Details
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </BaseDrawer>
  );
};

export default EventPreviewDrawer;
