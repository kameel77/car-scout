-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('UNKNOWN', 'B2C', 'B2B');

-- CreateEnum
CREATE TYPE "FinancingType" AS ENUM ('CASH', 'CREDIT', 'LEASING', 'RENTAL');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('OPEN', 'WON', 'LOST', 'NURTURING');

-- CreateEnum
CREATE TYPE "PipelinePhase" AS ENUM ('INBOX', 'QUALIFICATION', 'SELECTION', 'COMPLETING', 'FINANCIAL_DECISION', 'CONTRACT', 'DELIVERY');

-- CreateEnum
CREATE TYPE "PipelineApplicationState" AS ENUM ('DRAFT', 'PRECHECK_SUBMITTED', 'PRECHECK_APPROVED', 'FULL_SUBMITTED', 'CONDITIONALLY_APPROVED', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LeadSourceChannel" AS ENUM ('TV', 'META', 'GOOGLE', 'ORGANIC', 'REFERRAL', 'DEALER', 'PARTNER', 'OTHER');

-- CreateEnum
CREATE TYPE "PipelineTaxMode" AS ENUM ('GROSS', 'NET');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('EXPECTED', 'EARNED', 'INVOICED', 'PAID', 'REVERSED');

-- CreateEnum
CREATE TYPE "PipelineDocumentStatus" AS ENUM ('REQUIRED', 'REQUESTED', 'RECEIVED', 'VERIFIED', 'WAIVED');

-- CreateEnum
CREATE TYPE "PipelineActorType" AS ENUM ('USER', 'SYSTEM', 'AUTOMATION', 'THULIUM', 'CUSTOMER');

-- CreateTable
CREATE TABLE "pipeline_customers" (
    "id" TEXT NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "scope_id" TEXT NOT NULL,
    "client_type" "ClientType" NOT NULL DEFAULT 'UNKNOWN',
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "company_name" TEXT,
    "company_nip" TEXT,
    "thulium_customer_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_opportunities" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "scope_id" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT 'motolia',
    "customer_id" TEXT NOT NULL,
    "client_type" "ClientType" NOT NULL DEFAULT 'UNKNOWN',
    "financing_type" "FinancingType",
    "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "phase" "PipelinePhase" NOT NULL DEFAULT 'QUALIFICATION',
    "phase_entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lead_source" "LeadSourceChannel" NOT NULL,
    "lead_source_detail" TEXT,
    "first_touch_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_contact_at" TIMESTAMP(3),
    "source_lead_id" TEXT,
    "thulium_ticket_id" INTEGER,
    "owner_user_id" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "next_action_type" TEXT,
    "next_action_note" TEXT,
    "next_action_due_at" TIMESTAMP(3),
    "contract_signed_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "won_at" TIMESTAMP(3),
    "lost_at" TIMESTAMP(3),
    "lost_reason_code" TEXT,
    "lost_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_vehicle_candidates" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "listing_id" TEXT,
    "rental_vehicle_id" TEXT,
    "custom_make" TEXT,
    "custom_model" TEXT,
    "custom_version" TEXT,
    "custom_year" INTEGER,
    "price_snapshot_grosze" INTEGER,
    "selectionStatus" TEXT NOT NULL DEFAULT 'CANDIDATE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_vehicle_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_offers" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "vehicle_candidate_id" TEXT,
    "financing_product_id" TEXT,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "financing_type" "FinancingType" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "price_grosze" INTEGER NOT NULL,
    "down_payment_grosze" INTEGER NOT NULL DEFAULT 0,
    "period_months" INTEGER NOT NULL,
    "monthly_rate_grosze" INTEGER NOT NULL,
    "final_payment_grosze" INTEGER,
    "annual_mileage_km" INTEGER,
    "tax_mode" "PipelineTaxMode" NOT NULL DEFAULT 'GROSS',
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "commission_rate_pct" DECIMAL(6,3),
    "expected_commission_grosze" INTEGER,
    "presented_at" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_financiers" (
    "id" TEXT NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "scope_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "supported_financing" "FinancingType"[],
    "supported_client_types" "ClientType"[],
    "min_amount_grosze" INTEGER,
    "max_amount_grosze" INTEGER,
    "min_period_months" INTEGER,
    "max_period_months" INTEGER,
    "max_vehicle_age_years" INTEGER,
    "min_business_age_months" INTEGER,
    "eligibility_rules" JSONB,
    "default_commission_pct" DECIMAL(6,3),
    "typical_decision_days" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_financiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_applications" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "offer_id" TEXT,
    "financier_id" TEXT NOT NULL,
    "attempt_sequence" INTEGER NOT NULL,
    "external_reference" TEXT,
    "state" "PipelineApplicationState" NOT NULL DEFAULT 'DRAFT',
    "submitted_first_at" TIMESTAMP(3),
    "submitted_full_at" TIMESTAMP(3),
    "decision_at" TIMESTAMP(3),
    "rejection_reason_code" TEXT,
    "rejection_comment" TEXT,
    "approved_conditions" JSONB,
    "reroute_from_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_loss_reasons" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "requires_comment" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pipeline_loss_reasons_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "pipeline_phase_requirements" (
    "id" TEXT NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "scope_id" TEXT NOT NULL,
    "client_type" "ClientType",
    "financing_type" "FinancingType",
    "target_phase" "PipelinePhase" NOT NULL,
    "field_path" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enforcement" TEXT NOT NULL DEFAULT 'SOFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pipeline_phase_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_document_requirements" (
    "id" TEXT NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "scope_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "client_type" "ClientType",
    "financing_type" "FinancingType",
    "financier_id" TEXT,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pipeline_document_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_documents" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "requirement_id" TEXT,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "PipelineDocumentStatus" NOT NULL DEFAULT 'REQUIRED',
    "requested_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "pipeline_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_tasks" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'MANUAL',
    "due_at" TIMESTAMP(3),
    "assigned_user_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_commissions" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "application_id" TEXT,
    "status" "CommissionStatus" NOT NULL DEFAULT 'EXPECTED',
    "basis_grosze" INTEGER NOT NULL,
    "rate_pct" DECIMAL(6,3) NOT NULL,
    "amount_grosze" INTEGER NOT NULL,
    "is_manual_override" BOOLEAN NOT NULL DEFAULT false,
    "override_reason" TEXT,
    "invoice_number" TEXT,
    "earned_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_events" (
    "id" TEXT NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "scope_id" TEXT NOT NULL,
    "opportunity_id" TEXT,
    "customer_id" TEXT,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor_type" "PipelineActorType" NOT NULL,
    "actor_user_id" TEXT,
    "actor_label" TEXT,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlation_id" TEXT,
    "causation_event_id" TEXT,
    "idempotency_key" TEXT,
    "dispatched_at" TIMESTAMP(3),

    CONSTRAINT "pipeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_automation_rules" (
    "id" TEXT NOT NULL,
    "scope_type" "ScopeType" NOT NULL,
    "scope_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "trigger_type" TEXT NOT NULL,
    "condition" JSONB,
    "actions" JSONB NOT NULL,
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pipeline_customers_scope_type_scope_id_idx" ON "pipeline_customers"("scope_type", "scope_id");

-- CreateIndex
CREATE INDEX "pipeline_customers_phone_idx" ON "pipeline_customers"("phone");

-- CreateIndex
CREATE INDEX "pipeline_customers_email_idx" ON "pipeline_customers"("email");

-- CreateIndex
CREATE INDEX "pipeline_customers_thulium_customer_id_idx" ON "pipeline_customers"("thulium_customer_id");

-- CreateIndex
CREATE INDEX "pipeline_customers_company_nip_idx" ON "pipeline_customers"("company_nip");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_opportunities_number_key" ON "pipeline_opportunities"("number");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_opportunities_source_lead_id_key" ON "pipeline_opportunities"("source_lead_id");

-- CreateIndex
CREATE INDEX "pipeline_opportunities_scope_type_scope_id_status_phase_idx" ON "pipeline_opportunities"("scope_type", "scope_id", "status", "phase");

-- CreateIndex
CREATE INDEX "pipeline_opportunities_owner_user_id_status_idx" ON "pipeline_opportunities"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "pipeline_opportunities_next_action_due_at_idx" ON "pipeline_opportunities"("next_action_due_at");

-- CreateIndex
CREATE INDEX "pipeline_opportunities_customer_id_idx" ON "pipeline_opportunities"("customer_id");

-- CreateIndex
CREATE INDEX "pipeline_opportunities_lead_source_created_at_idx" ON "pipeline_opportunities"("lead_source", "created_at");

-- CreateIndex
CREATE INDEX "pipeline_vehicle_candidates_opportunity_id_idx" ON "pipeline_vehicle_candidates"("opportunity_id");

-- CreateIndex
CREATE INDEX "pipeline_offers_opportunity_id_idx" ON "pipeline_offers"("opportunity_id");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_offers_opportunity_id_version_number_key" ON "pipeline_offers"("opportunity_id", "version_number");

-- CreateIndex
CREATE INDEX "pipeline_financiers_scope_type_scope_id_is_active_idx" ON "pipeline_financiers"("scope_type", "scope_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_financiers_scope_type_scope_id_code_key" ON "pipeline_financiers"("scope_type", "scope_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_applications_reroute_from_id_key" ON "pipeline_applications"("reroute_from_id");

-- CreateIndex
CREATE INDEX "pipeline_applications_financier_id_state_idx" ON "pipeline_applications"("financier_id", "state");

-- CreateIndex
CREATE INDEX "pipeline_applications_opportunity_id_idx" ON "pipeline_applications"("opportunity_id");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_applications_opportunity_id_attempt_sequence_key" ON "pipeline_applications"("opportunity_id", "attempt_sequence");

-- CreateIndex
CREATE INDEX "pipeline_phase_requirements_scope_type_scope_id_target_phas_idx" ON "pipeline_phase_requirements"("scope_type", "scope_id", "target_phase");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_document_requirements_scope_type_scope_id_code_cli_key" ON "pipeline_document_requirements"("scope_type", "scope_id", "code", "client_type", "financing_type", "financier_id");

-- CreateIndex
CREATE INDEX "pipeline_documents_opportunity_id_status_idx" ON "pipeline_documents"("opportunity_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_documents_opportunity_id_code_key" ON "pipeline_documents"("opportunity_id", "code");

-- CreateIndex
CREATE INDEX "pipeline_tasks_assigned_user_id_completed_at_idx" ON "pipeline_tasks"("assigned_user_id", "completed_at");

-- CreateIndex
CREATE INDEX "pipeline_tasks_opportunity_id_idx" ON "pipeline_tasks"("opportunity_id");

-- CreateIndex
CREATE INDEX "pipeline_tasks_due_at_idx" ON "pipeline_tasks"("due_at");

-- CreateIndex
CREATE INDEX "pipeline_commissions_opportunity_id_idx" ON "pipeline_commissions"("opportunity_id");

-- CreateIndex
CREATE INDEX "pipeline_commissions_status_idx" ON "pipeline_commissions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_events_idempotency_key_key" ON "pipeline_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "pipeline_events_opportunity_id_occurred_at_idx" ON "pipeline_events"("opportunity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "pipeline_events_customer_id_occurred_at_idx" ON "pipeline_events"("customer_id", "occurred_at");

-- CreateIndex
CREATE INDEX "pipeline_events_aggregate_type_aggregate_id_occurred_at_idx" ON "pipeline_events"("aggregate_type", "aggregate_id", "occurred_at");

-- CreateIndex
CREATE INDEX "pipeline_events_dispatched_at_idx" ON "pipeline_events"("dispatched_at");

-- CreateIndex
CREATE INDEX "pipeline_events_scope_type_scope_id_type_occurred_at_idx" ON "pipeline_events"("scope_type", "scope_id", "type", "occurred_at");

-- CreateIndex
CREATE INDEX "pipeline_automation_rules_trigger_type_is_active_idx" ON "pipeline_automation_rules"("trigger_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_automation_rules_scope_type_scope_id_code_key" ON "pipeline_automation_rules"("scope_type", "scope_id", "code");

-- AddForeignKey
ALTER TABLE "pipeline_opportunities" ADD CONSTRAINT "pipeline_opportunities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "pipeline_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_opportunities" ADD CONSTRAINT "pipeline_opportunities_source_lead_id_fkey" FOREIGN KEY ("source_lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_opportunities" ADD CONSTRAINT "pipeline_opportunities_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_opportunities" ADD CONSTRAINT "pipeline_opportunities_lost_reason_code_fkey" FOREIGN KEY ("lost_reason_code") REFERENCES "pipeline_loss_reasons"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_vehicle_candidates" ADD CONSTRAINT "pipeline_vehicle_candidates_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "pipeline_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_vehicle_candidates" ADD CONSTRAINT "pipeline_vehicle_candidates_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_vehicle_candidates" ADD CONSTRAINT "pipeline_vehicle_candidates_rental_vehicle_id_fkey" FOREIGN KEY ("rental_vehicle_id") REFERENCES "rental_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_offers" ADD CONSTRAINT "pipeline_offers_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "pipeline_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_offers" ADD CONSTRAINT "pipeline_offers_vehicle_candidate_id_fkey" FOREIGN KEY ("vehicle_candidate_id") REFERENCES "pipeline_vehicle_candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_offers" ADD CONSTRAINT "pipeline_offers_financing_product_id_fkey" FOREIGN KEY ("financing_product_id") REFERENCES "financing_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_applications" ADD CONSTRAINT "pipeline_applications_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "pipeline_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_applications" ADD CONSTRAINT "pipeline_applications_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "pipeline_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_applications" ADD CONSTRAINT "pipeline_applications_financier_id_fkey" FOREIGN KEY ("financier_id") REFERENCES "pipeline_financiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_applications" ADD CONSTRAINT "pipeline_applications_reroute_from_id_fkey" FOREIGN KEY ("reroute_from_id") REFERENCES "pipeline_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_applications" ADD CONSTRAINT "pipeline_applications_rejection_reason_code_fkey" FOREIGN KEY ("rejection_reason_code") REFERENCES "pipeline_loss_reasons"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_document_requirements" ADD CONSTRAINT "pipeline_document_requirements_financier_id_fkey" FOREIGN KEY ("financier_id") REFERENCES "pipeline_financiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_documents" ADD CONSTRAINT "pipeline_documents_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "pipeline_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_documents" ADD CONSTRAINT "pipeline_documents_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "pipeline_document_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_tasks" ADD CONSTRAINT "pipeline_tasks_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "pipeline_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_tasks" ADD CONSTRAINT "pipeline_tasks_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_commissions" ADD CONSTRAINT "pipeline_commissions_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "pipeline_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_commissions" ADD CONSTRAINT "pipeline_commissions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "pipeline_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "pipeline_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "pipeline_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

