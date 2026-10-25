import test from "node:test";
import assert from "node:assert/strict";
import { COMMUNITY_LINKS } from "../src/lib/community.ts";
import { brandingSchema } from "../src/lib/telegram/branding-schema.ts";
import { community, welcome } from "../src/lib/telegram/render.ts";

/** The public channel and group: right links, plain buttons, no Premium anywhere. */

const b = brandingSchema.parse({});
const urls = (kb: { url?: string }[][]) => kb.flat().map((x) => x.url).filter(Boolean);

test("the two public community links", () => {
  assert.deepEqual(
    COMMUNITY_LINKS.map((l) => [l.label, l.url]),
    [
      ["Join our Channel", "https://t.me/Unique_One_in"],
      ["Join our Community Group", "https://t.me/Unique_One_Chat"],
    ]
  );
});

test("the bot's start menu and /community both link to them", () => {
  for (const screen of [welcome(b, "https://courses.monster"), community()]) {
    const u = urls(screen.keyboard);
    assert.ok(u.includes("https://t.me/Unique_One_in"));
    assert.ok(u.includes("https://t.me/Unique_One_Chat"));
  }
  const c = community();
  assert.ok(!/premium/i.test(c.text + JSON.stringify(c.keyboard)), "no Premium wording or gate");
  assert.ok(c.keyboard.flat().every((x) => "url" in x && !("callback_data" in x)), "plain links only");
});
