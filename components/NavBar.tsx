"use client";

import Link from "next/link";
import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Logo from "@/public/assets/images/LOGO_OHARA.svg";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { useUser } from "@/app/context/UserContext";

import { Button } from "@/components/ui/button";
import {
  LogOutIcon,
  UserIcon,
  ChevronDown,
  Shield,
  Edit,
  Plus,
  FileText,
  Calendar,
  Upload,
  Menu,
  X,
  Home,
  Layers,
  Copy,
  FolderOpen,
  ShoppingBag,
} from "lucide-react";
import LoginModal from "./LoginModal";

const NavBar = () => {
  const pathname =
    usePathname()
      ?.split("/")
      .filter((segment) => segment !== "") || [];

  const { userId, role, loading } = useUser();

  const [isOpen, setIsOpen] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const previousPathRef = useRef(pathname);

  // Cerrar el menú móvil cuando cambia la ruta
  useEffect(() => {
    // Solo cerrar si realmente cambió la ruta
    const currentPath = pathname.join("/");
    const previousPath = previousPathRef.current.join("/");

    if (currentPath !== previousPath) {
      setIsMobileMenuOpen(false);
      previousPathRef.current = pathname;
    }
  }, [pathname]);

  // Cerrar el dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        adminMenuRef.current &&
        !adminMenuRef.current.contains(event.target as Node)
      ) {
        setIsAdminMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Manejar clics fuera del menú móvil separadamente
  useEffect(() => {
    const handleMobileMenuClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const mobileButton = document.querySelector(".mobile-menu-button");

      if (
        isMobileMenuOpen &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(target) &&
        !mobileButton?.contains(target)
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    // Usar un pequeño delay para evitar conflictos con el click del botón
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleMobileMenuClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleMobileMenuClickOutside);
    };
  }, [isMobileMenuOpen]);

  // Prevenir scroll cuando el menú móvil está abierto
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  const adminMenuItems = [
    {
      href: "/admin/edit-card",
      label: "Edit Card",
      icon: Edit,
      description: "Modify existing cards",
    },
    {
      href: "/admin/add-card",
      label: "Add Card",
      icon: Plus,
      description: "Create new card entries",
    },
    {
      href: "/admin/add-set",
      label: "Add Set",
      icon: Plus,
      description: "Create new card sets",
    },
    {
      href: "/admin/add-rulings",
      label: "Add Rulings",
      icon: FileText,
      description: "Add card rulings",
    },
    {
      href: "/admin/add-event",
      label: "Add Event",
      icon: Calendar,
      description: "Create new events",
    },
    {
      href: "/admin/upload-sets",
      label: "Upload Sets",
      icon: Upload,
      description: "Bulk upload card sets",
    },
    {
      href: "/admin/create-decks",
      label: "Decks para venta",
      icon: ShoppingBag,
      description: "Crea decks especiales para la tienda",
    },
    {
      href: "/admin/shop-decks",
      label: "Gestionar decks venta",
      icon: Layers,
      description: "Edita y publica tus decks de tienda",
    },
  ];

  // Menú completo para desktop
  const desktopMenuItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/deckbuilder", label: "Deckbuilder", icon: Layers },
    { href: "/shop", label: "Shop", icon: ShoppingBag },
    { href: "/proxies", label: "Proxies", icon: Copy },
  ];

  if (userId) {
    desktopMenuItems.push({
      href: "/lists",
      label: "My Lists",
      icon: FolderOpen,
    });
    desktopMenuItems.push({
      href: "/decks",
      label: "My decks",
      icon: FolderOpen,
    });
    desktopMenuItems.push({
      href: "/logs",
      label: "Game Logs",
      icon: FileText,
    });
  }

  // Menú mobile sin Proxies
  const mobileMenuItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/deckbuilder", label: "Deckbuilder", icon: Layers },
    { href: "/shop", label: "Shop", icon: ShoppingBag },
  ];

  if (userId) {
    mobileMenuItems.push({
      href: "/lists",
      label: "My Lists",
      icon: FolderOpen,
    });
    mobileMenuItems.push({
      href: "/decks",
      label: "My decks",
      icon: FolderOpen,
    });
  }

  return (
    <>
      <header className="flex w-full justify-between items-center h-[60px] px-4 md:px-6 shadow-md relative text-[#FAF9F3] bg-black z-50">
        {!loading && (
          <>
            {/* Logo y menú desktop */}
            <div className="flex items-center gap-6 justify-between w-full">
              <div className="flex items-center gap-6">
                {/* Logo */}
                <Link
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = "/";
                  }}
                  className="flex items-center"
                >
                  <Image
                    src={Logo}
                    height={120}
                    width={120}
                    alt="logo"
                    className="invert w-[100px] md:w-[120px] h-auto"
                  />
                </Link>

                {/* Menú Desktop */}
                <nav className="hidden md:flex items-center gap-6">
                  <span className="text-gray-600">|</span>
                  {desktopMenuItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative text-white hover:text-gray-300 transition-colors font-medium ${
                        (item.href === "/" && pathname.length === 0) ||
                        (item.href !== "/" &&
                          pathname[0] === item.href.slice(1))
                          ? "after:absolute after:bottom-[-20px] after:left-0 after:w-full after:h-[2px] after:bg-white after:transition-transform after:duration-300"
                          : ""
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}

                  {/* Admin Dropdown Menu Desktop */}
                  {role === "ADMIN" && (
                    <>
                      <span className="text-gray-600">|</span>
                      <div className="relative" ref={adminMenuRef}>
                        <button
                          onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-200 ${
                            isAdminMenuOpen || pathname[0] === "admin"
                              ? "bg-white/10 text-white"
                              : "text-white hover:bg-white/5 hover:text-gray-300"
                          }`}
                        >
                          <Shield size={16} className="text-red-400" />
                          <span className="font-medium">Admin</span>
                          <ChevronDown
                            size={14}
                            className={`transition-transform duration-200 ${
                              isAdminMenuOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {/* Dropdown Menu */}
                        {isAdminMenuOpen && (
                          <div className="absolute top-full mt-2 right-0 w-64 bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden z-50">
                            <div className="p-2 border-b border-gray-800">
                              <p className="text-xs text-gray-400 font-medium px-2">
                                ADMIN TOOLS
                              </p>
                            </div>
                            <div className="p-2">
                              {adminMenuItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname
                                  .join("/")
                                  .includes(item.href.slice(1));

                                return (
                                  <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsAdminMenuOpen(false)}
                                    className={`flex items-start gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group ${
                                      isActive
                                        ? "bg-red-500/20 text-white"
                                        : "hover:bg-white/5 text-gray-300 hover:text-white"
                                    }`}
                                  >
                                    <Icon
                                      size={18}
                                      className={`mt-0.5 ${
                                        isActive
                                          ? "text-red-400"
                                          : "text-gray-500 group-hover:text-gray-400"
                                      }`}
                                    />
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">
                                        {item.label}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        {item.description}
                                      </p>
                                    </div>
                                    {isActive && (
                                      <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2"></div>
                                    )}
                                  </Link>
                                );
                              })}
                            </div>
                            <div className="p-2 border-t border-gray-800">
                              <Link
                                href="/admin"
                                onClick={() => setIsAdminMenuOpen(false)}
                                className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-all duration-200"
                              >
                                View all admin options →
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </nav>
              </div>

              {/* Botones de autenticación desktop */}
              <div className="hidden md:flex gap-4">
                {userId ? (
                  <>
                    <Button
                      asChild
                      variant="outline"
                      className="bg-transparent border border-white hover:bg-white hover:text-black transition-all duration-300 rounded-md flex items-center gap-2"
                    >
                      <Link href="/account/settings" className="flex items-center gap-2">
                        <UserIcon size={18} />
                        <span>Mi cuenta</span>
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      className="bg-transparent border border-white hover:bg-white hover:text-black transition-all duration-300 rounded-md flex items-center gap-2"
                      onClick={() => signOut({ callbackUrl: "/?from=logout" })}
                    >
                      <LogOutIcon size={18} />
                      <span>Sign Out</span>
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setIsOpen(true)}
                    variant="outline"
                    className="bg-transparent border border-white hover:bg-white hover:text-black transition-all duration-300 rounded-md flex items-center gap-2"
                  >
                    <UserIcon size={18} />
                    <span>Sign In</span>
                  </Button>
                )}
              </div>

              {/* Botón de menú móvil */}
              <button
                className="mobile-menu-button md:hidden p-2 rounded-md hover:bg-white/10 transition-colors relative z-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                }}
                aria-label="Toggle mobile menu"
              >
                {isMobileMenuOpen ? (
                  <X size={24} className="text-white" />
                ) : (
                  <Menu size={24} className="text-white" />
                )}
              </button>
            </div>
          </>
        )}

        <LoginModal
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false);
          }}
        />
      </header>

      {/* Menú móvil overlay */}
      {!loading && (
        <div
          className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
            isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Menú móvil panel */}
      {!loading && (
        <div
          ref={mobileMenuRef}
          className={`fixed top-[60px] right-0 bottom-0 w-[280px] bg-gray-900 border-l border-gray-800 shadow-2xl z-50 md:hidden transform transition-transform duration-300 ease-out ${
            isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Enlaces principales */}
            <nav className="flex-1 p-4">
              <div className="space-y-1">
                {mobileMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    (item.href === "/" && pathname.length === 0) ||
                    (item.href !== "/" && pathname[0] === item.href.slice(1));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                        isActive
                          ? "bg-white/10 text-white"
                          : "text-gray-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon
                        size={20}
                        className={isActive ? "text-white" : "text-gray-400"}
                      />
                      <span className="font-medium text-gray-400">
                        {item.label}
                      </span>
                      {isActive && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Sección Admin en móvil */}
              {role === "ADMIN" && (
                <div className="mt-6 pt-6 border-t border-gray-800">
                  <p className="text-xs text-gray-400 font-medium px-4 mb-3">
                    ADMIN TOOLS
                  </p>
                  <div className="space-y-1">
                    {adminMenuItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname
                        .join("/")
                        .includes(item.href.slice(1));

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                            isActive
                              ? "bg-red-500/20 text-white"
                              : "text-gray-300 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <Icon
                            size={20}
                            className={
                              isActive ? "text-red-400" : "text-gray-400"
                            }
                          />
                          <span className="font-medium text-gray-400">
                            {item.label}
                          </span>
                          {isActive && (
                            <div className="ml-auto w-2 h-2 bg-red-400 rounded-full"></div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </nav>

            {/* Botón de autenticación móvil */}
            <div className="p-4 border-t border-gray-800">
              {userId ? (
                <Button
                  variant="outline"
                  className="w-full bg-transparent border border-white hover:bg-white hover:text-black transition-all duration-300 rounded-md flex items-center justify-center gap-2"
                  onClick={() => signOut({ callbackUrl: "/?from=logout" })}
                >
                  <LogOutIcon size={18} />
                  <span className="text-white">Sign Out</span>
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsOpen(true);
                  }}
                  variant="outline"
                  className="w-full bg-transparent border border-white hover:bg-white hover:text-black transition-all duration-300 rounded-md flex items-center justify-center gap-2"
                >
                  <UserIcon size={18} />
                  <span>Sign In</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NavBar;
