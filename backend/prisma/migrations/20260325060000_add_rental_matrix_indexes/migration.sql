-- CreateIndex
CREATE INDEX "rental_matrix_entries_monthly_rate_gross_idx" ON "rental_matrix_entries"("monthly_rate_gross");

-- CreateIndex
CREATE INDEX "rental_matrix_entries_assignment_id_monthly_rate_gross_idx" ON "rental_matrix_entries"("assignment_id", "monthly_rate_gross");
