import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveImageUpload, UploadError } from "@/lib/uploads";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { isTrustedOrigin } from "@/lib/ip";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!isTrustedOrigin(origin, request.nextUrl.origin)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit(`avatar-upload:${session.user.id}`, { limit: 10, windowMs: 15 * 60_000 });
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
    const path = await saveImageUpload(file, "avatar");
    await logAudit({
      userId: session.user.id,
      action: "user.avatar_upload",
      entity: "user",
      entityId: session.user.id,
      meta: { size: file.size },
    });
    return NextResponse.json({ path });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[avatar] upload failed:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
