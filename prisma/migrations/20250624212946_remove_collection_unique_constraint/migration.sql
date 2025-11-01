/*
  Warnings:

  - You are about to drop the column `price` on the `Card` table. All the data in the column will be lost.
  - The primary key for the `CardSet` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `UserCollection` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Made the column `uuid` on table `Card` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `id` to the `CardSet` table without a default value. This is not possible if the table is not empty.
  - The required column `uuid` was added to the `User` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE `CardColor` DROP FOREIGN KEY `CardColor_cardId_fkey`;

-- DropForeignKey
ALTER TABLE `CardCondition` DROP FOREIGN KEY `CardCondition_cardId_fkey`;

-- DropForeignKey
ALTER TABLE `CardEffect` DROP FOREIGN KEY `CardEffect_cardId_fkey`;

-- DropForeignKey
ALTER TABLE `CardPriceLog` DROP FOREIGN KEY `CardPriceLog_cardId_fkey`;

-- DropForeignKey
ALTER TABLE `CardSet` DROP FOREIGN KEY `CardSet_cardId_fkey`;

-- DropForeignKey
ALTER TABLE `CardSet` DROP FOREIGN KEY `CardSet_setId_fkey`;

-- DropForeignKey
ALTER TABLE `CardText` DROP FOREIGN KEY `CardText_cardId_fkey`;

-- DropForeignKey
ALTER TABLE `CardType` DROP FOREIGN KEY `CardType_cardId_fkey`;

-- DropForeignKey
ALTER TABLE `UserCollection` DROP FOREIGN KEY `UserCollection_cardId_fkey`;

-- DropForeignKey
ALTER TABLE `UserCollection` DROP FOREIGN KEY `UserCollection_userId_fkey`;

-- DropIndex
DROP INDEX `CardColor_cardId_fkey` ON `CardColor`;

-- DropIndex
DROP INDEX `CardCondition_cardId_fkey` ON `CardCondition`;

-- DropIndex
DROP INDEX `CardEffect_cardId_fkey` ON `CardEffect`;

-- DropIndex
DROP INDEX `CardPriceLog_cardId_fkey` ON `CardPriceLog`;

-- DropIndex
DROP INDEX `CardSet_setId_fkey` ON `CardSet`;

-- DropIndex
DROP INDEX `CardText_cardId_fkey` ON `CardText`;

-- DropIndex
DROP INDEX `CardType_cardId_fkey` ON `CardType`;

-- AlterTable
ALTER TABLE `Card` DROP COLUMN `price`,
    ADD COLUMN `order` VARCHAR(191) NOT NULL DEFAULT '0',
    MODIFY `uuid` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `CardSet` DROP PRIMARY KEY,
    ADD COLUMN `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `User` ADD COLUMN `emailVerified` DATETIME(3) NULL,
    ADD COLUMN `image` VARCHAR(191) NULL,
    ADD COLUMN `role` ENUM('ADMIN', 'USER', 'SELLER') NOT NULL DEFAULT 'USER',
    ADD COLUMN `uuid` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `UserCollection`;

-- CreateTable
CREATE TABLE `Deck` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `uniqueUrl` VARCHAR(191) NOT NULL,
    `originalDeckId` INTEGER NULL,
    `userId` INTEGER NULL,
    `description` VARCHAR(191) NULL DEFAULT '',
    `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Deck_uniqueUrl_key`(`uniqueUrl`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeckCard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deckId` INTEGER NOT NULL,
    `cardId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GameLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `deckId` INTEGER NOT NULL,
    `opponentLeaderId` INTEGER NOT NULL,
    `isWin` BOOLEAN NOT NULL,
    `wentFirst` BOOLEAN NOT NULL,
    `opponentName` VARCHAR(191) NULL,
    `comments` TEXT NULL,
    `playedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GameLogCard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `gameLogId` INTEGER NOT NULL,
    `cardId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardRuling` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cardId` INTEGER NOT NULL,
    `question` TEXT NOT NULL,
    `answer` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Account` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerAccountId` VARCHAR(191) NOT NULL,
    `refresh_token` TEXT NULL,
    `access_token` TEXT NULL,
    `expires_at` INTEGER NULL,
    `token_type` VARCHAR(191) NULL,
    `scope` VARCHAR(191) NULL,
    `id_token` TEXT NULL,
    `session_state` VARCHAR(191) NULL,

    UNIQUE INDEX `Account_providerAccountId_key`(`providerAccountId`),
    UNIQUE INDEX `Account_provider_providerAccountId_key`(`provider`, `providerAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionToken` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Session_sessionToken_key`(`sessionToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificationToken` (
    `identifier` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VerificationToken_token_key`(`token`),
    UNIQUE INDEX `VerificationToken_identifier_token_key`(`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserList` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isOrdered` BOOLEAN NOT NULL DEFAULT false,
    `isDeletable` BOOLEAN NOT NULL DEFAULT true,
    `isCollection` BOOLEAN NOT NULL DEFAULT false,
    `maxRows` INTEGER NULL,
    `maxColumns` INTEGER NULL,
    `totalPages` INTEGER NOT NULL DEFAULT 1,
    `color` VARCHAR(191) NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UserList_userId_isPublic_idx`(`userId`, `isPublic`),
    INDEX `UserList_userId_isCollection_idx`(`userId`, `isCollection`),
    UNIQUE INDEX `UserList_userId_name_key`(`userId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserListCard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `listId` INTEGER NOT NULL,
    `cardId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `sortOrder` INTEGER NULL,
    `page` INTEGER NULL,
    `row` INTEGER NULL,
    `column` INTEGER NULL,
    `notes` VARCHAR(191) NULL,
    `condition` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UserListCard_listId_cardId_idx`(`listId`, `cardId`),
    INDEX `UserListCard_listId_sortOrder_idx`(`listId`, `sortOrder`),
    UNIQUE INDEX `UserListCard_listId_page_row_column_key`(`listId`, `page`, `row`, `column`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `User_email_key` ON `User`(`email`);

-- CreateIndex
CREATE UNIQUE INDEX `User_uuid_key` ON `User`(`uuid`);

-- AddForeignKey
ALTER TABLE `Deck` ADD CONSTRAINT `Deck_originalDeckId_fkey` FOREIGN KEY (`originalDeckId`) REFERENCES `Deck`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deck` ADD CONSTRAINT `Deck_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeckCard` ADD CONSTRAINT `DeckCard_deckId_fkey` FOREIGN KEY (`deckId`) REFERENCES `Deck`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeckCard` ADD CONSTRAINT `DeckCard_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameLog` ADD CONSTRAINT `GameLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameLog` ADD CONSTRAINT `GameLog_deckId_fkey` FOREIGN KEY (`deckId`) REFERENCES `Deck`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameLog` ADD CONSTRAINT `GameLog_opponentLeaderId_fkey` FOREIGN KEY (`opponentLeaderId`) REFERENCES `Card`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameLogCard` ADD CONSTRAINT `GameLogCard_gameLogId_fkey` FOREIGN KEY (`gameLogId`) REFERENCES `GameLog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GameLogCard` ADD CONSTRAINT `GameLogCard_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardRuling` ADD CONSTRAINT `CardRuling_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardCondition` ADD CONSTRAINT `CardCondition_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardType` ADD CONSTRAINT `CardType_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardColor` ADD CONSTRAINT `CardColor_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardEffect` ADD CONSTRAINT `CardEffect_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardText` ADD CONSTRAINT `CardText_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserList` ADD CONSTRAINT `UserList_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserListCard` ADD CONSTRAINT `UserListCard_listId_fkey` FOREIGN KEY (`listId`) REFERENCES `UserList`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserListCard` ADD CONSTRAINT `UserListCard_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardSet` ADD CONSTRAINT `CardSet_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardSet` ADD CONSTRAINT `CardSet_setId_fkey` FOREIGN KEY (`setId`) REFERENCES `Set`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardPriceLog` ADD CONSTRAINT `CardPriceLog_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
