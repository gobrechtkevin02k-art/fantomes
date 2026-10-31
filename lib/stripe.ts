import Stripe from "stripe";
import { createHmac, timingSafeEqual } from "crypto";

export const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export const COOKIE = "fantomes_acces";
const signature = (id: string) => createHmac("sha256", process.env.STRIPE_SECRET_KEY ?? "").update(id).digest("hex");
export const signer = (id: string) => `${id}.${signature(id)}`;

export function lireCookie(v?: string): string | null {
  if (!v) return null;
  const i = v.lastIndexOf(".");
  const id = v.slice(0, i), s = v.slice(i + 1);
  const a = Buffer.from(signature(id)), b = Buffer.from(s);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

export const idValide = (id: string) => /^cs_(test|live)_[A-Za-z0-9]+$/.test(id);

// Vérification côté serveur, directement auprès de Stripe : jamais sur la seule redirection.
export async function sessionPayee(id: string): Promise<{ ok: boolean; mode?: string }> {
  const s = await getStripe().checkout.sessions.retrieve(id, { expand: ["subscription"] });
  if (s.status !== "complete" || s.payment_status !== "paid") return { ok: false };
  if (s.mode === "subscription") {
    const sub = s.subscription as { status: string } | null;
    return { ok: !!sub && ["active", "trialing"].includes(sub.status), mode: s.mode };
  }
  return { ok: true, mode: s.mode };
}
