-- AlterTable: add contracted_application_id to pipeline_opportunities
ALTER TABLE "pipeline_opportunities" ADD COLUMN "contracted_application_id" TEXT;

-- AlterTable: rename column attempt_sequence to round_number on pipeline_applications
ALTER TABLE "pipeline_applications" RENAME COLUMN "attempt_sequence" TO "round_number";

-- DropIndex: drop old unique index on reroute_from_id
DROP INDEX IF EXISTS "pipeline_applications_reroute_from_id_key";

-- DropIndex: drop old unique index on (opportunity_id, attempt_sequence)
DROP INDEX IF EXISTS "pipeline_applications_opportunity_id_attempt_sequence_key";

-- CreateIndex: create new unique index on (opportunity_id, financier_id, round_number)
CREATE UNIQUE INDEX "pipeline_applications_opportunity_id_financier_id_round_number_key" ON "pipeline_applications"("opportunity_id", "financier_id", "round_number");

-- CreateIndex: create index on reroute_from_id
CREATE INDEX IF NOT EXISTS "pipeline_applications_reroute_from_id_idx" ON "pipeline_applications"("reroute_from_id");

-- CreateIndex: create index on contracted_application_id
CREATE INDEX IF NOT EXISTS "pipeline_opportunities_contracted_application_id_idx" ON "pipeline_opportunities"("contracted_application_id");

-- AddForeignKey: add FK from pipeline_opportunities.contracted_application_id to pipeline_applications.id
ALTER TABLE "pipeline_opportunities" ADD CONSTRAINT "pipeline_opportunities_contracted_application_id_fkey" FOREIGN KEY ("contracted_application_id") REFERENCES "pipeline_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
