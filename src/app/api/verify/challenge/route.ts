import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPublishedCourse } from "@/lib/courses";
import { createChallenge, verifyChallengeSubmission } from "@/lib/verify-challenge";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp, isTrustedOrigin } from "@/lib/ip";

/**
 * Additional human-verification layer for the download flow — issues (GET)
 * and verifies (POST) a randomized, lightweight interactive challenge. This
 * never replaces the existing page-ticket / Turnstile / rate-limit / origin
 * checks in /api/download/init; it's one more independent gate stacked on
 * top of them (see verify-challenge.ts).
 */

const slugSchema = z.string().min(1).max(120);

export async function GET(request: NextRequest) {
  const ip = await getClientIp();
  const rl = checkRateLimit(`verify-challenge-issue:${hashIp(ip)}`, { limit: 30, windowMs: 5 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const slugParam = request.nextUrl.searchParams.get("slug") ?? "";
  const parsed = slugSchema.safeParse(slugParam);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const course = await getPublishedCourse(parsed.data);
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const { type, params, ticket } = createChallenge(parsed.data);
  return NextResponse.json(
    { type, params, ticket },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

const bodySchema = z.object({
  slug: z.string().min(1).max(120),
  ticket: z.string().min(1).max(4096),
  solution: z.unknown(),
  trace: z.object({
    elapsedMs: z.number().min(0).max(10 * 60_000),
    samples: z.number().int().min(0).max(10_000),
  }),
});

export async function POST(request: NextRequest) {
  const ip = await getClientIp();
  const rl = checkRateLimit(`verify-challenge-submit:${hashIp(ip)}`, { limit: 20, windowMs: 5 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!isTrustedOrigin(origin, request.nextUrl.origin)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = verifyChallengeSubmission(
    parsed.data.ticket,
    parsed.data.slug,
    parsed.data.solution,
    parsed.data.trace
  );

  if (!result.ok) {
    // Deliberately generic message — never reveal which specific check
    // failed (ticket vs. correctness vs. timing), so a scripted attacker
    // can't use the error to iteratively tune around individual checks.
    return NextResponse.json({ ok: false, error: "Verification failed. Let's try that again." }, { status: 403 });
  }

  return NextResponse.json({ ok: true, humanTicket: result.humanTicket });
}
