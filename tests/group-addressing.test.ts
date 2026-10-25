import test from "node:test";
import assert from "node:assert/strict";
import { addressedText } from "../src/lib/telegram/addressing.ts";

/** In groups the bot answers only messages meant for it. */

const bot = { id: 42, username: "CourseBot" };
const group = { type: "supergroup" };
const mention = (text: string, offset: number) => ({
  chat: group,
  text,
  entities: [{ type: "mention", offset, length: "@CourseBot".length }],
});

test("private chats are always answered", () => {
  assert.equal(addressedText({ chat: { type: "private" }, text: "python" }, bot), "python");
});

test("ordinary group chatter is ignored", () => {
  assert.equal(addressedText({ chat: group, text: "hello everyone" }, bot), null);
  assert.equal(addressedText({ chat: group, text: "ask @OtherBot", entities: [{ type: "mention", offset: 4, length: 9 }] }, bot), null);
});

test("a mention is answered with the mention stripped", () => {
  assert.equal(addressedText(mention("@CourseBot python course", 0), bot), "python course");
  assert.equal(addressedText(mention("find react @coursebot", 11), bot), "find react");
  assert.equal(addressedText(mention("@CourseBot", 0), bot), "");
});

test("a reply to the bot is answered", () => {
  assert.equal(addressedText({ chat: group, text: "java", reply_to_message: { from: { id: 42 } } }, bot), "java");
  assert.equal(addressedText({ chat: group, text: "java", reply_to_message: { from: { id: 7 } } }, bot), null);
});

test("commands: ours or unsuffixed are answered, another bot's are not", () => {
  assert.equal(addressedText({ chat: group, text: "/courses" }, bot), "/courses");
  assert.equal(addressedText({ chat: group, text: "/courses@CourseBot" }, bot), "/courses@CourseBot");
  assert.equal(addressedText({ chat: group, text: "/start@OtherBot" }, bot), null);
});
