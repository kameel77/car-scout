ALTER TABLE "financing_products"
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'OWN',
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "min_amount" DOUBLE PRECISION,
ADD COLUMN     "max_amount" DOUBLE PRECISION,
ADD COLUMN     "provider_config" JSONB;

CREATE TABLE "financing_provider_connections" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "api_base_url" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "api_secret" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financing_provider_connections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financing_provider_connections_provider_idx" ON "financing_provider_connections"("provider");
CREATE INDEX "financing_provider_connections_provider_is_active_idx" ON "financing_provider_connections"("provider", "is_active");
