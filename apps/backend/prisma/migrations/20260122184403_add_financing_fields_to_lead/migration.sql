-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "external_status" TEXT,
ADD COLUMN     "financing_amount" DOUBLE PRECISION,
ADD COLUMN     "financing_down_payment" DOUBLE PRECISION,
ADD COLUMN     "financing_installment" DOUBLE PRECISION,
ADD COLUMN     "financing_period" INTEGER,
ADD COLUMN     "financing_product_id" TEXT;

-- CreateIndex
CREATE INDEX "leads_financing_product_id_idx" ON "leads"("financing_product_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_financing_product_id_fkey" FOREIGN KEY ("financing_product_id") REFERENCES "financing_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
