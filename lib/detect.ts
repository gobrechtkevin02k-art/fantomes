export type Prelevement = { nom: string; mensuel: number; annuel: number; dernier: string; actif: boolean; essentiel: boolean };
type Ligne = { date: string; libelle: string; montant: number };

const sansAccent = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function decouperLigne(l: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (c === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === sep && !q) { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function nombre(s: string | undefined): number | null {
  if (!s) return null;
  let t = s.replace(/[\s\u00a0€]|EUR/gi, "");
  if (!t) return null;
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function dateIso(s: string | undefined): string | null {
  if (!s) return null;
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4}|\d{2})/);
  if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

export function lireReleve(texte: string): Ligne[] | { erreur: string } {
  const lignes = texte.replace(/^\uFEFF/, "").split(/\r?\n/);
  const hi = lignes.findIndex((l) => {
    const n = sansAccent(l.toLowerCase());
    return n.includes("date") && /libelle|label|description|intitule|operation|detail/.test(n) && /montant|debit|amount/.test(n);
  });
  if (hi < 0) return { erreur: "Je ne reconnais pas ce fichier. Il faut un export CSV avec au moins une date, un libellé et un montant." };
  const h = lignes[hi];
  const sep = [";", "\t", ","].sort((a, b) => h.split(b).length - h.split(a).length)[0];
  const cols = decouperLigne(h, sep).map((c) => sansAccent(c.toLowerCase()));
  const iDate = cols.findIndex((c) => c.includes("date"));
  const iLib = cols.findIndex((c) => !c.includes("date") && /libelle|label|description|intitule|detail|operation/.test(c));
  const iMont = cols.findIndex((c) => /^montant|amount/.test(c));
  const iDeb = cols.findIndex((c) => c.includes("debit"));
  const iCre = cols.findIndex((c) => c.includes("credit"));
  const res: Ligne[] = [];
  for (const l of lignes.slice(hi + 1)) {
    if (!l.trim()) continue;
    const c = decouperLigne(l, sep);
    const date = dateIso(c[iDate]);
    let montant = iMont >= 0 ? nombre(c[iMont]) : null;
    if (montant === null && iDeb >= 0) { const d = nombre(c[iDeb]); if (d !== null && d !== 0) montant = -Math.abs(d); }
    if (montant === null && iCre >= 0) montant = nombre(c[iCre]);
    if (!date || montant === null) continue;
    res.push({ date, libelle: c[iLib] ?? "", montant });
  }
  if (res.length === 0) return { erreur: "Le fichier est lisible, mais je n'y trouve aucune opération. Vérifie qu'il n'est pas vide." };
  return res;
}

const BRUIT = /\b(PRLV|PRELEVEMENT|PRELEV|SEPA|CB|CARTE|PAIEMENT|PAIEM|ACHAT|VIR|VIREMENT|REF|ECH|ECHEANCE|MANDAT|ID|NUM|FACT|FACTURE|DU|DE|LE|LA|PAR|DEBIT|WWW|COM|FR|EUR)\b/g;

function cle(lib: string): string {
  const s = sansAccent(lib.toUpperCase())
    .replace(/\d{1,2}[\/.]\d{1,2}([\/.]\d{2,4})?/g, " ")
    .replace(/[0-9*#_\-.:\/]+/g, " ")
    .replace(BRUIT, " ").replace(/\s+/g, " ").trim();
  return s.split(" ").filter((w) => w.length > 1).slice(0, 2).join(" ");
}

const ESSENTIEL = /\b(LOYER|BAIL|AGENCE|IMMOBILIER|SYNDIC|COPRO|ASSURANCE|ASSUR|MUTUELLE|MAIF|MACIF|MAAF|AXA|ALLIANZ|GROUPAMA|CREDIT|PRET|EMPRUNT|ECHEANCE|EDF|ENGIE|ENERGIE|ELECTRICITE|GAZ|EAU|IMPOT|IMPOTS|DGFIP|TRESOR|URSSAF|CAF|CPAM|CRECHE|CANTINE)\b/;
const mediane = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const jours = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function detecter(lignes: Ligne[]): Prelevement[] {
  const fin = lignes.reduce((m, l) => (l.date > m ? l.date : m), "0000-00-00");
  const groupes = new Map<string, Ligne[]>();
  for (const l of lignes) {
    if (l.montant >= 0) continue;
    const k = cle(l.libelle);
    if (!k) continue;
    groupes.set(k, [...(groupes.get(k) ?? []), l]);
  }
  const out: Prelevement[] = [];
  for (const [k, items] of groupes) {
    items.sort((a, b) => a.date.localeCompare(b.date));
    const mois = new Set(items.map((i) => i.date.slice(0, 7)));
    if (mois.size < 3 || items.length > mois.size * 1.5) continue;
    const montants = items.map((i) => Math.abs(i.montant));
    const med = mediane(montants);
    if (montants.filter((m) => Math.abs(m - med) <= med * 0.25).length < montants.length * 0.6) continue;
    const ecarts: number[] = [];
    for (let i = 1; i < items.length; i++) ecarts.push(jours(items[i - 1].date, items[i].date));
    const e = mediane(ecarts);
    if (e < 24 || e > 38) continue;
    const dernier = items[items.length - 1].date;
    out.push({
      nom: k.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()),
      mensuel: med, annuel: med * 12, dernier,
      actif: jours(dernier, fin) <= 45,
      essentiel: ESSENTIEL.test(k),
    });
  }
  return out.filter((p) => p.actif).sort((a, b) => b.annuel - a.annuel);
}

export function exemple(): string {
  const l = ["Date;Libellé;Montant"];
  const mois = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  const f = (n: number) => n.toFixed(2).replace(".", ",");
  mois.forEach((m, i) => {
    const d = (j: string) => `${j}/${m.slice(5)}/${m.slice(0, 4)}`;
    l.push(`${d("01")};VIR SALAIRE ENTREPRISE;2100,00`);
    l.push(`${d("03")};PRLV SEPA LOYER AGENCE 4471;-780,00`);
    l.push(`${d("05")};PRLV SEPA STREAMING PLUS 88231;-13,99`);
    l.push(`${d("07")};CB APPLI SPORT PREMIUM 0${i + 1}12;-9,99`);
    l.push(`${d("12")};PRLV CLOUD 200 GO REF${i}9;-2,99`);
    l.push(`${d("15")};CB SUPERMARCHE CENTRE ${i}2;-${f(40 + i * 17)}`);
    l.push(`${d("21")};CB SUPERMARCHE CENTRE ${i}8;-${f(22 + i * 9)}`);
    if (i < 3) l.push(`${d("09")};PRLV ESSAI MUSIQUE;-4,99`);
  });
  return l.join("\n");
}
