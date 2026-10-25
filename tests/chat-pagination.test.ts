import test from "node:test";
import assert from "node:assert/strict";

/**
 * The chat feed's paging, against a real database.
 *
 * This needs a database because the defect it covers is in what the query
 * planner does, not in any pure function: Prisma's `cursor` + `skip: 1` only
 * behaves as intended while the cursor row still satisfies the query's `where`.
 * In a moderated live feed it routinely does not — Prisma then positions at the
 * first row *after* the filtered-out anchor, and `skip: 1` discards that row.
 * So hiding one message silently ate the next one for every client polling at
 * that moment, permanently, because the cursor had already advanced past it.
 *
 * Set CHAT_TEST_DATABASE_URL to a THROWAWAY database (these tests delete every
 * chat message in it) that has had `prisma migrate deploy` applied:
 *
 *   CHAT_TEST_DATABASE_URL=postgresql://…/scratch npm test
 *
 * Without it these skip rather than fail, so `npm test` stays runnable with no
 * database at all.
 */

const url = process.env.CHAT_TEST_DATABASE_URL;
const skip = url ? false : "CHAT_TEST_DATABASE_URL is not set";
if (url) process.env.DATABASE_URL = url;

const AUTHOR = "chat-paging-probe@example.invalid";

// Imported lazily: with no database configured these modules must not even be
// loaded, and tsx compiles this file to CJS, so no top-level await.
type Deps = {
  db: import("@prisma/client").PrismaClient;
  chat: typeof import("../src/lib/chat.ts");
};
let deps: Promise<Deps> | null = null;
function load(): Promise<Deps> {
  deps ??= (async () => {
    const { PrismaClient } = await import("@prisma/client");
    const chat = await import("../src/lib/chat.ts");
    return { db: new PrismaClient(), chat };
  })();
  return deps;
}

async function seed(count: number): Promise<string[]> {
  const { db } = await load();
  await db.chatMessage.deleteMany({});
  await db.user.deleteMany({ where: { email: AUTHOR } });
  const user = await db.user.create({
    data: { email: AUTHOR, name: "Paging Probe", emailVerified: new Date() },
  });
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const m = await db.chatMessage.create({ data: { userId: user.id, body: `msg ${i}` } });
    ids.push(m.id);
    // Distinct createdAt values, so the ordering under test is the real one
    // rather than an accident of identical timestamps.
    await new Promise((r) => setTimeout(r, 3));
  }
  return ids;
}

const bodies = (r: { items: { body: string }[] }) => r.items.map((m) => m.body);

test("polling from a visible message returns everything after it", { skip }, async () => {
  const { chat } = await load();
  const ids = await seed(5);
  assert.deepEqual(bodies(await chat.listChatMessages({ after: ids[2] })), ["msg 3", "msg 4"]);
});

test("hiding the message a client last saw does not swallow the next one", { skip }, async () => {
  const { db, chat } = await load();
  const ids = await seed(5);
  await db.chatMessage.update({ where: { id: ids[2] }, data: { status: "HIDDEN" } });
  assert.deepEqual(
    bodies(await chat.listChatMessages({ after: ids[2] })),
    ["msg 3", "msg 4"],
    "the message immediately after the moderated one was dropped"
  );
});

test("the same holds for a deleted message and one held for link review", { skip }, async () => {
  const { db, chat } = await load();
  const ids = await seed(5);
  await db.chatMessage.update({ where: { id: ids[1] }, data: { status: "DELETED" } });
  await db.chatMessage.update({ where: { id: ids[3] }, data: { linkPending: true } });
  assert.deepEqual(bodies(await chat.listChatMessages({ after: ids[1] })), ["msg 2", "msg 4"]);
});

test("an anchor the database no longer has falls back to the caller's timestamp", { skip }, async () => {
  const { chat } = await load();
  await seed(3);
  const since = new Date(Date.now() - 60_000);
  assert.deepEqual(
    bodies(await chat.listChatMessages({ after: "cgone0000000000000000000", since })),
    ["msg 0", "msg 1", "msg 2"]
  );
});

test("an unknown anchor with no timestamp reports nothing rather than replaying", { skip }, async () => {
  const { chat } = await load();
  await seed(3);
  assert.deepEqual(bodies(await chat.listChatMessages({ after: "cgone0000000000000000000" })), []);
});

test("loading older history pages backwards and skips what is not visible", { skip }, async () => {
  const { db, chat } = await load();
  const ids = await seed(5);
  await db.chatMessage.update({ where: { id: ids[2] }, data: { status: "HIDDEN" } });
  const page = await chat.listChatMessages({ before: ids[4], limit: 2 });
  assert.deepEqual(bodies(page), ["msg 3", "msg 1"]);
  assert.ok(page.nextCursor, "there is more history, so a cursor should be offered");
});

test("every response carries the server's own clock for the next poll", { skip }, async () => {
  const { chat } = await load();
  const stamp = new Date("2030-01-02T03:04:05.000Z");
  const res = await chat.toChatMessagesResponse([], null, null, stamp);
  assert.equal(res.serverTime, stamp.toISOString());
});

test("clean up", { skip }, async () => {
  const { db } = await load();
  await db.chatMessage.deleteMany({});
  await db.user.deleteMany({ where: { email: AUTHOR } });
  await db.$disconnect();
});
