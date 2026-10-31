"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { CONTACT, PORTAIL, type Plan } from "@/lib/offres";

const eur = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formules: { id: Plan; nom: string; prix: string; detail: string; jour: string }[] = [
  { id: "unique", nom: "Audit complet", prix: "19 €", detail: "une seule fois", jour: "Paiement unique" },
  { id: "mensuel", nom: "Suivi mensuel", prix: "9 €", detail: "par mois", jour: "soit 0,30 € par jour" },
  { id: "annuel", nom: "Suivi annuel", prix: "79 €", detail: "par an", jour: "soit 0,22 € par jour" },
];

const faq = [
  ["Est-ce que ça marche pour mon cas ?", "Si ta banque te laisse exporter un CSV et que tu as au moins 3 mois de relevé, oui. Fantômes repère les prélèvements mensuels réguliers. Les abonnements annuels ne sont pas détectés. Si ta liste ne t'apporte rien, tu es remboursé (voir la garantie)."],
  ["Combien de temps ça me prend ?", "Quelques minutes : tu déposes le fichier, tu lis la liste, tu copies les lettres de résiliation des abonnements que tu n'utilises plus."],
  ["Et si je veux arrêter ?", `Tu te connectes au portail de gestion avec ton email (lien sous le paiement et dans le pied de page) et tu résilies toi-même en deux clics, avant le prélèvement suivant, sans préavis ni justificatif. En cas de souci, écris à ${CONTACT}. L'audit complet est un paiement unique, il n'y a rien à résilier.`],
  ["À quoi sert exactement ce que je paie ?", "À débloquer la liste complète de tes prélèvements, une lettre de résiliation prête à envoyer pour chacun, et le total économisé sur l'année. Ton relevé reste sur ton appareil."],
];

export default function Offre() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>("mensuel");
  const [secret, setSecret] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  const [total, setTotal] = useState<number | null>(null);
  const [nb, setNb] = useState(0);
  const stripe = useMemo(() => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""), []);

  useEffect(() => {
    try {
      const l = JSON.parse(sessionStorage.getItem("fantomes_liste") ?? "null") as { annuel: number }[] | null;
      if (l?.length) { setTotal(l.reduce((s, p) => s + p.annuel, 0)); setNb(l.length); }
    } catch {}
  }, []);

  useEffect(() => {
    let annule = false;
    setSecret(null); setErreur("");
    fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) })
      .then((r) => r.json())
      .then((d) => { if (annule) return; if (d.clientSecret) setSecret(d.clientSecret); else setErreur(d.erreur ?? "Le paiement est momentanément indisponible."); })
      .catch(() => !annule && setErreur("Le paiement est momentanément indisponible. Réessaie dans un instant."));
    return () => { annule = true; };
  }, [plan]);

  async function apresPaiement() {
    const id = secret?.split("_secret_")[0];
    if (!id) return;
    await fetch("/api/acces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: id }) });
    router.push("/releve");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-6">
      <Link href="/releve" className="inline-block py-2 pr-4 underline underline-offset-4">Retour à ma liste</Link>

      <h1 className="mt-6 font-serif text-4xl font-extrabold leading-tight">
        {total !== null ? "Voilà ta liste, prête." : "Ta liste est prête quand tu l'es."}
      </h1>
      {total !== null ? (
        <p className="chiffre mt-4">
          {nb} prélèvements réguliers repérés dans ton relevé, pour <strong>{eur(total)} € par an</strong>. Il te reste à les débloquer, et à résilier ceux que tu n'utilises plus.
        </p>
      ) : (
        <p className="mt-4">Dépose d'abord ton relevé : <Link href="/releve" className="underline underline-offset-4">retrouver mes prélèvements</Link>.</p>
      )}
      <p className="mt-3 border-l-4 border-braise pl-3 font-semibold">Satisfait ou remboursé pendant 14 jours.</p>

      {total !== null && (
        <p className="chiffre mt-6 bg-sable p-4">
          Le suivi coûte <strong>0,30 € par jour</strong>. Un seul abonnement oublié résilié te rend son montant annuel, chaque année.
        </p>
      )}

      <h2 className="mt-10 font-serif text-2xl font-semibold">Choisis ta formule</h2>
      <div className="mt-4 grid gap-3">
        {formules.map((f) => {
          const actif = plan === f.id;
          return (
            <button key={f.id} aria-pressed={actif} onClick={() => setPlan(f.id)}
              className={`flex items-center justify-between gap-3 border-2 border-encre p-4 text-left ${actif ? "bg-braise" : "bg-creme"} ${f.id === "mensuel" ? "border-4" : ""}`}>
              <span>
                <span className="block text-xl font-semibold">{f.nom}{f.id === "mensuel" && <span className="ml-2 text-sm font-semibold">Recommandé</span>}</span>
                <span className="chiffre text-base">{f.jour}</span>
              </span>
              <span className="chiffre font-serif text-3xl font-extrabold">{f.prix}<span className="block text-right font-sans text-sm font-normal">{f.detail}</span></span>
            </button>
          );
        })}
      </div>

      <section className="mt-8 border-2 border-encre p-5">
        <h2 className="font-serif text-2xl font-semibold">La garantie, en clair</h2>
        <p className="mt-2">
          Pendant 14 jours après ton paiement, tu écris à {CONTACT} avec l'adresse email utilisée pour payer, sans avoir à te justifier. Tu es remboursé de la totalité sous 5 jours ouvrés. Ta banque peut ensuite mettre quelques jours à l'afficher.
        </p>
      </section>

      <section className="mt-8">
        <p className="mb-3 font-semibold">
          {plan === "unique" ? "Paiement unique : rien à résilier." : "Sans engagement, résiliable à tout moment."}
        </p>
        {erreur && <p role="alert" className="border-2 border-braise p-4">{erreur}</p>}
        {!erreur && !secret && <p className="bg-sable p-4">Chargement du paiement sécurisé…</p>}
        {secret && (
          <EmbeddedCheckoutProvider key={secret} stripe={stripe} options={{ clientSecret: secret, onComplete: apresPaiement }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        )}
        <p className="mt-3 text-sm">Paiement sécurisé par Stripe. Fantômes ne voit jamais ton numéro de carte.</p>
        <p className="mt-3 text-base">Déjà abonné ? <a href={PORTAIL} className="underline underline-offset-4">Gérer ou résilier mon abonnement</a></p>
      </section>

      <section className="mt-12 pb-12">
        <h2 className="font-serif text-2xl font-semibold">Questions fréquentes</h2>
        <div className="mt-4 divide-y divide-encre/20 border-y border-encre/20">
          {faq.map(([q, r]) => (
            <details key={q} className="py-4">
              <summary className="cursor-pointer text-lg font-semibold">{q}</summary>
              <p className="mt-2 max-w-md">{r}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
