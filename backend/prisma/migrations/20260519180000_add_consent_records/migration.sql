-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "brand_id" TEXT,
    "ip_hash" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "country" TEXT,
    "choice" JSONB NOT NULL,
    "banner_version" TEXT NOT NULL,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_records_created_at_idx" ON "consent_records"("created_at");
