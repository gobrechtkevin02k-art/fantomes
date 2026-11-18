// Lien de confiance entre le site et l'appli Android publiée sur le Play Store (facultatif).
// PWABuilder ou Bubblewrap fournissent le nom du paquet et l'empreinte SHA-256 de la clé de signature :
// ANDROID_PACKAGE=fr.pilote.app  ANDROID_SHA256=AA:BB:…  (plusieurs empreintes séparées par des virgules).
export function GET() {
  const paquet = process.env.ANDROID_PACKAGE?.trim();
  const empreintes = (process.env.ANDROID_SHA256 ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (!paquet || empreintes.length === 0) return Response.json([], { status: 404 });
  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: paquet, sha256_cert_fingerprints: empreintes },
    },
  ]);
}
