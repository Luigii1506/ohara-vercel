export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import sharp from "sharp";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1400;
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

type VisionRecognition = {
  code: string | null;
  name: string | null;
  setCode: string | null;
  rarity: string | null;
  region: string | null;
  language: string | null;
  confidence: number;
  notes: string | null;
};

type CardCandidate = {
  id: number;
  name: string;
  code: string;
  setCode: string;
  rarity: string | null;
  region: string | null;
  language: string | null;
  src: string;
  alternateArt: string | null;
  setTitle: string | null;
  confidence: number;
  reasons: string[];
};

function getApiKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || null;
}

const RECOGNITION_TOOL_NAME = "report_card_identification";

const recognitionTool = {
  name: RECOGNITION_TOOL_NAME,
  description: "Report the identified One Piece Card Game card fields.",
  input_schema: {
    type: "object" as const,
    properties: {
      code: {
        type: ["string", "null"],
        description:
          "Card code like OP01-001, ST10-003, EB02-045, P-001. Null if not legible.",
      },
      name: {
        type: ["string", "null"],
        description: "Printed card name.",
      },
      setCode: {
        type: ["string", "null"],
        description: "Set code like OP01, ST10, EB02, PRB01, P.",
      },
      rarity: {
        type: ["string", "null"],
      },
      region: {
        type: ["string", "null"],
        description:
          "One of US, JP, CN, KR, TH, FR when inferable from language or print style.",
      },
      language: {
        type: ["string", "null"],
        description: "ISO-like lowercase code such as en, ja, zh-Hans, ko, th, fr.",
      },
      confidence: {
        type: "number",
        description:
          "Overall confidence between 0 and 1 that this identification is correct.",
      },
      notes: {
        type: ["string", "null"],
        description:
          "Brief note about uncertainty, glare, blur, or partial occlusion. Null if none.",
      },
    },
    required: ["confidence"],
  },
};

function normalizeCode(value: string | null | undefined) {
  if (!value) return null;
  return value
    .toUpperCase()
    .replace(/[—–−]/g, "-")
    .replace(/\s+/g, "")
    .replace(/_/g, "-")
    .replace(/([A-Z]+)(\d{2})(\d{3})$/, "$1$2-$3");
}

function normalizeText(value: string | null | undefined) {
  if (!value) return "";
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clampConfidence(value: unknown) {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

function overlapScore(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.85;

  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

async function preprocessImage(buffer: Buffer) {
  const image = sharp(buffer, { failOn: "none" }).rotate();
  const metadata = await image.metadata();

  const processed = await image
    .resize({
      width:
        metadata.width && metadata.width > metadata.height
          ? MAX_IMAGE_DIMENSION
          : undefined,
      height:
        metadata.height && metadata.height >= metadata.width
          ? MAX_IMAGE_DIMENSION
          : undefined,
      fit: "inside",
      withoutEnlargement: true,
    })
    .normalize()
    .sharpen({ sigma: 1.1, m1: 1.2, m2: 0.6 })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  const finalMetadata = await sharp(processed).metadata();

  return {
    buffer: processed,
    width: finalMetadata.width ?? metadata.width ?? null,
    height: finalMetadata.height ?? metadata.height ?? null,
    mimeType: "image/jpeg",
  };
}

function isSupportedImageMediaType(
  value: string
): value is "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  return (
    value === "image/jpeg" ||
    value === "image/png" ||
    value === "image/gif" ||
    value === "image/webp"
  );
}

async function recognizeCardFromImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<VisionRecognition> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. Add it before using the scanner."
    );
  }

  if (!isSupportedImageMediaType(mimeType)) {
    throw new Error(`Unsupported image type for Claude vision: ${mimeType}`);
  }

  const client = new Anthropic({ apiKey });
  const prompt = [
    "You are identifying a single One Piece Card Game trading card from one image.",
    "Read the small printed code carefully — it is tiny text usually in a bottom corner, formatted like OP01-001, ST10-003, EB02-045, or P-001.",
    "The image may have foil/holo glare, blur, or partial occlusion. Use whatever text and art is legible instead of guessing, and lower confidence accordingly rather than inventing a plausible-looking value.",
    "If a field is not legible, return null for it.",
    "confidence reflects how sure you are of the overall identification, from 0 (no idea) to 1 (fully legible and certain) — use notes to briefly explain what made the read difficult, if anything.",
    "Call the report_card_identification tool with your findings — that is the only way to respond.",
  ].join("\n");

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: imageBuffer.toString("base64"),
            },
          },
        ],
      },
    ],
    tools: [recognitionTool],
    tool_choice: { type: "tool", name: RECOGNITION_TOOL_NAME },
  });

  const toolUseBlock = response.content.find(
    (block) => block.type === "tool_use"
  );
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
    throw new Error("Claude no devolvió una identificación estructurada.");
  }

  const parsed = toolUseBlock.input as Partial<VisionRecognition>;

  return {
    code: normalizeCode(parsed.code) ?? null,
    name: parsed.name?.trim() || null,
    setCode: normalizeCode(parsed.setCode)?.replace(/-\d{3}$/, "") ?? null,
    rarity: parsed.rarity?.trim() || null,
    region: parsed.region?.trim().toUpperCase() || null,
    language: parsed.language?.trim() || null,
    confidence: clampConfidence(parsed.confidence),
    notes: parsed.notes?.trim() || null,
  };
}

