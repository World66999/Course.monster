-- Additive: visitor counts for the admin dashboard. No existing table is touched.
-- CreateTable
CREATE TABLE "site_visits" (
    "day" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_visits_pkey" PRIMARY KEY ("day","visitorHash")
);
