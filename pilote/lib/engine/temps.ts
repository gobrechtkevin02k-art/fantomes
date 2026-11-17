// Heures locales dans un fuseau donné (le serveur tourne en UTC, l'utilisateur vit à Paris).

export const FUSEAU_DEFAUT = "Europe/Paris";

export interface Parties {
  annee: number;
  mois: number;
  jour: number;
  heure: number;
  minute: number;
  seconde: number;
  jourSemaine: number; // 0 = dimanche
}

const formats = new Map<string, Intl.DateTimeFormat>();

function format(tz: string): Intl.DateTimeFormat {
  let f = formats.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        weekday: "short",
      });
    } catch {
      f = format(tz === FUSEAU_DEFAUT ? "UTC" : FUSEAU_DEFAUT);
    }
    formats.set(tz, f);
  }
  return f;
}

const JOURS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function parties(t: number, tz = FUSEAU_DEFAUT): Parties {
  const p: Record<string, string> = {};
  for (const x of format(tz).formatToParts(new Date(t))) p[x.type] = x.value;
  return {
    annee: Number(p.year),
    mois: Number(p.month),
    jour: Number(p.day),
    heure: Number(p.hour) % 24,
    minute: Number(p.minute),
    seconde: Number(p.second),
    jourSemaine: JOURS.indexOf(p.weekday),
  };
}

/** Décalage (ms) entre l'heure locale du fuseau et UTC à l'instant t. */
export function decalage(t: number, tz = FUSEAU_DEFAUT): number {
  const p = parties(t, tz);
  return Date.UTC(p.annee, p.mois - 1, p.jour, p.heure, p.minute, p.seconde) - Math.floor(t / 1000) * 1000;
}

/** Instant correspondant à hh:mm (heure locale) le même jour local que t. */
export function aHeure(t: number, tz: string, h: number, m = 0): number {
  const p = parties(t, tz);
  return Date.UTC(p.annee, p.mois - 1, p.jour, h, m, 0) - decalage(t, tz);
}

export const debutJour = (t: number, tz = FUSEAU_DEFAUT) => aHeure(t, tz, 0, 0);

export function cleJour(t: number, tz = FUSEAU_DEFAUT): string {
  const p = parties(t, tz);
  return `${p.annee}-${String(p.mois).padStart(2, "0")}-${String(p.jour).padStart(2, "0")}`;
}

export function hhmm(t: number, tz = FUSEAU_DEFAUT): string {
  const p = parties(t, tz);
  return `${p.heure}h${String(p.minute).padStart(2, "0")}`;
}

const NOMS_JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** « aujourd'hui », « demain » ou le nom du jour. */
export function jourRelatif(t: number, maintenant: number, tz = FUSEAU_DEFAUT): string {
  const ecart = Math.round((debutJour(t, tz) - debutJour(maintenant, tz)) / 86_400_000);
  if (ecart === 0) return "aujourd'hui";
  if (ecart === 1) return "demain";
  if (ecart === -1) return "hier";
  return NOMS_JOURS[parties(t, tz).jourSemaine];
}
