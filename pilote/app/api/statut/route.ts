import { NextResponse } from "next/server";
import { cleApi } from "@/lib/oddsapi";
import { iaConfiguree, MODELE_ANALYSE } from "@/lib/serveur/analyste";
import { pushConfigure } from "@/lib/serveur/push";
import { stockage } from "@/lib/serveur/stockage";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    cotes: cleApi() ? "live" : "demo",
    ia: iaConfiguree(),
    modeleIA: MODELE_ANALYSE,
    stockage: stockage().type,
    push: pushConfigure(),
    cron: !!process.env.CRON_SECRET,
  });
}
