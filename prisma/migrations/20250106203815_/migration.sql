/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Set` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Set` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Set` DROP COLUMN `createdAt`,
    DROP COLUMN `updatedAt`,
    ADD COLUMN `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updated_at` DATETIME(3) NULL;
