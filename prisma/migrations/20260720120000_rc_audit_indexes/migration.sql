-- Release-candidate audit: additive indexes only, no data/shape changes.
-- Covers the admin moderation "all comments"/"all reviews" listings (status-only
-- filter, no courseId — the existing composite indexes lead with courseId and
-- don't help there), the course skill-level/language filters on the public
-- catalog, and the admin Users page's default createdAt sort.

-- CreateIndex
CREATE INDEX "comments_status_createdAt_idx" ON "comments"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "courses_published_skillLevel_idx" ON "courses"("published", "skillLevel");

-- CreateIndex
CREATE INDEX "courses_published_language_idx" ON "courses"("published", "language");

-- CreateIndex
CREATE INDEX "reviews_status_createdAt_idx" ON "reviews"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt" DESC);
