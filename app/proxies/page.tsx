"use client";

import ProxiesBuilder from "@/components/proxies/ProxiesBuilder";
import { CardWithCollectionData } from "@/types";
import { useCards } from "@/hooks/useCards";

const DeckBuilder = () => {
  const { data: cards = [], isLoading } = useCards();

  const handleSave = async () => {};

  const handleRestart = () => {};

  return (
    <ProxiesBuilder
      onSave={handleSave}
      onRestart={handleRestart}
      initialCards={cards as CardWithCollectionData[]}
    />
  );
};

export default DeckBuilder;
