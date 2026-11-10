/**
 * Toast notifications, loaded on first use.
 *
 * Dozens of components call `toast.success/error`, including the newsletter
 * form in the footer of every page. Importing the toast library directly put
 * all of it (~46 kB) into every page's first load for a function that only
 * runs after a click. This facade has the same call shape and fetches the
 * library when the first toast is actually shown. The <Toaster> that displays
 * them is mounted by the root layout after hydration.
 */
type ToastFn = typeof import("sonner").toast;
type Args = Parameters<ToastFn["success"]>;

let cached: Promise<ToastFn> | null = null;
const load = () => (cached ??= import("sonner").then((m) => m.toast));

export const toast = {
  success: (...args: Args) => void load().then((t) => t.success(...args)),
  error: (...args: Args) => void load().then((t) => t.error(...args)),
  info: (...args: Args) => void load().then((t) => t.info(...args)),
  message: (...args: Args) => void load().then((t) => t.message(...args)),
};
