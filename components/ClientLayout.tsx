"use client";
import { usePathname } from "next/navigation";

import React from "react";
import { useState } from "react";
import NavBar from "@/components/NavBar";
import { I18nProvider } from "@/components/i18n/I18nProvider";

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const pathname = usePathname();
  // Verificar si la ruta actual es `/login`, cualquier ruta del seller o user-store
  const isLoginPage = pathname === "/login";
  const isSellerPage = pathname.startsWith("/seller");
  const isUserStorePage = pathname.startsWith("/user-store");

  if (isLoginPage || isSellerPage || isUserStorePage) {
    return <I18nProvider>{children}</I18nProvider>; // Renderiza directamente los hijos si es login, seller o user-store
  }

  return (
    <I18nProvider>
      <main className={"h-[100dvh] w-full flex flex-col min-h-0"}>
        <NavBar />

        <section className="min-h-0 flex-1 flex flex-col-reverse md:flex-1 md:h-0 md:flex md:flex-row w-full">
          {/* <SideNav /> */}
          <section className="overflow-auto flex-1 flex min-h-0 w-full min-w-0 bg-[#f0ecdc]">
            {children}
          </section>
        </section>
      </main>
    </I18nProvider>
  );
}
