// Parser: texto de carta (One Piece TCG) → efectos estructurados ejecutables.
//
// Prototipo del motor de reglas. Cubre los patrones más comunes; lo no
// reconocido queda como { type: "raw" } para ir subiendo cobertura.

import {
  CardFilter,
  Duration,
  EffectAction,
  EffectCost,
  ParsedCardEffects,
  ParsedEffect,
  Target,
  Trigger,
} from "@/types/cardEffects";

const TRIGGER_MAP: Record<string, Trigger> = {
  "On Play": "OnPlay",
  "When Attacking": "WhenAttacking",
  "Activate: Main": "ActivateMain",
  "Active: Main": "ActivateMain",
  Main: "Main",
  "On K.O.": "OnKO",
  "On Block": "OnBlock",
  Counter: "Counter",
  Trigger: "Trigger",
  "Your Turn": "YourTurn",
  "Opponent's Turn": "OpponentsTurn",
  "On Your Opponent's Attack": "OnOpponentAttack",
  "End of Your Turn": "EndOfYourTurn",
};
const KEYWORD_ABILITIES: Record<string, EffectAction> = {
  Blocker: { type: "giveKeyword", target: "self", keyword: "Blocker" },
  Rush: { type: "giveKeyword", target: "self", keyword: "Rush" },
  "Double Attack": { type: "giveKeyword", target: "self", keyword: "DoubleAttack" },
  Banish: { type: "giveKeyword", target: "self", keyword: "Banish" },
};

const num = (s?: string) => (s ? parseInt(s, 10) : 0);

/** Filtro de objetivo: tipo {X}, cost/power ≤/≥ N. */
function parseFilter(text: string): CardFilter | undefined {
  const f: CardFilter = {};
  const type = text.match(/\{([^}]+)\}/);
  if (type) f.cardType = type[1];
  const costLte = text.match(/cost of (\d+) or less/i);
  if (costLte) f.costLte = num(costLte[1]);
  const costGte = text.match(/cost of (\d+) or more/i);
  if (costGte) f.costGte = num(costGte[1]);
  const powLte = text.match(/(\d+) power or less/i);
  if (powLte) f.powerLte = num(powLte[1]);
  const powGte = text.match(/(\d+) power or more/i);
  if (powGte) f.powerGte = num(powGte[1]);
  return Object.keys(f).length ? f : undefined;
}

