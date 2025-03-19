/*
  Warnings:

  - A unique constraint covering the columns `[heliusWebhookId]` on the table `Webhook` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `filters` to the `Webhook` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `Webhook` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Webhook` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Webhook" ADD COLUMN     "filters" JSONB NOT NULL,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "retryDelay" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "url" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "response" JSONB,
    "error" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookLog_webhookId_idx" ON "WebhookLog"("webhookId");

-- CreateIndex
CREATE INDEX "WebhookLog_timestamp_idx" ON "WebhookLog"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Webhook_heliusWebhookId_key" ON "Webhook"("heliusWebhookId");

-- CreateIndex
CREATE INDEX "Webhook_userId_idx" ON "Webhook"("userId");

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
