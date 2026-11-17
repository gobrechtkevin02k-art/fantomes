export const WINAMAX = "https://www.winamax.fr/paris-sportifs";

/** Lien vers Winamax : on n'accepte que des liens https vers winamax.fr. */
export function lienWinamax(lien?: string): string {
  if (!lien) return WINAMAX;
  try {
    const u = new URL(lien);
    if (u.protocol === "https:" && (u.hostname === "winamax.fr" || u.hostname.endsWith(".winamax.fr"))) return u.toString();
  } catch {
    /* lien invalide */
  }
  return WINAMAX;
}
