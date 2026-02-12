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
  MoreHorizontal,
  List,
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

// Types
interface MenuItem {
  href: string;
  label: string;
  icon: React.ElementType;
  priority?: number; // Lower = more important, shown first
}

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
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const adminMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const previousPathRef = useRef(pathname);

  // Cerrar el menú móvil cuando cambia la ruta
  useEffect(() => {
    const currentPath = pathname.join("/");
    const previousPath = previousPathRef.current.join("/");

    if (currentPath !== previousPath) {
      setIsMobileMenuOpen(false);
      setIsMoreMenuOpen(false);
      setIsUserMenuOpen(false);
      previousPathRef.current = pathname;
    }
  }, [pathname]);

  // Cerrar dropdowns cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        adminMenuRef.current &&
        !adminMenuRef.current.contains(event.target as Node)
      ) {
        setIsAdminMenuOpen(false);
      }
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target as Node)
      ) {
        setIsMoreMenuOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        { href: "/admin/edit-card", label: "Edit Card", icon: Edit, description: "Modify existing cards" },
        { href: "/admin/add-set", label: "Add Set", icon: Plus, description: "Create new card sets" },
        { href: "/admin/upload-sets", label: "Upload Sets", icon: Upload, description: "Bulk upload card sets" },
        { href: "/admin/add-rulings", label: "Add Rulings", icon: FileText, description: "Add card rulings" },
        { href: "/admin/dons", label: "Admin Don!!", icon: Shield, description: "Gestiona Don base y alternos" },
        { href: "/admin/region-alternates", label: "Region Alternates", icon: Images, description: "Sync alternateArt from US cards" },
        { href: "/admin/card-groups", label: "Card Groups", icon: Layers, description: "Agrupa cartas por region" },
      ],
    },
    {
      category: "Events & Scraping",
      items: [
        { href: "/admin/events", label: "Events", icon: Calendar, description: "Aprueba y edita eventos" },
        { href: "/admin/tournaments", label: "Tournament Insights", icon: Trophy, description: "Resultados y decklists sincronizados" },
        { href: "/admin/missing-sets", label: "Missing Sets", icon: AlertTriangle, description: "Aprueba sets detectados" },
        { href: "/admin/missing-cards", label: "Missing Cards", icon: AlertTriangle, description: "Aprueba cartas detectadas" },
        { href: "/admin/missing-products", label: "Missing Products", icon: AlertTriangle, description: "Aprueba productos detectados" },
        { href: "/admin/event-scraper", label: "Scraper Lab", icon: RefreshCw, description: "Dry-run tools para scraping" },
        { href: "/admin/tcg-sync", label: "TCG Sync", icon: RefreshCw, description: "Sincroniza catálogos con TCGplayer" },
      ],
    },
    {
      category: "Shop & Decks",
      items: [
        { href: "/admin/products", label: "Productos", icon: ShoppingBag, description: "Gestiona productos aprobados" },
        { href: "/admin/create-decks", label: "Crear Decks", icon: ShoppingBag, description: "Decks para la tienda" },
        { href: "/admin/shop-decks", label: "Gestionar Decks", icon: Layers, description: "Edita y publica decks" },
      ],
    },
    {
      category: "Media",
      items: [
        { href: "/admin/upload-image-r2", label: "Upload Images", icon: Images, description: "Sube imágenes a R2" },
      ],
    },
  ];

  // Menú principal reorganizado por prioridad
  const mainMenuItems: MenuItem[] = [
    { href: "/", label: t("nav.home"), icon: Home, priority: 1 },
    { href: "/deckbuilder", label: t("nav.deckbuilder"), icon: Layers, priority: 2 },
    { href: "/events", label: t("nav.events"), icon: Calendar, priority: 3 },
    { href: "/tournaments", label: t("nav.tournaments"), icon: Trophy, priority: 4 },
  ];

  // Items que van en el menú "More" en pantallas medianas
  const secondaryMenuItems: MenuItem[] = [
    { href: "/proxies", label: "Proxies", icon: Copy, priority: 5 },
    { href: "/products", label: "Products", icon: ShoppingBag, priority: 6 },
  ];

  // Items privados (solo usuarios logueados)
  const privateMenuItems: MenuItem[] = [
    { href: "/lists", label: "My Lists", icon: List, priority: 1 },
    { href: "/collection", label: t("nav.collection"), icon: FolderOpen, priority: 2 },
    { href: "/decks", label: t("nav.decks"), icon: FolderOpen, priority: 3 },
  ];

  const showPrivateMenus = Boolean(userId);
  const showAdminMenu = role === "ADMIN";
  const showProducts = showAdminMenu && !loading;

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
    { href: "https://www.instagram.com/ohara.tcg", label: "Instagram", iconPath: siInstagram.path },
    { href: "https://www.tiktok.com/@ohara.tcg", label: "TikTok", iconPath: siTiktok.path },
    { href: "https://www.facebook.com/ohara.tcg.shop", label: "Facebook", iconPath: siFacebook.path },
    { href: "https://discord.com/invite/BJYGaAuadB", label: "Discord", iconPath: siDiscord.path },
    { href: "https://www.youtube.com/@oharatcg_op", label: "YouTube", iconPath: siYoutube.path },
  ];

  // Helper para verificar si un item está activo
  const isItemActive = (href: string) => {
    if (href === "/") return pathname.length === 0;
    return pathname[0] === href.slice(1);
  };



  return (
    <>
      <header className="flex w-full items-center px-4 lg:px-6 h-[70px] shadow-md relative text-[#FAF9F3] bg-black z-50">
        <div className="flex items-center gap-4 w-full">
          {/* Logo */}
          <Link
            href="/"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = "/";
            }}
            className="flex items-center flex-shrink-0"
          >
            <Image
              src={Logo}
              height={120}
              width={120}
              alt="logo"
              className="w-[100px] lg:w-[120px] h-auto"
            />
          </Link>

          {/* Desktop Navigation - Optimizada para diferentes tamaños */}
          <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 flex-1 min-w-0 overflow-hidden">
            {/* Separator */}
            <span className="text-gray-600 flex-shrink-0 mx-0.5 lg:mx-1">|</span>

            {/* Main menu items - Compacto en md, normal en lg+ */}
            {mainMenuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-1.5 lg:px-3 py-2 text-white hover:text-gray-300 transition-colors font-medium text-xs lg:text-sm whitespace-nowrap !no-underline ${
                  isItemActive(item.href)
                    ? "after:absolute after:bottom-[-2px] after:left-1.5 after:right-1.5 lg:after:left-3 lg:after:right-3 after:h-[2px] after:bg-white"
                    : ""
                }`}
              >
                {item.label}
              </Link>
            ))}

            {/* Private menu items - Compacto en pantallas medianas */}
            {showPrivateMenus && (
              <>
                <span className="text-gray-600 flex-shrink-0 mx-0.5 lg:mx-1">|</span>
                {privateMenuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative px-1.5 lg:px-3 py-2 text-white hover:text-gray-300 transition-colors font-medium text-xs lg:text-sm whitespace-nowrap !no-underline ${
                      isItemActive(item.href)
                        ? "after:absolute after:bottom-[-2px] after:left-1.5 after:right-1.5 lg:after:left-3 lg:after:right-3 after:h-[2px] after:bg-white"
                        : ""
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </>
            )}

            {/* Menú "More" para items secundarios (proxies, products) */}
            {(secondaryMenuItems.length > 0 || showProducts) && (
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                  className={`flex items-center gap-1 px-1.5 lg:px-3 py-2 rounded-md transition-all duration-200 text-xs lg:text-sm ${
                    isMoreMenuOpen
                      ? "bg-white/10 text-white"
                      : "text-white hover:bg-white/5 hover:text-gray-300"
                  }`}
                >
                  <span className="font-medium">More</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isMoreMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isMoreMenuOpen && (
                  <div className="absolute top-full mt-2 left-0 w-48 bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden z-50 py-1">
                    {secondaryMenuItems.map((item) => {
                      const Icon = item.icon;
                      const active = isItemActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsMoreMenuOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 transition-all duration-200 ${
                            active
                              ? "bg-white/10 text-white"
                              : "text-gray-300 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <Icon size={16} className={active ? "text-white" : "text-gray-400"} />
                          <span className="font-medium text-sm">{item.label}</span>
                        </Link>
                      );
                    })}
                    {showProducts && (
                      <Link
                        href="/products"
                        onClick={() => setIsMoreMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 transition-all duration-200 ${
                          isItemActive("/products")
                            ? "bg-white/10 text-white"
                            : "text-gray-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <ShoppingBag size={16} className={isItemActive("/products") ? "text-white" : "text-gray-400"} />
                        <span className="font-medium text-sm">Products</span>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Admin Menu */}
            {showAdminMenu && (
              <>
                <span className="text-gray-600 flex-shrink-0 mx-0.5 lg:mx-1">|</span>
                <div className="relative" ref={adminMenuRef}>
                  <button
                    onClick={() => setIsAdminMenuOpen(!isAdminMenuOpen)}
                    className={`flex items-center gap-1.5 lg:gap-2 px-1.5 lg:px-3 py-2 rounded-md transition-all duration-200 ${
                      isAdminMenuOpen || pathname[0] === "admin"
                        ? "bg-white/10 text-white"
                        : "text-white hover:bg-white/5 hover:text-gray-300"
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-red-400" />
                    <span className="font-medium text-xs lg:text-sm">{t("nav.admin")}</span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${isAdminMenuOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isAdminMenuOpen && (
                    <div className="absolute top-full mt-2 right-0 w-[600px] max-w-[90vw] bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden z-50">
                      <div className="p-3 border-b border-gray-800 bg-gray-900/50">
                        <p className="text-xs text-white font-semibold px-2">{t("nav.adminTools")}</p>
                      </div>
                      <div className="p-3 grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
                        {adminMenuCategories.map((category) => (
                          <div key={category.category} className="space-y-1">
                            <p className="text-[10px] text-white font-semibold px-2 mb-2 uppercase tracking-wider">
                              {category.category}
                            </p>
                            {category.items.map((item) => {
                              const Icon = item.icon;
                              const isActive = pathname.join("/").includes(item.href.slice(1));
                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  onClick={() => setIsAdminMenuOpen(false)}
                                  className={`flex items-start gap-2.5 px-3 py-2 rounded-md transition-all duration-200 group no-underline ${
                                    isActive
                                      ? "bg-red-500/20 text-white shadow-sm"
                                      : "hover:bg-white/5 text-gray-300 hover:text-white"
                                  }`}
                                >
                                  <Icon
                                    size={16}
                                    className={`mt-0.5 flex-shrink-0 ${isActive ? "text-red-400" : "text-white group-hover:text-gray-400"}`}
                                  />
                                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                                    <p className="font-medium text-xs leading-tight no-underline text-white">
                                      {item.label}
                                    </p>
                                    <p className="text-[10px] !no-underline mt-0.5 leading-tight text-white">
                                      {item.description}
                                    </p>
                                  </div>
                                  {isActive && <div className="w-1 h-1 bg-red-400 rounded-full mt-1 flex-shrink-0"></div>}
                                </Link>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </nav>

          {/* Right side - Responsive design */}
          <div className="hidden md:flex items-center gap-1 lg:gap-2 flex-shrink-0 ml-auto">
            {/* Extra large screens: Everything visible */}
            <div className="hidden xl:flex items-center gap-1 pr-2">
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

            {/* Large screens: Region + Language buttons */}
            <div className="hidden lg:flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsRegionModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-white/10 text-white text-xs font-semibold hover:bg-white/10 transition-colors"
                aria-label="Region"
              >
                <MapPin size={14} />
                <span className="uppercase hidden xl:inline">{region || DEFAULT_REGION}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsLanguageModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-white/10 text-white text-xs font-semibold hover:bg-white/10 transition-colors"
                aria-label="Language"
              >
                <Globe size={14} />
                <span className="uppercase">{lang}</span>
              </button>
            </div>

            {/* Medium screens: Icon only for region */}
            <div className="flex lg:hidden items-center gap-1">
              <button
                type="button"
                onClick={() => setIsRegionModalOpen(true)}
                className="p-2 rounded-md border border-white/10 text-white hover:bg-white/10 transition-colors"
                aria-label="Region"
              >
                <MapPin size={16} />
              </button>
              <button
                type="button"
                onClick={() => setIsLanguageModalOpen(true)}
                className="p-2 rounded-md border border-white/10 text-white hover:bg-white/10 transition-colors"
                aria-label="Language"
              >
                <Globe size={16} />
              </button>
            </div>

            {/* User Menu - Combines auth and social on smaller screens */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200 ${
                  isUserMenuOpen ? "bg-white/10 text-white" : "text-white hover:bg-white/5"
                }`}
              >
                {loading ? (
                  <div className="h-5 w-5 rounded-full bg-white/20 animate-pulse" />
                ) : userId ? (
                  <UserIcon size={18} />
                ) : (
                  <UserIcon size={18} />
                )}
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isUserMenuOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isUserMenuOpen && (
                <div className="absolute top-full mt-2 right-0 w-56 bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden z-50 py-1">
                  {/* Auth section */}
                  {loading ? (
                    <div className="px-4 py-3">
                      <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
                    </div>
                  ) : userId ? (
                    <>
                      <div className="px-4 py-2 border-b border-gray-800">
                        <p className="text-xs text-gray-400">Signed in as</p>
                        <p className="text-sm font-medium text-white truncate">User</p>
                      </div>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          signOut({ callbackUrl: "/?from=logout" });
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-left"
                      >
                        <LogOutIcon size={16} />
                        <span className="text-sm">Sign Out</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-left"
                    >
                      <UserIcon size={16} />
                      <span className="text-sm">Sign In</span>
                    </button>
                  )}

                  {/* Social links - shown in user menu on smaller screens */}
                  <div className="xl:hidden border-t border-gray-800 mt-1 pt-1">
                    <p className="px-4 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider">Follow Us</p>
                    <div className="flex items-center gap-1 px-3 pb-2">
                      {socialLinks.map(({ href, label, iconPath }) => (
                        <Link
                          key={href}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="p-2 rounded-md hover:bg-white/10 transition-colors"
                          aria-label={label}
                        >
                          {renderSocialIcon(iconPath, label)}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={() => setIsRegionDrawerOpen(true)}
              className="p-2 rounded-md hover:bg-white/10 transition-colors"
              aria-label="Region"
            >
              <MapPin size={20} className="text-white" />
            </button>
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
              {isMobileMenuOpen ? <X size={24} className="text-white" /> : <Menu size={24} className="text-white" />}
            </button>
          </div>
        </div>

        <LoginModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </header>

      {/* Mobile menu overlay */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Mobile menu panel */}
      <div
        ref={mobileMenuRef}
        className={`fixed top-[60px] right-0 bottom-0 w-[300px] bg-gray-900 border-l border-gray-800 shadow-2xl z-50 md:hidden transform transition-transform duration-300 ease-out ${
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <nav className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Public items */}
            <div className="space-y-1">
              {mainMenuItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-white no-underline ${
                      active ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon size={20} className="text-white" />
                    <span className="font-medium text-white">{item.label}</span>
                    {active && <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>}
                  </Link>
                );
              })}
              
              {/* Products for admin */}
              {showProducts && (
                <Link
                  href="/products"
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-white no-underline ${
                    isItemActive("/products") ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <ShoppingBag size={20} className="text-white" />
                  <span className="font-medium text-white">Products</span>
                  {isItemActive("/products") && <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>}
                </Link>
              )}

              {/* Secondary items */}
              {secondaryMenuItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-white no-underline ${
                      active ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon size={20} className="text-white" />
                    <span className="font-medium text-white">{item.label}</span>
                    {active && <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>}
                  </Link>
                );
              })}
            </div>

            {/* Private items */}
            {showPrivateMenus && (
              <div className="pt-4 border-t border-gray-800 space-y-1">
                <p className="text-xs text-gray-400 font-medium px-4 mb-2">MY ACCOUNT</p>
                {privateMenuItems.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-white no-underline ${
                        active ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon size={20} className="text-white" />
                      <span className="font-medium text-white">{item.label}</span>
                      {active && <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Admin items */}
            {showAdminMenu && (
              <div className="pt-4 border-t border-gray-800">
                <p className="text-xs text-white font-medium px-4 mb-3">ADMIN TOOLS</p>
                <div className="space-y-4">
                  {adminMenuCategories.map((category) => (
                    <div key={category.category} className="space-y-1">
                      <p className="text-[10px] text-white font-semibold px-4 mb-2 uppercase tracking-wider">
                        {category.category}
                      </p>
                      {category.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname.join("/").includes(item.href.slice(1));
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 no-underline ${
                              isActive ? "bg-red-500/20 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <Icon size={18} className="text-white" />
                            <span className="font-medium text-sm text-white">{item.label}</span>
                            {isActive && <div className="ml-auto w-2 h-2 bg-red-400 rounded-full"></div>}
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Social links */}
            <div className="pt-4">
              <p className="text-xs text-gray-400 font-medium px-1 mb-3">{t("nav.followUs")}</p>
              <div className="flex flex-wrap gap-2">
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

          {/* Auth button */}
          <div className="p-4 border-t border-gray-800">
            {loading ? (
              <div className="w-full h-11 rounded-md border border-white/20 bg-white/5 animate-pulse" />
            ) : userId ? (
              <Button
                variant="outline"
                className="w-full h-11 bg-transparent border border-white hover:bg-white hover:text-black transition-all duration-300 rounded-md flex items-center justify-center gap-2"
                onClick={() => signOut({ callbackUrl: "/?from=logout" })}
              >
                <LogOutIcon size={18} className="text-white" />
                <span className="text-white">{t("auth.signOut")}</span>
              </Button>
            ) : (
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
            )}
          </div>
        </div>
      </div>

      {/* Language Drawer */}
      <BaseDrawer isOpen={isLanguageDrawerOpen} onClose={() => setIsLanguageDrawerOpen(false)} maxHeight="60vh">
        <div className="px-5 pb-4 flex flex-col">
          <h3 className="text-lg font-semibold text-slate-900">{t("language.title")}</h3>
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
                  isActive ? "bg-blue-50 border-2 border-blue-500" : "bg-slate-50 border-2 border-transparent hover:bg-slate-100"
                }`}
              >
                <span className="font-semibold text-slate-900">{option.label}</span>
                {isActive && <span className="text-xs font-semibold text-blue-600 uppercase">{option.code}</span>}
              </button>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </BaseDrawer>

      {/* Language Modal */}
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
                    isActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                  }`}
                >
                  <span className="font-semibold">{option.label}</span>
                  <span className="text-xs font-semibold uppercase">{option.code}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Region Drawer */}
      <BaseDrawer isOpen={isRegionDrawerOpen} onClose={() => setIsRegionDrawerOpen(false)} maxHeight="60vh">
        <div className="px-5 pb-4 flex flex-col">
          <h3 className="text-lg font-semibold text-slate-900">Region</h3>
          <p className="text-sm text-slate-500">Choose the region for card data.</p>
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
                  isActive ? "bg-blue-50 border-2 border-blue-500" : "bg-slate-50 border-2 border-transparent hover:bg-slate-100"
                }`}
              >
                <span className="font-semibold text-slate-900">{option.label}</span>
                {isActive && <span className="text-xs font-semibold text-blue-600 uppercase">{option.code}</span>}
              </button>
            );
          })}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </BaseDrawer>

      {/* Region Modal */}
      <Dialog open={isRegionModalOpen} onOpenChange={setIsRegionModalOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl border-none bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle>Region</DialogTitle>
            <DialogDescription>Choose the region for card data.</DialogDescription>
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
                    isActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                  }`}
                >
                  <span className="font-semibold">{option.label}</span>
                  <span className="text-xs font-semibold uppercase">{option.code}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NavBar;
