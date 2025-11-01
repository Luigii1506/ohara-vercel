"use client";

import React from "react";

interface CreateCollectionButtonProps {
  userId: string;
  setIsCollectionCreated: React.Dispatch<React.SetStateAction<boolean>>;
}

const CollectionForm: React.FC<CreateCollectionButtonProps> = ({
  userId,
  setIsCollectionCreated,
}) => {
  const [isLoading, setIsLoading] = React.useState(false);

  const createCollection = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/collection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, cards: [] }),
      });

      if (response.ok) {
        console.log("Colección creada exitosamente");
      } else {
        console.log("Error al crear la colección", response);
        throw new Error("Error al crear la colección");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
      setIsCollectionCreated(true);
    }
  };

  return (
    <button
      onClick={createCollection}
      disabled={isLoading}
      className=" rounded-full p-3 shadow-md border-2 border-[#928157] text-[#928157] hover:bg-[#c9ae6e] hover:text-white hover:font-bold"
    >
      {isLoading ? "Creando colección..." : "Crear colección"}
    </button>
  );
};

export default CollectionForm;
