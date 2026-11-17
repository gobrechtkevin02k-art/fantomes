// Service worker de Pilote : affiche les notifications push et ouvre l'application au bon endroit.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { texte: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(d.titre || "Pilote", {
      body: d.texte || "",
      icon: "/icones/icone-192.png",
      badge: "/icones/badge-96.png",
      tag: d.tag,
      renotify: !!d.tag,
      data: { url: d.url || "/", urlAction: d.urlAction || d.url || "/" },
      actions: d.actions || [],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const cible = new URL(event.action === "valider" ? data.urlAction : data.url, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if (new URL(f.url).origin === self.location.origin && "focus" in f) {
          return f.navigate(cible).then((c) => (c || f).focus());
        }
      }
      return self.clients.openWindow(cible);
    }),
  );
});
