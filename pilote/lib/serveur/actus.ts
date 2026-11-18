// Fil d'actualités : publications de l'administrateur et bilans automatiques du compte public.

import "server-only";
import type { Actu } from "../actus";
import { titreBilan } from "../actus";
import type { EtatApp } from "../types";
import { calculerBankroll } from "../engine/bankroll";
import { cleJour, parties } from "../engine/temps";
import { eur, eurSigne } from "../format";
import { offreDe } from "./abonnements";
import { envoyer } from "./push";
import { CLE_SUIVEURS, profilPublic } from "./public";
import { stockage } from "./stockage";

export const CLE_ACTUS = "actus";
const MAX_ACTUS = 300;

export async function listerActus(): Promise<Actu[]> {
  return (await stockage().get<Actu[]>(CLE_ACTUS)) ?? [];
}

async function telegram(a: Actu, origine: string) {
  const jeton = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const canal = process.env.TELEGRAM_CANAL?.trim();
  if (!jeton || !canal) return;
  const texte = `${a.titre}\n\n${a.texte}\n\nRésultats complets et vérifiables : ${origine}/resultats\n18+ · Jouer comporte des risques. 09 74 75 13 13`;
  try {
    if (a.image) {
      await fetch(`https://api.telegram.org/bot${jeton}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: canal, photo: `${origine}${a.image}`, caption: texte.slice(0, 1024) }),
        signal: AbortSignal.timeout(10_000),
      });
    } else {
      await fetch(`https://api.telegram.org/bot${jeton}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: canal, text: texte, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(10_000),
      });
    }
  } catch {
    /* Telegram indisponible : la publication reste dans le fil */
  }
}

/** Publie une actualité : fil, notification aux abonnés qui suivent le compte (offres payantes), canal Telegram. */
export async function publier(a: Actu, origine: string): Promise<number> {
  const st = stockage();
  await st.set(CLE_ACTUS, [a, ...(await listerActus())].slice(0, MAX_ACTUS));
  let envois = 0;
  for (const id of await st.membres(CLE_SUIVEURS)) {
    if (id === profilPublic()) continue;
    const { offre } = await offreDe(id);
    if (offre === "decouverte") continue;
    envois += await envoyer(id, { titre: a.titre, texte: a.texte.slice(0, 180), url: "/actus", tag: `actu-${a.id}` });
  }
  await telegram(a, origine);
  return envois;
}

export async function supprimerActu(id: string) {
  await stockage().set(
    CLE_ACTUS,
    (await listerActus()).filter((a) => a.id !== id),
  );
}

/**
 * Bilan du jour automatique, à partir des paris réglés du compte public (données du journal, pas d'une capture).
 * Une fois par jour, après 22 h (heure de Paris), s'il y a eu des paris réglés dans la journée.
 */
export function bilanDuJour(etat: EtatApp, maintenant: number): Actu | null {
  const tz = "Europe/Paris";
  if (parties(maintenant, tz).heure < 22) return null;
  const jour = cleJour(maintenant, tz);
  const regles = etat.paris.filter((p) => !p.demo && p.statut !== "en_cours" && p.regleLe && cleJour(Date.parse(p.regleLe), tz) === jour);
  if (!regles.length) return null;
  const gagnes = regles.filter((p) => p.statut === "gagne").length;
  const perdus = regles.filter((p) => p.statut === "perdu").length;
  const net = Math.round(regles.reduce((t, p) => t + (p.gain ?? 0) - p.mise, 0) * 100) / 100;
  const mises = Math.round(regles.reduce((t, p) => t + p.mise, 0) * 100) / 100;
  const bilan = { gagnes, perdus, enCours: 0, mises, net };
  const lignes = regles.map((p) => {
    const nom = p.jambes.length > 1 ? `Combiné de ${p.jambes.length} sélections` : p.jambes[0]?.label ?? "Pari";
    return `• ${nom} à ${p.cote.toFixed(2).replace(".", ",")} : ${eurSigne((p.gain ?? 0) - p.mise)}`;
  });
  return {
    id: `bilan-${jour}`,
    t: new Date(maintenant).toISOString(),
    type: "bilan_auto",
    titre: `Bilan du jour · ${titreBilan(bilan)}`,
    texte: `${lignes.join("\n")}\nBankroll du compte : ${eur(calculerBankroll(etat).total)}. Chiffres tirés du journal public, vérifiables dans Résultats.`,
    bilan,
    auto: true,
  };
}

export async function publierBilanDuJour(maintenant: number, origine: string): Promise<boolean> {
  const id = profilPublic();
  if (!id) return false;
  const etat = await stockage().get<EtatApp>(`etat:${id}`);
  const a = etat ? bilanDuJour(etat, maintenant) : null;
  if (!a || (await listerActus()).some((x) => x.id === a.id)) return false;
  await publier(a, origine);
  return true;
}
