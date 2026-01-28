-- CreateTable
CREATE TABLE "crm_tracking_sessions" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_tracking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_tracking_visits" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "visited_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_tracking_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_tracking_sessions_uuid_idx" ON "crm_tracking_sessions"("uuid");

-- CreateIndex
CREATE INDEX "crm_tracking_visits_session_id_idx" ON "crm_tracking_visits"("session_id");

-- AddForeignKey
ALTER TABLE "crm_tracking_visits" ADD CONSTRAINT "crm_tracking_visits_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "crm_tracking_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
