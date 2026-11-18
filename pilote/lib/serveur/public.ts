// Compte public : le profil désigné par PILOTE_PROFIL_PUBLIC alimente l'onglet Résultats.

import "server-only";
import type { EtatApp } from "../types";
import { chainer, differences, type EvenementBrut, type Evenement } from "../transparence";
import { calculerBankroll, statistiques } from "../engine/bankroll";
import { droitsDe } from "../offres";
import { cote, eur, eurSigne } from "../format";
import { offreDe } from "./abonnements";
import { envoyer } from "./push";
import { stockage } from "./stockage";

export const profilPublic = () => process.env.PILOTE_PROFIL_PUBLIC?.trim() || "";
export const estPublic = (id: string) => !!profilPublic() && id === profilPublic();

export const CLE_JOURNAL = "journal:public";
export const CLE_SYNCHRO = "public:derniere-synchro";
export const CLE_SUIVEURS = "suiveurs:public";

/** À appeler avant d'enregistrer une nouvelle version du compte public : ajoute les différences au journal. */
export async function journaliser(nouvel: EtatApp, precedent: EtatApp | null): Promise<EvenementBrut[]> {
  const st = stockage();
  const maintenant = Date.now();
  const journal = (await st.get<Evenement[]>(CLE_JOURNAL)) ?? [];
  // Si le journal est vide, on l'ouvre à partir de l'état complet, même si un état existait déjà.
  const ev = differences(journal.length ? precedent : null, nouvel, maintenant);
  if (ev.length) await st.set(CLE_JOURNAL, await chainer(journal, ev, maintenant));
  await st.set(CLE_SYNCHRO, new Date(maintenant).toISOString());
  return ev;
}

/** Prévient les abonnés qui suivent le compte public : nouveau pari et résultat (offres payantes). */
export async function diffuser(evenements: EvenementBrut[], etat: EtatApp): Promise<number> {
  const utiles = evenements.filter((e) => !e.d.anterieur && (e.type === "pari_place" || e.type === "pari_regle") && e.d.pari);
  if (!utiles.length) return 0;
  const suiveurs = (await stockage().membres(CLE_SUIVEURS)).filter((id) => id !== profilPublic());
  if (!suiveurs.length) return 0;
  const bilan = statistiques(etat.paris.filter((p) => !p.demo)).profit;
  const total = calculerBankroll(etat).total;
  let envois = 0;
  for (const id of suiveurs) {
    const { offre } = await offreDe(id);
    if (!droitsDe(offre).notifMatin) continue; // réservé aux offres payantes
    for (const e of utiles) {
      const p = e.d.pari!;
      const nom = p.selections.length > 1 ? `Combiné de ${p.selections.length} sélections` : p.selections[0].label;
      const notif =
        e.type === "pari_place"
          ? {
              titre: "📣 Nouveau pari sur le compte public",
              texte: `${nom} (${p.selections.map((s) => s.match).join(", ")}) à ${cote(p.cote)}, mise ${eur(p.mise)}, indice ${p.confiance}.`,
              url: "/resultats",
              tag: `public-${p.id}`,
            }
          : {
              titre: `${p.statut === "gagne" ? "✅" : p.statut === "perdu" ? "❌" : "↩️"} Compte public : ${eurSigne((p.gain ?? 0) - p.mise)}`,
              texte: `${nom} à ${cote(p.cote)}. Résultat des paris depuis le début : ${eurSigne(bilan)}. Bankroll : ${eur(total)}.`,
              url: "/resultats",
              tag: `public-resultat-${p.id}`,
            };
      envois += await envoyer(id, notif);
    }
  }
  return envois;
}
