import test from "node:test";
import assert from "node:assert/strict";
import {
  aiPlatformFormSchema,
  freeResourceFormSchema,
  listAppListingsQuerySchema,
  listAiPlatformsQuerySchema,
  listCourseRequestsQuerySchema,
  listFreeResourcesQuerySchema,
} from "../src/lib/validation.ts";

// ---------------------------------------------------------------------------
// Regression: query-string booleans
//
// The list schemas used `z.coerce.boolean()`, which is just `Boolean(value)`.
// Every non-empty string is truthy there, so `?openSource=false` parsed as
// TRUE and the filter turned ON when the user asked for it OFF. The site's own
// controls delete the parameter instead of writing `=false`, which is why this
// stayed hidden — but hand-edited, shared and bookmarked URLs do carry it.
// ---------------------------------------------------------------------------

test("an explicit false in the query string does not enable a filter", () => {
  for (const falsey of ["false", "0", "no", "FALSE", " false "]) {
    assert.equal(
      listAppListingsQuerySchema.parse({ openSource: falsey }).openSource,
      false,
      `openSource=${falsey} must not enable the filter`
    );
    assert.equal(listCourseRequestsQuerySchema.parse({ mine: falsey }).mine, false);
    assert.equal(listCourseRequestsQuerySchema.parse({ bookmarked: falsey }).bookmarked, false);
    assert.equal(listCourseRequestsQuerySchema.parse({ following: falsey }).following, false);
  }
});

test("the true spellings still enable a filter", () => {
  for (const truthy of ["true", "1", "yes", "on", "TRUE"]) {
    assert.equal(listAppListingsQuerySchema.parse({ openSource: truthy }).openSource, true);
    assert.equal(listCourseRequestsQuerySchema.parse({ mine: truthy }).mine, true);
  }
});

test("an absent flag stays undefined rather than becoming false", () => {
  assert.equal(listAppListingsQuerySchema.parse({}).openSource, undefined);
});

test("junk in a boolean flag is treated as off, not as on", () => {
  assert.equal(listAppListingsQuerySchema.parse({ openSource: "sure-why-not" }).openSource, false);
});

// ---------------------------------------------------------------------------
// New directory list queries
// ---------------------------------------------------------------------------

test("list queries default to the curated sort and a bounded page size", () => {
  const resources = listFreeResourcesQuerySchema.parse({});
  assert.equal(resources.sort, "curated");
  assert.equal(resources.limit, 12);

  const platforms = listAiPlatformsQuerySchema.parse({});
  assert.equal(platforms.sort, "curated");
  assert.equal(platforms.limit, 12);
});

test("page size cannot be inflated into an unbounded query", () => {
  assert.equal(listFreeResourcesQuerySchema.safeParse({ limit: "1000" }).success, false);
  assert.equal(listAiPlatformsQuerySchema.safeParse({ limit: "-1" }).success, false);
  assert.equal(listFreeResourcesQuerySchema.parse({ limit: "48" }).limit, 48);
});

test("unknown enum values are rejected instead of reaching the database", () => {
  assert.equal(listFreeResourcesQuerySchema.safeParse({ category: "DROP TABLE" }).success, false);
  assert.equal(listFreeResourcesQuerySchema.safeParse({ source: "'; select 1 --" }).success, false);
  assert.equal(listAiPlatformsQuerySchema.safeParse({ pricing: "FREE_FOREVER" }).success, false);
  assert.equal(listAiPlatformsQuerySchema.safeParse({ category: "../../etc" }).success, false);
});

// ---------------------------------------------------------------------------
// Admin form schemas — the server-side gate on admin input
// ---------------------------------------------------------------------------

const validResource = {
  title: "Python notes",
  description: "",
  url: "https://mega.nz/folder/abc",
  category: "EBOOK" as const,
  thumbnail: "",
  tags: "",
  featured: false,
  published: true,
  order: 0,
};

test("a resource URL with a dangerous scheme is rejected server-side", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "http://example.com/",
    "https://user:pass@evil.example/",
  ]) {
    const result = freeResourceFormSchema.safeParse({ ...validResource, url });
    assert.equal(result.success, false, `should have rejected: ${url}`);
  }
});

test("an accepted resource URL comes out of the schema already normalized", () => {
  // The action stores schema output directly, so normalization has to happen
  // here rather than being something each call site must remember.
  const parsed = freeResourceFormSchema.parse({ ...validResource, url: "  https://MEGA.NZ/folder/abc  " });
  assert.equal(parsed.url, "https://mega.nz/folder/abc");
});

test("the resource form has no field for the source badge", () => {
  // sourceType is derived from the hostname in the server action. If a field
  // for it ever appears here, a crafted POST could label any host as MEGA.
  const parsed = freeResourceFormSchema.parse({
    ...validResource,
    // @ts-expect-error deliberately passing a field the schema must not accept
    sourceType: "MEGA",
  });
  assert.ok(!("sourceType" in parsed), "sourceType must never be accepted from the client");
});

const validPlatform = {
  name: "Perplexity",
  description: "",
  url: "https://www.perplexity.ai/",
  category: "RESEARCH" as const,
  pricingType: "FREE_TIER" as const,
  freeTierNote: "",
  logo: "",
  tags: "",
  featured: false,
  published: true,
  order: 0,
};

test("an AI platform URL must be a real https site", () => {
  for (const url of ["javascript:alert(1)", "http://perplexity.ai", "not-a-url", ""]) {
    assert.equal(
      aiPlatformFormSchema.safeParse({ ...validPlatform, url }).success,
      false,
      `should have rejected: ${url}`
    );
  }
});

test("pricing type is a closed set — no unverifiable claim can be stored", () => {
  // "Free forever" is not a value on purpose: nothing here can verify a
  // vendor's future pricing, so it must not be storable or displayable.
  for (const pricingType of ["FREE_FOREVER", "100_PERCENT_FREE", "PAID", ""]) {
    assert.equal(
      aiPlatformFormSchema.safeParse({ ...validPlatform, pricingType }).success,
      false,
      `should have rejected pricing: ${pricingType}`
    );
  }
  for (const pricingType of ["FREE", "FREE_TIER", "FREE_PLAN_LIMITED", "FREE_TRIAL", "OPEN_SOURCE"]) {
    assert.equal(aiPlatformFormSchema.safeParse({ ...validPlatform, pricingType }).success, true);
  }
});

test("oversized admin input is rejected rather than stored", () => {
  assert.equal(
    freeResourceFormSchema.safeParse({ ...validResource, title: "a".repeat(500) }).success,
    false
  );
  assert.equal(
    freeResourceFormSchema.safeParse({ ...validResource, description: "a".repeat(5000) }).success,
    false
  );
  assert.equal(
    aiPlatformFormSchema.safeParse({ ...validPlatform, freeTierNote: "a".repeat(500) }).success,
    false
  );
});

test("a title is required, so a resource can never render as a blank card", () => {
  assert.equal(freeResourceFormSchema.safeParse({ ...validResource, title: "" }).success, false);
  assert.equal(freeResourceFormSchema.safeParse({ ...validResource, title: " a " }).success, false);
  assert.equal(aiPlatformFormSchema.safeParse({ ...validPlatform, name: "" }).success, false);
});
