-- Additive only: new nullable columns / defaulted columns on "courses".
-- Existing rows keep working with no manual edits.

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "courses"
  ADD COLUMN "skillLevel" "SkillLevel",
  ADD COLUMN "language" TEXT,
  ADD COLUMN "durationHours" DOUBLE PRECISION,
  ADD COLUMN "instructor" TEXT,
  ADD COLUMN "publisher" TEXT,
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "prerequisites" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "learningOutcomes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "certificate" BOOLEAN,
  ADD COLUMN "lifetimeAccess" BOOLEAN,
  ADD COLUMN "popular" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "courses_published_popular_idx" ON "courses"("published", "popular");
