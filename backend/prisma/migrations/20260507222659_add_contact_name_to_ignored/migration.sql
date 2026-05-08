-- DropIndex
DROP INDEX `IgnoredContact_phone_key` ON `ignoredcontact`;

-- AlterTable
ALTER TABLE `ignoredcontact` ADD COLUMN `contactName` VARCHAR(191) NULL;
