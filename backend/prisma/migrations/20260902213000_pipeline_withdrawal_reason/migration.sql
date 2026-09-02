-- AlterTable: add withdrawal_reason_code to pipeline_applications
ALTER TABLE "pipeline_applications" ADD COLUMN "withdrawal_reason_code" TEXT;

-- Backfill: preserve reason on applications already withdrawn as CONTRACTED_ELSEWHERE before FK nulls it
UPDATE "pipeline_applications"
SET "withdrawal_reason_code" = 'CONTRACTED_ELSEWHERE'
WHERE "state" = 'WITHDRAWN' AND "rejection_reason_code" = 'CONTRACTED_ELSEWHERE';

-- Cleanup: remove CONTRACTED_ELSEWHERE from pipeline_loss_reasons (it is not a loss reason)
DELETE FROM "pipeline_loss_reasons" WHERE "code" = 'CONTRACTED_ELSEWHERE';
