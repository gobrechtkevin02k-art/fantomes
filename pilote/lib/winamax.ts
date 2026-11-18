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

/** Page du match sur Winamax à partir de son identifiant (fourni par The Odds API avec includeSids). */
export function lienMatchWinamax(sid?: string): string | undefined {
  return sid && /^\d{3,12}$/.test(sid) ? `https://www.winamax.fr/paris-sportifs/match/${sid}` : undefined;
}

/** Copie la mise (format « 8,40 ») puis ouvre Winamax : il ne reste qu'à toucher la sélection, coller la mise et valider. */
export function ouvrirAvecMise(lien: string, mise: number): void {
  const texte = mise.toFixed(2).replace(".", ",");
  try {
    void navigator.clipboard?.writeText(texte);
  } catch {
    /* presse-papiers indisponible */
  }
  window.open(lien, "_blank", "noopener");
}
