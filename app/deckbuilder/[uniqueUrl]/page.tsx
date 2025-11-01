"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Oswald } from "next/font/google";
import { CardWithCollectionData } from "@/types";
import {
  Share2,
  Pencil,
  Download,
  Eye as OpenEye,
  EyeOff as CloseEye,
  X,
  Check,
  Copy,
  ChartColumnBigIcon,
} from "lucide-react";
import { getColors } from "@/helpers/functions";
import GroupedCardPreviewStatic from "@/components/deckbuilder/GroupedCardPreviewStatic";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import html2canvas from "html2canvas";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { rarityFormatter } from "@/helpers/formatters";
import { showSuccessToast } from "@/lib/toastify";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import DeckStats from "@/components/deckbuilder/DeckStats";
import { DeckCard } from "@/types";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const DeckBuilderUniqueUrl = () => {
  const { uniqueUrl } = useParams(); // URL único del deck original
  const router = useRouter();

  const deckRef = useRef(null);
  const modalRef = useRef(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [showLargeImage, setShowLargeImage] = useState(false);
  const [selectedCard, setSelectedCard] = useState<DeckCard | null>(null);
  const [isTouchable, setIsTouchable] = useState(true);
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  const [content, setContent] = useState("");

  const [activeTab, setActiveTab] = useState("sansan");
  // Estados para el deck a visualizar
  const [deckData, setDeckData] = useState<any>(null);
  const [isDeckLoaded, setIsDeckLoaded] = useState(false);
  const [deckCards, setDeckCards] = useState<DeckCard[]>([]);
  const [selectedLeader, setSelectedLeader] =
    useState<CardWithCollectionData | null>(null);

  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isOn, setIsOn] = useState(false);

  const totalCards = deckCards.reduce(
    (total, card) => total + card.quantity,
    0
  );

  // Función para compartir el URL del deck usando la API nativa o copiando el link
  const handleShare = async () => {
    const shareData = {
      title: deckData?.name || "Mi Deck",
      text: "Mira mi deck en One Piece Card Game!",
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Error al compartir:", err);
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert("Link copiado al portapapeles");
    }
  };

  const handleDownload = () => {
    if (deckRef.current) {
      html2canvas(deckRef.current, {
        useCORS: true,
        scale: 6, // Ajusta este valor según la resolución deseada
      }).then((canvas) => {
        const imgData = canvas.toDataURL("image/png");
        setPreviewImage(imgData);
        setShowModal(true);
      });
    }
  };

  // Función para redirigir a la vista de fork (edición) del deck
  const handleFork = () => {
    router.push(`/deckbuilder/${uniqueUrl}/fork`);
  };

  const handleExport = () => {
    setIsModalOpen(true);

    requestAnimationFrame(() => {
      setContent(formatSanSanEvents());
    });
  };

  // Función para copiar el texto al portapapeles
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      showSuccessToast("Text copied to clipboard");
      setCopied(true);
    } catch (err) {
      console.error("Error al copiar el texto: ", err);
    }
  };
  const handleCopyUrl = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showSuccessToast("Text copied to clipboard");
      setCopiedUrl(true);
    } catch (err) {
      console.error("Error al copiar el texto: ", err);
    }
  };

  // Función que genera el primer formato: "cantidad x código" por línea
  const formatOptgsim = (): string => {
    // Agrupa las cartas por código sumando las cantidades
    const groupedCards = deckCards.reduce(
      (acc: Record<string, DeckCard>, card) => {
        if (acc[card.code]) {
          acc[card.code].quantity += card.quantity;
        } else {
          // Se clona la carta para no modificar el array original
          acc[card.code] = { ...card };
        }
        return acc;
      },
      {} as Record<string, DeckCard>
    );

    // Formatea cada grupo en "cantidad x código"
    const formattedCards = Object.values(groupedCards).map(
      (card) => `${card.quantity}x${card.code}`
    );

    // Retorna la cadena final, empezando con el líder
    return `1x${selectedLeader?.code ?? ""}\n${formattedCards.join("\n")}`;
  };

  // Función que genera el segundo formato: array con cabecera y luego el código repetido según la cantidad
  const formatTableTop = () => {
    const output = ["Exported from oharatcg.com", [`${selectedLeader?.code}`]];
    deckCards.forEach((card) => {
      for (let i = 0; i < card.quantity; i++) {
        output.push(card.code);
      }
    });
    return JSON.stringify(output);
  };

  const formatSanSanEvents = () => {
    // Agrupar cartas por su código, sumando las cantidades
    const groupedCards = deckCards.reduce(
      (acc: Record<string, DeckCard>, card) => {
        if (acc[card.code]) {
          acc[card.code].quantity += card.quantity;
        } else {
          // Copia la carta para luego acumular su cantidad
          acc[card.code] = { ...card };
        }
        return acc;
      },
      {} as Record<string, DeckCard>
    );

    // Formatear el resultado agrupado con `&nbsp;`
    const formattedCards = Object.values(groupedCards).map(
      (card) =>
        `${card.quantity} -\u200B ${card.code} ${rarityFormatter(
          card.rarity
        )}\u200B.\u200B`
    );

    return `1 - ${
      selectedLeader?.code ?? ""
    } L\u200B.\u200B\n${formattedCards.join("\n")}`;
  };

  // Agrupamos las cartas por código sin modificar sus cantidades:
  const groupedCards = Object.values(
    deckCards.reduce((groups, card) => {
      if (!groups[card.code]) {
        groups[card.code] = [];
      }
      groups[card.code].push(card);
      return groups;
    }, {} as Record<string, typeof deckCards>)
  );

  // Ordenamos las cartas según el criterio:
  // 1. Las cartas que no son "Event" se ordenan por costo de menor a mayor.
  // 2. Las cartas de tipo "Event" se ubican siempre al final, sin importar el costo.
  groupedCards.sort((groupA, groupB) => {
    const cardA = groupA[0];
    const cardB = groupB[0];

    const isSpecialA = cardA.category === "Event" || cardA.category === "Stage";
    const isSpecialB = cardB.category === "Event" || cardB.category === "Stage";

    // Si uno es Event/Stage y el otro no, el Event/Stage va al final:
    if (isSpecialA !== isSpecialB) {
      return isSpecialA ? 1 : -1;
    }

    // Si ambos son Event/Stage o ninguno lo es, ordenar por costo ascendente.
    const costA = parseInt(cardA.cost ?? "0", 10);
    const costB = parseInt(cardB.cost ?? "0", 10);
    return costA - costB;
  });

  // Fetch del deck original mediante su uniqueUrl
  useEffect(() => {
    const fetchDeck = async () => {
      try {
        const res = await fetch(`/api/admin/decks/${uniqueUrl}`);
        if (!res.ok) throw new Error("Deck no encontrado");
        const data = await res.json();
        setDeckData(data);
        // Se asume que el deck original tiene exactamente 1 Leader
        const leaderEntry = data.deckCards.find(
          (dc: any) => dc.card.category === "Leader"
        );
        if (leaderEntry) setSelectedLeader(leaderEntry.card);

        console.log(" data.deckCards", data.deckCards);
        // Las cartas no Leader se usan para inicializar el deck
        const nonLeaderCards = data.deckCards
          .filter((dc: any) => dc.card.category !== "Leader")
          .map((dc: any) => ({
            cardId: dc.card.id,
            name: dc.card.name,
            rarity: dc.card.rarity || "Desconocido",
            quantity: dc.quantity,
            src: dc.card.src,
            code: dc.card.code,
            category: dc.card.category,
            color: dc.card.colors.length ? dc.card.colors[0].color : "gray",
            cost: dc.card.cost || "",
            set: dc.card.sets[0].set.title ?? "",
          }));
        setDeckCards(nonLeaderCards);
        setIsDeckLoaded(true);
      } catch (error) {
        console.error(error);
      }
    };

    if (uniqueUrl) fetchDeck();
  }, [uniqueUrl]);

  useEffect(() => {
    if (!showLargeImage) {
      setTimeout(() => {
        setIsTouchable(true);
      }, 300);
    } else {
      setIsTouchable(false);
    }
  }, [showLargeImage]);

  return (
    <div className="flex flex-col flex-1 bg-[#f2eede] w-full">
      <div className="flex flex-col flex-shrink-0 h-full bg-white px-4 py-4 gap-4">
        <div className="flex items-center gap-4 w-full justify-between">
          <div className="flex items-center gap-3 w-2/3">
            {selectedLeader && (
              <div
                className="relative w-[50px] h-[50px] rounded-full cursor-pointer"
                onClick={() => {
                  if (isTouchable) {
                    setSelectedCard({
                      cardId: Number(selectedLeader.id),
                      id: Number(selectedLeader.id),
                      name: selectedLeader.name,
                      rarity: selectedLeader.rarity ?? "",
                      quantity: 1,
                      src: selectedLeader.src,
                      code: selectedLeader.code,
                      color: selectedLeader.colors[0].color,
                      colors: selectedLeader.colors,
                      cost: selectedLeader.cost ?? "",
                      category: selectedLeader.category,
                      set: selectedLeader.sets[0].set.title,
                      power: selectedLeader.power ?? "",
                      counter: selectedLeader.counter ?? "",
                      attribute: selectedLeader.attribute ?? "",
                    });
                    setShowLargeImage(true);
                  }
                }}
              >
                {selectedLeader.colors.length === 2 ? (
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `linear-gradient(
                                    to right,
                                    ${getColors(
                                      selectedLeader.colors[0].color
                                    )} 0%,
                                    ${getColors(
                                      selectedLeader.colors[0].color
                                    )} 40%,
                                    ${getColors(
                                      selectedLeader.colors[1].color
                                    )} 60%,
                                    ${getColors(
                                      selectedLeader.colors[1].color
                                    )} 100%
                                  )`,
                    }}
                  />
                ) : (
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      backgroundColor: getColors(
                        selectedLeader.colors[0].color
                      ),
                    }}
                  />
                )}
                <div
                  className="absolute inset-1 rounded-full bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${selectedLeader.src})`,
                    backgroundSize: "150%",
                    backgroundPosition: "-80px -5px",
                  }}
                />
              </div>
            )}

            <div className="flex flex-col flex-1">
              <div className="flex items-start justify-center gap-0 flex-col">
                <span className="font-semibold text-sm line-clamp-1 break-all text-left">
                  {selectedLeader?.name ?? "Name"}
                </span>
                <span
                  className={`${oswald.className} text-sm text-muted-foreground text-left`}
                >
                  {selectedLeader?.code ?? "-"}
                </span>
              </div>
            </div>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg border w-1/3 text-center">
            <span className="font-bold text-2xl">{totalCards}/50</span>
          </div>
          <div className="w-[42p] h-[42px]">
            <button
              onClick={() => setIsStatsOpen(!isStatsOpen)}
              className={`
        !w-[42px] h-[42px] rounded-lg flex items-center justify-center
        transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2
        ${
          isStatsOpen
            ? "bg-[#2463eb] text-white shadow-lg ring-[#2463eb]"
            : "bg-secondary text-secondary-foreground ring-secondary"
        }
      `}
              aria-pressed={isStatsOpen}
              aria-label={isStatsOpen ? "Apagar" : "Encender"}
            >
              <ChartColumnBigIcon />
              <span className="sr-only">
                {isStatsOpen ? "Encendido" : "Apagado"}
              </span>
            </button>
          </div>
        </div>

        <div className="p-3 bg-[#F3F4F6] rounded-lg border overflow-auto flex-1">
          {isDeckLoaded ? (
            deckCards.length === 0 ? (
              <p>No hay cartas en el deck.</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-9 2xl:grid-cols-10 max-w-[1900px] m-auto gap-2">
                {groupedCards.map((group) =>
                  group.map((c, index) => {
                    // Buscamos la carta en el mazo por su id
                    const cardInDeck = deckCards.find(
                      (card) => card.cardId === c.cardId
                    );
                    return (
                      <div
                        key={index}
                        onClick={() => {
                          if (isTouchable) {
                            setSelectedCard(c);
                            setShowLargeImage(true);
                          }
                        }}
                        className="cursor-pointer border rounded-lg shadow p-1 bg-white justify-center items-center flex flex-col relative h-fit"
                      >
                        <img src={c?.src} alt={c?.name} className="w-full" />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex justify-center items-center w-full flex-col">
                                <span
                                  className={`${oswald.className} text-[13px] font-[500] mt-1`}
                                >
                                  {c?.code}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{c?.set}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {cardInDeck && cardInDeck.quantity > 0 && (
                          <div className="absolute -top-1 -right-1 !bg-[#000] !text-white rounded-full h-[40px] w-[40px] flex items-center justify-center text-xl font-bold border-2 border-white">
                            <span className="mb-[2px]">
                              {cardInDeck.quantity}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )
          ) : (
            <p>Loading deck...</p>
          )}
        </div>

        {/* Botones de acción */}

        <div className="m-auto w-full sm:w-auto">
          <div className="flex justify-between gap-2 max-w-none w-full sm:max-w-[500px] sm:w-screen">
            <Button
              onClick={handleFork}
              className="flex-1 gap-2 bg-blue-500 hover:bg-blue-600 text-white py-6 transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              <Pencil className="w-5 h-5" />
              <span className="text-lg font-medium">Edit</span>
            </Button>

            <Button
              onClick={handleExport}
              className="flex-1 gap-2 bg-violet-500 hover:bg-violet-600 text-white py-6 transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              <Download className="w-5 h-5" />
              <span className="text-lg font-medium">Export</span>
            </Button>
          </div>
        </div>
      </div>
      <Transition appear show={isModalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[999]"
          onClose={() => {
            setIsModalOpen(false);
            setActiveTab("sansan");
          }}
          ref={modalRef}
        >
          <div
            className={`fixed inset-0 flex w-screen items-center justify-center p-4 transition-all duration-500 ease-in-out bg-black/60`}
          >
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave=""
              leaveFrom=""
              leaveTo=""
            >
              <DialogPanel
                className={`w-full max-w-[430px] space-y-4 bg-white shadow-xl border transform transition-all rounded-lg`}
              >
                <div className="w-full max-w-[430px] h-screen md:h-fit max-h-[96dvh] bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden transition-shadow duration-300">
                  <div className="sticky top-0 bg-[#000] text-white p-4 flex flex-row justify-center items-center rounded-t-lg z-10 min-h-[80px] lg:min-h-[96px]">
                    <DialogTitle className="text-lg lg:text-2xl font-bold">
                      Export Deck
                    </DialogTitle>
                    <button
                      onClick={() => {
                        setActiveTab("sansan");
                        setCopiedUrl(false);
                        setCopied(false);
                        setIsModalOpen(false);
                        setContent("");
                      }}
                      aria-label="Close"
                    >
                      <X className="h-[30px] w-[30px] md:h-[60px] md:w-[60px] text-white cursor-pointer absolute right-5 top-0 bottom-0 m-auto" />
                    </button>
                  </div>

                  <div className="p-3 md:p-6 flex-1 flex flex-col min-h-0 gap-4">
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
                        aria-controls={`panel-${"sansan"}`}
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
                        aria-controls={`panel-${"optcgsim"}`}
                      >
                        OPSim
                      </button>
                    </div>
                    <div className="flex flex-col bg-gray-200 rounded-b-lg min-h-0 overflow-auto rounded-lg px-4 py-3">
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
                            fontFamily: "Arial, sans-serif", // Prueba otra fuente
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
                    <Button
                      onClick={() => handleCopy()}
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

                  {/* Panel lateral estático: URL y botón Share */}
                  <div className="w-full flex flex-col gap-5 p-4">
                    <div className="flex w-full flex-col space-y-2">
                      <div className="flex items-center space-x-2">
                        <Input
                          id="deck-url"
                          type="text"
                          value={
                            "https://oharatcg.com/deckbuilder/" + uniqueUrl
                          }
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
                              "https://oharatcg.com/deckbuilder/" + uniqueUrl
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
                      <Share2 className="w-5 h-5" />
                      <span className="text-lg font-medium">Share</span>
                    </Button>
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

      <Transition appear show={isStatsOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[999]"
          onClose={() => {
            setIsStatsOpen(false);
          }}
        >
          <div
            className={`fixed inset-0 flex w-screen items-center justify-center p-4 transition-all duration-500 ease-in-out bg-black/60`}
          >
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave=""
              leaveFrom=""
              leaveTo=""
            >
              <DialogPanel
                className={`w-full max-w-[900px] space-y-4 bg-white shadow-xl border transform transition-all rounded-lg`}
              >
                <div className="w-full max-w-[900px] h-screen md:h-fit max-h-[96dvh] bg-white rounded-lg shadow-2xl flex flex-col transition-shadow duration-300 overflow-auto">
                  <div className="sticky top-0 bg-[#000] text-white p-4 flex flex-row justify-center items-center rounded-t-lg z-10 min-h-[80px] lg:min-h-[80px]">
                    <DialogTitle className="text-lg lg:text-2xl font-bold">
                      Stats
                    </DialogTitle>
                    <div className="absolute right-5 top-0 bottom-0 m-auto h-fit">
                      <button
                        onClick={() => setIsStatsOpen(false)}
                        aria-label="Close"
                      >
                        <X className="h-[20px] w-[20px] md:h-[60px] md:w-[60px] text-white cursor-pointer" />
                      </button>
                    </div>
                  </div>

                  <DeckStats deck={deckData?.deckCards} />
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

      {showModal && previewImage && (
        <div className="modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative w-full">
            <img src={previewImage} alt="Preview del Deck" className="w-full" />
            <div className="flex justify-between">
              <a
                href={previewImage}
                download="deck.png"
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded"
              >
                Descargar Imagen
              </a>
            </div>
          </div>
        </div>
      )}

      {showLargeImage && (
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
                src={selectedCard?.src}
                className="max-w-full max-h-[calc(100dvh-130px)] object-contain"
                alt=""
              />
              <div className="text-white text-lg font-[400] text-center px-5">
                <span className={`${oswald.className} font-[500]`}>
                  {selectedCard?.code}
                </span>
                <br />
                <span>{selectedCard?.set}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeckBuilderUniqueUrl;
