import { NextRequest, NextResponse } from "next/server";

import { requireAuth, handleAuthError } from "@/lib/auth-helpers";
import {
  buildCardLocalizationDrafts,
  buildCardLocalizationDraftsWithTranslations,
} from "@/lib/cards/localization/drafts";
import { CardTextTranslationService } from "@/lib/cards/localization/translator";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const db = prisma as any;
type ExistingLocalizationEntry = { sourceKey: string; status: string };

function assertAdmin(user: { role?: string | null }) {
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function parseLanguage(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "es";
  return value.trim();
}

function isValidStatus(value: unknown) {
  return (
    value === "DRAFT" ||
    value === "REVIEWED" ||
    value === "APPROVED" ||
    value === "NEEDS_REVIEW"
  );
}

function isValidSource(value: unknown) {
  return (
    value === "GLOSSARY" ||
    value === "AI" ||
    value === "HUMAN" ||
    value === "IMPORTED"
  );
}

async function loadCard(cardId: number) {
  return db.card.findUnique({
    where: { id: cardId },
    include: {
      effects: {
        orderBy: { id: "asc" },
      },
      texts: {
        orderBy: { id: "asc" },
      },
      localizations: {
        orderBy: [{ language: "asc" }, { sourceOrder: "asc" }, { id: "asc" }],
      },
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const forbidden = assertAdmin(user);
    if (forbidden) return forbidden;

    const cardId = Number(params.id);
    if (!Number.isInteger(cardId)) {
      return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
    }

    const language = request.nextUrl.searchParams.get("language")?.trim() || null;
    const card = await loadCard(cardId);

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const drafts = language
      ? buildCardLocalizationDrafts(card, language)
      : [];

    return NextResponse.json({
      card: {
        id: card.id,
        name: card.name,
        triggerCard: card.triggerCard,
        effects: card.effects,
        texts: card.texts,
      },
      localizations: language
        ? card.localizations.filter(
            (entry: { language: string }) => entry.language === language
          )
        : card.localizations,
      drafts,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const forbidden = assertAdmin(user);
    if (forbidden) return forbidden;

    const cardId = Number(params.id);
    if (!Number.isInteger(cardId)) {
      return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const language = parseLanguage(body?.language);
    const overwriteDrafts = body?.overwriteDrafts === true;
    const mode = body?.mode === "ai" ? "ai" : "glossary";

    const card = await loadCard(cardId);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const translator = new CardTextTranslationService();
    const drafts =
      mode === "ai"
        ? await buildCardLocalizationDraftsWithTranslations(
            card,
            language,
            translator,
            mode
          )
        : buildCardLocalizationDrafts(card, language);
    await translator.flush().catch(() => undefined);
    const existingEntries = new Map<string, ExistingLocalizationEntry>(
      card.localizations
        .filter((entry: { language: string }) => entry.language === language)
        .map((entry: ExistingLocalizationEntry) => [entry.sourceKey, entry])
    );

    const toWrite = drafts.filter((draft) => {
      const existing = existingEntries.get(draft.sourceKey);
      if (!existing) return true;
      if (existing.status === "APPROVED" && !overwriteDrafts) return false;
      return overwriteDrafts;
    });

    const written = await db.$transaction(
      toWrite.map((draft) =>
        db.cardLocalization.upsert({
          where: {
            cardId_language_sourceKey: {
              cardId: draft.cardId,
              language: draft.language,
              sourceKey: draft.sourceKey,
            },
          },
          create: draft,
          update: {
            sourceText: draft.sourceText,
            translatedText: draft.translatedText,
            sourceHash: draft.sourceHash,
            glossaryVersion: draft.glossaryVersion,
            sourceOrder: draft.sourceOrder,
            sourceRecordId: draft.sourceRecordId,
            translationSource: draft.translationSource,
            status:
              existingEntries.get(draft.sourceKey)?.status === "APPROVED" &&
              !overwriteDrafts
                ? "APPROVED"
                : "DRAFT",
          },
        })
      )
    );

    return NextResponse.json({
      language,
      mode,
      generated: drafts.length,
      written: written.length,
      skipped: drafts.length - written.length,
      localizations: written,
    });
    
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const forbidden = assertAdmin(user);
    if (forbidden) return forbidden;

    const cardId = Number(params.id);
    if (!Number.isInteger(cardId)) {
      return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const language = parseLanguage(body?.language);
    const entries = Array.isArray(body?.entries) ? body.entries : [];

    if (!entries.length) {
      return NextResponse.json({ error: "entries is required" }, { status: 400 });
    }

    const card = await loadCard(cardId);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const sourceEntries = new Map(
      buildCardLocalizationDrafts(card, language).map((draft) => [
        draft.sourceKey,
        draft,
      ])
    );

    const updated = await db.$transaction(
      entries.map((entry: any) => {
        const sourceKey =
          typeof entry?.sourceKey === "string" ? entry.sourceKey.trim() : "";
        const translatedText =
          typeof entry?.translatedText === "string"
            ? entry.translatedText.trim()
            : "";

        if (!sourceKey || !translatedText) {
          throw new Error("Each entry requires sourceKey and translatedText");
        }

        const sourceDraft = sourceEntries.get(sourceKey);
        if (!sourceDraft) {
          throw new Error(`Unknown sourceKey: ${sourceKey}`);
        }

        return db.cardLocalization.upsert({
          where: {
            cardId_language_sourceKey: {
              cardId,
              language,
              sourceKey,
            },
          },
          create: {
            ...sourceDraft,
            translatedText,
            notes:
              typeof entry?.notes === "string" ? entry.notes.trim() || null : null,
            status: isValidStatus(entry?.status) ? entry.status : "REVIEWED",
            translationSource: isValidSource(entry?.translationSource)
              ? entry.translationSource
              : "HUMAN",
            reviewedAt: isValidStatus(entry?.status)
              ? entry.status === "REVIEWED" || entry.status === "APPROVED"
                ? new Date()
                : null
              : new Date(),
            approvedAt: entry?.status === "APPROVED" ? new Date() : null,
          },
          update: {
            translatedText,
            notes:
              typeof entry?.notes === "string" ? entry.notes.trim() || null : null,
            status: isValidStatus(entry?.status) ? entry.status : "REVIEWED",
            translationSource: isValidSource(entry?.translationSource)
              ? entry.translationSource
              : "HUMAN",
            reviewedAt:
              entry?.status === "REVIEWED" || entry?.status === "APPROVED"
                ? new Date()
                : undefined,
            approvedAt:
              entry?.status === "APPROVED" ? new Date() : entry?.status ? null : undefined,
          },
        });
      })
    );

    return NextResponse.json({
      language,
      updatedCount: updated.length,
      localizations: updated,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
