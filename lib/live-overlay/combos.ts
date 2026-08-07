/**
 * Combos / presets del overlay: un solo disparo aplica varias escenas a la vez
 * (confeti + sonido + sello) de forma atómica. Compartido entre el cliente
 * (botones) y el servidor (los aplica). Sin dependencias.
 */
export type LiveOverlayCombo = {
  id: string;
  label: string;
  emoji: string;
  confetti?: boolean;
  sfx?: string;
  stamp?: { text: string; subtitle?: string };
};

export const LIVE_OVERLAY_COMBOS: LiveOverlayCombo[] = [
  {
    id: "sold",
    label: "Vendido",
    emoji: "💰",
    confetti: true,
    sfx: "coin",
    stamp: { text: "¡VENDIDO!" },
  },
  {
    id: "hype",
    label: "Hype",
    emoji: "🔥",
    confetti: true,
    sfx: "levelup",
  },
  {
    id: "gg",
    label: "GG",
    emoji: "🎉",
    confetti: true,
    sfx: "ding",
    stamp: { text: "GG" },
  },
  {
    id: "pull",
    label: "Pull",
    emoji: "✨",
    confetti: true,
    sfx: "levelup",
    stamp: { text: "¡PULL!" },
  },
];

export const findLiveOverlayCombo = (
  id: string
): LiveOverlayCombo | undefined =>
  LIVE_OVERLAY_COMBOS.find((combo) => combo.id === id);
