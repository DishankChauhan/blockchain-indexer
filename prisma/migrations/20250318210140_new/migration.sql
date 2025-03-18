/*
  Warnings:

  - You are about to drop the column `name` on the `DatabaseConnection` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `DatabaseConnection` table. All the data in the column will be lost.
  - You are about to drop the column `channel` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `NotificationWebhook` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VerificationToken` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `database` to the `DatabaseConnection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `host` to the `DatabaseConnection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `DatabaseConnection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `port` to the `DatabaseConnection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `DatabaseConnection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `IndexingJob` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DatabaseConnection" DROP COLUMN "name",
DROP COLUMN "url",
ADD COLUMN     "database" TEXT NOT NULL,
ADD COLUMN     "host" TEXT NOT NULL,
ADD COLUMN     "lastConnectedAt" TIMESTAMP(3),
ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "port" INTEGER NOT NULL,
ADD COLUMN     "username" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'pending';

-- AlterTable
ALTER TABLE "IndexingJob" ADD COLUMN     "lastRunAt" TIMESTAMP(3),
ADD COLUMN     "type" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "channel",
ADD COLUMN     "deliveryResults" JSONB DEFAULT '{}',
ALTER COLUMN "priority" SET DEFAULT 'medium',
ALTER COLUMN "metadata" SET DEFAULT '{}',
ALTER COLUMN "status" SET DEFAULT 'pending';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "password",
ALTER COLUMN "name" DROP NOT NULL;

-- DropTable
DROP TABLE "NotificationWebhook";

-- DropTable
DROP TABLE "VerificationToken";

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "DatabaseConnection_userId_idx" ON "DatabaseConnection"("userId");

-- CreateIndex
CREATE INDEX "IndexingJob_userId_idx" ON "IndexingJob"("userId");

-- CreateIndex
CREATE INDEX "IndexingJob_dbConnectionId_idx" ON "IndexingJob"("dbConnectionId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Webhook_indexingJobId_idx" ON "Webhook"("indexingJobId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
