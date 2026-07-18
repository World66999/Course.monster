import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveImageUpload, UploadError, type UploadKind } from "@/lib/uploads";
import { logAudit } from "@/lib/audit";

const KINDS = new Set<UploadKind>(["thumbnail", "banner", "logo", "meta"]);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  const kind = String(form.get("kind") ?? "thumbnail") as UploadKind;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: "Invalid upload kind" }, { status: 400 });
  }

  try {
    const path = await saveImageUpload(file, kind);
    await logAudit({
      userId: session.user.id,
      action: "upload.create",
      entity: "upload",
      meta: { path, kind, size: file.size },
    });
    return NextResponse.json({ path });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[admin] upload failed:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