function durationOf(t: string): Duration {
  if (/during this battle/i.test(t)) return "battle";
  if (/until the start of your next turn/i.test(t)) return "untilStartOfYourNextTurn";
  if (/until the end of your opponent's next turn/i.test(t)) return "untilEndOfOpponentTurn";
  return "turn";
}

// Matchers de acción, en orden. Cada uno intenta contra una cláusula.
const ACTION_MATCHERS: { re: RegExp; build: (m: RegExpMatchArray, clause: string) => EffectAction }[] = [
  { re: /Draw (\d+) cards?/i, build: (m) => ({ type: "draw", n: num(m[1]) }) },
  {
    re: /(?:gains?|gain) \+?(\d+) power/i,
    build: (m, c) => ({
      type: "givePower",
      target: /opponent's/i.test(c) ? "chosenOpponentCharacter" : "self",
      amount: num(m[1]),
      duration: durationOf(c),
    }),
  },
  {
    re: /Give (?:up to |all of )?(\d+)?[^.]*opponent's Characters?[^.]*[-−](\d+) power/i,
    build: (m, c) => ({
      type: "givePower",
      target: /all of/i.test(c) ? "allOpponentCharacters" : "chosenOpponentCharacter",
      amount: -num(m[2]),
      duration: durationOf(c),
    }),
  },
  {
    re: /Set up to (\d+) of your DON!! cards? as active/i,
    build: (m) => ({ type: "activateDon", n: num(m[1]) }),
  },
  {
    re: /add (?:up to )?(\d+) cards? from(?: the top of)? your Life cards? to your hand/i,
    build: (m) => ({ type: "trash", from: "life", n: num(m[1]) }),
  },
  {
    re: /reveal up to (\d+) \{[^}]+\} type card/i,
    build: (m, c) => ({ type: "lookTopAdd", look: 0, add: num(m[1]), filter: parseFilter(c) }),
  },
  {
    re: /K\.?O\.? up to (\d+)[^.]*/i,
    build: (m, c) => ({ type: "ko", target: "chosenOpponentCharacter", upTo: num(m[1]), filter: parseFilter(c) }),
  },
  {
    re: /Rest up to (\d+)[^.]*Character/i,
    build: (m, c) => ({
      type: "rest",
      target: /opponent/i.test(c) ? "chosenOpponentCharacter" : "chosenYourCharacter",
      upTo: num(m[1]),
      filter: parseFilter(c),
    }),
  },
  {
    re: /Add up to (\d+) DON!! card[^.]*set it as (active|rested)/i,
    build: (m) => ({ type: "addDon", n: num(m[1]), state: m[2].toLowerCase() as "active" | "rested" }),
  },
  {
    re: /Give up to (\d+) rested DON!! cards?[^.]*/i,
    build: (m, c) => ({
      type: "giveDon",
      target: /this (?:Leader|Character)/i.test(c) ? "self" : "chosenYourCharacter",
      n: num(m[1]),
      rested: true,
    }),
  },
  {
    re: /Look at (?:up to )?(\d+) cards? from the top of your deck/i,
    build: (m, c) => {
      const add = c.match(/add(?: up to)? (\d+)/i);
      return { type: "lookTopAdd", look: num(m[1]), add: add ? num(add[1]) : 1, filter: parseFilter(c) };
    },
  },
  {
    re: /Return up to (\d+)[^.]*Character/i,
    build: (m, c) => ({
      type: "returnToHand",
      target: /opponent/i.test(c) ? "chosenOpponentCharacter" : "chosenYourCharacter",
      upTo: num(m[1]),
      filter: parseFilter(c),
    }),
  },
  {
    re: /(?:Play|Place) up to (\d+)[^.]*/i,
    build: (m, c) => ({
      type: "play",
      from: /from your (?:deck|trash)/i.test(c) ? (/trash/i.test(c) ? "trash" : "deck") : "hand",
      upTo: num(m[1]),
      filter: parseFilter(c),
    }),
  },
  {
    re: /Trash (\d+) cards? from the top of your deck/i,
    build: (m) => ({ type: "trash", from: "topDeck", n: num(m[1]) }),
  },
  {
    re: /add (?:up to )?(\d+) cards? from the top of your deck to (?:the top of )?your Life/i,
    build: (m) => ({ type: "addToLife", from: "topDeck", n: num(m[1]) }),
  },
  { re: /Set (?:this Character|this Leader) as active/i, build: () => ({ type: "setActive", target: "self" }) },
  {
    re: /Deal (\d+) damage/i,
    build: (m) => ({ type: "dealDamage", n: num(m[1]) }),
  },
  {
    re: /cannot be K\.?O\.?/i,
    build: () => ({ type: "restrict", target: "self", restriction: "cantKO" }),
  },
  {
    re: /cannot attack/i,
    build: (_m, c) => ({
      type: "restrict",
      target: /this Character/i.test(c) ? "self" : "chosenOpponentCharacter",
      restriction: "cantAttack",
    }),
  },
];

// Cláusulas de continuación/relleno que no son acciones propias (se absorben).
const IGNORE_CLAUSES = [
  /^place the rest/i,
  /^place them/i,
  /^trash the rest/i,
  /in any order$/i,
  /^then,?$/i,
  /^and add it to your hand/i,
  /^add it to your hand/i,
];

