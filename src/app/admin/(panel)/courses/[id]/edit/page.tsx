import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CourseForm } from "@/components/admin/course-form";

export const metadata: Metadata = { title: "Edit course" };
export const dynamic = "force-dynamic";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [course, categories] = await Promise.all([
    db.course.findUnique({ where: { id } }),
    db.category.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!course) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit course</h1>
      <CourseForm
        courseId={course.id}
        categories={categories}
        defaultValues={{
          title: course.title,
          slug: course.slug,
          shortDescription: course.shortDescription ?? "",
          description: course.description,
          thumbnail: course.thumbnail ?? "",
          banner: course.banner ?? "",
          categoryId: course.categoryId ?? "",
          tags: course.tags.join(", "),
          downloadUrl: course.downloadUrl,
          telegramUrl: course.telegramUrl ?? "",
          sizeLabel: course.sizeLabel ?? "",
          lecturesCount: course.lecturesCount ?? undefined,
          published: course.published,
          featured: course.featured,
          trending: course.trending,
          seoTitle: course.seoTitle ?? "",
          seoDescription: course.seoDescription ?? "",
          metaImage: course.metaImage ?? "",
        }}
      />
    </div>
  );
}
