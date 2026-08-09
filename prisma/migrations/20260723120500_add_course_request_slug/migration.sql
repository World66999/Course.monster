-- AlterTable
ALTER TABLE "course_requests" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "course_requests_slug_key" ON "course_requests"("slug");

