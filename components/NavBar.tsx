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
  Upload,
  Images,
  Menu,
  X,
  Home,
  Layers,
  Copy,
  FolderOpen,
  ShoppingBag,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import {
  siInstagram,
  siTiktok,
  siFacebook,
  siDiscord,
  siYoutube,
} from "simple-icons/icons";
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

  const adminMenuCategories = [
    {
      category: "Cards & Sets",
      items: [
        {
          href: "/admin/edit-card",
          label: "Edit Card",
          icon: Edit,
          description: "Modify existing cards",
        },
        {
          href: "/admin/add-set",
          label: "Add Set",
          icon: Plus,
          description: "Create new card sets",
        },
        {
          href: "/admin/upload-sets",
          label: "Upload Sets",
          icon: Upload,
          description: "Bulk upload card sets",
        },
        {
          href: "/admin/add-rulings",
          label: "Add Rulings",
          icon: FileText,
          description: "Add card rulings",
        },
        {
          href: "/admin/dons",
          label: "Admin Don!!",
          icon: Shield,
          description: "Gestiona Don base y alternos",
        },
      ],
    },
    {
      category: "Events & Scraping",
      items: [
        {
          href: "/admin/events",
          label: "Events",
          icon: Calendar,
          description: "Aprueba y edita eventos",
        },
        {
          href: "/admin/missing-sets",
          label: "Missing Sets",
          icon: AlertTriangle,
          description: "Aprueba sets detectados",
        },
        {
          href: "/admin/missing-cards",
          label: "Missing Cards",
          icon: AlertTriangle,
          description: "Aprueba cartas detectadas",
        },
      ],
    },
    {
      category: "Shop & Decks",
      items: [
        {
          href: "/admin/create-decks",
          label: "Crear Decks",
          icon: ShoppingBag,
          description: "Decks para la tienda",
        },
        {
          href: "/admin/shop-decks",
          label: "Gestionar Decks",
          icon: Layers,
          description: "Edita y publica decks",
        },
      ],
    },
    {
      category: "Media",
      items: [
        {
          href: "/admin/upload-image-r2",
          label: "Upload Images",
          icon: Images,
          description: "Sube imágenes a R2",
        },
      ],
    },
  ];

  // Flatten para mantener compatibilidad con mobile
  const adminMenuItems = adminMenuCategories.flatMap((cat) => cat.items);

  // Menú completo para desktop
  const desktopMenuItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/deckbuilder", label: "Deckbuilder", icon: Layers },
    { href: "/events", label: "Events", icon: Calendar },
    //{ href: "/shop", label: "Shop", icon: ShoppingBag },
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
    //{ href: "/shop", label: "Shop", icon: ShoppingBag },
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

  const renderSocialIcon = (path: string, label: string) => (
    <svg
      aria-hidden="true"
      focusable="false"
      role="img"
      viewBox="0 0 24 24"
      className="h-5 w-5 text-white fill-current"
    >
      <title>{label}</title>
      <path d={path} />
    </svg>
  );

  const socialLinks = [
    {
      href: "https://www.instagram.com/ohara.tcg",
      label: "Instagram",
      iconPath: siInstagram.path,
    },
    {
      href: "https://www.tiktok.com/@ohara.tcg",
      label: "TikTok",
      iconPath: siTiktok.path,
    },
    {
      href: "https://www.facebook.com/ohara.tcg.shop",
      label: "Facebook",
      iconPath: siFacebook.path,
    },
    {
      href: "https://discord.com/invite/BJYGaAuadB",
      label: "Discord",
      iconPath: siDiscord.path,
    },
    {
      href: "https://www.youtube.com/@oharatcg_op",
      label: "YouTube",
      iconPath: siYoutube.path,
    },
  ];

  return (
    <>
      <header className="flex w-full flex-wrap items-center gap-3 px-4 md:px-6 py-3 shadow-md relative text-[#FAF9F3] bg-black z-50">
        {!loading && (
          <div className="flex items-center gap-4 w-full">
            {/* Logo y menú desktop */}
            <div className="flex items-center gap-4 justify-between flex-1 min-w-0">
              <div className="flex items-center gap-4 min-w-0">
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
                <nav className="hidden md:flex flex-wrap lg:flex-nowrap items-center gap-4 text-sm">
                  <span className="text-gray-600 flex-shrink-0">|</span>
                  {desktopMenuItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative text-white hover:text-gray-300 transition-colors font-medium !no-underline  ${
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
                      <span className="text-gray-600 flex-shrink-0">|</span>
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

                        {/* Dropdown Menu - Modern Grid Layout */}
                        {isAdminMenuOpen && (
                          <div className="absolute top-full mt-2 right-0 w-[600px] max-w-[90vw] bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden z-50">
                            <div className="p-3 border-b border-gray-800 bg-gray-900/50">
                              <p className="text-xs text-white font-semibold px-2">
                                ADMIN TOOLS
                              </p>
                            </div>
                            <div className="p-3 grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
                              {adminMenuCategories.map((category) => (
                                <div
                                  key={category.category}
                                  className="space-y-1"
                                >
                                  <p className="text-[10px] text-white font-semibold px-2 mb-2 uppercase tracking-wider">
                                    {category.category}
                                  </p>
                                  {category.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = pathname
                                      .join("/")
                                      .includes(item.href.slice(1));

                                    return (
                                      <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() =>
                                          setIsAdminMenuOpen(false)
                                        }
                                        className={`flex items-start gap-2.5 px-3 py-2 rounded-md transition-all duration-200 group no-underline ${
                                          isActive
                                            ? "bg-red-500/20 text-white shadow-sm"
                                            : "hover:bg-white/5 text-gray-300 hover:text-white"
                                        }`}
                                      >
                                        <Icon
                                          size={16}
                                          className={`mt-0.5 flex-shrink-0 ${
                                            isActive
                                              ? "text-red-400"
                                              : "text-white group-hover:text-gray-400"
                                          }`}
                                        />
                                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                                          <p className="font-medium text-xs leading-tight no-underline text-white">
                                            {item.label}
                                          </p>
                                          <p className="text-[10px] !no-underline mt-0.5 leading-tight text-white">
                                            {item.description}
                                          </p>
                                        </div>
                                        {isActive && (
                                          <div className="w-1 h-1 bg-red-400 rounded-full mt-1 flex-shrink-0"></div>
                                        )}
                                      </Link>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                            <div className="p-2 border-t border-gray-800 bg-gray-900/50">
                              <Link
                                href="/admin"
                                onClick={() => setIsAdminMenuOpen(false)}
                                className="flex items-center justify-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-all duration-200"
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

              {/* Redes sociales + botones de autenticación desktop */}
              <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-2 pr-2">
                  {socialLinks.map(({ href, label, iconPath }) => (
                    <Link
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-white/5 hover:bg-white/15 transition-colors"
                      aria-label={label}
                    >
                      {renderSocialIcon(iconPath, label)}
                    </Link>
                  ))}
                </div>
                {userId ? (
                  <Button
                    variant="outline"
                    className="bg-transparent border border-white hover:bg-white hover:text-black transition-all duration-300 rounded-md flex items-center gap-2"
                    onClick={() => signOut({ callbackUrl: "/?from=logout" })}
                  >
                    <LogOutIcon size={18} />
                    <span>Sign Out</span>
                  </Button>
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
                className="mobile-menu-button md:hidden p-2 rounded-md hover:bg-white/10 transition-colors relative z-50 ml-auto"
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
          </div>
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
          className={`fixed top-[60px] right-0 bottom-0 w-[300px] bg-gray-900 border-l border-gray-800 shadow-2xl z-50 md:hidden transform transition-transform duration-300 ease-out ${
            isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Enlaces principales */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-6">
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
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-white no-underline ${
                        isActive
                          ? "bg-white/10 text-white"
                          : "text-gray-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon
                        size={20}
                        className={isActive ? "text-white" : "text-white"}
                      />
                      <span className="font-medium text-white">
                        {item.label}
                      </span>
                      {isActive && (
                        <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Sección Admin en móvil con categorías */}
              {role === "ADMIN" && (
                <div className="pt-6 border-t border-gray-800">
                  <p className="text-xs text-white font-medium px-4 mb-3">
                    ADMIN TOOLS
                  </p>
                  <div className="space-y-4">
                    {adminMenuCategories.map((category) => (
                      <div key={category.category} className="space-y-1">
                        <p className="text-[10px] text-white font-semibold px-4 mb-2 uppercase tracking-wider">
                          {category.category}
                        </p>
                        {category.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = pathname
                            .join("/")
                            .includes(item.href.slice(1));

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 no-underline ${
                                isActive
                                  ? "bg-red-500/20 text-white"
                                  : "text-gray-300 hover:bg-white/5 hover:text-white"
                              }`}
                            >
                              <Icon
                                size={18}
                                className={
                                  isActive ? "text-white" : "text-white"
                                }
                              />
                              <span className="font-medium text-sm text-white">
                                {item.label}
                              </span>
                              {isActive && (
                                <div className="ml-auto w-2 h-2 bg-red-400 rounded-full"></div>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Redes sociales mobile */}
              <div className="mt-8">
                <p className="text-xs text-gray-400 font-medium px-1 mb-3">
                  FOLLOW US
                </p>
                <div className="flex flex-wrap gap-3">
                  {socialLinks.map(({ href, label, iconPath }) => (
                    <Link
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-[48px] flex items-center justify-center p-3 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-colors"
                    >
                      {renderSocialIcon(iconPath, label)}
                      <span className="sr-only">{label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </nav>

            {/* Botón de autenticación móvil */}
            <div className="p-4 border-t border-gray-800">
              {userId ? (
                <Button
                  variant="outline"
                  className="w-full bg-transparent border border-white hover:bg-white hover:text-black transition-all duration-300 rounded-md flex items-center justify-center gap-2"
                  onClick={() => signOut({ callbackUrl: "/?from=logout" })}
                >
                  <LogOutIcon size={18} className="text-white" />
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
