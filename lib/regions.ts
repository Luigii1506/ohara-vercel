export type RegionOption = {
  code: string;
  label: string;
};

export const DEFAULT_REGION = "US";

export const REGION_OPTIONS: RegionOption[] = [
  { code: "US", label: "USA" },
  { code: "JP", label: "Japan" },
  { code: "FR", label: "France" },
  { code: "KR", label: "Korea" },
  { code: "CN", label: "China" },
];