/** Parsea el texto de acción (puede tener varias cláusulas) a EffectAction[]. */
function parseActions(text: string): EffectAction[] {
  const actions: EffectAction[] = [];
  const clauses = text
    .split(/(?:\.\s+|;\s+|,?\s*Then,\s*|,?\s*and then\s*)/i)
    .map((c) => c.trim())
    .filter(Boolean);
  for (const clause of clauses) {
    if (IGNORE_CLAUSES.some((re) => re.test(clause))) continue;
    let matched = false;
    for (const { re, build } of ACTION_MATCHERS) {
      const m = clause.match(re);
      if (m) {
        actions.push(build(m, clause));
        matched = true;
        break;
      }
    }
    if (!matched && clause.length > 4) actions.push({ type: "raw", text: clause.slice(0, 80) });
  }
  return actions;
}

/** Parsea el costo/condición del prefijo "You may ...:" de un efecto. */
function parseCost(text: string): { cost?: EffectCost; rest: string } {
  const idx = text.indexOf(":");
  if (idx === -1 || idx > 90) return { rest: text };
  const pre = text.slice(0, idx);
  if (!/^You may|^Rest |^Trash |^Return /i.test(pre.trim())) return { rest: text };
  const cost: EffectCost = {};
  if (/rest .*this (?:Character|Leader)/i.test(pre)) cost.restThisCard = true;
  const rd = pre.match(/rest (\d+) of your DON!! cards?/i);
  if (rd) cost.restDon = num(rd[1]);
  const th = pre.match(/trash (\d+) cards? from your hand/i);
  if (th) cost.trashFromHand = num(th[1]);
  const tl = pre.match(/trash (\d+) cards? from(?: the top of)? your Life/i);
  if (tl) cost.trashFromLife = num(tl[1]);
  return { cost: Object.keys(cost).length ? cost : undefined, rest: text.slice(idx + 1).trim() };
}

/** Parsea el texto completo de una carta a efectos estructurados. */
export function parseCardText(rawText: string): ParsedEffect[] {
  const effects: ParsedEffect[] = [];
  // El texto entre paréntesis es recordatorio de reglas, no acciones → quitar.
  const text = rawText.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ");
  // Separar por tags [X]; alternan tag / texto.
  const parts = text.split(/(\[[^\]]+\])/).filter((s) => s.trim());

  let tags: string[] = [];
  let body = "";
  const flush = () => {
    const triggerTag = tags.find((t) => TRIGGER_MAP[t]);
    const keywordTag = tags.find((t) => KEYWORD_ABILITIES[t]);
    if (!triggerTag && !keywordTag && !body.trim()) {
      tags = [];
      body = "";
      return;
    }
    const eff: ParsedEffect = {
      trigger: triggerTag ? TRIGGER_MAP[triggerTag] : keywordTag ? "Passive" : "Unknown",
      oncePerTurn: tags.some((t) => /Once Per Turn/i.test(t)) || undefined,
      actions: [],
    };
    const don = tags.find((t) => /DON!! x(\d+)/i.test(t));
    if (don) eff.donRequirement = num(don.match(/x(\d+)/i)?.[1]);
    if (keywordTag) eff.actions.push(KEYWORD_ABILITIES[keywordTag]);
    if (body.trim()) {
      const { cost, rest } = parseCost(body.trim());
      if (cost) eff.cost = cost;
      eff.actions.push(...parseActions(rest));
    }
    if (eff.actions.length) effects.push(eff);
    tags = [];
    body = "";
  };

  for (const part of parts) {
    const tag = part.match(/^\[([^\]]+)\]$/);
    if (tag) {
      const name = tag[1];
      // Un nuevo TRIGGER cierra el efecto anterior si ya había cuerpo.
      if (TRIGGER_MAP[name] && (body.trim() || tags.some((t) => TRIGGER_MAP[t]))) flush();
      tags.push(name);
    } else {
      body += part;
    }
  }
  flush();
  return effects;
}

export function parseCardEffects(code: string, texts: string[]): ParsedCardEffects {
  const effects: ParsedEffect[] = [];
  for (const t of texts) effects.push(...parseCardText(t));
  const allActions = effects.flatMap((e) => e.actions);
  const parsed = allActions.filter((a) => a.type !== "raw").length;
  const coverage = allActions.length ? parsed / allActions.length : 1;
  return { code, effects, coverage };
}
