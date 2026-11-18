import { NextResponse } from "next/server";
import { cloturesPour } from "@/lib/serveur/clv";

export const dynamic = "force-dynamic";

/** Cotes de clôture des sélections demandées (données de marché, sans information personnelle). */
export async function POST(req: Request) {
  const c = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(c.ids) ? c.ids.filter((x): x is string => typeof x === "string" && x.length < 300).slice(0, 1000) : [];
  return NextResponse.json({ clotures: await cloturesPour(ids) });
}
