import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveImageUpload, UploadError } from "@/lib/uploads";
import { assertCanPostRequest } from "@/lib/course-requests";
import { checkRateLimit } from "@/lib/rate-limit";
import { isTrustedOrigin } from "@/lib/ip";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!isTrustedOrigin(origin, request.nextUrl.origin)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  // Live re-check — a banned user must not be able to pre-stage images for
  // later use, same rationale as the chat-image upload route.
  const guard = await assertCanPostRequest(session.user.id);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: 403 });
  }

  const rl = checkRateLimit(`request-image-upload:${session.user.id}`, { limit: 20, windowMs: 15 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many uploads. Please try again later." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    // Two variants: a full-size version for the detail page and a small
    // thumbnail for cards — both re-encoded through sharp, which also
    // strips any non-image payload and validates real image content
    // regardless of the claimed extension/MIME type.
    const [path, thumbPath] = await Promise.all([
      saveImageUpload(file, "requestImage"),
      saveImageUpload(file, "requestImageThumb"),
    ]);
    await logAudit({
      userId: session.user.id,
      action: "courseRequest.image_upload",
      entity: "user",
      entityId: session.user.id,
      meta: { size: file.size },
    });
    return NextResponse.json({ path, thumbPath });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[request-image] upload failed:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
