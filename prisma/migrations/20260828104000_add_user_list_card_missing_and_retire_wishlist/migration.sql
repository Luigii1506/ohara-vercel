ALTER TABLE "UserListCard"
ADD COLUMN "isMissing" BOOLEAN NOT NULL DEFAULT false;

UPDATE "UserListCard"
SET "isMissing" = true
WHERE "listId" IN (
  SELECT "id"
  FROM "UserList"
  WHERE "purpose" = 'WISHLIST'
);

UPDATE "UserList"
SET "purpose" = 'GENERAL'
WHERE "purpose" = 'WISHLIST';

CREATE INDEX "UserListCard_listId_isMissing_idx"
ON "UserListCard"("listId", "isMissing");
