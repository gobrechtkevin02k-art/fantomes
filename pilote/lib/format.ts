// Mise en forme française des montants, cotes, pourcentages et dates.

export const eur = (x: number, decimales = 2) =>
  (Number.isFinite(x) ? x : 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: decimales, maximumFractionDigits: decimales });

export const eurSigne = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${eur(Math.abs(x))}`;

export const pct = (x: number, decimales = 1) => `${(x * 100).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: decimales })} %`;

export const pctSigne = (x: number, decimales = 1) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${pct(Math.abs(x), decimales)}`;

export const cote = (x: number) => {
  if (!Number.isFinite(x)) return "—";
  if (x >= 1000) return Math.round(x).toLocaleString("fr-FR");
  if (x >= 100) return x.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  return x.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const nombre = (x: number, d = 0) => x.toLocaleString("fr-FR", { maximumFractionDigits: d });

export function dateMatch(iso: string, maintenant = Date.now()): string {
  const d = new Date(iso);
  const auj = new Date(maintenant);
  const demain = new Date(maintenant + 86_400_000);
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === auj.toDateString()) return `Aujourd'hui · ${heure}`;
  if (d.toDateString() === demain.toDateString()) return `Demain · ${heure}`;
  const jour = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} · ${heure}`;
}

export function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function dateLongue(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function depuis(iso: string, maintenant = Date.now()): string {
  const m = Math.round((maintenant - Date.parse(iso)) / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

export function dansCombien(iso: string, maintenant = Date.now()): string {
  const m = Math.round((Date.parse(iso) - maintenant) / 60_000);
  if (m < 60) return `dans ${Math.max(m, 0)} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `dans ${h} h`;
  return `dans ${Math.round(h / 24)} j`;
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
