-- CreateEnum
CREATE TYPE "CardLocalizationContentType" AS ENUM ('NAME', 'TRIGGER', 'EFFECT', 'TEXT');

-- CreateEnum
CREATE TYPE "CardLocalizationStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "CardLocalizationSource" AS ENUM ('GLOSSARY', 'AI', 'HUMAN', 'IMPORTED');

-- CreateTable
CREATE TABLE "CardLocalization" (
    "id" SERIAL NOT NULL,
    "cardId" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "contentType" "CardLocalizationContentType" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceRecordId" INTEGER,
    "sourceOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceText" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    "sourceHash" TEXT,
    "glossaryVersion" TEXT,
    "translationSource" "CardLocalizationSource" NOT NULL DEFAULT 'GLOSSARY',
    "status" "CardLocalizationStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardLocalization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardLocalization_cardId_language_sourceKey_key" ON "CardLocalization"("cardId", "language", "sourceKey");

-- CreateIndex
CREATE INDEX "CardLocalization_cardId_language_idx" ON "CardLocalization"("cardId", "language");

-- CreateIndex
CREATE INDEX "CardLocalization_language_status_idx" ON "CardLocalization"("language", "status");

-- CreateIndex
CREATE INDEX "CardLocalization_sourceRecordId_idx" ON "CardLocalization"("sourceRecordId");

-- AddForeignKey
ALTER TABLE "CardLocalization" ADD CONSTRAINT "CardLocalization_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
