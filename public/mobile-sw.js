const CACHE_NAME = "agent-signal-mobile-v1";
const APP_SHELL = [
  "/",
  "/mobile.webmanifest",
  "/mobile-icon-192.png",
  "/mobile-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
      return cached ?? network;
    })
  );
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Agent Signal",
    body: "Status sesji uległ zmianie.",
    status: "attention"
  };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    // Use the generic notification for malformed or empty payloads.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/mobile-icon-192.png",
      badge: "/mobile-icon-192.png",
      tag: `agent-signal-${payload.status}`,
      renotify: true,
      data: { url: "/" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      (clients) => {
        const existing = clients[0];
        if (existing) {
          existing.navigate("/");
          return existing.focus();
        }
        return self.clients.openWindow("/");
      }
    )
  );
});
