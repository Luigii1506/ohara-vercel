/**
 * Catálogo de clips de video del overlay. Cada clip es un botón en el deck.
 *
 * CÓMO AGREGAR UN CLIP
 * --------------------
 * 1) Consigue el archivo (ver más abajo el recorte con yt-dlp/ffmpeg si tienes
 *    los derechos). Súbelo a R2, ej. bucket `ohara`, carpeta `videos/`.
 *    Formato ideal: .webm (VP9) o .mp4 (H.264), corto y liviano.
 * 2) Agrega una entrada aquí con su URL pública de R2.
 *
 * IMPORTANTE (derechos): usa solo clips tuyos, con licencia o libres de derechos.
 * Reproducir material con copyright en un live puede hacer que TikTok lo silencie
 * o baje la transmisión.
 *
 * RECORTAR DE SEGUNDO X A Y (si tienes derechos):
 *   yt-dlp -f mp4 -o fuente.mp4 "URL_DEL_VIDEO"
 *   ffmpeg -ss X -to Y -i fuente.mp4 -c:v libx264 -c:a aac -movflags +faststart clip.mp4
 *   # (o a webm)  ffmpeg -ss X -to Y -i fuente.mp4 -c:v libvpx-vp9 -c:a libopus clip.webm
 *   luego sube clip.mp4 a R2 y pega su URL abajo.
 */
export type LiveOverlayVideoClip = {
  id: string;
  label: string;
  emoji: string;
  url: string; // URL pública en R2 (mp4/webm)
  loop?: boolean; // repetir hasta "Detener"
  muted?: boolean; // sin audio
  fit?: "cover" | "contain"; // llenar (recorta) o contener (letterbox)
  startSec?: number; // recorte en runtime (si NO pre-recortaste)
  endSec?: number;
};

export const LIVE_OVERLAY_VIDEO_CLIPS: LiveOverlayVideoClip[] = [
  // Ejemplo — reemplaza `url` por tu clip en R2 y descomenta:
  // {
  //   id: "hype",
  //   label: "Hype",
  //   emoji: "🎬",
  //   url: "https://images.oharatcg.com/videos/hype.mp4",
  //   loop: false,
  //   muted: false,
  //   fit: "cover",
  //   // startSec: 12, endSec: 18,  // opcional si no pre-recortaste
  // },
];

export const findLiveOverlayVideoClip = (
  id: string
): LiveOverlayVideoClip | undefined =>
  LIVE_OVERLAY_VIDEO_CLIPS.find((c) => c.id === id);
