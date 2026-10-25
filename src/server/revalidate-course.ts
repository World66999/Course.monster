import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

/**
 * Refresh one course page after its reviews or comments change.
 *
 * The page is cached (ISR) and personalised on the client, so a write that
 * changes what everyone sees — a new, edited or deleted review or comment —
 * must drop the cached copy, or a reload would briefly show the old thread.
 * Best effort: a failed lookup only delays freshness until the page's normal
 * revalidation window.
 */
export async function revalidateCoursePage(courseId: string): Promise<void> {
  try {
    const course = await db.course.findUnique({ where: { id: courseId }, select: { slug: true } });
    if (course) revalidatePath(`/courses/${course.slug}`);
  } catch (err) {
    console.error("[revalidate] course page refresh failed:", err);
  }
}
