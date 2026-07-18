import type { Metadata } from "next";
import { db } from "@/lib/db";
import { CourseForm } from "@/components/admin/course-form";

export const metadata: Metadata = { title: "New course" };
export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  const categories = await db.category.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">New course</h1>
      <CourseForm
        courseId={null}
        categories={categories}
        defaultValues={{
          title: "",
          slug: "",
          shortDescription: "",
          description: "",
          thumbnail: "",
          banner: "",
          categoryId: "",
          tags: "",
          downloadUrl: "",
          telegramUrl: "",
          sizeLabel: "",
          lecturesCount: undefined,
          published: false,
          featured: false,
          trending: false,
          seoTitle: "",
          seoDescription: "",
          metaImage: "",
        }}
      />
    </div>
  );
}
