"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import AnnouncementModal from "@/components/announcements/AnnouncementModal";
import { useI18n } from "@/components/i18n/I18nProvider";

const VISITOR_KEY = "ohara-visitor-id";
const SESSION_KEY_PREFIX = "announcement-session-";
const DISMISS_KEY_PREFIX = "announcement-dismissed-";

const createVisitorId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const getVisitorId = () => {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(VISITOR_KEY);
  if (stored) return stored;
  const next = createVisitorId();
  window.localStorage.setItem(VISITOR_KEY, next);
  return next;
};

const makeDismissKey = (id: number, version: number) =>
  `${DISMISS_KEY_PREFIX}${id}-v${version}`;

const makeSessionKey = (id: number) => `${SESSION_KEY_PREFIX}${id}`;

const AnnouncementGate = () => {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { lang } = useI18n();
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<{
    id: number;
    title: string;
    body: string;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
    version: number;
  } | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setVisitorId(getVisitorId());
  }, []);

  const canShowInSession = useCallback((id: number, version: number) => {
    if (typeof window === "undefined") return false;
    if (window.sessionStorage.getItem(makeSessionKey(id))) {
      return false;
    }
    if (window.localStorage.getItem(makeDismissKey(id, version))) {
      return false;
    }
    return true;
  }, []);

  const markSessionShown = useCallback((id: number) => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(makeSessionKey(id), "1");
  }, []);

  const markDismissed = useCallback((id: number, version: number) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(makeDismissKey(id, version), "1");
  }, []);

  const logEvent = useCallback(
    async (type: "IMPRESSION" | "DISMISS" | "CLICK", payload: any) => {
      try {
        await fetch("/api/announcements/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            type,
            screen: pathname,
            locale: lang,
            visitorId,
          }),
        });
      } catch (error) {
        console.error("Failed to log announcement event:", error);
      }
    },
    [lang, pathname, visitorId]
  );

  const fetchAnnouncement = useCallback(async () => {
    if (!visitorId) return;
    try {
      const response = await fetch(
        `/api/announcements/active?screen=${encodeURIComponent(
          pathname
        )}&locale=${lang}&visitorId=${encodeURIComponent(visitorId)}`
      );
      const data = await response.json();
      if (!data?.announcement) {
        setAnnouncement(null);
        setIsOpen(false);
        return;
      }

      const next = data.announcement;
      if (!canShowInSession(next.id, next.version)) {
        return;
      }

      setAnnouncement(next);
      setIsOpen(true);
      markSessionShown(next.id);
      logEvent("IMPRESSION", { announcementId: next.id });
    } catch (error) {
      console.error("Failed to fetch announcement:", error);
    }
  }, [visitorId, pathname, lang, canShowInSession, logEvent, markSessionShown]);

  useEffect(() => {
    fetchAnnouncement();
  }, [fetchAnnouncement, session?.user?.id]);

  const handleClose = async () => {
    if (!announcement) return;
    setIsOpen(false);
    markDismissed(announcement.id, announcement.version);
    await logEvent("DISMISS", { announcementId: announcement.id });
  };

  const handleCta = async () => {
    if (!announcement) return;
    await logEvent("CLICK", { announcementId: announcement.id });
    markDismissed(announcement.id, announcement.version);
    setIsOpen(false);
    if (announcement.ctaUrl) {
      window.open(announcement.ctaUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <AnnouncementModal
      isOpen={isOpen}
      announcement={announcement}
      onClose={handleClose}
      onCta={handleCta}
    />
  );
};

export default AnnouncementGate;
