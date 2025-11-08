"use server";

import * as cheerio from "cheerio";
import { CardData } from "@/types";

enum Rarity {
  Common = "Common",
  Uncommon = "Uncommon",
  Rare = "Rare",
  SuperRare = "Super Rare",
  SpecialRare = "Special Rare",
  SecretRare = "Secret Rare",
  Leader = "Leader",
}

const conditionsToFind = [
  "①",
  "➁",
  "③",
  "➃",
  "➄",
  "➅",
  "➆",
  "➇",
  "➈",
  "➉",
  "➀",
  "➂",
];

function extractEffectsAndTexts(text: string): {
  effects: string[];
  texts: string[];
  conditions: string[];
} {
  const effects: string[] = [];
  const texts: string[] = [];
  const conditions: string[] = [];
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  lines.forEach((line) => {
    let effectRegex = /^\[([^\]]+)\]/;
    let match: RegExpExecArray | null;
    let currentLine = line;
    let effectsInLine: string[] = [];

    // Extraer todos los efectos al inicio de la línea
    while ((match = effectRegex.exec(currentLine)) !== null) {
      effectsInLine.push(match[1]);
      effects.push(match[1]);
      currentLine = currentLine.slice(match[0].length).trim();
      effectRegex = /^\[([^\]]+)\]/;
    }

    const keyword = "DON!! −";
    if (currentLine.includes(keyword)) {
      const position = currentLine.indexOf(keyword);
      const extracted = currentLine.substring(
        position,
        position + keyword.length + 1
      );
      conditions.push(extracted);
    }

    if (conditionsToFind.some((condition) => currentLine.includes(condition))) {
      const foundCondition = conditionsToFind.find((condition) =>
        currentLine.includes(condition)
      );
      conditions.push(foundCondition || "");
    }

    if (currentLine.length > 0) {
      let formattedText = `[${effectsInLine.join("] [")}] ${currentLine}`;
      formattedText = formattedText.replace(/\[\]\s*/, "");
      texts.push(formattedText);
    }
  });

  return { effects, texts, conditions };
}

