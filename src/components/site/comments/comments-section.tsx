import { auth } from "@/auth";
import { listTopLevelComments, getTopLevelCommentCount, attachLikedByMe } from "@/lib/comments";
import { CommentThread } from "@/components/site/comments/comment-thread";
import { Section, SectionHeading } from "@/components/site/section";

export async function CommentsSection({ courseId }: { courseId: string }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [{ items, nextCursor }, total] = await Promise.all([
    listTopLevelComments(courseId, { sort: "newest" }),
    getTopLevelCommentCount(courseId),
  ]);
  const itemsWithMeta = await attachLikedByMe(items, userId);

  return (
    <Section id="comments" className="py-14">
      <SectionHeading title="Comments" subtitle="Discuss this course with other learners" />
      <div className="mx-auto max-w-3xl">
        <CommentThread courseId={courseId} initialItems={itemsWithMeta} initialCursor={nextCursor} total={total} />
      </div>
    </Section>
  );
}
