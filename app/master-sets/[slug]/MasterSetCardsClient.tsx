"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MasterSetDetailCard } from "@/lib/master-sets/query";
import {
  getMasterSetRelationTypeLabel,
  getMasterSetVariantLabel,
} from "@/lib/master-sets/presentation";

type PriceField = "marketPrice" | "midPrice";

type Props = {
  cards: MasterSetDetailCard[];
  priceField: PriceField;
  characterName: string;
};

function getPriceValue(card: MasterSetDetailCard, priceField: PriceField) {
  if (priceField === "midPrice") {
    return card.midPrice ?? card.marketPrice;
  }

  return card.marketPrice ?? card.midPrice;
}

function getPriceLabel(priceField: PriceField) {
  return priceField === "midPrice" ? "Listed Median" : "Market Price";
}

function getFallbackSetLabel(card: MasterSetDetailCard) {
  if (card.setCode?.trim()) {
    return card.setCode.trim();
  }

  const codePrefix = card.code.split("-")[0]?.trim();
  return codePrefix || "SET N/A";
}

function getVariantLabel(card: MasterSetDetailCard) {
  return card.alternateArt
    ? getMasterSetVariantLabel(card.variantCategory)
    : "Base";
}

function getRelationLabel(card: MasterSetDetailCard) {
  return card.relationTypes.length > 0
    ? card.relationTypes.map(getMasterSetRelationTypeLabel).join(" / ")
    : "Relacion no definida";
}

function renderCardGrid(
  cards: MasterSetDetailCard[],
  priceField: PriceField,
  onSelectCard: (card: MasterSetDetailCard) => void
) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {cards.map((card) => {
        const shownPrice = getPriceValue(card, priceField);

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectCard(card)}
            className="overflow-hidden rounded-[24px] border border-slate-200 bg-white text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="aspect-[3/4] bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.src}
                alt={card.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {getFallbackSetLabel(card)}
                  </p>
                  <h2 className="truncate text-sm font-bold text-slate-950 md:text-base">
                    {card.name}
                  </h2>
                  <p className="mt-1 text-[11px] font-medium text-slate-500 md:text-xs">
                    {card.code}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    card.owned
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {card.owned ? "Owned" : "Missing"}
                </span>
              </div>

              <div className="mt-3 space-y-1.5">
                <p className="text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-900">Region:</span>{" "}
                  {card.region || "N/A"}
                </p>
                <p className="text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-900">Tipo:</span>{" "}
                  {getVariantLabel(card)}
                </p>
                <p className="line-clamp-2 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-900">Relacion:</span>{" "}
                  {getRelationLabel(card)}
                </p>
              </div>

              {shownPrice !== null ? (
                <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 md:text-sm">
                  {getPriceLabel(priceField)}: ${shownPrice.toFixed(2)}
                </div>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function MasterSetCardsClient({
  cards,
  priceField,
  characterName,
}: Props) {
  const [selectedCard, setSelectedCard] = useState<MasterSetDetailCard | null>(null);
  const priceLabel = getPriceLabel(priceField);
  const cameoCards = cards.filter((card) =>
    card.relationTypes.includes("DEPICTED_IN_ART")
  );
  const nameCards = cards.filter((card) =>
    card.relationTypes.includes("MENTIONED_IN_NAME")
  );
  const cameoIds = new Set(cameoCards.map((card) => card.id));
  const nameIds = new Set(nameCards.map((card) => card.id));
  const otherCards = cards.filter(
    (card) => !cameoIds.has(card.id) && !nameIds.has(card.id)
  );

  return (
    <>
      <div className="space-y-6">
        {cameoCards.length > 0 ? (
          <section>
            <div className="mb-3 border-b border-slate-200 pb-2">
              <h2 className="text-base font-bold text-slate-950 md:text-lg">
                Cameos
              </h2>
            </div>
            {renderCardGrid(cameoCards, priceField, setSelectedCard)}
          </section>
        ) : null}

        {nameCards.length > 0 ? (
          <section>
            <div className="mb-3 border-b border-slate-200 pb-2">
              <h2 className="text-base font-bold text-slate-950 md:text-lg">
                Cartas de {characterName}
              </h2>
            </div>
            {renderCardGrid(nameCards, priceField, setSelectedCard)}
          </section>
        ) : null}

        {otherCards.length > 0 ? (
          <section>
            <div className="mb-3 border-b border-slate-200 pb-2">
              <h2 className="text-base font-bold text-slate-950 md:text-lg">
                Otras relaciones
              </h2>
            </div>
            {renderCardGrid(otherCards, priceField, setSelectedCard)}
          </section>
        ) : null}
      </div>

      <Dialog open={Boolean(selectedCard)} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <DialogContent className="max-w-5xl border-slate-200 bg-[#f7f2e6] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{selectedCard?.name}</DialogTitle>
          </DialogHeader>

          {selectedCard ? (
            <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
              <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedCard.src}
                  alt={selectedCard.name}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {getFallbackSetLabel(selectedCard)}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedCard.code}
                    {selectedCard.region ? ` · ${selectedCard.region}` : ""}
                  </p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <p>
                      <span className="font-semibold text-slate-900">Tipo:</span>{" "}
                      {getVariantLabel(selectedCard)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">Relacion:</span>{" "}
                      {getRelationLabel(selectedCard)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-[24px] bg-slate-900 px-4 py-4 text-white">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-300">
                      {priceLabel}
                    </div>
                    <div className="mt-1 text-2xl font-bold">
                      {getPriceValue(selectedCard, priceField) !== null
                        ? `$${getPriceValue(selectedCard, priceField)!.toFixed(2)}`
                        : "N/A"}
                    </div>
                  </div>
                  <div className="rounded-[24px] bg-white px-4 py-4 ring-1 ring-slate-200">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      Market Price
                    </div>
                    <div className="mt-1 text-2xl font-bold text-slate-950">
                      {selectedCard.marketPrice !== null
                        ? `$${selectedCard.marketPrice.toFixed(2)}`
                        : "N/A"}
                    </div>
                  </div>
                  <div className="rounded-[24px] bg-indigo-50 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-indigo-700/80">
                      Listed Median
                    </div>
                    <div className="mt-1 text-2xl font-bold text-indigo-900">
                      {selectedCard.midPrice !== null
                        ? `$${selectedCard.midPrice.toFixed(2)}`
                        : "N/A"}
                    </div>
                  </div>
                  <div
                    className={`rounded-[24px] px-4 py-4 ${
                      selectedCard.owned
                        ? "bg-emerald-50 text-emerald-900"
                        : "bg-rose-50 text-rose-900"
                    }`}
                  >
                    <div className="text-[11px] uppercase tracking-[0.14em] opacity-70">
                      Status
                    </div>
                    <div className="mt-1 text-2xl font-bold">
                      {selectedCard.owned ? "Owned" : "Missing"}
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200">
                  <div className="text-sm font-semibold text-slate-900">Quick info</div>
                  <div className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <p>Category: {selectedCard.category}</p>
                    <p>Rarity: {selectedCard.rarity || "N/A"}</p>
                    <p>Base card ID: {selectedCard.baseCardId ?? "N/A"}</p>
                    <p>Abre cualquier carta para verla en grande.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
