// Ancrage externe du journal : une fois par jour, l'empreinte de la dernière entrée est publiée
// hors du serveur de Pilote, là où elle ne peut plus être modifiée :
// - OpenTimestamps (gratuit) : l'empreinte est horodatée puis inscrite dans la blockchain Bitcoin ;
// - un canal Telegram public (facultatif) : un message daté que tout le monde peut consulter.

import "server-only";
import type { Ancrage, Evenement } from "../transparence";
import { sha256 } from "../transparence";
import { cleJour } from "../engine/temps";
import { CLE_JOURNAL } from "./public";
import { stockage } from "./stockage";

export const CLE_ANCRAGES = "ancrages:public";
const CALENDRIERS = ["https://a.pool.opentimestamps.org", "https://b.pool.opentimestamps.org"];
// En-tête d'un fichier de preuve OpenTimestamps (format « detached timestamp »), version 1, opération SHA-256.
const ENTETE_OTS = Buffer.concat([
  Buffer.from([0x00]),
  Buffer.from("OpenTimestamps"),
  Buffer.from([0x00, 0x00]),
  Buffer.from("Proof"),
  Buffer.from([0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94, 0x01, 0x08]),
]);

/** Le fichier horodaté est un texte contenant l'empreinte du journal ; la preuve porte sur son SHA-256. */
export const texteAncre = (a: Pick<Ancrage, "jour" | "n" | "hash">) => `Pilote — journal public au ${a.jour}, entrée n°${a.n}\nEmpreinte SHA-256 : ${a.hash}\n`;

async function horodater(texte: string): Promise<Buffer | null> {
  const digest = Buffer.from(await sha256(texte), "hex");
  for (const url of CALENDRIERS) {
    try {
      const res = await fetch(`${url}/digest`, {
        method: "POST",
        headers: { Accept: "application/vnd.opentimestamps.v1", "Content-Type": "application/x-www-form-urlencoded" },
        body: digest,
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return Buffer.concat([ENTETE_OTS, digest, Buffer.from(await res.arrayBuffer())]);
    } catch {
      /* calendrier indisponible : on essaie le suivant */
    }
  }
  return null;
}

async function publierTelegram(texte: string): Promise<string | undefined> {
  const jeton = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const canal = process.env.TELEGRAM_CANAL?.trim();
  if (!jeton || !canal) return undefined;
  try {
    const res = await fetch(`https://api.telegram.org/bot${jeton}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: canal, text: texte, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    const d = (await res.json()) as { ok: boolean; result?: { message_id: number } };
    if (d.ok && d.result && canal.startsWith("@")) return `https://t.me/${canal.slice(1)}/${d.result.message_id}`;
  } catch {
    /* publication impossible aujourd'hui */
  }
  return undefined;
}

/** Ancre le journal si de nouvelles entrées sont arrivées depuis le dernier ancrage (au plus une fois par jour). */
export async function ancrerSiBesoin(maintenant: number): Promise<Ancrage | null> {
  const st = stockage();
  const journal = (await st.get<Evenement[]>(CLE_JOURNAL)) ?? [];
  if (!journal.length) return null;
  const ancrages = (await st.get<Ancrage[]>(CLE_ANCRAGES)) ?? [];
  const jour = cleJour(maintenant, "Europe/Paris");
  const dernier = journal[journal.length - 1];
  if (ancrages.some((a) => a.jour === jour) || ancrages[ancrages.length - 1]?.n === dernier.n) return null;

  const base = { jour, n: dernier.n, hash: dernier.hash };
  const texte = texteAncre(base);
  const [ots, telegram] = await Promise.all([horodater(texte), publierTelegram(texte)]);
  if (ots) await st.set(`ancrage-ots:${jour}`, ots.toString("base64"));
  const a: Ancrage = { ...base, t: new Date(maintenant).toISOString(), ...(ots ? { ots: true } : {}), ...(telegram ? { telegram } : {}) };
  await st.set(CLE_ANCRAGES, [...ancrages, a]);
  return a;
}
