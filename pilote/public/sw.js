// Service worker de Pilote : notifications push, pastille sur l'icône, ouverture rapide et page hors ligne.

const CACHE = "pilote-v2";
const HORS_LIGNE = "/hors-ligne.html";
const COQUILLE = [HORS_LIGNE, "/icones/icone-192.png", "/icones/badge-96.png", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(COQUILLE))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c.startsWith("pilote-") && c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages : toujours le réseau (cotes et résultats à jour) ; sans connexion, la page hors ligne.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(HORS_LIGNE).then((r) => r || Response.error())));
    return;
  }

  // Fichiers du site versionnés (leur nom contient une empreinte qui change à chaque mise à jour) et icônes :
  // servis depuis le téléphone. Les fichiers sans empreinte (mode développement) passent par le réseau.
  const versionne = /^\/_next\/static\/(chunks|css|media)\/(?:.*[-./])?[0-9a-f]{8,}\./.test(url.pathname);
  if (versionne || url.pathname.startsWith("/icones/")) {
    event.respondWith(
      caches.open(CACHE).then((c) =>
        c.match(req).then(
          (r) =>
            r ||
            fetch(req).then((rep) => {
              if (rep.ok) c.put(req, rep.clone());
              return rep;
            }),
        ),
      ),
    );
  }
  // Tout le reste (API, cotes, résultats) passe directement par le réseau.
});

function pastille(n) {
  try {
    if (typeof n !== "number") return;
    if (n > 0) self.navigator.setAppBadge?.(n);
    else self.navigator.clearAppBadge?.();
  } catch {
    /* pastilles non prises en charge */
  }
}

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { texte: event.data ? event.data.text() : "" };
  }
  pastille(d.badge);
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
