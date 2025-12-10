interface RawDictionary {
  phrases: Array<[string, string]>;
}

type NormalizedLocale = "jp" | "fr" | "cn";

const RAW_DICTIONARIES: Record<NormalizedLocale, RawDictionary> = {
  jp: {
    phrases: [
      ["ワンピース", "One Piece"],
      ["プロモーションパック", "Promotion Pack"],
      ["プロモーションスリーブ", "Promotion Sleeve"],
      ["リミテッド", "Limited"],
      ["オフィシャルプレイマット", "Official Playmat"],
      ["オフィシャルPlaymat", "Official Playmat"],
      ["プレミアムカードコレクション", "Premium Card Collection"],
      ["ベストセレクション", "Best Selection"],
      ["リミテッドカードスリーブ", "Limited Card Sleeve"],
      ["カードスリーブ", "Card Sleeve"],
      ["リミテッドエディション", "Limited Edition"],
      ["プレミアムマット", "Premium Mat"],
      ["プレイマット", "Playmat"],
      ["カードセット", "Card Set"],
      ["カードゲーム", "Card Game"],
      ["プレミアム", "Premium"],
      ["ジャッジ", "Judge"],
      ["ウィナー", "Winner"],
      ["スタンダードバトルパック", "Standard Battle Pack"],
      ["特製", "Special"],
      ["ドン!!カード", "Don!! Card"],
      ["ドン!!", "Don!!"],
      ["カード", "Card"],
    ],
  },
  fr: {
    phrases: [
      ["Tournoi boutique", "Store Tournament"],
      ["Pack de participation", "Participation Pack"],
      ["Pack du vainqueur", "Winner Pack"],
      ["Sleeves", "Sleeves"],
      ["Tapis de jeu", "Playmat"],
      ["Carte promotionnelle", "Promotion Card"],
      ["Pack événement", "Event Pack"],
    ],
  },
  cn: {
    phrases: [
      ["促销包", "Promotion Pack"],
      ["活动包", "Event Pack"],
      ["参赛包", "Participation Pack"],
      ["获胜者包", "Winner Pack"],
      ["裁判包", "Judge Pack"],
      ["卡套", "Sleeve"],
      ["卡牌", "Card"],
      ["纪念品", "Commemorative Item"],
      ["限定", "Limited"],
      ["套装", "Set"],
    ],
  },
};

interface DictionaryEntry {
  pattern: RegExp;
  replacement: string;
}

const COMPILED_DICTIONARIES: Record<string, DictionaryEntry[]> =
  Object.fromEntries(
    Object.entries(RAW_DICTIONARIES).map(([locale, dict]) => {
      const sortedPhrases = dict.phrases
        .filter(([source]) => source.trim().length > 0)
        .sort(([a], [b]) => b.length - a.length);
      return [
        locale,
        sortedPhrases.map(([source, replacement]) => ({
          pattern: new RegExp(
            source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "gi"
          ),
          replacement,
        })),
      ];
    })
  );

const VERSION_TOKENS = ["Vol", "Volume", "Season", "Set"];

function normalizeLocale(locale?: string): string {
  if (!locale) return "en";
  const lower = locale.toLowerCase();
  if (COMPILED_DICTIONARIES[lower]) return lower;
  const base = lower.split("-")[0];
  return base in COMPILED_DICTIONARIES ? base : lower;
}

export function translateWithDictionary(
  text: string | null | undefined,
  locale?: string
): string | null {
  if (!text) return null;
  const normalizedLocale = normalizeLocale(locale);
  const dictionary = COMPILED_DICTIONARIES[normalizedLocale];
  if (!dictionary) return null;

  let result = text;
  let hasReplacement = false;

  for (const entry of dictionary) {
    const updated = result.replace(entry.pattern, entry.replacement);
    if (updated !== result) {
      result = updated;
      hasReplacement = true;
    }
  }

  result = result.replace(/\s*-\s*/g, " - ");
  VERSION_TOKENS.forEach((token) => {
    const regex = new RegExp(`([A-Za-z0-9])\\s*(${token}\\.?\\s*\\d+)`, "gi");
    result = result.replace(regex, (_, pre, rest) => {
      const cleaned = rest.replace(/\s+/g, " ");
      return `${pre} ${cleaned}`;
    });
  });
  result = result.replace(/\s+/g, " ").trim();

  return hasReplacement ? result : null;
}
