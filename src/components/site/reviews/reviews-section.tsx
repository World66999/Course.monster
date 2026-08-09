import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getReviewSummary, listReviews } from "@/lib/comments";
import { ReviewsPanel } from "@/components/site/reviews/reviews-panel";
import { Section, SectionHeading } from "@/components/site/section";

export async function ReviewsSection({ courseId }: { courseId: string }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [summary, { items, nextCursor }, myReview] = await Promise.all([
    getReviewSummary(courseId),
    listReviews(courseId, { sort: "newest", limit: 10 }),
    userId
      ? db.review.findUnique({
          where: { courseId_userId: { courseId, userId } },
          select: { id: true, rating: true, title: true, body: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <Section id="reviews" className="py-14">
      <SectionHeading title="Reviews" subtitle="What learners say about this course" />
      <ReviewsPanel
        courseId={courseId}
        initialSummary={summary}
        initialItems={items}
        initialCursor={nextCursor}
        initialMyReview={myReview ? { ...myReview, title: myReview.title ?? "" } : null}
      />
    </Section>
  );
}
