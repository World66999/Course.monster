-- CreateEnum
CREATE TYPE "ResourceSourceType" AS ENUM ('MEGA', 'TELEGRAM', 'GOOGLE_DRIVE', 'GITHUB', 'DROPBOX', 'ONEDRIVE', 'YOUTUBE', 'ARCHIVE_ORG', 'WEBSITE');

-- CreateEnum
CREATE TYPE "ResourceCategory" AS ENUM ('DOCUMENTATION', 'COURSE', 'EBOOK', 'TOOL', 'DATASET', 'CHEATSHEET', 'COMMUNITY', 'OTHER');

-- CreateEnum
CREATE TYPE "AiPlatformCategory" AS ENUM ('CHAT', 'CODING', 'IMAGE', 'VIDEO', 'WRITING', 'RESEARCH', 'EDUCATION', 'PRODUCTIVITY', 'PRESENTATIONS', 'DESIGN', 'AUDIO', 'OTHER');

-- CreateEnum
CREATE TYPE "AiPricingType" AS ENUM ('FREE', 'FREE_TIER', 'FREE_PLAN_LIMITED', 'FREE_TRIAL', 'OPEN_SOURCE');

-- CreateTable
CREATE TABLE "free_resources" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "sourceType" "ResourceSourceType" NOT NULL,
    "category" "ResourceCategory" NOT NULL,
    "thumbnail" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "free_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_platforms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "category" "AiPlatformCategory" NOT NULL,
    "pricingType" "AiPricingType" NOT NULL,
    "freeTierNote" TEXT,
    "logo" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "free_resources_url_key" ON "free_resources"("url");

-- CreateIndex
CREATE INDEX "free_resources_published_createdAt_idx" ON "free_resources"("published", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "free_resources_published_featured_idx" ON "free_resources"("published", "featured");

-- CreateIndex
CREATE INDEX "free_resources_published_category_idx" ON "free_resources"("published", "category");

-- CreateIndex
CREATE INDEX "free_resources_published_sourceType_idx" ON "free_resources"("published", "sourceType");

-- CreateIndex
CREATE INDEX "free_resources_published_order_idx" ON "free_resources"("published", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ai_platforms_url_key" ON "ai_platforms"("url");

-- CreateIndex
CREATE INDEX "ai_platforms_published_createdAt_idx" ON "ai_platforms"("published", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ai_platforms_published_featured_idx" ON "ai_platforms"("published", "featured");

-- CreateIndex
CREATE INDEX "ai_platforms_published_category_idx" ON "ai_platforms"("published", "category");

-- CreateIndex
CREATE INDEX "ai_platforms_published_pricingType_idx" ON "ai_platforms"("published", "pricingType");

-- CreateIndex
CREATE INDEX "ai_platforms_published_order_idx" ON "ai_platforms"("published", "order");

