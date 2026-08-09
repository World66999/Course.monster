import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * A self-contained, additional human-verification layer for the download
 * flow — sits alongside (never in place of) the existing page-ticket +
 * Turnstile + rate-limit + origin checks in /api/download/init.
 *
 * Two short-lived, single-use, HMAC-signed ticket kinds, both Node-only
 * (issued/consumed from Route Handlers, never Edge middleware — unlike
 * page-ticket.ts, so this can use node:crypto directly, matching
 * download-token.ts's style):
 *
 *  1. A "challenge" ticket: minted when the client asks for a puzzle,
 *     embeds the randomly-generated correct answer so the server needs no
 *     session/DB state to check it later, single-use, ~3 minutes to solve.
 *  2. A "human-verified" ticket: minted only after a challenge ticket is
 *     correctly and plausibly solved, consumed by /api/download/init as one
 *     more required gate before a download link is issued.
 */

const CHALLENGE_TICKET_TTL_MS = 3 * 60 * 1000;
const HUMAN_TICKET_TTL_MS = 2 * 60 * 1000;

// Anti-automation floor: a real drag/rotate/tap sequence cannot physically
// complete faster than this, and a scripted "solve instantly" submission
// will trip it. Deliberately generous — this must never cause real users to
// fail ("no frustration"), it only screens out implausibly-fast automation.
const MIN_INTERACTION_MS = 280;
const MIN_DRAG_SAMPLES = 3;

export type ChallengeType = "slider" | "dial" | "sequence";

export interface SliderParams {
  target: number; // 0-100
  tolerance: number;
}
export interface DialParams {
  target: number; // degrees, 0-359
  tolerance: number;
}
export interface SequenceParams {
  tiles: number; // grid size (6)
  sequence: number[]; // indices into the tile grid, in required tap order
}

export type ChallengeParams = SliderParams | DialParams | SequenceParams;

export interface IssuedChallenge {
  type: ChallengeType;
  params: ChallengeParams;
  ticket: string;
}

export interface InteractionTrace {
  elapsedMs: number;
  samples: number;
}

export type SliderSolution = { value: number };
export type DialSolution = { value: number };
export type SequenceSolution = { taps: number[] };
export type ChallengeSolution = SliderSolution | DialSolution | SequenceSolution;

interface ChallengeTicketPayload {
  kind: "challenge";
  slug: string;
  type: ChallengeType;
  params: ChallengeParams;
  nonce: string;
  exp: number;
}

interface HumanTicketPayload {
  kind: "human-verified";
  slug: string;
  nonce: string;
  exp: number;
}

const challengeNonces = new Map<string, number>();
const humanNonces = new Map<string, number>();

function secret(): string {
  const s = process.env.DOWNLOAD_TOKEN_SECRET;
  if (!s) throw new Error("DOWNLOAD_TOKEN_SECRET is not set");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function pack(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

function unpack<T>(token: string): T | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, sign(data))) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function purgeStale(nonces: Map<string, number>, now: number) {
  for (const [nonce, exp] of nonces) {
    if (exp < now) nonces.delete(nonce);
  }
}

function randomChallenge(): { type: ChallengeType; params: ChallengeParams } {
  const type = (["slider", "dial", "sequence"] as const)[randomInt(0, 3)];
  switch (type) {
    case "slider":
      return { type, params: { target: randomInt(12, 89), tolerance: 6 } satisfies SliderParams };
    case "dial":
      return { type, params: { target: randomInt(0, 360), tolerance: 10 } satisfies DialParams };
    case "sequence": {
      const tiles = 6;
      const pool = Array.from({ length: tiles }, (_, i) => i);
      const sequence: number[] = [];
      for (let i = 0; i < 4; i++) {
        const idx = randomInt(0, pool.length);
        sequence.push(pool.splice(idx, 1)[0]!);
      }
      return { type, params: { tiles, sequence } satisfies SequenceParams };
    }
  }
}

export function createChallenge(slug: string): IssuedChallenge {
  const { type, params } = randomChallenge();
  const payload: ChallengeTicketPayload = {
    kind: "challenge",
    slug,
    type,
    params,
    nonce: randomBytes(12).toString("base64url"),
    exp: Date.now() + CHALLENGE_TICKET_TTL_MS,
  };
  return { type, params, ticket: pack(payload) };
}

function solutionMatches(type: ChallengeType, params: ChallengeParams, solution: unknown): boolean {
  if (type === "slider") {
    const p = params as SliderParams;
    const s = solution as Partial<SliderSolution>;
    return typeof s.value === "number" && Math.abs(s.value - p.target) <= p.tolerance;
  }
  if (type === "dial") {
    const p = params as DialParams;
    const s = solution as Partial<DialSolution>;
    if (typeof s.value !== "number") return false;
    const diff = Math.abs(((((s.value - p.target) % 360) + 540) % 360) - 180);
    return diff <= p.tolerance;
  }
  const p = params as SequenceParams;
  const s = solution as Partial<SequenceSolution>;
  return (
    Array.isArray(s.taps) &&
    s.taps.length === p.sequence.length &&
    s.taps.every((t, i) => t === p.sequence[i])
  );
}

export type ChallengeVerifyResult =
  | { ok: true; humanTicket: string }
  | {
      ok: false;
      reason: "invalid" | "expired" | "used" | "slug_mismatch" | "incorrect" | "implausible";
    };

/** Never trusts the browser: signature, expiry, single-use, slug binding, correctness, and interaction plausibility are all re-checked here. */
export function verifyChallengeSubmission(
  ticket: string,
  slug: string,
  solution: unknown,
  trace: InteractionTrace
): ChallengeVerifyResult {
  const payload = unpack<ChallengeTicketPayload>(ticket);
  if (!payload || payload.kind !== "challenge") return { ok: false, reason: "invalid" };

  const now = Date.now();
  purgeStale(challengeNonces, now);
  if (now > payload.exp) return { ok: false, reason: "expired" };
  if (payload.slug !== slug) return { ok: false, reason: "slug_mismatch" };
  if (challengeNonces.has(payload.nonce)) return { ok: false, reason: "used" };
  // Consume immediately — one ticket, exactly one attempt, pass or fail.
  challengeNonces.set(payload.nonce, payload.exp);

  const elapsed = typeof trace.elapsedMs === "number" ? trace.elapsedMs : 0;
  const samples = typeof trace.samples === "number" ? trace.samples : 0;
  const minSamples =
    payload.type === "sequence" ? (payload.params as SequenceParams).sequence.length : MIN_DRAG_SAMPLES;
  if (elapsed < MIN_INTERACTION_MS || samples < minSamples) {
    return { ok: false, reason: "implausible" };
  }

  if (!solutionMatches(payload.type, payload.params, solution)) {
    return { ok: false, reason: "incorrect" };
  }

  const humanPayload: HumanTicketPayload = {
    kind: "human-verified",
    slug,
    nonce: randomBytes(12).toString("base64url"),
    exp: Date.now() + HUMAN_TICKET_TTL_MS,
  };
  return { ok: true, humanTicket: pack(humanPayload) };
}

export type HumanTicketVerifyResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "used" | "slug_mismatch" };

export function consumeHumanTicket(token: string, slug: string): HumanTicketVerifyResult {
  const payload = unpack<HumanTicketPayload>(token);
  if (!payload || payload.kind !== "human-verified") return { ok: false, reason: "invalid" };

  const now = Date.now();
  purgeStale(humanNonces, now);
  if (now > payload.exp) return { ok: false, reason: "expired" };
  if (payload.slug !== slug) return { ok: false, reason: "slug_mismatch" };
  if (humanNonces.has(payload.nonce)) return { ok: false, reason: "used" };
  humanNonces.set(payload.nonce, payload.exp);

  return { ok: true };
}
