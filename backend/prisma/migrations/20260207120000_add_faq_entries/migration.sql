-- CreateEnum
CREATE TYPE "FaqPage" AS ENUM ('home', 'offers', 'contact');

-- CreateTable
CREATE TABLE "faq_entries" (
    "id" TEXT NOT NULL,
    "page" "FaqPage" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "question_pl" TEXT NOT NULL,
    "answer_pl" TEXT NOT NULL,
    "question_en" TEXT NOT NULL,
    "answer_en" TEXT NOT NULL,
    "question_de" TEXT NOT NULL,
    "answer_de" TEXT NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "faq_entries_page_sort_order_idx" ON "faq_entries"("page", "sort_order");
