// Stockage clé-valeur côté serveur, pour la synchronisation, les notifications et le cache des analyses.
// - Upstash Redis (REST) si UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (ou KV_REST_API_URL / KV_REST_API_TOKEN) sont définis ;
// - sinon un fichier JSON local (.data/pilote.json) quand l'application tourne sur un serveur classique ;
// - sinon (Vercel sans Redis) une simple mémoire, perdue à chaque redémarrage.

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

export type TypeStockage = "redis" | "fichier" | "memoire";

interface Stockage {
  type: TypeStockage;
  get<T>(cle: string): Promise<T | null>;
  set(cle: string, valeur: unknown, ttlSecondes?: number): Promise<void>;
  del(cle: string): Promise<void>;
  ajouterAEnsemble(cle: string, membre: string): Promise<void>;
  membres(cle: string): Promise<string[]>;
}

function redis(url: string, jeton: string): Stockage {
  const cmd = async <T>(...args: (string | number)[]): Promise<T> => {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    const j = (await res.json()) as { result?: T; error?: string };
    if (!res.ok || j.error) throw new Error(`Redis : ${j.error ?? res.status}`);
    return j.result as T;
  };
  return {
    type: "redis",
    async get<T>(cle: string) {
      const v = await cmd<string | null>("GET", cle);
      return v === null ? null : (JSON.parse(v) as T);
    },
    async set(cle, valeur, ttl) {
      const v = JSON.stringify(valeur);
      if (ttl) await cmd("SET", cle, v, "EX", Math.ceil(ttl));
      else await cmd("SET", cle, v);
    },
    async del(cle) {
      await cmd("DEL", cle);
    },
    async ajouterAEnsemble(cle, membre) {
      await cmd("SADD", cle, membre);
    },
    async membres(cle) {
      return (await cmd<string[] | null>("SMEMBERS", cle)) ?? [];
    },
  };
}

interface Entree {
  v: unknown;
  exp?: number;
}

function local(type: "fichier" | "memoire"): Stockage {
  const fichier = path.join(process.cwd(), ".data", "pilote.json");
  let donnees: Record<string, Entree> | null = null;
  let ecriture: Promise<void> = Promise.resolve();

  const charger = async () => {
    if (donnees) return donnees;
    donnees = {};
    if (type === "fichier") {
      try {
        donnees = JSON.parse(await fs.readFile(fichier, "utf8")) as Record<string, Entree>;
      } catch {
        donnees = {};
      }
    }
    return donnees;
  };
  const sauver = () => {
    if (type !== "fichier") return Promise.resolve();
    ecriture = ecriture.then(async () => {
      await fs.mkdir(path.dirname(fichier), { recursive: true });
      const tmp = `${fichier}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(donnees));
      await fs.rename(tmp, fichier);
    });
    return ecriture;
  };
  const lire = async (cle: string): Promise<unknown> => {
    const d = await charger();
    const e = d[cle];
    if (!e) return null;
    if (e.exp && e.exp < Date.now()) {
      delete d[cle];
      return null;
    }
    return e.v;
  };
  return {
    type,
    async get<T>(cle: string) {
      return ((await lire(cle)) as T) ?? null;
    },
    async set(cle, valeur, ttl) {
      const d = await charger();
      d[cle] = { v: valeur, ...(ttl ? { exp: Date.now() + ttl * 1000 } : {}) };
      await sauver();
    },
    async del(cle) {
      const d = await charger();
      delete d[cle];
      await sauver();
    },
    async ajouterAEnsemble(cle, membre) {
      const d = await charger();
      const actuel = ((d[cle]?.v as string[]) ?? []).filter((m) => m !== membre);
      d[cle] = { v: [...actuel, membre] };
      await sauver();
    },
    async membres(cle) {
      return ((await lire(cle)) as string[]) ?? [];
    },
  };
}

let instance: Stockage | null = null;

export function stockage(): Stockage {
  if (instance) return instance;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const jeton = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && jeton) instance = redis(url.replace(/\/$/, ""), jeton);
  else instance = local(process.env.VERCEL ? "memoire" : "fichier");
  return instance;
}

/** Le stockage survit-il aux redémarrages ? (nécessaire pour les notifications programmées) */
export const stockagePersistant = () => stockage().type !== "memoire";

export const cleProfil = (id: string) => /^[a-zA-Z0-9-]{8,64}$/.test(id);
