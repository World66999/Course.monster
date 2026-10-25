import { getReviewSummary, listReviews } from "@/lib/comments";
import { ReviewsPanel } from "@/components/site/reviews/reviews-panel";
import { Section, SectionHeading } from "@/components/site/section";

/**
 * Viewer-independent on purpose: no auth() here, so the course page can be
 * cached and served to everyone. The viewer's own review is fetched on the
 * client by ReviewsPanel.
 */
export async function ReviewsSection({ courseId }: { courseId: string }) {
  const [summary, { items, nextCursor }] = await Promise.all([
    getReviewSummary(courseId),
    listReviews(courseId, { sort: "newest", limit: 10 }),
  ]);

  return (
    <Section id="reviews" className="py-14">
      <SectionHeading title="Reviews" subtitle="What learners say about this course" />
      <ReviewsPanel
        courseId={courseId}
        initialSummary={summary}
        initialItems={items}
        initialCursor={nextCursor}
      />
    </Section>
  );
}
