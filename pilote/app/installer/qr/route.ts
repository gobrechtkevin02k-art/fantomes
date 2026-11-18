import QRCode from "qrcode";

// QR code de l'adresse de Pilote, à scanner avec le téléphone depuis un ordinateur.
// ?chemin=/resultats pour viser une page précise du site (jamais une autre adresse).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const chemin = url.searchParams.get("chemin") ?? "/";
  const cible = new URL(/^\/[\w\-/]*$/.test(chemin) ? chemin : "/", url.origin).href;
  const svg = await QRCode.toString(cible, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#090c11", light: "#ffffff" } });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
