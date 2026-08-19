"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  RefreshCcw,
  RotateCcw,
  ScanLine,
  Smartphone,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ScanCandidate = {
  id: number;
  name: string;
  code: string;
  setCode: string;
  rarity: string | null;
  region: string | null;
  language: string | null;
  src: string;
  alternateArt: string | null;
  setTitle: string | null;
  confidence: number;
  reasons: string[];
};

type ScanResponse = {
  recognition: {
    code: string | null;
    name: string | null;
    setCode: string | null;
    rarity: string | null;
    region: string | null;
    language: string | null;
    confidence: number;
    notes: string | null;
  };
  bestCandidate: ScanCandidate | null;
  candidates: ScanCandidate[];
  image: {
    width: number | null;
    height: number | null;
  };
};

const CARD_RATIO = 63 / 88;

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function ScanClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isStartingCamera, setIsStartingCamera] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">(
    "environment"
  );

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setIsStartingCamera(true);
    setCameraError(null);

    try {
      stopStream();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: cameraFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
    } catch (error) {
      console.error("Error opening camera:", error);
      setCameraError(
        "No se pudo abrir la cámara. Revisa permisos o usa la opción de subir foto."
      );
    } finally {
      setIsStartingCamera(false);
    }
  }, [cameraFacing, stopStream]);

  useEffect(() => {
    void startCamera();
    return () => {
      stopStream();
    };
  }, [startCamera, stopStream]);

  useEffect(() => {
    return () => {
      if (capturedUrl) {
        URL.revokeObjectURL(capturedUrl);
      }
    };
  }, [capturedUrl]);

  const resetCapture = useCallback(() => {
    setResult(null);
    setScanError(null);
    setCapturedBlob(null);
    if (capturedUrl) {
      URL.revokeObjectURL(capturedUrl);
    }
    setCapturedUrl(null);
  }, [capturedUrl]);

  const scanBlob = useCallback(async (blob: Blob) => {
    setIsScanning(true);
    setScanError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", blob, "scan-card.jpg");

      const response = await fetch("/api/scan/identify", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo escanear la carta.");
      }

      setResult(data as ScanResponse);
    } catch (error: any) {
      setScanError(error?.message || "No se pudo escanear la carta.");
    } finally {
      setIsScanning(false);
    }
  }, []);

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setScanError("La cámara todavía no está lista.");
      return;
    }

    const cropScale = 0.82;
    let cropHeight = Math.floor(video.videoHeight * cropScale);
    let cropWidth = Math.floor(cropHeight * CARD_RATIO);

    if (cropWidth > Math.floor(video.videoWidth * cropScale)) {
      cropWidth = Math.floor(video.videoWidth * cropScale);
      cropHeight = Math.floor(cropWidth / CARD_RATIO);
    }

    const cropX = Math.floor((video.videoWidth - cropWidth) / 2);
    const cropY = Math.floor((video.videoHeight - cropHeight) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setScanError("No se pudo preparar la captura.");
      return;
    }

    context.drawImage(
      video,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );

    if (!blob) {
      setScanError("No se pudo generar la imagen de captura.");
      return;
    }

    resetCapture();
    const objectUrl = URL.createObjectURL(blob);
    setCapturedBlob(blob);
    setCapturedUrl(objectUrl);
    await scanBlob(blob);
  }, [resetCapture, scanBlob]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      resetCapture();
      const objectUrl = URL.createObjectURL(file);
      setCapturedBlob(file);
      setCapturedUrl(objectUrl);
      await scanBlob(file);
      event.target.value = "";
    },
    [resetCapture, scanBlob]
  );

  const bestCandidate = result?.bestCandidate ?? null;
  const hasCapture = Boolean(capturedUrl);
  const topCandidates = useMemo(
    () => result?.candidates ?? [],
    [result?.candidates]
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937,_#020617_58%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2 text-sky-300">
            <ScanLine className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-[0.18em]">
              Scanner
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Escanear una carta
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Centra una sola carta dentro del marco. El sistema intenta leer su
            c&oacute;digo y proponerte la coincidencia m&aacute;s probable.
          </p>
        </div>

        <Card className="overflow-hidden border-slate-800 bg-slate-950/70 shadow-2xl">
          <CardContent className="p-0">
            <div className="relative aspect-[9/16] bg-black">
              {!hasCapture ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.76),rgba(2,6,23,0.18)_18%,rgba(2,6,23,0.18)_82%,rgba(2,6,23,0.82))]" />
                  <div className="pointer-events-none absolute inset-x-0 top-5 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-950/70 px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur">
                      <Smartphone className="h-3.5 w-3.5" />
                      Usa buena luz y evita reflejos
                    </div>
                  </div>
                  <div
                    className="pointer-events-none absolute left-1/2 top-1/2 w-[72%] max-w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border-[3px] border-white/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]"
                    style={{ aspectRatio: `${CARD_RATIO}` }}
                  >
                    <div className="absolute left-3 top-3 h-6 w-6 rounded-tl-2xl border-l-4 border-t-4 border-sky-300" />
                    <div className="absolute right-3 top-3 h-6 w-6 rounded-tr-2xl border-r-4 border-t-4 border-sky-300" />
                    <div className="absolute bottom-3 left-3 h-6 w-6 rounded-bl-2xl border-b-4 border-l-4 border-sky-300" />
                    <div className="absolute bottom-3 right-3 h-6 w-6 rounded-br-2xl border-b-4 border-r-4 border-sky-300" />
                  </div>
                  {isStartingCamera && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75">
                      <div className="flex items-center gap-2 rounded-full bg-slate-900/90 px-4 py-2 text-sm text-slate-200">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Abriendo c&aacute;mara...
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <img
                  src={capturedUrl ?? undefined}
                  alt="Carta capturada"
                  className="h-full w-full object-contain bg-black"
                />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex gap-2">
          {!hasCapture ? (
            <>
              <Button
                className="h-12 flex-1 gap-2 text-base"
                onClick={() => void captureFrame()}
                disabled={isStartingCamera}
              >
                <Camera className="h-4 w-4" />
                Capturar
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 border-slate-700 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
                onClick={() =>
                  setCameraFacing((prev) =>
                    prev === "environment" ? "user" : "environment"
                  )
                }
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                className="h-12 flex-1 gap-2 text-base"
                onClick={() => capturedBlob && void scanBlob(capturedBlob)}
                disabled={isScanning || !capturedBlob}
              >
                {isScanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ScanLine className="h-4 w-4" />
                )}
                Reintentar escaneo
              </Button>
              <Button
                variant="outline"
                className="h-12 border-slate-700 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
                onClick={resetCapture}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Nueva foto
              </Button>
            </>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            className="h-11 flex-1 border-slate-700 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Subir foto
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {cameraError && (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {cameraError}
          </div>
        )}

        {scanError && (
          <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {scanError}
          </div>
        )}

        <div className="mt-5 space-y-4 pb-8">
          <Card className="border-slate-800 bg-slate-950/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-100">
                Lectura detectada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!result ? (
                <div className="rounded-lg border border-dashed border-slate-700 px-4 py-5 text-sm text-slate-400">
                  Captura una carta para ver c&oacute;digo, nombre, set e
                  indicadores de confianza.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <InfoPill label="C&oacute;digo" value={result.recognition.code} />
                  <InfoPill label="Set" value={result.recognition.setCode} />
                  <InfoPill label="Nombre" value={result.recognition.name} />
                  <InfoPill
                    label="Confianza OCR"
                    value={formatPercent(result.recognition.confidence)}
                  />
                  <InfoPill label="Rareza" value={result.recognition.rarity} />
                  <InfoPill label="Regi&oacute;n" value={result.recognition.region} />
                  {result.recognition.notes ? (
                    <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
                      {result.recognition.notes}
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-950/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-100">
                Mejor coincidencia
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!bestCandidate ? (
                <div className="rounded-lg border border-dashed border-slate-700 px-4 py-5 text-sm text-slate-400">
                  Todav&iacute;a no hay una coincidencia confirmable.
                </div>
              ) : (
                <div className="flex gap-3">
                  <img
                    src={bestCandidate.src}
                    alt={bestCandidate.name}
                    className="h-28 w-20 rounded-lg border border-slate-800 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {bestCandidate.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {bestCandidate.code} · {bestCandidate.setCode}
                        </p>
                      </div>
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                        {formatPercent(bestCandidate.confidence)}
                      </Badge>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {bestCandidate.setTitle ? (
                        <MetaBadge>{bestCandidate.setTitle}</MetaBadge>
                      ) : null}
                      {bestCandidate.rarity ? (
                        <MetaBadge>{bestCandidate.rarity}</MetaBadge>
                      ) : null}
                      {bestCandidate.region ? (
                        <MetaBadge>{bestCandidate.region}</MetaBadge>
                      ) : null}
                      {bestCandidate.alternateArt ? (
                        <MetaBadge>Alt {bestCandidate.alternateArt}</MetaBadge>
                      ) : null}
                    </div>

                    {bestCandidate.reasons.length > 0 ? (
                      <ul className="mt-3 space-y-1 text-xs text-slate-300">
                        {bestCandidate.reasons.map((reason) => (
                          <li key={reason} className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {topCandidates.length > 1 && (
            <Card className="border-slate-800 bg-slate-950/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-slate-100">
                  Otras opciones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topCandidates.slice(1).map((candidate) => (
                  <div
                    key={candidate.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2",
                      candidate.confidence >= 0.75 && "border-sky-500/40"
                    )}
                  >
                    <img
                      src={candidate.src}
                      alt={candidate.name}
                      className="h-16 w-12 rounded-md border border-slate-800 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {candidate.name}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {candidate.code}
                        {candidate.setTitle ? ` · ${candidate.setTitle}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-slate-700 text-slate-200">
                      {formatPercent(candidate.confidence)}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4 text-xs leading-5 text-slate-400">
            <div className="mb-2 flex items-center gap-2 text-slate-200">
              <ImagePlus className="h-4 w-4" />
              Tips para mejor lectura
            </div>
            <ul className="space-y-1">
              <li>Usa una sola carta por foto.</li>
              <li>Evita brillo fuerte en el sleeve.</li>
              <li>Llena el marco con la carta sin cortar las esquinas.</li>
              <li>Si el OCR falla, prueba subir una foto m&aacute;s cerrada.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoPill({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-100">
        {value && value.trim() ? value : "Sin dato"}
      </p>
    </div>
  );
}

function MetaBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200">
      {children}
    </span>
  );
}
