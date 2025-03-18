/*
  Warnings:

  - You are about to drop the column `dbConnectionId` on the `IndexingJob` table. All the data in the column will be lost.
  - You are about to drop the column `lastRunAt` on the `IndexingJob` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryResults` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `Notification` table. All the data in the column will be lost.
  - Made the column `userId` on table `Notification` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `password` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "IndexingJob" DROP CONSTRAINT "IndexingJob_dbConnectionId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropIndex
DROP INDEX "Account_userId_idx";

-- DropIndex
DROP INDEX "DatabaseConnection_userId_idx";

-- DropIndex
DROP INDEX "IndexingJob_dbConnectionId_idx";

-- DropIndex
DROP INDEX "IndexingJob_userId_idx";

-- DropIndex
DROP INDEX "Notification_createdAt_idx";

-- DropIndex
DROP INDEX "Notification_status_idx";

-- DropIndex
DROP INDEX "Notification_type_idx";

-- DropIndex
DROP INDEX "Notification_userId_idx";

-- DropIndex
DROP INDEX "Session_userId_idx";

-- DropIndex
DROP INDEX "User_email_idx";

-- DropIndex
DROP INDEX "Webhook_heliusWebhookId_key";

-- DropIndex
DROP INDEX "Webhook_indexingJobId_idx";

-- AlterTable
ALTER TABLE "DatabaseConnection" ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "IndexingJob" DROP COLUMN "dbConnectionId",
DROP COLUMN "lastRunAt",
ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "deliveryResults",
DROP COLUMN "priority",
ALTER COLUMN "userId" SET NOT NULL,
ALTER COLUMN "metadata" DROP DEFAULT,
ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "password" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
