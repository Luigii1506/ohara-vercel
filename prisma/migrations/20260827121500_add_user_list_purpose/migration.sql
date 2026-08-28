ALTER TABLE "UserList"
ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'GENERAL';

UPDATE "UserList"
SET "purpose" = CASE
  WHEN "isCollection" = true THEN 'PERSONAL_COLLECTION'
  ELSE 'GENERAL'
END;

CREATE INDEX "UserList_userId_purpose_idx" ON "UserList"("userId", "purpose");
