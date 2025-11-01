-- CreateTable
CREATE TABLE `UserListBackcard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `listId` INTEGER NOT NULL,
    `page` INTEGER NOT NULL,
    `row` INTEGER NOT NULL,
    `column` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UserListBackcard_listId_idx`(`listId`),
    UNIQUE INDEX `UserListBackcard_listId_page_row_column_key`(`listId`, `page`, `row`, `column`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserListBackcard` ADD CONSTRAINT `UserListBackcard_listId_fkey` FOREIGN KEY (`listId`) REFERENCES `UserList`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumn to UserList for backcards relation (optional - Prisma maneja esto automáticamente)
-- No necesitamos modificar la tabla UserList físicamente, solo el schema de Prisma
