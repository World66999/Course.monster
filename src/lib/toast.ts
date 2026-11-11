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

/**
 * Resolved by the <Toaster> when it has mounted. A toast sent before that
 * would be dropped (the library only delivers to a mounted container), which
 * could happen to a tap made in the first moments after the page loads. A
 * 4-second cap means a toast is never held back for long if the container is
 * somehow missing.
 */
let markReady: () => void = () => undefined;
const containerReady = new Promise<void>((resolve) => {
  markReady = resolve;
});
export const toasterMounted = () => markReady();

const load = () =>
  (cached ??= Promise.all([
    import("sonner").then((m) => m.toast),
    Promise.race([containerReady, new Promise<void>((r) => setTimeout(r, 4000))]),
  ])
    .then(([t]) => t)
    .catch((err) => {
      // The download was cut off (offline, or the visitor left the page):
      // forget it so the next toast tries again instead of failing forever.
      cached = null;
      throw err;
    }));

/** A toast that cannot be shown is dropped quietly; it must never break the action behind it. */
const show = (kind: "success" | "error" | "info" | "message", args: Args) =>
  void load()
    .then((t) => t[kind](...args))
    .catch(() => undefined);

export const toast = {
  success: (...args: Args) => show("success", args),
  error: (...args: Args) => show("error", args),
  info: (...args: Args) => show("info", args),
  message: (...args: Args) => show("message", args),
};
