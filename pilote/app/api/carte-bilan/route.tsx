import { ImageResponse } from "next/og";
import { profilPublic } from "@/lib/serveur/public";
import { stockage } from "@/lib/serveur/stockage";
import { parMois, plusGrosseBaisse, profitPari, series } from "@/lib/engine/analyse";
import { parties } from "@/lib/engine/temps";
import type { EtatApp } from "@/lib/types";

export const dynamic = "force-dynamic";

const eur = (x: number) => `${x < 0 ? "−" : x > 0 ? "+" : ""}${Math.abs(x).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Carte « bilan du mois » à partager (1080 × 1350), pertes comprises. */
export async function GET(req: Request) {
  const id = profilPublic();
  const etat = id ? await stockage().get<EtatApp>(`etat:${id}`) : null;
  const maintenant = Date.now();
  const p0 = parties(maintenant, "Europe/Paris");
  const demande = new URL(req.url).searchParams.get("mois") ?? `${p0.annee}-${String(p0.mois).padStart(2, "0")}`;
  const mois = /^\d{4}-\d{2}$/.test(demande) ? demande : `${p0.annee}-${String(p0.mois).padStart(2, "0")}`;
  const tous = (etat?.paris ?? []).filter((p) => !p.demo);
  const duMois = tous.filter((p) => {
    if (p.statut === "en_cours" || !p.regleLe) return false;
    const d = parties(Date.parse(p.regleLe), "Europe/Paris");
    return `${d.annee}-${String(d.mois).padStart(2, "0")}` === mois;
  });
  const ligne = parMois(duMois, "Europe/Paris")[0];
  const resultat = ligne?.resultat ?? 0;
  const pire = duMois.length ? Math.min(...duMois.map(profitPari)) : 0;
  const s = series(duMois);
  const baisse = plusGrosseBaisse(duMois);
  const depuisDebut = tous.filter((p) => p.statut !== "en_cours").reduce((t, p) => t + profitPari(p), 0);
  const couleur = resultat >= 0 ? "#34d399" : "#f87171";
  const titre = `${MOIS[Number(mois.slice(5)) - 1]} ${mois.slice(0, 4)}`;

  const Case = ({ label, valeur, c }: { label: string; valeur: string; c?: string }) => (
    <div style={{ display: "flex", flexDirection: "column", width: "48%", background: "#161d26", borderRadius: 28, padding: "22px 30px", marginBottom: 20 }}>
      <div style={{ display: "flex", fontSize: 30, color: "#8b97a4" }}>{label}</div>
      <div style={{ display: "flex", fontSize: 54, fontWeight: 700, color: c ?? "#e9eef3", marginTop: 6 }}>{valeur}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#090c11", color: "#e9eef3", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 700 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, border: "4px solid #a78bfa", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 20, color: "#34d399" }}>P</div>
          Pilote
        </div>
        <div style={{ display: "flex", fontSize: 46, marginTop: 40, color: "#8b97a4" }}>{`Bilan de ${titre}`}</div>
        <div style={{ display: "flex", fontSize: 34, color: "#5d6875", marginTop: 6 }}>Compte réel, gains et pertes publiés sans filtre</div>
        <div style={{ display: "flex", fontSize: 136, fontWeight: 800, color: couleur, marginTop: 28, letterSpacing: -4, lineHeight: 1.15 }}>{eur(resultat)}</div>
        <div style={{ display: "flex", fontSize: 34, color: "#8b97a4", marginTop: 4, marginBottom: 36 }}>résultat des paris du mois</div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between" }}>
          <Case label="Paris réglés" valeur={String(ligne?.paris ?? 0)} />
          <Case label="Réussite" valeur={ligne ? `${Math.round(ligne.reussite * 100)} %` : "—"} />
          <Case label="ROI" valeur={ligne ? `${ligne.roi >= 0 ? "+" : "−"}${Math.abs(ligne.roi * 100).toFixed(1).replace(".", ",")} %` : "—"} c={ligne ? (ligne.roi >= 0 ? "#34d399" : "#f87171") : undefined} />
          <Case label="Plus grosse perte" valeur={pire < 0 ? eur(pire) : "aucune"} c={pire < 0 ? "#f87171" : undefined} />
          <Case label="Plus grosse baisse" valeur={baisse.montant > 0 ? eur(-baisse.montant) : "aucune"} c={baisse.montant > 0 ? "#f87171" : undefined} />
          <Case label="Pire série de pertes" valeur={`${s.pertesMax} d'affilée`} />
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#8b97a4", marginTop: 4, marginBottom: 28 }}>{`Depuis le début : ${eur(depuisDebut)}`}</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", fontSize: 22, color: "#5d6875", lineHeight: 1.4 }}>
          <div style={{ display: "flex" }}>{"Journal complet et vérifiable dans l'onglet Résultats de Pilote. Les résultats passés ne préjugent pas des résultats futurs."}</div>
          <div style={{ display: "flex" }}>Interdit aux moins de 18 ans. Jouer comporte des risques : endettement, isolement, dépendance. Pour être aidé : 09 74 75 13 13 (appel non surtaxé).</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, headers: { "Cache-Control": "no-store" } },
  );
}
