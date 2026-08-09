-- CreateEnum
CREATE TYPE "LearningLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS');

-- CreateEnum
CREATE TYPE "LearningResourceType" AS ENUM ('VIDEO', 'PLAYLIST');

-- CreateEnum
CREATE TYPE "AppCategory" AS ENUM ('DEVELOPER_TOOLS', 'PROGRAMMING', 'EDUCATION', 'PRODUCTIVITY', 'UTILITIES', 'OPEN_SOURCE', 'MEDIA_TOOLS', 'FILE_MANAGEMENT', 'PRIVACY_TOOLS', 'NETWORKING', 'OTHER');

-- CreateEnum
CREATE TYPE "AppPlatform" AS ENUM ('ANDROID', 'WINDOWS', 'MACOS', 'LINUX', 'WEB', 'IOS', 'CROSS_PLATFORM');

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "appListingId" TEXT,
ADD COLUMN     "codingChannelId" TEXT,
ADD COLUMN     "learningResourceId" TEXT;

-- CreateTable
CREATE TABLE "coding_channels" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "logo" TEXT,
    "shortDescription" TEXT,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "spokenLanguage" TEXT,
    "skillLevel" "LearningLevel",
    "bestSuitedFor" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "bookmarkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coding_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coding_channel_bookmarks" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coding_channel_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_resources" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "videoId" TEXT,
    "playlistId" TEXT,
    "thumbnail" TEXT,
    "resourceType" "LearningResourceType" NOT NULL,
    "creatorName" TEXT,
    "categoryId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skillLevel" "LearningLevel",
    "spokenLanguage" TEXT,
    "durationMinutes" INTEGER,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "bookmarkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_resource_bookmarks" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_resource_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_listings" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "screenshots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shortDescription" TEXT,
    "description" TEXT,
    "developer" TEXT,
    "projectUrl" TEXT,
    "sourceUrl" TEXT,
    "downloadUrl" TEXT NOT NULL,
    "platform" "AppPlatform" NOT NULL,
    "category" "AppCategory" NOT NULL,
    "version" TEXT,
    "appUpdatedAt" TIMESTAMP(3),
    "license" TEXT,
    "isOpenSource" BOOLEAN NOT NULL DEFAULT false,
    "minAndroidVersion" TEXT,
    "architecture" TEXT,
    "fileSizeLabel" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coding_channels_slug_key" ON "coding_channels"("slug");

-- CreateIndex
CREATE INDEX "coding_channels_published_createdAt_idx" ON "coding_channels"("published", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "coding_channels_published_featured_idx" ON "coding_channels"("published", "featured");

-- CreateIndex
CREATE INDEX "coding_channels_published_order_idx" ON "coding_channels"("published", "order");

-- CreateIndex
CREATE INDEX "coding_channel_bookmarks_userId_idx" ON "coding_channel_bookmarks"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "coding_channel_bookmarks_channelId_userId_key" ON "coding_channel_bookmarks"("channelId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_resources_slug_key" ON "learning_resources"("slug");

-- CreateIndex
CREATE INDEX "learning_resources_published_createdAt_idx" ON "learning_resources"("published", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "learning_resources_published_featured_idx" ON "learning_resources"("published", "featured");

-- CreateIndex
CREATE INDEX "learning_resources_published_resourceType_idx" ON "learning_resources"("published", "resourceType");

-- CreateIndex
CREATE INDEX "learning_resources_categoryId_idx" ON "learning_resources"("categoryId");

-- CreateIndex
CREATE INDEX "learning_resource_bookmarks_userId_idx" ON "learning_resource_bookmarks"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_resource_bookmarks_resourceId_userId_key" ON "learning_resource_bookmarks"("resourceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "app_listings_slug_key" ON "app_listings"("slug");

-- CreateIndex
CREATE INDEX "app_listings_published_createdAt_idx" ON "app_listings"("published", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "app_listings_published_featured_idx" ON "app_listings"("published", "featured");

-- CreateIndex
CREATE INDEX "app_listings_published_category_idx" ON "app_listings"("published", "category");

-- CreateIndex
CREATE INDEX "app_listings_published_platform_idx" ON "app_listings"("published", "platform");

-- CreateIndex
CREATE INDEX "reports_codingChannelId_idx" ON "reports"("codingChannelId");

-- CreateIndex
CREATE INDEX "reports_learningResourceId_idx" ON "reports"("learningResourceId");

-- CreateIndex
CREATE INDEX "reports_appListingId_idx" ON "reports"("appListingId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_codingChannelId_reporterId_key" ON "reports"("codingChannelId", "reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_learningResourceId_reporterId_key" ON "reports"("learningResourceId", "reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_appListingId_reporterId_key" ON "reports"("appListingId", "reporterId");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_codingChannelId_fkey" FOREIGN KEY ("codingChannelId") REFERENCES "coding_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_learningResourceId_fkey" FOREIGN KEY ("learningResourceId") REFERENCES "learning_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_appListingId_fkey" FOREIGN KEY ("appListingId") REFERENCES "app_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coding_channel_bookmarks" ADD CONSTRAINT "coding_channel_bookmarks_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "coding_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coding_channel_bookmarks" ADD CONSTRAINT "coding_channel_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resource_bookmarks" ADD CONSTRAINT "learning_resource_bookmarks_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "learning_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resource_bookmarks" ADD CONSTRAINT "learning_resource_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

