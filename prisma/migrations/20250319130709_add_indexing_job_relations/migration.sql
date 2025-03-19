/*
  Warnings:

  - Added the required column `dbConnectionId` to the `IndexingJob` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DatabaseConnection" ALTER COLUMN "status" SET DEFAULT 'pending';

-- AlterTable
ALTER TABLE "IndexingJob" ADD COLUMN     "dbConnectionId" TEXT NOT NULL,
ADD COLUMN     "lastRunAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "DatabaseConnection_userId_idx" ON "DatabaseConnection"("userId");

-- CreateIndex
CREATE INDEX "IndexingJob_userId_idx" ON "IndexingJob"("userId");

-- CreateIndex
CREATE INDEX "IndexingJob_dbConnectionId_idx" ON "IndexingJob"("dbConnectionId");

-- CreateIndex
CREATE INDEX "Webhook_indexingJobId_idx" ON "Webhook"("indexingJobId");

-- AddForeignKey
ALTER TABLE "IndexingJob" ADD CONSTRAINT "IndexingJob_dbConnectionId_fkey" FOREIGN KEY ("dbConnectionId") REFERENCES "DatabaseConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
