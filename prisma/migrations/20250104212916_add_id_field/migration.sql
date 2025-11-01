/*
  Warnings:

  - A unique constraint covering the columns `[uuid]` on the table `Card` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Card` ADD COLUMN `uuid` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Card_uuid_key` ON `Card`(`uuid`);
