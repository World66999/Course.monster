import { listTopLevelComments, getTopLevelCommentCount, attachLikedByMe } from "@/lib/comments";
import { CommentThread } from "@/components/site/comments/comment-thread";
import { Section, SectionHeading } from "@/components/site/section";

/**
 * Viewer-independent on purpose: no auth() here, so the course page can be
 * cached and served to everyone. Every comment renders as not-liked; the
 * viewer's own like state is merged in on the client by CommentThread.
 */
export async function CommentsSection({ courseId }: { courseId: string }) {
  const [{ items, nextCursor }, total] = await Promise.all([
    listTopLevelComments(courseId, { sort: "newest" }),
    getTopLevelCommentCount(courseId),
  ]);
  const itemsWithMeta = await attachLikedByMe(items, null);

  return (
    <Section id="comments" className="py-14">
      <SectionHeading title="Comments" subtitle="Discuss this course with other learners" />
      <div className="mx-auto max-w-3xl">
        <CommentThread courseId={courseId} initialItems={itemsWithMeta} initialCursor={nextCursor} total={total} />
      </div>
    </Section>
  );
}
