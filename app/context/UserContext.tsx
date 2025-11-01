"use client";

import React, { createContext, useContext } from "react";
import { useSession } from "next-auth/react";

// Definir la interfaz del contexto
interface UserContextType {
  userId: string | null;
  loading: boolean;
  role: string | null;
}

// Crear el contexto
const UserContext = createContext<UserContextType>({
  userId: null,
  loading: true,
  role: null,
});

// Hook personalizado para usar el contexto
export const useUser = () => useContext(UserContext);

// Componente proveedor del contexto
export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { data: session, status } = useSession();

  return (
    <UserContext.Provider
      value={{
        userId: session?.user?.id ?? null,
        loading: status === "loading",
        role: session?.user?.role ?? null,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
