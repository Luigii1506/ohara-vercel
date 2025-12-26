"use client";

import { Deck } from "@/types";
import BaseDrawer from "@/components/ui/BaseDrawer";
import DeckDetailView from "@/components/decks/DeckDetailView";

interface DeckDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  deck: Deck | null;
  mode?: "user" | "shop" | "shop-admin";
  onDelete?: () => void;
}

const DeckDetailDrawer: React.FC<DeckDetailDrawerProps> = ({
  isOpen,
  onClose,
  deck,
  onDelete,
}) => {
  if (!deck) return null;

  const handleDelete = () => {
    onDelete?.();
    onClose();
  };

  return (
    <BaseDrawer isOpen={isOpen} onClose={onClose}>
      <DeckDetailView
        deck={deck}
        isDrawer={true}
        onClose={onClose}
        onDelete={handleDelete}
      />
    </BaseDrawer>
  );
};

export default DeckDetailDrawer;
