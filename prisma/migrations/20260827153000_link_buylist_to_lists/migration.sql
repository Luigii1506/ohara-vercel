ALTER TABLE "BuylistSession"
ADD COLUMN "sourceListId" INTEGER,
ADD COLUMN "resultListId" INTEGER;

ALTER TABLE "BuylistSession"
ADD CONSTRAINT "BuylistSession_sourceListId_fkey"
FOREIGN KEY ("sourceListId") REFERENCES "UserList"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "BuylistSession"
ADD CONSTRAINT "BuylistSession_resultListId_fkey"
FOREIGN KEY ("resultListId") REFERENCES "UserList"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "BuylistSession_sourceListId_idx" ON "BuylistSession"("sourceListId");
CREATE INDEX "BuylistSession_resultListId_idx" ON "BuylistSession"("resultListId");
