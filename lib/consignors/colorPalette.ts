// Paleta de colores distinguibles para consignatarios. Se asignan en orden
// de creación (el consignatario N-ésimo de una cuenta recibe
// CONSIGNOR_COLOR_PALETTE[N % length]), así que consignatarios consecutivos
// nunca se ven iguales hasta que la paleta da la vuelta.
export const CONSIGNOR_COLOR_PALETTE = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#0ea5e9", // sky
  "#6366f1", // indigo
  "#a855f7", // purple
  "#ec4899", // pink
  "#84cc16", // lime
  "#06b6d4", // cyan
  "#f43f5e", // rose
];

export function pickConsignorColor(indexAmongOwnersConsignors: number): string {
  return CONSIGNOR_COLOR_PALETTE[
    indexAmongOwnersConsignors % CONSIGNOR_COLOR_PALETTE.length
  ];
}
