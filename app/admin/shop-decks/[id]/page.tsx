"use client";

import { useParams } from "next/navigation";
import EditShopDeckBuilder from "@/components/deckbuilder/EditShopDeckBuilder";

const AdminEditShopDeckPage = () => {
  const params = useParams();
  const deckId = Array.isArray(params?.id) ? params?.id[0] : params?.id;

  if (!deckId) {
    return null;
  }

  return <EditShopDeckBuilder deckId={deckId.toString()} />;
};

export default AdminEditShopDeckPage;
