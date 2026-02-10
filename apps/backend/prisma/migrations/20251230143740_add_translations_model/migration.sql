-- CreateTable
CREATE TABLE "translations" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source_value" TEXT NOT NULL,
    "pl" TEXT,
    "en" TEXT,
    "de" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "translations_source_value_key" ON "translations"("source_value");

-- CreateIndex
CREATE INDEX "translations_category_idx" ON "translations"("category");
