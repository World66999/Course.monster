// Retirement worker for the former Monetag push-notification service worker.
//
// Monetag registered a worker at this URL for push ads. Deleting the file is
// not enough: browsers that already installed it keep running it. When such a
// browser next checks /sw.js for updates it picks up this version instead,
// which cancels the push subscription, unregisters itself and loads nothing
// from any third party. Safe to delete once old installs have aged out.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const sub = await self.registration.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      } catch {}
      await self.registration.unregister();
    })()
  );
});
