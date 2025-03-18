/*
  Warnings:

  - You are about to drop the column `database` on the `DatabaseConnection` table. All the data in the column will be lost.
  - You are about to drop the column `host` on the `DatabaseConnection` table. All the data in the column will be lost.
  - You are about to drop the column `lastConnectedAt` on the `DatabaseConnection` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `DatabaseConnection` table. All the data in the column will be lost.
  - You are about to drop the column `port` on the `DatabaseConnection` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `DatabaseConnection` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `IndexingJob` table. All the data in the column will be lost.
  - You are about to drop the column `lastIndexedAt` on the `IndexingJob` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerified` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `User` table. All the data in the column will be lost.
  - Added the required column `name` to the `DatabaseConnection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `DatabaseConnection` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "DatabaseConnection" DROP COLUMN "database",
DROP COLUMN "host",
DROP COLUMN "lastConnectedAt",
DROP COLUMN "password",
DROP COLUMN "port",
DROP COLUMN "username",
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "url" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'active';

-- AlterTable
ALTER TABLE "IndexingJob" DROP COLUMN "category",
DROP COLUMN "lastIndexedAt",
ALTER COLUMN "status" SET DEFAULT 'active';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailVerified",
DROP COLUMN "image",
ALTER COLUMN "name" SET NOT NULL;

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "indexingJobId" TEXT NOT NULL,
    "heliusWebhookId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Webhook_heliusWebhookId_key" ON "Webhook"("heliusWebhookId");

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_indexingJobId_fkey" FOREIGN KEY ("indexingJobId") REFERENCES "IndexingJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
