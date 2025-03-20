-- DropIndex
DROP INDEX "Webhook_heliusWebhookId_key";

-- AlterTable
ALTER TABLE "IndexingJob" ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Webhook" ADD COLUMN     "config" JSONB DEFAULT '{"rateLimit":{"windowMs":60000,"maxRequests":60}}',
ALTER COLUMN "filters" SET DEFAULT '{}';

-- CreateTable
CREATE TABLE "ProcessedData" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aggregation" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aggregation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessedData_jobId_idx" ON "ProcessedData"("jobId");

-- CreateIndex
CREATE INDEX "ProcessedData_timestamp_idx" ON "ProcessedData"("timestamp");

-- CreateIndex
CREATE INDEX "Aggregation_type_field_idx" ON "Aggregation"("type", "field");

-- CreateIndex
CREATE INDEX "Aggregation_timestamp_idx" ON "Aggregation"("timestamp");

-- CreateIndex
CREATE INDEX "IndexingJob_type_idx" ON "IndexingJob"("type");

-- CreateIndex
CREATE INDEX "IndexingJob_status_idx" ON "IndexingJob"("status");

-- AddForeignKey
ALTER TABLE "ProcessedData" ADD CONSTRAINT "ProcessedData_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IndexingJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
