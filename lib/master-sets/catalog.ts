export type MasterSetSeedCharacter = {
  slug: string;
  name: string;
  aliases: string[];
  description?: string;
};

export const MASTER_SET_SEED_CHARACTERS: MasterSetSeedCharacter[] = [
  {
    slug: "monkey-d-luffy",
    name: "Monkey D. Luffy",
    aliases: ["Monkey D. Luffy", "Luffy", "Mugiwara", "Straw Hat Luffy"],
    description: "Leader of the Straw Hat Pirates.",
  },
  {
    slug: "portgas-d-ace",
    name: "Portgas D. Ace",
    aliases: ["Portgas D. Ace", "Ace", "Fire Fist Ace"],
    description: "Son of Gol D. Roger and sworn brother of Luffy and Sabo.",
  },
  {
    slug: "roronoa-zoro",
    name: "Roronoa Zoro",
    aliases: ["Roronoa Zoro", "Zoro", "Pirate Hunter Zoro"],
  },
  {
    slug: "nami",
    name: "Nami",
    aliases: ["Nami", "Cat Burglar Nami"],
  },
  {
    slug: "sanji",
    name: "Sanji",
    aliases: ["Sanji", "Black Leg Sanji"],
  },
  {
    slug: "trafalgar-law",
    name: "Trafalgar Law",
    aliases: ["Trafalgar Law", "Law", "Trafalgar D. Water Law"],
  },
  {
    slug: "shanks",
    name: "Shanks",
    aliases: ["Shanks", "Red-Haired Shanks", "Red Hair Shanks"],
  },
  {
    slug: "gol-d-roger",
    name: "Gol D. Roger",
    aliases: ["Gol D. Roger", "Roger", "Gold Roger"],
  },
  {
    slug: "sabo",
    name: "Sabo",
    aliases: ["Sabo"],
  },
  {
    slug: "yamato",
    name: "Yamato",
    aliases: ["Yamato"],
  },
  {
    slug: "boa-hancock",
    name: "Boa Hancock",
    aliases: ["Boa Hancock", "Hancock"],
  },
  {
    slug: "nico-robin",
    name: "Nico Robin",
    aliases: ["Nico Robin", "Robin"],
  },
];

export type ExtractedCharacterMatch = {
  slug: string;
  relationType:
    | "MENTIONED_IN_NAME"
    | "MENTIONED_IN_TEXT"
    | "MENTIONED_IN_TRIGGER";
  matchedAlias: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildAliasRegex(alias: string) {
  return new RegExp(
    `(^|[^\\p{L}\\p{N}])(${escapeRegExp(alias)})(?=[^\\p{L}\\p{N}]|$)`,
    "iu"
  );
}

function hasAliasMatch(text: string, aliases: string[]) {
  return aliases.find((alias) => buildAliasRegex(alias).test(text)) ?? null;
}

export function extractCharacterMatchesFromCardSource({
  name,
  texts,
  triggerCard,
}: {
  name?: string | null;
  texts?: Array<string | null | undefined>;
  triggerCard?: string | null;
}): ExtractedCharacterMatch[] {
  const matches = new Map<string, ExtractedCharacterMatch>();

  for (const character of MASTER_SET_SEED_CHARACTERS) {
    const aliasInName = name ? hasAliasMatch(name, character.aliases) : null;
    if (aliasInName) {
      matches.set(`${character.slug}:MENTIONED_IN_NAME`, {
        slug: character.slug,
        relationType: "MENTIONED_IN_NAME",
        matchedAlias: aliasInName,
      });
    }

    const aliasInTrigger = triggerCard
      ? hasAliasMatch(triggerCard, character.aliases)
      : null;
    if (aliasInTrigger) {
      matches.set(`${character.slug}:MENTIONED_IN_TRIGGER`, {
        slug: character.slug,
        relationType: "MENTIONED_IN_TRIGGER",
        matchedAlias: aliasInTrigger,
      });
    }

    for (const text of texts ?? []) {
      const aliasInText = text ? hasAliasMatch(text, character.aliases) : null;
      if (aliasInText) {
        matches.set(`${character.slug}:MENTIONED_IN_TEXT`, {
          slug: character.slug,
          relationType: "MENTIONED_IN_TEXT",
          matchedAlias: aliasInText,
        });
        break;
      }
    }
  }

  return Array.from(matches.values());
}
