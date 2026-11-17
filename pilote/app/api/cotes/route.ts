import { NextResponse } from "next/server";
import { coteDemo } from "@/lib/demo";
import { cleApi, cleSportValide, cotesLive, quota } from "@/lib/oddsapi";
import type { MarketKey, OddsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const MARCHES: MarketKey[] = ["h2h", "totals", "spreads"];

export async function GET(req: Request) {
  const u = new URL(req.url);
  const sports = (u.searchParams.get("sports") ?? "").split(",").filter(cleSportValide).slice(0, 20);
  const marches = (u.searchParams.get("markets") ?? "h2h").split(",").filter((m): m is MarketKey => MARCHES.includes(m as MarketKey));
  const forceDemo = u.searchParams.get("demo") === "1";

  if (!cleApi() || forceDemo) {
    const body: OddsResponse = { source: "demo", fetchedAt: new Date().toISOString(), events: coteDemo(sports), quota: { remaining: null, used: null }, errors: [] };
    return NextResponse.json(body);
  }

  const errors: string[] = [];
  const resultats = await Promise.all(
    sports.map((s) =>
      cotesLive(s, marches.length ? marches : ["h2h"]).catch((e: Error) => {
        errors.push(`${s} : ${e.message}`);
        return [];
      }),
    ),
  );
  const body: OddsResponse = {
    source: "live",
    fetchedAt: new Date().toISOString(),
    events: resultats.flat().sort((a, b) => a.commence.localeCompare(b.commence)),
    quota: quota(),
    errors,
  };
  return NextResponse.json(body);
}
