-- CreateEnum
CREATE TYPE "EmployeeOfferSourceType" AS ENUM ('FINANCING', 'RENTAL');

-- CreateEnum
CREATE TYPE "ContractPartyOption" AS ENUM ('CONSUMER', 'EMPLOYEE_B2B', 'EMPLOYER_COMPANY');

-- CreateEnum
CREATE TYPE "ProductAvailabilityStatus" AS ENUM ('AVAILABLE', 'REQUIRES_CONFIRMATION', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "MatrixPublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "employee_companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nip" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_programs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "default_discount_pct" DECIMAL(5,2),

    CONSTRAINT "employee_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_product_overrides" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "financing_product_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "b2c_status" "ProductAvailabilityStatus" NOT NULL DEFAULT 'REQUIRES_CONFIRMATION',
    "allowed_contract_parties" "ContractPartyOption"[] DEFAULT ARRAY['EMPLOYEE_B2B', 'EMPLOYER_COMPANY']::"ContractPartyOption"[],
    "min_down_payment_pct" DECIMAL(5,2),
    "max_down_payment_pct" DECIMAL(5,2),
    "allowed_periods" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_product_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_registration_codes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "label" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_registration_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_memberships" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "employee_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_membership_audits" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_membership_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_matrix_sets" (
    "id" TEXT NOT NULL,
    "rental_company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "allowed_contract_parties" "ContractPartyOption"[] DEFAULT ARRAY['EMPLOYEE_B2B', 'EMPLOYER_COMPANY']::"ContractPartyOption"[],
    "b2c_status" "ProductAvailabilityStatus" NOT NULL DEFAULT 'REQUIRES_CONFIRMATION',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_matrix_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_matrix_versions" (
    "id" TEXT NOT NULL,
    "matrix_set_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "fee_pct" DECIMAL(5,2),
    "status" "MatrixPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_matrix_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_matrix_rows" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "contract_months" INTEGER NOT NULL,
    "annual_mileage_km" INTEGER NOT NULL,
    "initial_payment_pct" DECIMAL(5,2) NOT NULL,
    "initial_payment_amount_net" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "monthly_rate_net" DECIMAL(10,2) NOT NULL,
    "monthly_rate_gross" DECIMAL(10,2) NOT NULL,
    "services_included" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "insurance_excess_500" DECIMAL(10,2),
    "insurance_no_limit" DECIMAL(10,2),
    "tires_no_limit" DECIMAL(10,2),
    "over_mileage_cost" DECIMAL(6,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_matrix_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_program_offers" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "source_type" "EmployeeOfferSourceType" NOT NULL,
    "listing_id" TEXT,
    "assignment_id" TEXT,
    "matrix_version_id" TEXT,
    "custom_price_pln" INTEGER,
    "discount_pct" DECIMAL(5,2),
    "benefit_policy_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_program_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_benefit_policies" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "moya_card_amount" INTEGER,
    "fuel_discount" TEXT,
    "consultant_care" BOOLEAN NOT NULL DEFAULT true,
    "terms_text" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_benefit_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_inquiries" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "contract_party" "ContractPartyOption" NOT NULL,
    "product_availability_status" "ProductAvailabilityStatus" NOT NULL DEFAULT 'REQUIRES_CONFIRMATION',
    "contact_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "nip" TEXT,
    "notes" TEXT,
    "calculation_snapshot" JSONB NOT NULL,
    "benefit_snapshot" JSONB,
    "idempotency_key" TEXT NOT NULL,
    "lead_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_companies_name_key" ON "employee_companies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "employee_companies_slug_key" ON "employee_companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "employee_programs_slug_key" ON "employee_programs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "employee_programs_company_id_id_key" ON "employee_programs"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_product_overrides_program_id_financing_product_id_key" ON "employee_product_overrides"("program_id", "financing_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_registration_codes_code_hash_key" ON "employee_registration_codes"("code_hash");

-- CreateIndex
CREATE INDEX "employee_registration_codes_company_id_is_active_idx" ON "employee_registration_codes"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "employee_accounts_email_key" ON "employee_accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employee_memberships_account_id_key" ON "employee_memberships"("account_id");

-- CreateIndex
CREATE INDEX "employee_membership_audits_account_id_created_at_idx" ON "employee_membership_audits"("account_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "employee_matrix_versions_matrix_set_id_version_number_key" ON "employee_matrix_versions"("matrix_set_id", "version_number");

-- CreateIndex
CREATE INDEX "employee_matrix_rows_version_id_assignment_id_idx" ON "employee_matrix_rows"("version_id", "assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_matrix_rows_version_id_assignment_id_contract_mont_key" ON "employee_matrix_rows"("version_id", "assignment_id", "contract_months", "annual_mileage_km", "initial_payment_pct", "initial_payment_amount_net");

-- CreateIndex
CREATE INDEX "employee_program_offers_program_id_is_active_idx" ON "employee_program_offers"("program_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "employee_program_offers_program_id_listing_id_key" ON "employee_program_offers"("program_id", "listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_program_offers_program_id_assignment_id_key" ON "employee_program_offers"("program_id", "assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_benefit_policies_program_id_id_key" ON "employee_benefit_policies"("program_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_inquiries_idempotency_key_key" ON "employee_inquiries"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "employee_inquiries_lead_id_key" ON "employee_inquiries"("lead_id");

-- CreateIndex
CREATE INDEX "employee_inquiries_company_id_status_idx" ON "employee_inquiries"("company_id", "status");

-- CreateIndex
CREATE INDEX "employee_inquiries_account_id_idx" ON "employee_inquiries"("account_id");

-- AddForeignKey
ALTER TABLE "employee_programs" ADD CONSTRAINT "employee_programs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "employee_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_product_overrides" ADD CONSTRAINT "employee_product_overrides_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "employee_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_product_overrides" ADD CONSTRAINT "employee_product_overrides_financing_product_id_fkey" FOREIGN KEY ("financing_product_id") REFERENCES "financing_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_registration_codes" ADD CONSTRAINT "employee_registration_codes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "employee_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_registration_codes" ADD CONSTRAINT "employee_registration_codes_company_id_program_id_fkey" FOREIGN KEY ("company_id", "program_id") REFERENCES "employee_programs"("company_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_memberships" ADD CONSTRAINT "employee_memberships_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "employee_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_memberships" ADD CONSTRAINT "employee_memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "employee_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_memberships" ADD CONSTRAINT "employee_memberships_company_id_program_id_fkey" FOREIGN KEY ("company_id", "program_id") REFERENCES "employee_programs"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_membership_audits" ADD CONSTRAINT "employee_membership_audits_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "employee_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_matrix_sets" ADD CONSTRAINT "employee_matrix_sets_rental_company_id_fkey" FOREIGN KEY ("rental_company_id") REFERENCES "rental_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_matrix_versions" ADD CONSTRAINT "employee_matrix_versions_matrix_set_id_fkey" FOREIGN KEY ("matrix_set_id") REFERENCES "employee_matrix_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_matrix_rows" ADD CONSTRAINT "employee_matrix_rows_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "employee_matrix_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_matrix_rows" ADD CONSTRAINT "employee_matrix_rows_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "vehicle_rental_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_program_offers" ADD CONSTRAINT "employee_program_offers_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_program_offers" ADD CONSTRAINT "employee_program_offers_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "vehicle_rental_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_program_offers" ADD CONSTRAINT "employee_program_offers_matrix_version_id_fkey" FOREIGN KEY ("matrix_version_id") REFERENCES "employee_matrix_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_program_offers" ADD CONSTRAINT "employee_program_offers_program_id_benefit_policy_id_fkey" FOREIGN KEY ("program_id", "benefit_policy_id") REFERENCES "employee_benefit_policies"("program_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_program_offers" ADD CONSTRAINT "employee_program_offers_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "employee_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_benefit_policies" ADD CONSTRAINT "employee_benefit_policies_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "employee_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_inquiries" ADD CONSTRAINT "employee_inquiries_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_inquiries" ADD CONSTRAINT "employee_inquiries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "employee_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_inquiries" ADD CONSTRAINT "employee_inquiries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "employee_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_inquiries" ADD CONSTRAINT "employee_inquiries_company_id_program_id_fkey" FOREIGN KEY ("company_id", "program_id") REFERENCES "employee_programs"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Integrity check constraint: Ensure EmployeeProgramOffer source consistency
ALTER TABLE "employee_program_offers"
ADD CONSTRAINT "check_offer_source_integrity"
CHECK (
  (source_type = 'FINANCING' AND listing_id IS NOT NULL AND assignment_id IS NULL AND matrix_version_id IS NULL)
  OR
  (source_type = 'RENTAL' AND assignment_id IS NOT NULL AND matrix_version_id IS NOT NULL AND listing_id IS NULL)
);
