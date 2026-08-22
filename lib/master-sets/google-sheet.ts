import * as XLSX from "xlsx";

export const GOOGLE_CAMEO_SPREADSHEET_ID =
  "19z6aFtVP0fFgTze5Fwa2USdp2shUOts4dsUsxCuxMTM";

const GOOGLE_CAMEO_META_SHEET_NAMES = new Set([
  "Front",
  "Character List",
  "Change Log",
]);

export type GoogleSheetTab = {
  name: string;
  gid: string;
  pageUrl: string;
  sheetType: "META" | "CHARACTER";
};

export type GoogleCameoRow = {
  rowNumber: number;
  cardName: string;
  cardType: string | null;
  setNumber: string | null;
  variant: string | null;
  specialSet: string | null;
  tcgplayerUrl: string | null;
  tcgplayerProductId: string | null;
  raw: Record<string, unknown>;
};

export type MasterSetVariantCategory =
  | "BASE"
  | "MANGA"
  | "PRE_RELEASE"
  | "RELEASE_EVENT"
  | "WINNER"
  | "FINALIST"
  | "PARTICIPATION"
  | "TOP_PLAYER"
  | "JUDGE"
  | "TREASURE_CUP"
  | "TREASURE_RARE"
  | "ANNIVERSARY"
  | "SERIAL"
  | "SPECIAL"
  | "OTHER";

function decodeJsStringLiteral(value: string) {
  try {
    return JSON.parse(`"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  } catch {
    return value;
  }
}

export function slugifyCharacterName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function normalizeCardCode(value: string | null | undefined) {
  if (!value) return null;

  return value
    .toUpperCase()
    .replace(/[—–−]/g, "-")
    .replace(/\s+/g, "")
    .replace(/_/g, "-")
    .replace(/([A-Z]+)(\d{2})(\d{3})$/, "$1$2-$3");
}

export function normalizeMasterSetText(value: string | null | undefined) {
  if (!value) return "";

  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function classifyMasterSetVariant(
  variant: string | null | undefined,
  specialSet?: string | null | undefined
): MasterSetVariantCategory {
  const normalizedVariant = normalizeMasterSetText(variant);
  const normalizedSpecialSet = normalizeMasterSetText(specialSet);
  const text = `${normalizedVariant} ${normalizedSpecialSet}`.trim();

  if (!text || text === "base") return "BASE";
  if (/\bmanga\b/.test(text)) return "MANGA";
  if (/pre release/.test(text)) return "PRE_RELEASE";
  if (/release event/.test(text)) return "RELEASE_EVENT";
  if (/\bwinner\b/.test(text)) return "WINNER";
  if (/\bfinalist\b/.test(text)) return "FINALIST";
  if (/\bparticipation\b/.test(text)) return "PARTICIPATION";
  if (/top player/.test(text)) return "TOP_PLAYER";
  if (/\bjudge\b/.test(text)) return "JUDGE";
  if (/treasure cup/.test(text)) return "TREASURE_CUP";
  if (/treasure rare/.test(text)) return "TREASURE_RARE";
  if (/anniversary/.test(text)) return "ANNIVERSARY";
  if (/serial/.test(text)) return "SERIAL";
  if (/special|promo|gold|holo/.test(text)) return "SPECIAL";
  if (!normalizedVariant) return "BASE";
  return "OTHER";
}

export function getVariantCategoryLabel(category: MasterSetVariantCategory) {
  switch (category) {
    case "BASE":
      return "Base";
    case "MANGA":
      return "Manga";
    case "PRE_RELEASE":
      return "Pre-Release";
    case "RELEASE_EVENT":
      return "Release event";
    case "WINNER":
      return "Winner";
    case "FINALIST":
      return "Finalist";
    case "PARTICIPATION":
      return "Participation";
    case "TOP_PLAYER":
      return "Top Player";
    case "JUDGE":
      return "Judge";
    case "TREASURE_CUP":
      return "Treasure Cup";
    case "TREASURE_RARE":
      return "Treasure Rare";
    case "ANNIVERSARY":
      return "Anniversary";
    case "SERIAL":
      return "Serial";
    case "SPECIAL":
      return "Special";
    default:
      return "Other";
  }
}

function pickFirstValue(
  row: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function extractTcgplayerProductId(value: string | null | undefined) {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const directDigits = trimmed.match(/^\d+$/)?.[0];
  if (directDigits) return directDigits;

  const fromUrl = trimmed.match(/tcgplayer\.com\/product\/(\d+)/i)?.[1];
  if (fromUrl) return fromUrl;

  return null;
}

export async function fetchGoogleCameoTabs(
  spreadsheetId = GOOGLE_CAMEO_SPREADSHEET_ID
) {
  const response = await fetch(
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load Google Sheet tabs (${response.status} ${response.statusText})`
    );
  }

  const html = await response.text();
  const matches = Array.from(
    html.matchAll(
      /items\.push\(\{name:\s*"((?:[^"\\]|\\.)*)",\s*pageUrl:\s*"((?:[^"\\]|\\.)*)",\s*gid:\s*"(-?\d+)"/g
    )
  );

  return matches.map((match) => {
    const name = decodeJsStringLiteral(match[1]);
    return {
      name,
      gid: match[3],
      pageUrl: decodeJsStringLiteral(match[2]).replace(/\\u003d/g, "="),
      sheetType: GOOGLE_CAMEO_META_SHEET_NAMES.has(name) ? "META" : "CHARACTER",
    } satisfies GoogleSheetTab;
  });
}

export async function fetchGoogleCameoRows(
  gid: string,
  spreadsheetId = GOOGLE_CAMEO_SPREADSHEET_ID
) {
  const response = await fetch(
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load Google Sheet CSV (${response.status} ${response.statusText})`
    );
  }

  const csv = await response.text();
  const workbook = XLSX.read(csv, { type: "string" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  return rows
    .map((row, index) => {
      const cardName = pickFirstValue(row, ["Card Name", "__EMPTY"]);
      const setNumber = pickFirstValue(row, ["Set Number", "__EMPTY_2"]);

      return {
        rowNumber: index + 2,
        cardName: cardName ?? "",
        cardType: pickFirstValue(row, ["Card Type", "__EMPTY_1"]),
        setNumber: normalizeCardCode(setNumber),
        variant: pickFirstValue(row, ["Variant", "__EMPTY_3"]),
        specialSet: pickFirstValue(
          row,
          ["Special Set (If applicable)", "__EMPTY_4"]
        ),
        tcgplayerUrl: pickFirstValue(row, [
          "TCGPlayer URL",
          "TCG Player URL",
          "TCG URL",
          "Link",
          "URL",
          "__EMPTY_5",
        ]),
        tcgplayerProductId: extractTcgplayerProductId(
          pickFirstValue(row, [
            "TCGPlayer Product ID",
            "TCG Player Product ID",
            "TCGPlayer ID",
            "TCG Player ID",
            "Product ID",
            "PID",
            "TCGPlayer URL",
            "TCG Player URL",
            "TCG URL",
            "Link",
            "URL",
            "__EMPTY_5",
            "__EMPTY_6",
          ])
        ),
        raw: row,
      } satisfies GoogleCameoRow;
    })
    .filter((row) => row.cardName || row.setNumber);
}
