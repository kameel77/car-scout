-- Add legal compliance fields and document links
ALTER TABLE "app_settings"
ADD COLUMN "legal_documents" JSONB,
ADD COLUMN "legal_company_name" TEXT,
ADD COLUMN "legal_address" TEXT,
ADD COLUMN "legal_contact_email" TEXT,
ADD COLUMN "legal_contact_phone" TEXT,
ADD COLUMN "legal_vat_id" TEXT,
ADD COLUMN "legal_register_number" TEXT,
ADD COLUMN "legal_representative" TEXT;
