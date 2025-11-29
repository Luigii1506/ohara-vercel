"use client";
import { usePathname } from "next/navigation";

import React from "react";
import { useState } from "react";
import NavBar from "@/components/NavBar";

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const pathname = usePathname();
  // Verificar si la ruta actual es `/login`, cualquier ruta del seller o user-store
  const isLoginPage = pathname === "/login";
  const isRegisterPage = pathname === "/register";
  const isForgotPassword = pathname === "/forgot-password";
  const isResetPassword = pathname === "/reset-password";
  const isSellerPage = pathname.startsWith("/seller");
  const isUserStorePage = pathname.startsWith("/user-store");

  if (
    isLoginPage ||
    isRegisterPage ||
    isForgotPassword ||
    isResetPassword ||
    isSellerPage ||
    isUserStorePage
  ) {
    return <>{children}</>; // Renderiza directamente los hijos si es login, seller o user-store
  }

  return (
    <>
      <main className={"h-[100dvh] w-screen flex flex-col min-h-0"}>
        <NavBar />

        <section
          className="min-h-0 flex-1 flex flex-col-reverse md:flex-1 md:h-0 md:flex md:flex-row w-full"
        >
          {/* <SideNav /> */}
          <section className="overflow-auto flex-1 flex min-h-0 w-full">
            {children}
          </section>
        </section>
      </main>
    </>
  );
}
