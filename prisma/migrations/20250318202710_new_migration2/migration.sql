/*
  Warnings:

  - You are about to drop the column `read` on the `Notification` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "read",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'unread';

-- CreateTable
CREATE TABLE "NotificationWebhook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationWebhook_pkey" PRIMARY KEY ("id")
);
