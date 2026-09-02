-- Clear old seeded requirements so NOT NULL column can be added cleanly
DELETE FROM "pipeline_phase_requirements";

-- AlterTable
ALTER TABLE "pipeline_phase_requirements" ADD COLUMN "code" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "pipeline_number_sequences" (
    "year" INTEGER NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pipeline_number_sequences_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_phase_requirements_scope_type_scope_id_code_key" ON "pipeline_phase_requirements"("scope_type", "scope_id", "code");
