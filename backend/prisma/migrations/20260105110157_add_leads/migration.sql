-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "preferred_contact" TEXT NOT NULL DEFAULT 'email',
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "reference_number" TEXT NOT NULL,
    "consent_marketing_at" TIMESTAMP(3),
    "consent_privacy_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_reference_number_key" ON "leads"("reference_number");

-- CreateIndex
CREATE INDEX "leads_listing_id_idx" ON "leads"("listing_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