export async function scrapeAmazonProduct(
  url: string,
  setCode: string
): Promise<CardData[]> {
  //if (!url) return [];

  console.log("url22", url);
  console.log("setCode", setCode);

  const username = String(process.env.BRIGHT_DATA_USERNAME);
  const password = String(process.env.BRIGHT_DATA_PASSWORD);
  const port = 22225;
  const session_id = (1000000 * Math.random()) | 0;
  const options = {
    auth: {
      username: `${username}-session-${session_id}`,
      password: password,
    },
    host: "brd.superproxy.io",
    port,
    rejectUnauthorized: false,
  };

  try {
    // Use native fetch with proxy configuration
    const proxyUrl = `http://${options.auth.username}:${options.auth.password}@${options.host}:${options.port}`;

    const response = await fetch(url, {
      // Note: fetch doesn't support proxy auth directly, using headers instead
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.text();
    console.log("responsess", response);

    const $ = cheerio.load(data);

    let results: CardData[] = [];

    let idToRarity: Map<string, string> = new Map();

    $(".card-page-main").each((index, element) => {
      let cost: string | null = null;
      let life: string | null = null;
      let power: string | null = null;
      let attribute: string | null = null;
      let counter: string | null = null;
      let illustrator: string | null = null;
      let text: string | null = null;
      let trigger: string | null = null;

      const src = $(element).find(".card-image img").attr("src") || "";

      const name = $(element).find(".card-text-name a").text();

      const id = $(element).find(".card-text-id").text();

      const category = $(element).find('span[data-tooltip="Category"]').text();

      const colorRaw = $(element).find('span[data-tooltip="Color"]').text();
      const colors = colorRaw.split("/").map((c) => c.trim());

      const typeRaw = $(element).find('span[data-tooltip="Type"]').text();
      const types = typeRaw.split("/").map((t) => t.trim());

      const rawStatus = $(element).find(".legal").text();
      const status = rawStatus.replace(/\s+/g, " ").trim();

      const illustratorRaw = $(element).find(".card-text-artist a").text();
      illustrator = illustratorRaw.replace(/\s+/g, " ").trim();
      if (illustrator === "") illustrator = null;

      if (category !== "Leader") {
        cost =
          $(element)
            .find(".card-text-type")
            .text()
            .split("•")
            .map((text) => text.trim())
            .find((text) => text.includes("Cost")) || null;
        life = null;
      } else {
        cost = null;
        life =
          $(element)
            .find(".card-text-type")
            .text()
            .split("•")
            .map((text) => text.trim())
            .find((text) => text.includes("Life")) || null;
      }

      if (category !== "Event") {
        const powerSection = $(element).find(".card-text-section").eq(1);
        const powerText = powerSection
          .contents()
          .filter(function () {
            return this.type === "text";
          })
          .text()
          .trim();
        const powerMatch = powerText.match(/^\d+\sPower/);
        power = powerMatch ? powerMatch[0] : null;
        attribute = powerSection.find('span[data-tooltip="Attribute"]').text();
        counter =
          powerSection
            .contents()
            .filter(function () {
              return this.type === "text";
            })
            .text()
            .trim()
            .split("•")
            .map((text) => text.trim())
            .find((text) => text.includes("Counter")) || null;

        text = $(element).find(".card-text-section").eq(2).text().trim();
      } else {
        power = null;
        attribute = null;
        counter = null;
        text = $(element).find(".card-text-section").eq(1).text().trim();
      }

      const triggerMatch = text ? text.match(/\[Trigger\](.*)/) : null;
      if (triggerMatch) {
        trigger = triggerMatch[1].trim();
      }

      const setRaw = $(element)
        .find(".prints-current-details")
        .first()
        .find("span")
        .first()
        .text();
      const set = setRaw.replace(/\s+/g, " ").trim();
      const rarity = $(element)
        .find(".prints-current-details")
        .first()
        .find("span")
        .last()
        .text()
        .trim();

      const isRarityEnum = Object.values(Rarity).includes(rarity as Rarity);
      const alternateArt = isRarityEnum ? null : rarity;

      let isFirstEdition;
      isFirstEdition = isRarityEnum ? true : false;

      const { effects, texts, conditions } = extractEffectsAndTexts(text || "");

      let textInParentheses = setCode;

      // Special case for promo cards
      if (id.startsWith("P-")) {
        isFirstEdition = true;
      }

      // if (alternateArt !== "Full Art") {
      results.push({
        src,
        name,
        _id: id,
        types: types.length > 0 ? types.map((type) => ({ type })) : [],
        colors: colors.length > 0 ? colors.map((color) => ({ color })) : [],
        cost,
        power,
        attribute,
        counter,
        category,
        life,
        rarity,
        set,
        illustrator,
        alternateArt:
          alternateArt === null
            ? null
            : alternateArt === ""
            ? "Alternate Art"
            : alternateArt,
        status,
        triggerCard: trigger,
        effects:
          effects.length > 0 ? effects.map((effect) => ({ effect })) : [],
        texts: texts.length > 0 ? texts.map((text) => ({ text })) : [],
        conditions:
          conditions.length > 0
            ? conditions.map((condition) => ({ condition }))
            : [],
        code: id,
        setCode: textInParentheses as string,
        isFirstEdition: isFirstEdition,
        id: id,
        alias: isFirstEdition ? "Base" : alternateArt || "Alternate Art",
      });
      // }
      idToRarity.set(id, rarity);
    });

    results = results.map((card) => {
      if (
        card.rarity === "Full Art" ||
        card.rarity === "Alternate Art" ||
        card.rarity === "Manga Art" ||
        card.rarity === "Special Card" ||
        card.rarity === "Tresure Rare"
      ) {
        const normalCard = results.find(
          (c) =>
            c._id === card._id &&
            c.rarity !== "Full Art" &&
            c.rarity !== "Alternate Art" &&
            c.rarity !== "Manga Art" &&
            c.rarity !== "Special Card" &&
            c.rarity !== "Tresure Rare"
        );
        if (normalCard) {
          card.rarity = normalCard.rarity;
        }
      }
      return card;
    });

    console.log("resultados", results);

    return results;
  } catch (error) {
    console.error("Error scraping the page:", error);
    return [];
  }
}