async function fetchCardPool(recognition: VisionRecognition) {
  const exactCode = recognition.code;
  const normalizedName = normalizeText(recognition.name);
  const maybeSetCode = recognition.setCode;
  const orConditions = [
    exactCode
      ? {
          code: {
            equals: exactCode,
            mode: "insensitive" as const,
          },
        }
      : undefined,
    normalizedName
      ? {
          name: {
            contains: recognition.name ?? "",
            mode: "insensitive" as const,
          },
        }
      : undefined,
    maybeSetCode
      ? {
          setCode: {
            equals: maybeSetCode,
            mode: "insensitive" as const,
          },
        }
      : undefined,
  ].filter(Boolean);

  if (orConditions.length === 0) {
    return [];
  }

  const cards = await prisma.card.findMany({
    where: {
      OR: orConditions as any[],
    },
    include: {
      sets: {
        take: 1,
        include: {
          set: {
            select: {
              title: true,
              code: true,
            },
          },
        },
      },
    },
    take: 80,
    orderBy: [{ code: "asc" }, { name: "asc" }],
  });

  return cards;
}

function scoreCandidate(card: any, recognition: VisionRecognition): CardCandidate {
  let score = 0;
  const reasons: string[] = [];

  const candidateCode = normalizeCode(card.code);
  const candidateSetCode = normalizeCode(card.setCode);
  const candidateName = normalizeText(card.name);
  const targetName = normalizeText(recognition.name);

  if (recognition.code && candidateCode === recognition.code) {
    score += 0.7;
    reasons.push("Coincide el código");
  } else if (recognition.code && candidateCode?.startsWith(recognition.code)) {
    score += 0.45;
    reasons.push("Código parcial cercano");
  }

  if (recognition.setCode && candidateSetCode === recognition.setCode) {
    score += 0.15;
    reasons.push("Coincide el set");
  }

  const nameScore = overlapScore(candidateName, targetName);
  if (nameScore > 0) {
    score += nameScore * 0.2;
    if (nameScore >= 0.95) reasons.push("Coincide el nombre");
    else reasons.push("Nombre cercano");
  }

  if (recognition.rarity && card.rarity === recognition.rarity) {
    score += 0.05;
    reasons.push("Coincide la rareza");
  }

  if (recognition.region && card.region === recognition.region) {
    score += 0.03;
    reasons.push("Coincide la región");
  }

  if (recognition.language && card.language === recognition.language) {
    score += 0.02;
    reasons.push("Coincide el idioma");
  }

  return {
    id: card.id,
    name: card.name,
    code: card.code,
    setCode: card.setCode,
    rarity: card.rarity,
    region: card.region,
    language: card.language,
    src: card.src,
    alternateArt: card.alternateArt,
    setTitle: card.sets?.[0]?.set?.title ?? null,
    confidence: Math.max(0, Math.min(1, score)),
    reasons,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: "Debes enviar una imagen en el campo 'file'." },
        { status: 400 }
      );
    }

    if (!fileEntry.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "El archivo debe ser una imagen." },
        { status: 400 }
      );
    }

    if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "La imagen excede el límite de 8 MB." },
        { status: 400 }
      );
    }

    const originalBuffer = Buffer.from(await fileEntry.arrayBuffer());
    const processed = await preprocessImage(originalBuffer);
    const recognition = await recognizeCardFromImage(
      processed.buffer,
      processed.mimeType
    );
    const pool = await fetchCardPool(recognition);
    const candidates = pool
      .map((card) => scoreCandidate(card, recognition))
      .filter((candidate) => candidate.confidence > 0)
      .sort((left, right) => right.confidence - left.confidence)
      .slice(0, 8);

    return NextResponse.json({
      recognition,
      bestCandidate: candidates[0] ?? null,
      candidates,
      image: {
        width: processed.width,
        height: processed.height,
      },
    });
  } catch (error: any) {
    console.error("Error identifying scanned card:", error);
    return NextResponse.json(
      {
        error:
          error?.message || "No se pudo identificar la carta en este momento.",
      },
      { status: 500 }
    );
  }
}
