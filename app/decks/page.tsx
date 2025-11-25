"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChartColumnBigIcon,
  ChevronDown,
  Edit,
  Eye,
  Plus,
  Trash2,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Download,
  FileText,
  Check,
  Copy,
  Share2,
  ShoppingBag,
} from "lucide-react";
import { Deck, GroupedDecks, DeckCard } from "@/types";
import { useSession } from "next-auth/react";
import React from "react";
import { getColors } from "@/helpers/functions";
import { Badge } from "@/components/ui/badge";
import { showSuccessToast, showErrorToast } from "@/lib/toastify";
import { Oswald } from "next/font/google";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { rarityFormatter } from "@/helpers/formatters";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// New component to display selected deck cards
const SelectedDeckCards = ({
  deck,
  onBackToList,
  onDelete = () => {},
  mode = "user",
}: {
  deck: Deck;
  onBackToList: () => void;
  onDelete?: () => void;
  mode?: "user" | "shop" | "shop-admin";
}) => {
  const isShopView = mode === "shop" || mode === "shop-admin";
  const isAdminShopView = mode === "shop-admin";
  const isPublicShopView = mode === "shop";
  const canEditDeck = mode === "user" || isAdminShopView;
  const canDeleteDeck = mode === "user" || isAdminShopView;
  // Filter states for deck cards
  const [search, setSearch] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedFilterSearch, setSelectedFilterSearch] = useState("all");
  const [selectedCounter, setSelectedCounter] = useState("");
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [selectedCosts, setSelectedCosts] = useState<string[]>([]);
  const [selectedPower, setSelectedPower] = useState<string[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

  // State for large image view
  const [showLargeImage, setShowLargeImage] = useState(false);
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null);

  // State for mobile tooltips
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [content, setContent] = useState("");
  const [activeTab, setActiveTab] = useState("sansan");
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveTooltip(null);
    };

    if (activeTooltip) {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [activeTooltip]);

  // Function to handle deck deletion
  const handleDelete = async (deckId: number) => {
    try {
      const endpoint = isShopView
        ? `/api/admin/shop-decks/${deckId}`
        : `/api/admin/deck/${deckId}`;
      const res = await fetch(endpoint, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "No se pudo eliminar el deck");
      }

      const data = await res.json();
      console.log("Deck eliminado:", data);
      showSuccessToast("Deck eliminado exitosamente");
      onDelete(); // Call the parent's onDelete function
      onBackToList(); // Go back to the list after deletion
    } catch (error) {
      console.error("Error eliminando deck:", error);
      showErrorToast(
        error instanceof Error ? error.message : "Error eliminando deck"
      );
    }
  };

  // Function to format deck for SanSan Events
  const formatSanSanEvents = () => {
    const leaderCard = deck.deckCards.find(
      (card) => card.card?.category === "Leader"
    );

    if (!leaderCard) {
      return "No se encontró carta líder";
    }

    console.log("deck.deckCards", deck.deckCards);

    // Agrupar cartas por su código, sumando las cantidades (excluyendo el líder)
    const groupedCards = deck.deckCards
      .filter((card) => card.card?.category !== "Leader")
      .reduce((acc: Record<string, DeckCard>, card) => {
        const cardCode = card.card?.code || card.code || "";
        if (acc[cardCode]) {
          acc[cardCode].quantity += card.quantity;
        } else {
          // Copia la carta para luego acumular su cantidad
          acc[cardCode] = { ...card };
        }
        return acc;
      }, {} as Record<string, DeckCard>);

    console.log("groupedCards", groupedCards);

    // Formatear el resultado agrupado con `&nbsp;`
    const formattedCards = Object.values(groupedCards).map(
      (card) =>
        `${card.quantity} -\u200B ${
          card.card?.code || card.code
        } ${rarityFormatter(
          card.card?.rarity || card.rarity || ""
        )}\u200B.\u200B`
    );
    console.log("formattedCards", formattedCards);

    return `1 - ${
      leaderCard.card?.code || leaderCard.code
    } L\u200B.\u200B\n${formattedCards.join("\n")}`;
  };

  // Function to handle export
  const handleExport = () => {
    setIsModalOpen(true);

    requestAnimationFrame(() => {
      setContent(formatSanSanEvents());
    });
  };

  // Function to format deck for OPSim
  const formatOptgsim = (): string => {
    // Agrupa las cartas por código sumando las cantidades
    const groupedCards = deck.deckCards.reduce(
      (acc: Record<string, DeckCard>, card) => {
        const cardCode = card.card?.code || card.code || "";
        if (acc[cardCode]) {
          acc[cardCode].quantity += card.quantity;
        } else {
          // Se clona la carta para no modificar el array original
          acc[cardCode] = { ...card };
        }
        return acc;
      },
      {} as Record<string, DeckCard>
    );

    // Formatea cada grupo en "cantidad x código"
    const formattedCards = Object.values(groupedCards).map(
      (card) => `${card.quantity}x${card.card?.code || card.code}`
    );

    // Get leader code
    const leaderCard = deck.deckCards.find(
      (card) => card.card?.category === "Leader"
    );
    const leaderCode = leaderCard?.card?.code || leaderCard?.code || "";

    // Retorna la cadena final, empezando con el líder
    return `1x${leaderCode}\n${formattedCards.join("\n")}`;
  };

  // Function to handle copy text
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      showSuccessToast("Text copied to clipboard");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error al copiar el texto: ", err);
      showErrorToast("Error al copiar el texto");
    }
  };

  // Function to handle copy URL
  const handleCopyUrl = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showSuccessToast("URL copied to clipboard");
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      console.error("Error al copiar la URL: ", err);
      showErrorToast("Error al copiar la URL");
    }
  };

  // Function to handle share
  const handleShare = async () => {
    const shareData = {
      title: `${deck.name} - One Piece TCG Deck`,
      text: `Check out this One Piece TCG deck: ${deck.name}`,
      url: `https://oharatcg.com/decks/${deck.uniqueUrl}`,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        showSuccessToast("Deck shared successfully");
      } else {
        // Fallback: copy URL to clipboard
        await navigator.clipboard.writeText(shareData.url);
        showSuccessToast("Deck URL copied to clipboard");
      }
    } catch (err) {
      console.error("Error sharing:", err);
      // Fallback: copy URL to clipboard
      try {
        await navigator.clipboard.writeText(shareData.url);
        showSuccessToast("Deck URL copied to clipboard");
      } catch (copyErr) {
        showErrorToast("Error sharing deck");
      }
    }
  };

  // Function to handle proxies
  const handleProxies = () => {
    // Expandir cartas según su cantidad para impresión
    const expandedCards = deck.deckCards.flatMap((card) =>
      Array(card.quantity).fill(card)
    );

    if (expandedCards.length === 0) {
      alert("No hay cartas en el deck para imprimir");
      return;
    }

    // Función helper para determinar si necesita proxy
    const getProxiedImageUrl = (originalUrl: string): string => {
      const problematicDomains = [
        "limitlesstcg.nyc3.digitaloceanspaces.com",
        "digitaloceanspaces.com",
        "limitlesstcg.nyc3.cdn.digitaloceanspaces.com",
        "en.onepiece-cardgame.com",
        "static.dotgg.gg",
        "i.pinimg.com",
        "assets.pokemon.com",
        "bez3ta.com",
        "spellmana.com",
        "oharatcg-21eab.kxcdn.com",
      ];

      try {
        const urlObj = new URL(originalUrl);
        const needsProxy = problematicDomains.some(
          (domain) =>
            urlObj.hostname === domain || urlObj.hostname.endsWith("." + domain)
        );

        if (needsProxy) {
          return `/api/proxy-image?url=${encodeURIComponent(originalUrl)}`;
        }

        return originalUrl; // Las de tu dominio no necesitan proxy
      } catch {
        return originalUrl; // Si falla el parsing, usar URL original
      }
    };

    // Crear modal de impresión
    const printModal = document.createElement("div");
    printModal.className = "print-modal";
    printModal.innerHTML = `
      <style>
        .print-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        
        .print-modal-content {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        
        .print-modal-header {
          padding: 20px;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .print-modal-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        
        .print-modal-actions {
          display: flex;
          gap: 10px;
        }
        
        .print-modal-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .print-modal-btn-primary {
          background: #2196F3;
          color: white;
        }
        
        .print-modal-btn-primary:hover {
          background: #1976d2;
          transform: translateY(-1px);
        }
        
        .print-modal-btn-primary:disabled {
          background: #ccc;
          cursor: not-allowed;
          transform: none;
        }
        
        .print-modal-btn-close {
          background: #f5f5f5;
          color: #666;
        }
        
        .print-modal-btn-close:hover {
          background: #e0e0e0;
        }
        
        .print-preview-container {
          flex: 1;
          overflow: auto;
          padding: 20px;
          background: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }
        
        .print-preview-iframe {
          width: 100%;
          height: 600px;
          border: none;
          background: white;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        
        .loading-container {
          text-align: center;
          padding: 40px;
        }
        
        .loading-spinner {
          width: 50px;
          height: 50px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #2196F3;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .loading-text {
          font-size: 18px;
          color: #666;
          margin-bottom: 10px;
        }
        
        .loading-progress {
          font-size: 14px;
          color: #999;
        }
        
        .info-box {
          background: #e3f2fd;
          border: 1px solid #bbdefb;
          border-radius: 4px;
          padding: 15px;
          margin-bottom: 15px;
          font-size: 14px;
        }
        
        .info-box strong {
          color: #1976d2;
        }
      </style>
      
      <div class="print-modal-content">
        <div class="print-modal-header">
          <h2>Generar PDF de Proxies</h2>
          <div class="print-modal-actions">
            <button id="print-btn" class="print-modal-btn print-modal-btn-primary" disabled>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/>
              </svg>
              Imprimir PDF
            </button>
            <button class="print-modal-btn print-modal-btn-close" id="close-modal-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
              Cerrar
            </button>
          </div>
        </div>
        <div class="print-preview-container">
          <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">Generando PDF...</div>
            <div class="loading-progress">Preparando imágenes</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(printModal);

    // Función para cerrar el modal - definida localmente
    const closeModal = () => {
      printModal.remove();
      document.removeEventListener("keydown", handleEsc);
    };

    // Event listener para el botón de cerrar
    const closeBtn = document.getElementById("close-modal-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }

    // Cerrar con ESC
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };
    document.addEventListener("keydown", handleEsc);

    // Cerrar al hacer click fuera del modal
    printModal.addEventListener("click", (e) => {
      if (e.target === printModal) {
        closeModal();
      }
    });

    // Generar PDF
    generatePDFContent();

    async function generatePDFContent() {
      try {
        // Cargar jsPDF
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        document.head.appendChild(script);

        await new Promise<void>((resolve) => {
          script.onload = () => resolve();
        });

        const { jsPDF } = (window as any).jspdf;

        const loadingProgress = printModal.querySelector(
          ".loading-progress"
        ) as HTMLElement;

        // Pre-cargar TODAS las imágenes antes de crear el PDF
        if (loadingProgress) {
          loadingProgress.textContent = `Cargando ${expandedCards.length} imágenes...`;
        }

        const imageCache = new Map<number, string>();
        const loadPromises: Promise<void>[] = [];

        // Cargar todas las imágenes en paralelo usando el proxy para dominios problemáticos
        for (let i = 0; i < expandedCards.length; i++) {
          const card = expandedCards[i];
          const proxiedUrl = getProxiedImageUrl(card.card?.src || card.src);

          const promise = loadImageWithProxy(proxiedUrl)
            .then((imgData: string) => {
              imageCache.set(i, imgData);
              if (loadingProgress) {
                loadingProgress.textContent = `Cargando imágenes... ${imageCache.size}/${expandedCards.length}`;
              }
            })
            .catch((error) => {
              console.warn(`Error cargando imagen ${i}:`, error);
              imageCache.set(i, "error");
              if (loadingProgress) {
                loadingProgress.textContent = `Cargando imágenes... ${
                  imageCache.size
                }/${expandedCards.length} (${
                  imageCache.size -
                  Array.from(imageCache.values()).filter((v) => v === "error")
                    .length
                } exitosas)`;
              }
            });
          loadPromises.push(promise);
        }

        // Esperar a que TODAS las imágenes se carguen
        await Promise.all(loadPromises);

        if (loadingProgress) {
          loadingProgress.textContent = "Creando PDF...";
        }

        // Crear PDF con configuración optimizada
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [210, 297],
          compress: false,
        });

        // Configuración de las cartas
        const cardWidth = 62;
        const cardHeight = 87;
        const gap = 1;
        const startX = 11;
        const startY = 10;

        // Organizar cartas en páginas
        const cardsPerPage = 9;
        const pages = [];
        for (let i = 0; i < expandedCards.length; i += cardsPerPage) {
          pages.push(expandedCards.slice(i, i + cardsPerPage));
        }

        // Helper function to draw placeholder
        const drawPlaceholder = (
          x: number,
          y: number,
          card: any,
          globalIndex: number
        ) => {
          // Si la imagen falló, dibujar un placeholder
          pdf.setFillColor(245, 245, 245);
          pdf.rect(x, y, cardWidth, cardHeight, "F");
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.5);
          pdf.rect(x, y, cardWidth, cardHeight, "S");

          pdf.setFontSize(10);
          pdf.setTextColor(100, 100, 100);
          const text = card.name || `Carta ${globalIndex + 1}`;
          const lines = pdf.splitTextToSize(text, cardWidth - 10);
          pdf.text(
            lines,
            x + cardWidth / 2,
            y + cardHeight / 2 - lines.length * 2,
            {
              align: "center",
            }
          );

          if (card.code) {
            pdf.setFontSize(8);
            pdf.setTextColor(150, 150, 150);
            pdf.text(card.code, x + cardWidth / 2, y + cardHeight / 2 + 10, {
              align: "center",
            });
          }

          // Mensaje de error
          pdf.setFontSize(7);
          pdf.setTextColor(200, 100, 100);
          pdf.text(
            "Error al cargar imagen",
            x + cardWidth / 2,
            y + cardHeight - 5,
            {
              align: "center",
            }
          );
        };

        // Procesar cada página
        for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
          if (pageIndex > 0) {
            pdf.addPage();
          }

          if (loadingProgress) {
            loadingProgress.textContent = `Generando página ${
              pageIndex + 1
            } de ${pages.length}`;
          }

          const pageCards = pages[pageIndex];

          // Procesar cada carta de la página
          for (let i = 0; i < pageCards.length; i++) {
            const card = pageCards[i];
            const globalIndex = pageIndex * cardsPerPage + i;
            const row = Math.floor(i / 3);
            const col = i % 3;

            const x = startX + col * (cardWidth + gap);
            const y = startY + row * (cardHeight + gap);

            // Usar la imagen pre-cargada del cache
            const imgData = imageCache.get(globalIndex);

            if (imgData && imgData !== "error") {
              try {
                // Como ahora usamos el proxy, las imágenes deberían cargarse como base64
                pdf.addImage(
                  imgData,
                  "JPEG",
                  x,
                  y,
                  cardWidth,
                  cardHeight,
                  `card_${pageIndex}_${i}`,
                  "NONE"
                );
              } catch (error) {
                console.error(`Error agregando imagen al PDF:`, error);
                drawPlaceholder(x, y, card, globalIndex);
              }
            } else {
              drawPlaceholder(x, y, card, globalIndex);
            }
          }

          // Pequeña pausa para no bloquear el UI
          await new Promise<void>((resolve) => setTimeout(resolve, 10));
        }

        if (loadingProgress) {
          loadingProgress.textContent = "Finalizando PDF...";
        }

        // Generar blob del PDF
        const pdfBlob = pdf.output("blob");
        const pdfUrl = URL.createObjectURL(pdfBlob);

        // Mostrar PDF en iframe
        const previewContainer = printModal.querySelector(
          ".print-preview-container"
        ) as HTMLElement;

        if (previewContainer) {
          previewContainer.innerHTML = `
            <div style="width: 100%; height: 100%; display: flex; flex-direction: column;">
              <iframe id="pdf-preview" class="print-preview-iframe" src="${pdfUrl}"></iframe>
            </div>
          `;
        }

        // Habilitar botón de impresión
        const printBtn = document.getElementById(
          "print-btn"
        ) as HTMLButtonElement;
        if (printBtn) {
          printBtn.disabled = false;
          printBtn.onclick = () => {
            const iframe = document.getElementById(
              "pdf-preview"
            ) as HTMLIFrameElement;
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.print();
            }
          };
        }
      } catch (error) {
        console.error("Error generating PDF:", error);
        const previewContainer = printModal.querySelector(
          ".print-preview-container"
        ) as HTMLElement;

        if (previewContainer) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          previewContainer.innerHTML = `
            <div class="loading-container">
              <div style="color: #f44336; font-size: 18px;">Error al generar el PDF</div>
              <div style="color: #666; margin-top: 10px;">Por favor, intenta de nuevo</div>
              <div style="color: #999; margin-top: 5px; font-size: 12px;">${errorMessage}</div>
            </div>
          `;
        }
      }
    }

    // Nueva función optimizada para cargar imágenes usando el proxy
    async function loadImageWithProxy(url: string): Promise<string> {
      return new Promise((resolve, reject) => {
        const img = new Image();

        // Las imágenes proxiadas no necesitan crossOrigin ya que vienen del mismo dominio
        if (!url.startsWith("/api/proxy-image")) {
          img.crossOrigin = "anonymous";
        }

        const timeout = setTimeout(() => {
          img.src = "";
          reject(new Error("Timeout cargando imagen"));
        }, 15000); // Aumentamos timeout para images proxiadas

        img.onload = function () {
          clearTimeout(timeout);
          try {
            const canvas = document.createElement("canvas");
            canvas.width = 744;
            canvas.height = 1044;

            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "white";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

              resolve(canvas.toDataURL("image/jpeg", 0.9));
            } else {
              reject(new Error("No se pudo obtener el contexto del canvas"));
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        };

        img.onerror = function () {
          clearTimeout(timeout);
          reject(new Error("Error cargando imagen"));
        };

        img.src = url;
      });
    }
  };

  // Filter deck cards based on search and filters
  const filteredCards = deck.deckCards.filter((deckCard) => {
    const card = deckCard.card;
    if (!card) return false;

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        ((selectedFilterSearch === "all" || selectedFilterSearch === "name") &&
          card.name.toLowerCase().includes(searchLower)) ||
        ((selectedFilterSearch === "all" || selectedFilterSearch === "code") &&
          deckCard.code.toLowerCase().includes(searchLower)) ||
        ((selectedFilterSearch === "all" || selectedFilterSearch === "type") &&
          card.category.toLowerCase().includes(searchLower)) ||
        ((selectedFilterSearch === "all" || selectedFilterSearch === "set") &&
          deckCard.set.toLowerCase().includes(searchLower));

      if (!matchesSearch) return false;
    }

    // Color filter
    if (selectedColors.length > 0) {
      const hasMatchingColor = card.colors?.some((c) =>
        selectedColors.includes(c.color)
      );
      if (!hasMatchingColor) return false;
    }

    // Category filter
    if (selectedCategories.length > 0) {
      if (!selectedCategories.includes(card.category)) return false;
    }

    // Rarity filter - using DeckCard.rarity instead of Card.rarity
    if (selectedRarities.length > 0) {
      if (!deckCard.rarity || !selectedRarities.includes(deckCard.rarity))
        return false;
    }

    // Set filter
    if (selectedSets.length > 0) {
      if (!selectedSets.includes(deckCard.set)) return false;
    }

    // Cost filter - using DeckCard.cost and Card.cost
    if (selectedCosts.length > 0) {
      const cardCost = card.cost || deckCard.cost;
      if (!cardCost || !selectedCosts.includes(cardCost)) return false;
    }

    // Power filter - using DeckCard.power and Card.power
    if (selectedPower.length > 0) {
      const cardPower = card.power || deckCard.power;
      if (!cardPower || !selectedPower.includes(cardPower)) return false;
    }

    // Counter filter - using DeckCard.counter and Card.counter
    if (selectedCounter) {
      const cardCounter = card.counter || deckCard.counter;
      if (!cardCounter || cardCounter !== selectedCounter) return false;
    }

    // Attributes filter - using DeckCard.attribute and Card.attribute
    if (selectedAttributes.length > 0) {
      const cardAttribute = card.attribute || deckCard.attribute;
      if (!cardAttribute || !selectedAttributes.includes(cardAttribute))
        return false;
    }

    // Codes filter
    if (selectedCodes.length > 0) {
      if (!selectedCodes.includes(deckCard.code)) return false;
    }

    // Note: Effects, Trigger, and Types filters are commented out as they're not available in the Card interface
    // If needed, these would require using CardData instead of Card

    return true;
  });

  // Group filtered cards by code like in the individual deck page
  const groupedCards = Object.values(
    filteredCards.reduce((groups, card) => {
      if (!groups[card.code]) {
        groups[card.code] = [];
      }
      groups[card.code].push(card);
      return groups;
    }, {} as Record<string, typeof filteredCards>)
  );

  // Sort cards by cost like in the individual deck page
  groupedCards.sort((groupA, groupB) => {
    const cardA = groupA[0];
    const cardB = groupB[0];

    const isSpecialA = cardA.category === "Event" || cardA.category === "Stage";
    const isSpecialB = cardB.category === "Event" || cardB.category === "Stage";

    // If one is Event/Stage and the other not, Event/Stage goes to the end:
    if (isSpecialA !== isSpecialB) {
      return isSpecialA ? 1 : -1;
    }

    // If both are Event/Stage or neither is, sort by ascending cost.
    const costA = parseInt(cardA.cost ?? "0", 10);
    const costB = parseInt(cardB.cost ?? "0", 10);
    return costA - costB;
  });

  // Get leader card for display
  const leaderCard = deck.deckCards.find(
    (card) => card.card?.category === "Leader"
  );

  return (
    <div className="space-y-6 animate-in slide-in-from-right-5 fade-in duration-300">
      {/* Single Main Card Container */}
      <Card className="shadow-lg border-0 bg-white">
        {/* Header Section with Deck Info and Actions */}
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b p-4 sm:p-6 rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <div className="border-l border-gray-300 pl-3 sm:pl-4 min-w-0 flex-1">
                <div className="flex items-center gap-2 sm:gap-3">
                  {leaderCard && (
                    <div className="relative w-[40px] h-[40px] sm:w-[48px] sm:h-[48px] rounded-full flex-shrink-0">
                      {leaderCard.card?.colors &&
                      leaderCard.card.colors.length === 2 ? (
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            background: `linear-gradient(
                              to right,
                              ${getColors(leaderCard.card.colors[0].color)} 0%,
                              ${getColors(leaderCard.card.colors[0].color)} 40%,
                              ${getColors(leaderCard.card.colors[1].color)} 60%,
                              ${getColors(leaderCard.card.colors[1].color)} 100%
                            )`,
                          }}
                        />
                      ) : leaderCard.card?.colors &&
                        leaderCard.card.colors.length > 0 ? (
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            backgroundColor: getColors(
                              leaderCard.card.colors[0].color
                            ),
                          }}
                        />
                      ) : null}
                      <div
                        className="absolute inset-1 rounded-full bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${leaderCard.card?.src})`,
                          backgroundSize: "150%",
                          backgroundPosition: "-20px -2px",
                        }}
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                      {deck.name}
                    </CardTitle>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {!isAdminShopView && !isPublicShopView && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleExport}
                    className="bg-gray-900 text-white hover:bg-gray-800 rounded-lg px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Exportar
                  </Button>
                  <Button
                    onClick={handleProxies}
                    className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Proxies
                  </Button>
                </div>
              )}

              {!isAdminShopView && isShopView && deck.shopUrl && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-3"
                        asChild
                      >
                        <a
                          href={deck.shopUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          <ShoppingBag className="h-4 w-4" />
                          <span className="hidden sm:inline">Comprar</span>
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Ir a la tienda</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {canEditDeck && (
                <div
                  className={cn(
                    "flex gap-2",
                    isAdminShopView && "w-full justify-center flex-wrap"
                  )}
                >
                  <Button
                    className="bg-black text-white hover:bg-black/90 rounded-lg px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-2"
                    asChild
                  >
                    <Link
                      href={
                        isAdminShopView
                          ? `/admin/shop-decks/${deck.id}`
                          : `/decks/edit/${deck.id}`
                      }
                    >
                      <Edit className="h-4 w-4" />
                      Editar
                    </Link>
                  </Button>
                  {canDeleteDeck && (
                    <DeleteDeckModal
                      deck={deck}
                      onConfirm={() => handleDelete(Number(deck.id))}
                    >
                      <Button className="bg-rose-500 hover:bg-rose-600 text-white rounded-lg px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-2">
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </Button>
                    </DeleteDeckModal>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Advanced Card Statistics */}
          <div className="mt-4 pt-4 sm:pt-6 border-t border-gray-200">
            <div className="overflow-x-auto">
              <div
                className={cn(
                  "flex items-center gap-2 sm:gap-3 flex-nowrap min-w-max pr-4",
                  isAdminShopView && "w-full justify-center flex-wrap gap-2"
                )}
              >
                {/* Counter +2000 Badge */}
                <div className="flex items-center gap-1.5 bg-amber-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-amber-200">
                  <span className="text-amber-600 text-xs">⚡</span>
                  <span className="text-xs font-medium text-amber-700">
                    +2000
                  </span>
                  <span className="text-sm font-bold text-amber-800">
                    {deck.deckCards
                      .filter(
                        (card) =>
                          card.card?.counter?.includes("+2000") ||
                          card.counter?.includes("+2000")
                      )
                      .reduce((sum, card) => sum + card.quantity, 0)}
                  </span>
                </div>

                {/* Counter +1000 Badge */}
                <div className="flex items-center gap-1.5 bg-sky-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-sky-200">
                  <span className="text-sky-600 text-xs">⚡</span>
                  <span className="text-xs font-medium text-sky-700">
                    +1000
                  </span>
                  <span className="text-sm font-bold text-sky-800">
                    {deck.deckCards
                      .filter(
                        (card) =>
                          card.card?.counter?.includes("+1000") ||
                          card.counter?.includes("+1000")
                      )
                      .reduce((sum, card) => sum + card.quantity, 0)}
                  </span>
                </div>

                {/* Trigger Badge */}
                <div className="flex items-center gap-1.5 bg-emerald-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-emerald-200">
                  <span className="text-emerald-600 text-xs">🔥</span>
                  <span className="text-xs font-medium text-emerald-700">
                    Trigger
                  </span>
                  <span className="text-sm font-bold text-emerald-800">
                    {deck.deckCards
                      .filter(
                        (card) =>
                          card.card?.triggerCard &&
                          card.card.triggerCard !== null &&
                          card.card.triggerCard !== ""
                      )
                      .reduce((sum, card) => sum + card.quantity, 0)}
                  </span>
                </div>

                {/* Types Badges */}
                {(() => {
                  // Crear un objeto para contar tipos
                  const typeCounts: Record<string, number> = {};

                  deck.deckCards.forEach((deckCard) => {
                    if (deckCard.card?.types) {
                      deckCard.card.types.forEach((typeObj) => {
                        const typeName = typeObj.type;
                        if (!typeCounts[typeName]) {
                          typeCounts[typeName] = 0;
                        }
                        typeCounts[typeName] += deckCard.quantity;
                      });
                    }
                  });

                  // Convertir a array y ordenar por cantidad (descendente)
                  const sortedTypes = Object.entries(typeCounts)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 3); // Reducir a 3 en móvil para mejor responsividad

                  return sortedTypes.map(([typeName, count]) => (
                    <TooltipProvider key={typeName}>
                      <Tooltip open={activeTooltip === typeName}>
                        <TooltipTrigger asChild>
                          <div
                            className="flex items-center gap-1.5 bg-purple-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-purple-200 cursor-help active:bg-purple-100 touch-manipulation transition-colors"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Toggle tooltip para móvil
                              setActiveTooltip(
                                activeTooltip === typeName ? null : typeName
                              );
                              // Auto-cerrar después de 3 segundos
                              if (activeTooltip !== typeName) {
                                setTimeout(() => setActiveTooltip(null), 3000);
                              }
                            }}
                            onMouseEnter={() => {
                              // Solo en desktop (pantallas grandes)
                              if (window.innerWidth >= 768) {
                                setActiveTooltip(typeName);
                              }
                            }}
                            onMouseLeave={() => {
                              // Solo en desktop
                              if (window.innerWidth >= 768) {
                                setActiveTooltip(null);
                              }
                            }}
                          >
                            <span className="text-purple-600 text-xs">🏷️</span>
                            <span className="text-xs font-medium text-purple-700 truncate max-w-16 sm:max-w-20">
                              {typeName}
                            </span>
                            <span className="text-sm font-bold text-purple-800">
                              {count}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="bg-gray-900 text-white px-3 py-2 rounded-md text-sm shadow-lg z-50 pointer-events-none"
                          sideOffset={5}
                        >
                          <p>
                            {typeName} ({count} cartas)
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ));
                })()}
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Cards Display Section */}
        <CardContent className="p-6">
          {filteredCards.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Eye className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No se encontraron cartas
              </h3>
              <p className="text-gray-500">
                Ajusta los filtros para ver más cartas del deck
              </p>
            </div>
          ) : (
            <div className="p-4 bg-[#F3F4F6] rounded-lg border overflow-auto">
              <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-9 2xl:grid-cols-10 max-w-[1900px] m-auto gap-2">
                {groupedCards.map((group) =>
                  group.map((card, index) => (
                    <div
                      key={`${card.cardId}-${index}`}
                      onClick={() => {
                        setSelectedCard(card);
                        setShowLargeImage(true);
                      }}
                      className="cursor-pointer border rounded-lg shadow p-1 bg-white justify-center items-center flex flex-col relative h-fit hover:shadow-md transition-all duration-200 hover:scale-105"
                    >
                      <img
                        src={card.card?.src || card.src}
                        alt={card.name}
                        className="w-full rounded"
                      />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex justify-center items-center w-full flex-col">
                              <span
                                className={`${oswald.className} text-[13px] font-[500] mt-1`}
                              >
                                {card.code}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{card.set}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {card.quantity > 1 && (
                        <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white shadow-lg">
                          <span className="mb-[2px]">{card.quantity}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {isPublicShopView && deck.shopUrl && (
            <div className="flex justify-center mt-5">
              <Button
                className="w-full sm:w-2/3 lg:w-1/2 bg-emerald-500 hover:bg-emerald-600 text-white text-lg font-semibold py-6 rounded-xl shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
                asChild
              >
                <a
                  href={deck.shopUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ShoppingBag className="h-5 w-5" />
                  Comprar deck
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Large image modal */}
      {showLargeImage && selectedCard && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-[999999] px-5 overflow-auto"
          onClick={() => setShowLargeImage(false)}
        >
          <div className="w-full max-w-3xl">
            <div className="text-white text-xl lg:text-2xl font-[400] text-center py-2 px-5">
              Tap to close
            </div>
            <div className="flex flex-col items-center gap-3 px-5 mb-3">
              <img
                src={selectedCard.card?.src || selectedCard.src}
                className="max-w-full max-h-[calc(100dvh-130px)] object-contain rounded-lg shadow-2xl"
                alt={selectedCard.name}
              />
              <div className="text-white text-lg font-[400] text-center px-5">
                <span className={`${oswald.className} font-[500]`}>
                  {selectedCard.code}
                </span>
                <br />
                <span>{selectedCard.set}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setActiveTab("sansan");
            setCopied(false);
            setCopiedUrl(false);
            setContent("");
          }
        }}
      >
        <DialogContent className="max-w-[430px] max-h-[96vh] p-0 overflow-hidden flex flex-col">
          <div className="w-full h-full bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <DialogHeader className="p-6 pb-4">
              <DialogTitle>Exportar Lista del Deck</DialogTitle>
              <DialogDescription>
                Copia la lista del deck en formato SanSan Events o OPSim
              </DialogDescription>
            </DialogHeader>
            {/* Content */}
            <div className="p-3 md:p-6 flex-1 flex flex-col min-h-0 gap-4">
              {/* Tabs */}
              <div className="inline-flex items-center gap-3 rounded-lg bg-muted p-2">
                <button
                  onClick={() => {
                    setActiveTab("sansan");
                    setContent(formatSanSanEvents());
                    setCopied(false);
                    setCopiedUrl(false);
                  }}
                  className={cn(
                    "w-1/2 relative px-4 py-2 text-md font-medium transition-colors",
                    "rounded-md hover:text-foreground/90",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activeTab === "sansan"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted-foreground/10"
                  )}
                  role="tab"
                  aria-selected={activeTab === "sansan"}
                >
                  SangSang
                </button>
                <button
                  onClick={() => {
                    setActiveTab("optcgsim");
                    setContent(formatOptgsim());
                    setCopied(false);
                    setCopiedUrl(false);
                  }}
                  className={cn(
                    "w-1/2 relative px-4 py-2 text-md font-medium transition-colors",
                    "rounded-md hover:text-foreground/90",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    activeTab === "optcgsim"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted-foreground/10"
                  )}
                  role="tab"
                  aria-selected={activeTab === "optcgsim"}
                >
                  OPSim
                </button>
              </div>

              {/* Content Display */}
              <div className="flex flex-col bg-gray-200 rounded-b-lg min-h-0 overflow-auto rounded-lg px-4 py-3 max-h-[200px]">
                {content.split("\n").map((line, index) => (
                  <p
                    key={index}
                    style={{
                      all: "unset",
                      margin: 0,
                      padding: 0,
                      pointerEvents: "none",
                      userSelect: "none",
                      textDecoration: "none",
                      listStyleType: "none",
                      display: "block",
                      fontSize: "inherit",
                      fontFamily: "Arial, sans-serif",
                      WebkitUserModify: "read-only",
                      MozUserModify: "read-only",
                      WebkitTouchCallout: "none",
                    }}
                    spellCheck="false"
                    translate="no"
                  >
                    {line}
                  </p>
                ))}
              </div>

              {/* Copy Text Button */}
              <Button
                onClick={handleCopy}
                className="w-full bg-[#4F7DFF] hover:bg-[#4F7DFF]/90 text-white py-6 text-lg font-medium"
              >
                {copied ? (
                  <span className="flex items-center justify-center gap-2">
                    <Check className="w-5 h-5" />
                    Copied!
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Copy className="w-5 h-5" />
                    Copy Text
                  </span>
                )}
              </Button>
            </div>
            {!isPublicShopView && (
              <div className="w-full flex flex-col gap-5 p-4">
                <div className="flex w-full flex-col space-y-2">
                  <div className="flex items-center space-x-2">
                    <Input
                      id="deck-url"
                      type="text"
                      value={`https://oharatcg.com/decks/${deck.uniqueUrl}`}
                      readOnly
                      className="font-mono h-[48px]"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="w-fit px-2 h-[48px]"
                      onClick={() =>
                        handleCopyUrl(
                          `https://oharatcg.com/decks/${deck.uniqueUrl}`
                        )
                      }
                    >
                      {copiedUrl ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      Copy URL
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={handleShare}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-6 text-lg font-medium"
                >
                  <Share2 className="w-5 h-5 mr-2" />
                  <span className="text-lg font-medium">Share</span>
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// New component for when no deck is selected
const WelcomeDeckSelection = ({
  isShopView = false,
  isAdminShopView = false,
}: {
  isShopView?: boolean;
  isAdminShopView?: boolean;
}) => {
  const title = isAdminShopView
    ? "Gestiona tus decks de venta"
    : isShopView
    ? "Explora la tienda de decks"
    : "Explora tus Mazos";
  const description = isAdminShopView
    ? "Selecciona un deck de la lista lateral para ver su detalle y editarlo antes de publicarlo."
    : isShopView
    ? "Selecciona un deck de la lista lateral para ver su detalle y continuar la compra en la tienda asociada."
    : "Selecciona un mazo de la lista lateral para ver todas sus cartas organizadas por categorías.";
  const primaryLabel = isAdminShopView
    ? "Crear deck para venta"
    : isShopView
    ? "Crear mi propio deck"
    : "Crear Nuevo Mazo";
  const secondaryLabel = isShopView ? "Explorar cartas" : "Explorar Cartas";
  const primaryHref = isAdminShopView ? "/admin/create-decks" : "/deckbuilder";
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in fade-in duration-500 h-full">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-3xl font-bold text-gray-800 mb-3">{title}</h2>

        <p className="text-lg text-muted-foreground leading-relaxed">
          {description}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 justify-center">
          {isAdminShopView ? (
            <>
              <Button
                asChild
                className="bg-black text-white hover:bg-black/90 transition-all duration-300 rounded-xl py-6 text-base tracking-wide"
              >
                <Link href="/admin/create-decks">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear deck para venta
                </Link>
              </Button>
              <Button
                variant="outline"
                asChild
                className="border-gray-300 hover:bg-gray-100 transition-colors duration-200 rounded-xl py-6 text-base tracking-wide"
              >
                <Link href="/shop">
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Ver tienda
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button
                asChild
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300"
              >
                <Link href={primaryHref}>
                  <Plus className="h-4 w-4 mr-2" />
                  {primaryLabel}
                </Link>
              </Button>

              <Button
                variant="outline"
                asChild
                className="hover:bg-muted/50 transition-colors duration-200"
              >
                <Link href="/">
                  <ChartColumnBigIcon className="h-4 w-4 mr-2" />
                  {secondaryLabel}
                </Link>
              </Button>
            </>
          )}
        </div>

        <div className="pt-6 border-t border-muted-foreground/20">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Tip:</strong> Haz clic en cualquier mazo de la barra
            lateral para comenzar
          </p>
        </div>
      </div>
    </div>
  );
};

interface DeleteDeckModalProps {
  deck: Deck;
  onConfirm: () => void;
  children: React.ReactNode;
}

const DeleteDeckModal = ({
  deck,
  onConfirm,
  children,
}: DeleteDeckModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    if (confirmText !== deck.name) {
      showErrorToast("El nombre del deck no coincide");
      return;
    }

    setIsDeleting(true);
    try {
      await onConfirm();
      setIsOpen(false);
      setConfirmText("");
    } catch (error) {
      console.error("Error deleting deck:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div onClick={() => setIsOpen(true)}>{children}</div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg overflow-hidden px-0 pb-0">
          <div className="bg-white flex flex-col h-full">
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-5 text-white flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">
                  ¿Eliminar este deck?
                </DialogTitle>
                <DialogDescription className="text-white/80">
                  Esta acción no se puede deshacer
                </DialogDescription>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="border border-red-100 rounded-xl p-4 bg-red-50">
                <p className="text-sm text-red-700">
                  Estás a punto de eliminar el deck{" "}
                  <span className="font-semibold">{deck.name}</span>. También se
                  eliminarán todas las cartas asociadas (
                  {deck.deckCards?.length || 0}) y su historial.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Escribe <strong>{deck.name}</strong> para confirmar:
                </label>
                <Input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={isDeleting}
                  autoComplete="off"
                  className="h-12 text-base"
                />
                {confirmText && confirmText !== deck.name && (
                  <p className="text-sm text-red-500">
                    El nombre no coincide, verifica e inténtalo de nuevo.
                  </p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 text-base font-semibold border-gray-200"
                onClick={() => setIsOpen(false)}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-12 text-base font-semibold bg-red-600 hover:bg-red-700"
                onClick={handleConfirm}
                disabled={confirmText !== deck.name || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5 mr-2" />
                    Eliminar deck
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const DecksPage = () => {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [isFetchingDecks, setIsFetchingDecks] = useState(true);
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const isAdminShopView = currentPath.startsWith("/admin/shop-decks");
  const isPublicShopView = currentPath.startsWith("/shop");
  const isShopView = isAdminShopView || isPublicShopView;

  // Filters
  const [search, setSearch] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedFilterSearch, setSelectedFilterSearch] = useState("all");
  const [selectedCounter, setSelectedCounter] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState("");
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [viewSelected, setViewSelected] = useState<
    "grid" | "list" | "alternate" | "text"
  >("text");
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [selectedCosts, setSelectedCosts] = useState<string[]>([]);
  const [selectedPower, setSelectedPower] = useState<string[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);
  const [isInputClear, setIsInputClear] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [selectedAltArts, setSelectedAltArts] = useState<string[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);

  // Suponiendo que 'decks' es tu array de decks
  const groupedDecks = decks.reduce((acc, deck) => {
    // Buscar el leader en cada deck
    const leaderCard = deck.deckCards.find(
      (dc) => dc.card?.category === "Leader"
    );
    if (leaderCard?.card) {
      const leaderCode = leaderCard.card.code;
      if (!acc[leaderCode as keyof typeof acc]) {
        acc[leaderCode] = {
          leaderCard,
          decks: [],
        };
      }
      acc[leaderCode].decks.push(deck);
    }
    return acc;
  }, {} as GroupedDecks);

  // Estado para controlar qué collapsible está abierto (puede ser un objeto con claves de leader)
  const [expanded, setExpanded] = useState({});

  // Función para alternar un collapsible
  const toggleExpand = (leaderCode: string) => {
    const wasExpanded = expanded[leaderCode as keyof typeof expanded];

    setExpanded((prev: Record<string, boolean>) => ({
      ...prev,
      [leaderCode]: !prev[leaderCode],
    }));

    // Si se está abriendo el collapsible (no estaba expandido antes)
    if (!wasExpanded) {
      const leaderGroup = groupedDecks[leaderCode];
      if (leaderGroup && leaderGroup.decks.length > 0) {
        // Seleccionar automáticamente el primer deck
        const firstDeck = leaderGroup.decks[0];
        handleSelectDeck(firstDeck);

        // Hacer scroll para que el elemento seleccionado sea visible
        setTimeout(() => {
          const selectedElement = document.querySelector(
            `[data-deck-id="${firstDeck.uniqueUrl}"]`
          );
          if (selectedElement) {
            // En móvil, hacer scroll al contenedor principal
            const isMobile = window.innerWidth < 1024; // lg breakpoint

            if (isMobile) {
              // En móvil, scroll al sidebar
              const sidebar = selectedElement.closest(
                ".lg\\:min-w-\\[398px\\]"
              );
              if (sidebar) {
                selectedElement.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                  inline: "nearest",
                });
              }
            } else {
              // En desktop, scroll normal
              selectedElement.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "nearest",
              });
            }
          }
        }, 150); // Aumentar el delay para mejor experiencia
      }
    }
  };

  const fetchDecks = async () => {
    setIsFetchingDecks(true);
    try {
      let endpoint: string | null = null;
      if (isShopView) {
        const includeUnpublished =
          session?.user?.role === "ADMIN" ? "?includeUnpublished=true" : "";
        endpoint = `/api/admin/shop-decks${includeUnpublished}`;
      } else if (userId) {
        endpoint = `/api/admin/decks/user/${userId}`;
      }

      if (!endpoint) return;

      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error(
          isShopView ? "No hay decks de tienda" : "No tienes decks"
        );
      }
      const data = await res.json();
      const filteredDecks = Array.isArray(data)
        ? data.filter((deck: Deck) =>
            isShopView ? deck.isShopDeck : !deck.isShopDeck
          )
        : [];
      setDecks(filteredDecks);
    } catch (error) {
      console.error("Error fetching decks:", error);
      showErrorToast(
        isShopView
          ? "No pudimos cargar los decks de la tienda"
          : "No pudimos cargar tus decks"
      );
    } finally {
      setIsFetchingDecks(false);
    }
  };

  useEffect(() => {
    if (isShopView || userId) {
      fetchDecks();
    } else {
      setIsFetchingDecks(false);
    }
  }, [session, userId, isShopView]);

  const handleSelectDeck = (deck: Deck) => {
    setSelectedDeck(deck);

    // Encontrar el líder del deck seleccionado
    const selectedLeaderCode = Object.entries(groupedDecks).find(
      ([leaderCode, { decks }]) =>
        decks.some((d) => d.uniqueUrl === deck.uniqueUrl)
    )?.[0];

    if (selectedLeaderCode) {
      // Cerrar todos los collapsibles excepto el del deck seleccionado
      setExpanded((prev: Record<string, boolean>) => {
        const newExpanded: Record<string, boolean> = {};
        // Cerrar todos
        Object.keys(prev).forEach((key) => {
          newExpanded[key] = false;
        });
        // Abrir solo el del deck seleccionado
        newExpanded[selectedLeaderCode] = true;
        return newExpanded;
      });

      // Hacer scroll al deck seleccionado después de un breve delay
      setTimeout(() => {
        const selectedElement = document.querySelector(
          `[data-deck-id="${deck.uniqueUrl}"]`
        );
        if (selectedElement) {
          selectedElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });
        }
      }, 200); // Delay para que el collapsible se abra primero
    }
  };

  const handleBackToList = () => {
    setSelectedDeck(null);
  };

  if (isShopView && isFetchingDecks) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] bg-gradient-to-b from-[#fbf6ef] to-[#f2e2c7] w-full">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-amber-300 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-semibold tracking-wide text-amber-700">
            Consultando decks disponibles...
          </p>
        </div>
      </div>
    );
  }

  if (isPublicShopView && !isFetchingDecks && decks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center bg-gradient-to-b from-[#fbf6ef] to-[#f2e2c7] w-full">
        <div className="max-w-3xl space-y-7">
          <div className="inline-flex items-center px-5 py-2 rounded-full bg-white/80 border border-amber-300 text-amber-700 text-sm font-semibold shadow-sm tracking-wide">
            <span className="mr-2 animate-pulse">🧭</span>
            Sin decks disponibles por ahora
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-snug tracking-tight">
            No hay decks disponibles en la tienda en este momento
          </h1>
          <div className="mt-2">
            <p className="text-lg md:text-xl text-gray-600 leading-relaxed tracking-wide px-2">
              Por ahora no tenemos decks listos para comprar, pero estamos
              preparando nuevos listados y reponiendo inventario. Mientras
              llegan, inspírate en la colección o arma tu propia lista
              competitiva.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/card-list"
              className="px-7 py-3.5 rounded-xl bg-black text-white font-semibold shadow-xl hover:-translate-y-0.5 hover:shadow-2xl transition-all duration-200 tracking-wide"
            >
              Explorar cartas
            </Link>
            <Link
              href="/deckbuilder"
              className="px-7 py-3.5 rounded-xl border border-gray-400 text-gray-800 font-semibold bg-white/90 hover:bg-white transition-all duration-200 tracking-wide"
            >
              Crear mi propio deck
            </Link>
          </div>
          <div className="mt-1">
            <p className="text-sm text-gray-500 tracking-wide mt-3">
              ¿Buscas algo específico? Escríbenos y te avisamos cuando vuelva a
              estar disponible.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row flex-1 bg-[#f2eede] w-full">
      <div className="flex flex-col flex-shrink-0 bg-white px-3 sm:px-4 py-2 lg:py-4 gap-2 lg:gap-4 border-t border-[#d3d3d3] transition-all duration-200 ease-in-out max-w-unset lg:min-w-[398px] h-auto lg:h-full max-h-64 lg:max-h-none overflow-y-auto lg:overflow-y-visible">
        <div className="rounded-lg border overflow-auto flex-1">
          <div className="space-y-2 border rounded-lg overflow-hidden">
            <div>
              {Object.entries(groupedDecks).map(
                ([leaderCode, { leaderCard, decks }]) => (
                  <Collapsible
                    key={leaderCode}
                    open={!!expanded[leaderCode as keyof typeof expanded]}
                    onOpenChange={() => toggleExpand(leaderCode)}
                    className="border-b last:border-b-0"
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 sm:p-4 hover:bg-muted/50 transition-colors duration-200">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className="flex items-center gap-2 sm:gap-3">
                          {leaderCard && (
                            <div className="relative w-[40px] h-[40px] sm:w-[48px] sm:h-[48px] rounded-full flex-shrink-0">
                              {leaderCard.card?.colors &&
                              leaderCard.card.colors.length === 2 ? (
                                <div
                                  className="absolute inset-0 rounded-full"
                                  style={{
                                    background: `linear-gradient(
                                      to right,
                                      ${getColors(
                                        leaderCard.card.colors[0].color
                                      )} 0%,
                                      ${getColors(
                                        leaderCard.card.colors[0].color
                                      )} 40%,
                                      ${getColors(
                                        leaderCard.card.colors[1].color
                                      )} 60%,
                                      ${getColors(
                                        leaderCard.card.colors[1].color
                                      )} 100%
                                    )`,
                                  }}
                                />
                              ) : leaderCard.card?.colors &&
                                leaderCard.card.colors.length > 0 ? (
                                <div
                                  className="absolute inset-0 rounded-full"
                                  style={{
                                    backgroundColor: getColors(
                                      leaderCard.card.colors[0].color
                                    ),
                                  }}
                                />
                              ) : null}
                              <div
                                className="absolute inset-1 rounded-full bg-cover bg-center"
                                style={{
                                  backgroundImage: `url(${leaderCard.card?.src})`,
                                  backgroundSize: "150%",
                                  backgroundPosition: "-20px -2px",
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-sm sm:text-lg leading-tight truncate">
                              {leaderCard?.card?.name}
                            </h3>
                            <Badge
                              variant="secondary"
                              className="text-xs flex-shrink-0"
                            >
                              {leaderCard?.card?.code || "N/A"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {decks.length} deck{decks.length > 1 ? "s" : ""}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-300 text-muted-foreground flex-shrink-0",
                          expanded[leaderCode as keyof typeof expanded]
                            ? "transform rotate-180"
                            : ""
                        )}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="transition-all duration-300 ease-in-out">
                      <div className="bg-muted/20">
                        {decks.map((deck) => {
                          // Calcular total de cartas en el deck
                          const totalCards = deck.deckCards.reduce(
                            (sum: number, deckCard: any) =>
                              sum + deckCard.quantity,
                            0
                          );

                          // Verificar si el deck está completo (50 cartas)
                          const isComplete = totalCards === 51; // 50 + 1 leader

                          return (
                            <div
                              key={deck.uniqueUrl}
                              data-deck-id={deck.uniqueUrl}
                              className={cn(
                                "p-3 sm:p-4 cursor-pointer transition-all duration-200 hover:bg-white/50 border-l-4 mx-2 my-1 rounded-r-lg",
                                selectedDeck?.uniqueUrl === deck.uniqueUrl
                                  ? "bg-blue-50 border-blue-500 shadow-sm"
                                  : "border-transparent hover:border-gray-300 hover:shadow-sm"
                              )}
                              onClick={() => handleSelectDeck(deck)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className="font-bold text-sm sm:text-base transition-colors duration-200 truncate">
                                      {deck.name}
                                    </h4>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {/* Indicador visual del estado del deck */}
                                  <div
                                    className={cn(
                                      "w-2 h-2 rounded-full",
                                      isComplete
                                        ? "bg-green-500"
                                        : "bg-orange-400"
                                    )}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-grow flex flex-col">
        <div
          className={`${
            selectedDeck ? "p-0 lg:p-5" : "p-5"
          } overflow-auto h-full border-t border-[#d3d3d3]`}
        >
          {selectedDeck ? (
            <SelectedDeckCards
              deck={selectedDeck}
              onBackToList={handleBackToList}
              onDelete={fetchDecks}
              mode={
                isAdminShopView ? "shop-admin" : isShopView ? "shop" : "user"
              }
            />
          ) : (
            <WelcomeDeckSelection
              isShopView={isShopView}
              isAdminShopView={isAdminShopView}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DecksPage;
