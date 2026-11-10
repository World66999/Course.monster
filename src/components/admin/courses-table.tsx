"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import {
  deleteCoursesAction,
  duplicateCourseAction,
  moveCourseAction,
  reorderCoursesAction,
  setCourseFlagsAction,
  setPublishedAction,
} from "@/server/actions/courses";
import { Button, buttonClasses } from "@/components/ui/button";
import { adminPath } from "@/lib/admin-path";
import { Badge } from "@/components/ui/badge";
import { CourseImage } from "@/components/site/course-image";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatDate, formatNumber } from "@/lib/utils";

export interface AdminCourseRow {
  id: string;
  title: string;
  slug: string;
  thumbnail: string | null;
  category: string | null;
  published: boolean;
  featured: boolean;
  trending: boolean;
  premium?: boolean;
  downloads: number;
  views: number;
  updatedAt: string;
}

export function CoursesTable({
  courses: serverCourses,
  page,
  pageCount,
  reorderEnabled,
}: {
  courses: AdminCourseRow[];
  page: number;
  pageCount: number;
  reorderEnabled: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<string[] | null>(null);

  // Local copy so a drop shows at once; the server's order replaces it on refresh.
  const [courses, setCourses] = React.useState(serverCourses);
  React.useEffect(() => {
    setCourses(serverCourses);
    setSelected(new Set());
  }, [serverCourses]);

  // ----- drag to reorder (pointer events: mouse, touch and pen alike) -----
  const rowRefs = React.useRef(new Map<string, HTMLTableRowElement>());
  const [drag, setDrag] = React.useState<{ id: string; from: number; over: number } | null>(null);

  function indexAt(clientY: number): number {
    let index = courses.length - 1;
    for (let i = 0; i < courses.length; i++) {
      const rect = rowRefs.current.get(courses[i]!.id)?.getBoundingClientRect();
      if (rect && clientY < rect.top + rect.height / 2) {
        index = i;
        break;
      }
    }
    return index;
  }

  function commitOrder(next: AdminCourseRow[]) {
    setCourses(next);
    void run(() => reorderCoursesAction(next.map((c) => c.id)), "Order updated");
  }

  function moveBy(index: number, delta: -1 | 1) {
    const to = index + delta;
    if (to < 0 || to >= courses.length) return;
    const next = [...courses];
    const [row] = next.splice(index, 1);
    next.splice(to, 0, row!);
    commitOrder(next);
  }

  function onHandlePointerDown(e: React.PointerEvent<HTMLButtonElement>, index: number) {
    if (busy || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id: courses[index]!.id, from: index, over: index });
  }
  function onHandlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    const over = indexAt(e.clientY);
    setDrag((d) => (d && d.over !== over ? { ...d, over } : d));
  }
  function onHandlePointerUp() {
    if (!drag) return;
    const { from, over } = drag;
    setDrag(null);
    if (from === over) return;
    const next = [...courses];
    const [row] = next.splice(from, 1);
    next.splice(over, 0, row!);
    commitOrder(next);
  }

  const allSelected = courses.length > 0 && selected.size === courses.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(courses.map((c) => c.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (next > 1) params.set("page", String(next));
    else params.delete("page");
    router.push(`${pathname}${params.size ? `?${params}` : ""}`);
  }

  const ids = [...selected];

  return (
    <div className="space-y-4">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="glass-chrome sticky top-20 z-30 flex flex-wrap items-center gap-2 rounded-nested p-3">
          <span className="mr-2 text-sm font-medium">{selected.size} selected</span>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => run(() => setPublishedAction(ids, true), "Courses published")}
          >
            Publish
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => run(() => setPublishedAction(ids, false), "Courses unpublished")}
          >
            Unpublish
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => run(() => setCourseFlagsAction(ids, { featured: true }), "Marked as featured")}
          >
            Feature
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => run(() => setCourseFlagsAction(ids, { featured: false }), "Removed from featured")}
          >
            Unfeature
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => run(() => setCourseFlagsAction(ids, { trending: true }), "Marked as trending")}
          >
            Trending
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => run(() => setCourseFlagsAction(ids, { trending: false }), "Removed from trending")}
          >
            Not trending
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => setConfirmDelete(ids)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Delete
          </Button>
        </div>
      )}

      <div className="relative overflow-x-auto rounded-card border border-border bg-card shadow-soft">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs tracking-wider text-muted-foreground uppercase">
              {reorderEnabled && (
                <th className="w-10 p-3">
                  <span className="sr-only">Drag to reorder</span>
                </th>
              )}
              <th className="w-10 p-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all courses"
                  className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                />
              </th>
              <th className="p-3 font-medium">Course</th>
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Stats</th>
              <th className="p-3 font-medium">Updated</th>
              {reorderEnabled && <th className="p-3 font-medium">Order</th>}
              <th className="w-12 p-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {courses.length === 0 && (
              <tr>
                <td colSpan={9} className="p-10 text-center text-muted-foreground">
                  No courses match your filters.
                </td>
              </tr>
            )}
            {courses.map((course, index) => (
              <tr
                key={course.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(course.id, el);
                  else rowRefs.current.delete(course.id);
                }}
                className={cn(
                  "border-b border-border transition-colors duration-150 last:border-0 hover:bg-primary-soft/45",
                  drag?.id === course.id && "bg-primary-soft opacity-70",
                  // Where the dragged row will land.
                  drag && drag.over === index && drag.from > index && "shadow-[inset_0_2px_0_0_var(--primary)]",
                  drag && drag.over === index && drag.from < index && "shadow-[inset_0_-2px_0_0_var(--primary)]"
                )}
              >
                {reorderEnabled && (
                  <td className="p-1 pl-2">
                    <button
                      type="button"
                      aria-label={`Reorder ${course.title}: drag, or press the up and down arrow keys`}
                      disabled={busy}
                      onPointerDown={(e) => onHandlePointerDown(e, index)}
                      onPointerMove={onHandlePointerMove}
                      onPointerUp={onHandlePointerUp}
                      onPointerCancel={() => setDrag(null)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          moveBy(index, -1);
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          moveBy(index, 1);
                        }
                      }}
                      className="flex h-11 w-9 cursor-grab touch-none items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing disabled:opacity-40"
                    >
                      <GripVertical className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                )}
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.has(course.id)}
                    onChange={() => toggleOne(course.id)}
                    aria-label={`Select ${course.title}`}
                    className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                  />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      <CourseImage src={course.thumbnail} title={course.title} className="[&>span]:text-xs" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={adminPath(`courses/${course.id}/edit`)}
                        className="block max-w-64 truncate font-medium hover:text-primary"
                      >
                        {course.title}
                      </Link>
                      <p className="max-w-64 truncate text-xs text-muted-foreground">/{course.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{course.category ?? "—"}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={course.published ? "success" : "secondary"}>
                      {course.published ? "Published" : "Draft"}
                    </Badge>
                    {course.premium && <Badge variant="premium">Premium</Badge>}
                    {course.featured && <Badge>Featured</Badge>}
                    {course.trending && <Badge variant="warning">Trending</Badge>}
                  </div>
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {formatNumber(course.downloads)} DLs · {formatNumber(course.views)} views
                </td>
                <td className="p-3 text-xs whitespace-nowrap text-muted-foreground">
                  {formatDate(course.updatedAt)}
                </td>
                {reorderEnabled && (
                  <td className="p-3">
                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Move ${course.title} up`}
                        disabled={busy || (page === 1 && index === 0)}
                        onClick={() => run(() => moveCourseAction(course.id, "up"), "Order updated")}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Move ${course.title} down`}
                        disabled={busy || (page === pageCount && index === courses.length - 1)}
                        onClick={() => run(() => moveCourseAction(course.id, "down"), "Order updated")}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                )}
                <td className="p-3">
                  <Dropdown>
                    <DropdownTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions for ${course.title}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownTrigger>
                    <DropdownContent align="end">
                      <DropdownItem asChild>
                        <Link href={adminPath(`courses/${course.id}/edit`)}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Edit
                        </Link>
                      </DropdownItem>
                      <DropdownItem asChild>
                        <Link href={`/courses/${course.slug}`} target="_blank">
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          View on site
                        </Link>
                      </DropdownItem>
                      <DropdownItem
                        onSelect={() => run(() => duplicateCourseAction(course.id), "Course duplicated")}
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        Duplicate
                      </DropdownItem>
                      <DropdownItem
                        onSelect={() =>
                          run(
                            () => setPublishedAction([course.id], !course.published),
                            course.published ? "Course unpublished" : "Course published"
                          )
                        }
                      >
                        {course.published ? "Unpublish" : "Publish"}
                      </DropdownItem>
                      <DropdownSeparator />
                      <DropdownItem
                        className="text-destructive data-[highlighted]:bg-destructive/10"
                        onSelect={() => setConfirmDelete([course.id])}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Delete
                      </DropdownItem>
                    </DropdownContent>
                  </Dropdown>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => goToPage(page + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogTitle>Delete {confirmDelete?.length === 1 ? "course" : `${confirmDelete?.length} courses`}?</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            This permanently removes the {confirmDelete?.length === 1 ? "course" : "courses"} along
            with download history and cached short links. This cannot be undone.
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                const toDelete = confirmDelete!;
                setConfirmDelete(null);
                void run(() => deleteCoursesAction(toDelete), "Deleted");
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground">
        {reorderEnabled ? (
          <>Drag the handle (or use the arrows) to change the order shown in featured sections.</>
        ) : (
          <>Reordering is available when no search or filter is active.</>
        )}{" "}
        <Link href={adminPath("courses/new")} className={buttonClasses("ghost", "sm", "h-auto p-0 text-xs text-primary")}>
          Add a new course →
        </Link>
      </p>
    </div>
  );
}
