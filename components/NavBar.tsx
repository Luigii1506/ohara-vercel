"use client";

import Link from "next/link";
import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Logo from "@/public/assets/images/LOGO_OHARA.svg";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { useUser } from "@/app/context/UserContext";
import { lockBodyScroll, unlockBodyScroll } from "@/components/ui/BaseDrawer";

import { Button } from "@/components/ui/button";
import BaseDrawer from "@/components/ui/BaseDrawer";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useRegion } from "@/components/region/RegionProvider";
import { DEFAULT_REGION } from "@/lib/regions";
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
  RefreshCw,
  Trophy,
  Globe,
  MapPin,
} from "lucide-react";
import {
  siInstagram,
  siTiktok,
  siFacebook,
  siDiscord,
  siYoutube,
} from "simple-icons/icons";
import LoginModal from "./LoginModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NavBar = () => {
  const pathname =
    usePathname()
      ?.split("/")
      .filter((segment) => segment !== "") || [];

  const { userId, role, loading } = useUser();
  const { t, lang, setLang, languages } = useI18n();
  const { region, setRegion, regions } = useRegion();

  const [isOpen, setIsOpen] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLanguageDrawerOpen, setIsLanguageDrawerOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isRegionDrawerOpen, setIsRegionDrawerOpen] = useState(false);
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
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
  const wasMenuOpenRef = useRef(false);
  useEffect(() => {
    if (isMobileMenuOpen) {
      if (!wasMenuOpenRef.current) {
        lockBodyScroll();
        wasMenuOpenRef.current = true;
      }
    } else {
      if (wasMenuOpenRef.current) {
        unlockBodyScroll();
        wasMenuOpenRef.current = false;
      }
    }
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
        {
          href: "/admin/region-alternates",
          label: "Region Alternates",
          icon: Images,
          description: "Sync alternateArt from US cards",
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
          href: "/admin/tournaments",
          label: "Tournament Insights",
          icon: Trophy,
          description: "Resultados y decklists sincronizados",
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
        {
          href: "/admin/event-scraper",
          label: "Scraper Lab",
          icon: RefreshCw,
          description: "Dry-run tools para scraping",
        },
        {
          href: "/admin/tcg-sync",
          label: "TCG Sync",
          icon: RefreshCw,
          description: "Sincroniza catálogos con TCGplayer",
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

  const publicDesktopMenuItems = [
    { href: "/", label: t("nav.home"), icon: Home },
    { href: "/deckbuilder", label: t("nav.deckbuilder"), icon: Layers },
    { href: "/events", label: t("nav.events"), icon: Calendar },
    { href: "/tournaments", label: t("nav.tournaments"), icon: Trophy },
    //{ href: "/shop", label: "Shop", icon: ShoppingBag },
    { href: "/proxies", label: "Proxies", icon: Copy },
  ];

  const privateDesktopMenuItems = [
    { href: "/decks", label: t("nav.decks"), icon: FolderOpen },
  ];

  const publicMobileMenuItems = [
    { href: "/", label: t("nav.home"), icon: Home },
    { href: "/deckbuilder", label: t("nav.deckbuilder"), icon: Layers },
    { href: "/events", label: t("nav.events"), icon: Calendar },
    { href: "/tournaments", label: t("nav.tournaments"), icon: Trophy },
    { href: "/proxies", label: "Proxies", icon: Copy },
    //{ href: "/shop", label: "Shop", icon: ShoppingBag },
  ];

  const privateMobileMenuItems = [
    { href: "/decks", label: t("nav.decks"), icon: FolderOpen },
  ];

  const showPrivateMenus = Boolean(userId);
  const showAdminMenu = role === "ADMIN";

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

  const renderDesktopAuth = () => {
    if (loading) {
      return (
        <div className="h-10 w-28 rounded-md border border-white/20 bg-white/5 animate-pulse" />
      );
    }
    if (userId) {
      return (
        <Button
          variant="outline"
          className="h-10 bg-transparent border border-white hover:bg-white hover:text-black transition-all duration-300 rounded-md flex items-center gap-2"
          onClick={() => signOut({ callbackUrl: "/?from=logout" })}
        >
          <LogOutIcon size={18} />
          <span>Sign Out</span>
        </Button>
      );
    }

    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="h-10 bg-transparent border border-white hover:bg-white hover:text-black transition-all duration-300 rounded-md flex items-center gap-2"
      >
        <UserIcon size={18} />
        <span>{t("auth.signIn")}</span>
      </Button>
    );
  };

  const renderMobileAuth = () => {
    if (loading) {
      return (
        <div className="w-full h-11 rounded-md border border-white/20 bg-white/5 animate-pulse" />
      );
    }

    if (userId) {
      return (
        <Button
          variant="outline"
          className="w-full h-11 bg-transparent border border-white hover:bg-white hover:text-black transition-all duration-300 rounded-md flex items-center justify-center gap-2"
          onClick={() => signOut({ callbackUrl: "/?from=logout" })}
        >
          <LogOutIcon size={18} className="text-white" />
          <span className="text-white">{t("auth.signOut")}</span>
        </Button>
      );
    }

    return (
      <Button
        onClick={() => {
          setIsMobileMenuOpen(false);
          setIsOpen(true);
        }}
        variant="outline"
        className="w-full h-11 bg-transparent border border-white hover:bg-white hover:text-black transition-all duration-300 rounded-md flex items-center justify-center gap-2"
      >
        <UserIcon size={18} className="text-white" />
        <span className="text-white">{t("auth.signIn")}</span>
      </Button>
    );
  };

  return (
    <>
      <header className="flex w-full items-center px-4 md:px-6 h-[70px] md:h-[70px] shadow-md relative text-[#FAF9F3] bg-black z-50">
        <div className="flex flex-wrap items-center gap-4 w-full">
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
                {publicDesktopMenuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative text-white hover:text-gray-300 transition-colors font-medium !no-underline  ${
                      (item.href === "/" && pathname.length === 0) ||
                      (item.href !== "/" && pathname[0] === item.href.slice(1))
                        ? "after:absolute after:bottom-[-20px] after:left-0 after:w-full after:h-[2px] after:bg-white after:transition-transform after:duration-300"
                        : ""
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}

                <div className="flex items-center gap-4 min-w-[240px] flex-shrink-0">
                  {privateDesktopMenuItems.map((item) => {
                    const isActive = pathname
                      .join("/")
                      .startsWith(item.href.slice(1));
                    const hidden = !showPrivateMenus || loading;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        tabIndex={hidden ? -1 : undefined}
                        aria-hidden={hidden}
                        className={`relative font-medium !no-underline whitespace-nowrap transition-colors ${
                          hidden
                            ? "text-transparent pointer-events-none select-none"
                            : "text-white hover:text-gray-300"
                        } ${
                          !hidden && isActive
                            ? "after:absolute after:bottom-[-20px] after:left-0 after:w-full after:h-[2px] after:bg-white after:transition-transform after:duration-300"
                            : ""
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>

                <div className="flex items-center min-w-[140px] justify-end">
                  {loading ? (
                    <div className="h-8 w-24 rounded-md bg-white/10 animate-pulse" />
                  ) : showAdminMenu ? (
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
                          <span className="font-medium">{t("nav.admin")}</span>
                          <ChevronDown
                            size={14}
                            className={`transition-transform duration-200 ${
                              isAdminMenuOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {isAdminMenuOpen && (
                          <div className="absolute top-full mt-2 right-0 w-[600px] max-w-[90vw] bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden z-50">
                            <div className="p-3 border-b border-gray-800 bg-gray-900/50">
                              <p className="text-xs text-white font-semibold px-2">
                                {t("nav.adminTools")}
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
                                {t("nav.viewAllAdmin")} →
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="h-8 w-24 rounded-md opacity-0 pointer-events-none" />
                  )}
                </div>
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
              {role === "ADMIN" && (
                <button
                  type="button"
                  onClick={() => setIsRegionModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-white/10 text-white text-xs font-semibold hover:bg-white/10 transition-colors"
                  aria-label="Region"
                >
                  <MapPin size={16} />
                  <span className="uppercase">{region || DEFAULT_REGION}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsLanguageModalOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-white/10 text-white text-xs font-semibold hover:bg-white/10 transition-colors"
                aria-label="Language"
              >
                <Globe size={16} />
                <span className="uppercase">{lang}</span>
              </button>
              {renderDesktopAuth()}
            </div>

            {/* Botón de menú móvil */}
            <div className="md:hidden flex items-center gap-2 ml-auto">
              {role === "ADMIN" && (
                <button
                  type="button"
                  onClick={() => setIsRegionDrawerOpen(true)}
                  className="p-2 rounded-md hover:bg-white/10 transition-colors"
                  aria-label="Region"
                >
                  <MapPin size={20} className="text-white" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsLanguageDrawerOpen(true)}
                className="p-2 rounded-md hover:bg-white/10 transition-colors"
                aria-label="Language"
              >
                <Globe size={20} className="text-white" />
              </button>
              <button
                className="mobile-menu-button p-2 rounded-md hover:bg-white/10 transition-colors relative z-50"
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
        </div>

        <LoginModal
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false);
          }}
        />
      </header>

      {/* Menú móvil overlay */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Menú móvil panel */}
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
              {publicMobileMenuItems.map((item) => {
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
                    <Icon size={20} className="text-white" />
                    <span className="font-medium text-white">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </Link>
                );
              })}

              {loading && !showPrivateMenus
                ? privateMobileMenuItems.slice(0, 2).map((_, index) => (
                    <div
                      key={`mobile-placeholder-${index}`}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg border border-white/10 bg-white/5 animate-pulse"
                    >
                      <div className="h-5 w-5 rounded-full bg-white/10" />
                      <div className="h-3 w-24 rounded bg-white/15" />
                    </div>
                  ))
                : null}

              {showPrivateMenus &&
                privateMobileMenuItems.map((item) => {
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
                      <Icon size={20} className="text-white" />
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
            {loading ? (
              <div className="pt-6 border-t border-gray-800 space-y-3">
                <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
                <div className="space-y-2">
                  {[0, 1].map((index) => (
                    <div
                      key={`admin-placeholder-${index}`}
                      className="h-10 rounded-lg bg-white/5 border border-white/10 animate-pulse"
                    />
                  ))}
                </div>
              </div>
            ) : showAdminMenu ? (
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
                            <Icon size={18} className="text-white" />
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
            ) : null}

            {/* Redes sociales mobile */}
            <div className="mt-8">
              <p className="text-xs text-gray-400 font-medium px-1 mb-3">
                {t("nav.followUs")}
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
            {renderMobileAuth()}
          </div>
        </div>
      </div>

      <BaseDrawer
        isOpen={isLanguageDrawerOpen}
        onClose={() => setIsLanguageDrawerOpen(false)}
        maxHeight="60vh"
      >
        <div className="px-5 pb-4 flex flex-col">
          <h3 className="text-lg font-semibold text-slate-900">
            {t("language.title")}
          </h3>
          <p className="text-sm text-slate-500">{t("language.subtitle")}</p>
        </div>
        <div className="px-3 pb-6 space-y-1">
          {languages.map((option) => {
            const isActive = option.code === lang;
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => {
                  setLang(option.code);
                  setIsLanguageDrawerOpen(false);
                }}
                className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-200 active:scale-[0.98] ${
                  isActive
                    ? "bg-blue-50 border-2 border-blue-500"
                    : "bg-slate-50 border-2 border-transparent hover:bg-slate-100"
                }`}
              >
                <span className="font-semibold text-slate-900">
                  {option.label}
                </span>
                {isActive && (
                  <span className="text-xs font-semibold text-blue-600 uppercase">
                    {option.code}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </BaseDrawer>

      <Dialog open={isLanguageModalOpen} onOpenChange={setIsLanguageModalOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl border-none bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle>{t("language.title")}</DialogTitle>
            <DialogDescription>{t("language.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-2">
            {languages.map((option) => {
              const isActive = option.code === lang;
              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => {
                    setLang(option.code);
                    setIsLanguageModalOpen(false);
                  }}
                  className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                  }`}
                >
                  <span className="font-semibold">{option.label}</span>
                  <span className="text-xs font-semibold uppercase">
                    {option.code}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {role === "ADMIN" && (
        <>
          <BaseDrawer
            isOpen={isRegionDrawerOpen}
            onClose={() => setIsRegionDrawerOpen(false)}
            maxHeight="60vh"
          >
            <div className="px-5 pb-4 flex flex-col">
              <h3 className="text-lg font-semibold text-slate-900">Region</h3>
              <p className="text-sm text-slate-500">
                Choose the region for card data.
              </p>
            </div>
            <div className="px-3 pb-6 space-y-1">
              {regions.map((option) => {
                const isActive = option.code === region;
                return (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => {
                      setRegion(option.code);
                      setIsRegionDrawerOpen(false);
                    }}
                    className={`w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-200 active:scale-[0.98] ${
                      isActive
                        ? "bg-blue-50 border-2 border-blue-500"
                        : "bg-slate-50 border-2 border-transparent hover:bg-slate-100"
                    }`}
                  >
                    <span className="font-semibold text-slate-900">
                      {option.label}
                    </span>
                    {isActive && (
                      <span className="text-xs font-semibold text-blue-600 uppercase">
                        {option.code}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="h-[env(safe-area-inset-bottom)]" />
          </BaseDrawer>

          <Dialog open={isRegionModalOpen} onOpenChange={setIsRegionModalOpen}>
            <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl border-none bg-white p-6 shadow-2xl">
              <DialogHeader>
                <DialogTitle>Region</DialogTitle>
                <DialogDescription>
                  Choose the region for card data.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-2">
                {regions.map((option) => {
                  const isActive = option.code === region;
                  return (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => {
                        setRegion(option.code);
                        setIsRegionModalOpen(false);
                      }}
                      className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors ${
                        isActive
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                      }`}
                    >
                      <span className="font-semibold">{option.label}</span>
                      <span className="text-xs font-semibold uppercase">
                        {option.code}
                      </span>
                    </button>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
};

export default NavBar;
