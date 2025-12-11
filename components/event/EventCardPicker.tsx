"use client";

import { useEffect, useState } from "react";
import SingleSelect from "@/components/SingleSelect";
import { setCodesOptions, setOptions } from "@/helpers/constants";
import { Card } from "@prisma/client";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { showErrorToast } from "@/lib/toastify";

export interface EventCardPickerProps {
  onCardSelected: (cardId: number) => void;
}

type PreviewCard = {
  name: string;
  code: string;
  src: string;
  setCode?: string | null;
  sets?: CardSetRelation[];
  rarity?: string | null;
  imageKey?: string | null;
};

type AlternateCard = PreviewCard & {
  id: number;
};

interface CardResponse extends Card {
  alternates?: AlternateCard[];
  sets?: CardSetRelation[];
}

const setNameDictionary = setOptions.reduce<Record<string, string>>(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {}
);

type CardSetRelation = {
  set: {
    id: number;
    title: string;
    code?: string | null;
  };
};

const formatSetLabels = (
  sets?: CardSetRelation[] | null,
  setCode?: string | null
) => {
  if (sets && sets.length > 0) {
    return sets.map(({ set }) => ({
      key: `set-${set.id}`,
      label: `${set.title}${set.code ? ` (${set.code})` : ""}`,
    }));
  }

  const codes = (setCode ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return codes.map((code) => ({
    key: code,
    label: setNameDictionary[code] ?? code,
  }));
};

export default function EventCardPicker({
  onCardSelected,
}: EventCardPickerProps) {
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [cards, setCards] = useState<CardResponse[]>([]);
  const [selectedBaseCardId, setSelectedBaseCardId] = useState<string>("");
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [loadingCards, setLoadingCards] = useState(false);

  useEffect(() => {
    if (!selectedCode) {
      setCards([]);
      setSelectedBaseCardId("");
      setSelectedCardId("");
      return;
    }

    const fetchCards = async () => {
      try {
        setLoadingCards(true);
        const response = await fetch(`/api/admin/cards/by-set/${selectedCode}`);
        if (!response.ok) throw new Error("Failed to fetch cards");
        const data = await response.json();
        setCards(data);
      } catch (error) {
        console.error(error);
        showErrorToast("Error al cargar cartas por set");
      } finally {
        setLoadingCards(false);
      }
    };

    fetchCards();
  }, [selectedCode]);

  const selectedBaseCard = cards.find(
    (card) => String(card.id) === selectedBaseCardId
  );

  const activeCard: PreviewCard | undefined = selectedBaseCard
    ? selectedCardId === String(selectedBaseCard.id)
      ? selectedBaseCard
      : selectedBaseCard.alternates?.find(
          (alternate) => String(alternate.id) === selectedCardId
        )
    : undefined;

  const previewCard: PreviewCard | null =
    activeCard ?? selectedBaseCard ?? null;

  const baseSetLabels = selectedBaseCard
    ? formatSetLabels(selectedBaseCard.sets, selectedBaseCard.setCode)
    : [];

  const getBaseCardLabel = (value: string) => {
    if (!value) return "Selecciona una carta base";
    const card = cards.find((item) => String(item.id) === value);
    return card ? `${card.name} (${card.code})` : value;
  };

  return (
    <div className="space-y-4">
      <div>
        <SingleSelect
          options={setCodesOptions}
          selected={selectedCode || null}
          setSelected={(value) => setSelectedCode(value)}
          buttonLabel="Selecciona el código del set"
          isSearchable
          isSolid
          isFullWidth
        />
      </div>

      {loadingCards ? (
        <p className="text-sm text-muted-foreground">Cargando cartas...</p>
      ) : cards.length > 0 ? (
        <div className="space-y-2">
          <SingleSelect
            options={cards.map((card) => ({
              value: String(card.id),
              label: `${card.name} (${card.code})`,
            }))}
            selected={selectedBaseCardId || null}
            setSelected={(value) => {
              setSelectedBaseCardId(value);
              setSelectedCardId(value);
            }}
            buttonLabel="Selecciona una carta base"
            displaySelectedAs={(value) => getBaseCardLabel(value)}
            isSearchable
            isSolid
            isFullWidth
          />

          {selectedBaseCard && previewCard && (
            <div className="space-y-2">
              <div className="rounded border p-3">
                <p className="text-sm font-semibold">Carta seleccionada</p>
                <div className="mt-2">
                  <CardPreview card={previewCard} />
                </div>
              </div>

              {selectedBaseCard.alternates &&
                selectedBaseCard.alternates.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">
                      Alternas disponibles
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        onClick={() =>
                          setSelectedCardId(String(selectedBaseCard.id))
                        }
                        className={`flex items-center gap-2 rounded border p-2 text-left ${
                          selectedCardId === String(selectedBaseCard.id)
                            ? "border-primary bg-muted"
                            : ""
                        }`}
                      >
                        <div className="relative h-16 w-12 overflow-hidden rounded">
                          {selectedBaseCard.imageKey || selectedBaseCard.src ? (
                            <Image
                              src={
                                selectedBaseCard.imageKey ||
                                selectedBaseCard.src
                              }
                              alt={selectedBaseCard.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
                              Sin imagen
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 justify-center items-center">
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-semibold">
                            {selectedBaseCard.name}
                          </p>
                          {baseSetLabels.length > 0 && (
                            <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                              {baseSetLabels.map((badge) => (
                                <span
                                  key={badge.key}
                                  className="inline-flex items-center rounded-full border px-2 py-0.5"
                                >
                                  {badge.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                    {selectedBaseCard.alternates.map((alternate) => (
                        <button
                          key={alternate.id}
                          onClick={() =>
                            setSelectedCardId(String(alternate.id))
                          }
                          className={`flex items-center gap-2 rounded border p-2 text-left ${
                            selectedCardId === String(alternate.id)
                              ? "border-primary bg-muted"
                              : ""
                          }`}
                        >
                          <div className="relative h-16 w-12 overflow-hidden rounded">
                            {alternate.imageKey || alternate.src ? (
                              <Image
                                src={alternate.imageKey || alternate.src}
                                alt={alternate.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
                                Sin imagen
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 justify-center items-center">
                            {(() => {
                              const alternateSetLabels = formatSetLabels(
                                alternate.sets,
                                alternate.setCode
                              );

                              return (
                                <div className="flex flex-col gap-1">
                                  <p className="text-sm font-semibold">
                                    {alternate.name}
                                  </p>
                                  {alternateSetLabels.length > 0 && (
                                    <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                                      {alternateSetLabels.map((badge) => (
                                        <span
                                          key={badge.key}
                                          className="inline-flex items-center rounded-full border px-2 py-0.5"
                                        >
                                          {badge.label}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      ) : selectedCode ? (
        <p className="text-sm text-muted-foreground">
          No se encontraron cartas para este código.
        </p>
      ) : null}

      <Button
        className="w-full"
        onClick={() => {
          if (!selectedCardId) return;
          onCardSelected(Number(selectedCardId));
        }}
        disabled={!selectedCardId}
      >
        Vincular carta seleccionada
      </Button>
    </div>
  );
}

function CardPreview({ card }: { card: PreviewCard }) {
  const relatedSets = formatSetLabels(card.sets, card.setCode);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="relative h-24 w-16 overflow-hidden rounded border">
        {card.imageKey || card.src ? (
          <a
            href={card.imageKey || card.src}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block h-full w-full"
            title="Abrir imagen en una nueva pestaña"
          >
            <Image
              src={card.imageKey || card.src}
              alt={card.name}
              fill
              className="object-cover"
            />
          </a>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
            Sin imagen
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <div className="space-y-1">
          <p className="text-base font-semibold leading-tight">{card.name}</p>
          <p className="text-sm text-muted-foreground">{card.code}</p>
        </div>
        {relatedSets.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {relatedSets.map((badge) => (
              <span
                key={badge.key}
                className="inline-flex items-center rounded-full bg-muted px-3 py-0.5"
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
