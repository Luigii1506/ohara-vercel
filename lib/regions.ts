export type RegionOption = {
  code: string;
  label: string;
};

export const DEFAULT_REGION = "US";

// TC (Taiwan/HK) queda fuera a propósito: sus cartas base son el mismo
// archivo de imagen y el mismo texto en japonés que JP — no hay
// localización real en chino tradicional, así que no cuenta como una
// opción de región distinta para navegar el catálogo. Las ~5,600 cartas
// TC ya importadas se quedan en la base (no se borran, se ven en las
// herramientas de admin que comparan por código), solo dejan de poder
// elegirse como región en el sitio.
export const REGION_OPTIONS: RegionOption[] = [
  { code: "US", label: "USA" },
  { code: "JP", label: "Japan" },
  { code: "FR", label: "France" },
  { code: "KR", label: "Korea" },
  { code: "CN", label: "China" },
];
