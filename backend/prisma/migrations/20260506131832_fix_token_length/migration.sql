-- AlterTable
ALTER TABLE `message` MODIFY `content` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `quickreply` MODIFY `content` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `refreshtoken` MODIFY `token` VARCHAR(512) NOT NULL;
