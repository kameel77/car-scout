-- CreateTable
CREATE TABLE "feature_tiles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image_url" TEXT,
    "target_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_tiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feature_tiles_is_active_sort_order_idx" ON "feature_tiles"("is_active", "sort_order");
