import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-update timing for the bot: how long until the user sees something
 * (first answer/send/edit completed), how long until all work is done, and
 * how many Bot API calls that took. One log line per update, with a label
 * that names the command or button type only — never the user's text.
 */

interface UpdateTiming {
  label: string;
  start: number;
  firstFeedbackMs: number | null;
  calls: number;
  callMs: number;
}

const store = new AsyncLocalStorage<UpdateTiming>();

/** Methods whose completion is something the user actually sees. */
const FEEDBACK_METHODS = new Set(["answerCallbackQuery", "sendMessage", "editMessageText", "sendInvoice", "sendPhoto", "sendDocument"]);

/** Called by the API client after every Bot API call. */
export function noteTelegramCall(method: string, ms: number): void {
  const t = store.getStore();
  if (!t) return;
  t.calls++;
  t.callMs += ms;
  if (t.firstFeedbackMs === null && FEEDBACK_METHODS.has(method)) t.firstFeedbackMs = Date.now() - t.start;
}

export interface TimingSummary {
  label: string;
  totalMs: number;
  firstFeedbackMs: number | null;
  calls: number;
  callMs: number;
}

export function formatTiming(s: TimingSummary): string {
  return `[telegram] timing ${s.label} total=${s.totalMs}ms first=${s.firstFeedbackMs ?? "-"}ms api=${s.calls}/${s.callMs}ms`;
}

/** Runs one update's work with timing; logs a single summary line when it ends. */
export async function runTimed(label: string, fn: () => Promise<void>, log: (line: string) => void = console.info): Promise<void> {
  const t: UpdateTiming = { label, start: Date.now(), firstFeedbackMs: null, calls: 0, callMs: 0 };
  try {
    await store.run(t, fn);
  } finally {
    log(formatTiming({ label, totalMs: Date.now() - t.start, firstFeedbackMs: t.firstFeedbackMs, calls: t.calls, callMs: t.callMs }));
  }
}

/**
 * A short, content-free label for an update: the command name for commands,
 * "text" for anything typed, and the callback-data prefix for buttons.
 */
export function updateLabel(update: {
  message?: { text?: string; successful_payment?: unknown };
  callback_query?: { data?: string };
  pre_checkout_query?: unknown;
  chat_member?: unknown;
}): string {
  if (update.pre_checkout_query) return "pre_checkout";
  if (update.chat_member) return "chat_member";
  if (update.callback_query) {
    const data = update.callback_query.data ?? "";
    const parts = data.split(":");
    const prefix = parts[0] === "a" || parts[0] === "rz" || parts[0] === "dn" ? parts.slice(0, 2).join(":") : parts[0];
    return `button:${/^[a-z0-9:_]{0,24}$/i.test(prefix) ? prefix : "other"}`;
  }
  if (update.message?.successful_payment) return "payment";
  const text = update.message?.text ?? "";
  const cmd = /^\/([a-z_]{1,32})(?:@\w+)?(?:\s|$)/i.exec(text);
  if (cmd) return `cmd:/${cmd[1].toLowerCase()}`;
  return update.message ? "text" : "other";
}
