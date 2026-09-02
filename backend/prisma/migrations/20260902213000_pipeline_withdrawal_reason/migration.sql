-- AlterTable: add withdrawal_reason_code to pipeline_applications
ALTER TABLE "pipeline_applications" ADD COLUMN "withdrawal_reason_code" TEXT;

-- Cleanup: remove CONTRACTED_ELSEWHERE from pipeline_loss_reasons (it is not a loss reason)
DELETE FROM "pipeline_loss_reasons" WHERE "code" = 'CONTRACTED_ELSEWHERE';
