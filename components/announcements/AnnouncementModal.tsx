"use client";

import React from "react";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import BaseDrawer from "@/components/ui/BaseDrawer";
import { useI18n } from "@/components/i18n/I18nProvider";

type AnnouncementPayload = {
  id: number;
  title: string;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  version: number;
};

interface AnnouncementModalProps {
  isOpen: boolean;
  announcement: AnnouncementPayload | null;
  onClose: () => void;
  onCta: () => void;
}

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  isOpen,
  announcement,
  onClose,
  onCta,
}) => {
  const { t } = useI18n();

  if (!announcement) return null;

  const ctaLabel =
    announcement.ctaLabel || t("announcement.ctaDefault");

  return (
    <BaseDrawer
      isOpen={isOpen}
      onClose={onClose}
      maxHeight="90vh"
      showHandle={false}
      desktopModal
      desktopMaxWidth="max-w-md"
    >
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-emerald-50" />
        <div className="absolute -top-24 -right-20 h-44 w-44 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-40 w-40 rounded-full bg-emerald-200/40 blur-3xl" />

        <div className="relative z-10 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
              <Sparkles className="h-3.5 w-3.5" />
              {t("announcement.badge")}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
              aria-label={t("announcement.dismiss")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <h3 className="mt-4 text-xl font-semibold text-slate-900">
            {announcement.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {announcement.body}
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              variant="ghost"
              onClick={onClose}
              className="w-full sm:w-auto"
            >
              {t("announcement.dismiss")}
            </Button>
            <Button
              onClick={onCta}
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white"
            >
              {ctaLabel}
            </Button>
          </div>
        </div>
      </div>
    </BaseDrawer>
  );
};

export default AnnouncementModal;
