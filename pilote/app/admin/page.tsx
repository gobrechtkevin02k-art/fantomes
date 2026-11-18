"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Actu, LectureCapture, ResultatControle } from "@/lib/actus";
import { useStore } from "@/lib/store";
import { useDonnees } from "@/lib/donnees";
import { cote, eur, eurSigne, uid } from "@/lib/format";
import { compresserImage } from "@/components/Preuves";
import { CarteActu } from "@/components/Actus";
import { Badge, Bouton, Carte, Champ, Interrupteur, Titre, Vide } from "@/components/ui";
import { IcAlerte, IcJournal, IcValider } from "@/components/Icones";

const CLE_AUTO = "pilote:admin-auto:v1";
const STATUTS: Record<string, string> = { gagne: "Gagné", perdu: "Perdu", en_cours: "En cours", rembourse: "Remboursé", cashout: "Cash-out", inconnu: "Illisible" };

interface ReponseLecture {
  lecture: LectureCapture;
  controle: ResultatControle;
  image: string;
  empreinte: string;
  publie?: Actu;
  brouillon?: { titre: string; texte: string };
  paris?: Actu["paris"];
  erreur?: string;
}

function Capture({ onPublie }: { onPublie: () => void }) {
  const { etat, majParis } = useStore();
  const { notifier, statut } = useDonnees();
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [contexte, setContexte] = useState("");
  const [auto, setAuto] = useState(true);
  const [lecture, setLecture] = useState(false);
  const [r, setR] = useState<ReponseLecture | null>(null);
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [publication, setPublication] = useState(false);

  useEffect(() => {
    try {
      setAuto(localStorage.getItem(CLE_AUTO) !== "non");
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const choisir = (f: File | null) => {
    setFichier(f);
    setR(null);
    if (apercu) URL.revokeObjectURL(apercu);
    setApercu(f ? URL.createObjectURL(f) : null);
  };

  const lire = async () => {
    if (!fichier) return;
    setLecture(true);
    try {
      const image = await compresserImage(fichier);
      const res = await fetch("/api/admin/lecture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profilId: etat.profilId, image, contexte, auto }) });
      const d = (await res.json()) as ReponseLecture;
      if (!res.ok) throw new Error(d.erreur ?? `Erreur ${res.status}`);
      setR(d);
      if (d.publie) {
        notifier("Lecture sûre : message publié automatiquement.", "succes");
        onPublie();
      } else {
        setTitre(d.brouillon?.titre ?? "");
        setTexte(d.brouillon?.texte ?? "");
      }
    } catch (e) {
      notifier((e as Error).message, "alerte");
    } finally {
      setLecture(false);
    }
  };

  const publier = async () => {
    if (!r) return;
    setPublication(true);
    try {
      const res = await fetch("/api/actus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profilId: etat.profilId, type: "resultat", titre, texte, image: r.image, bilan: r.controle.controles.length ? r.controle.bilan : undefined, paris: r.paris }),
      });
      const d = (await res.json()) as { actu?: Actu; erreur?: string };
      if (!res.ok || !d.actu) throw new Error(d.erreur ?? "Publication impossible.");
      setR({ ...r, publie: d.actu });
      notifier("Publié dans les actualités.", "succes");
      onPublie();
    } catch (e) {
      notifier((e as Error).message, "alerte");
    } finally {
      setPublication(false);
    }
  };

  // Les paris reconnus dans le journal reçoivent la capture comme preuve Winamax.
  const correspondances = (r?.controle.controles ?? []).filter((c) => c.correspondance && etat.paris.some((p) => p.id === c.correspondance!.pariId && !p.preuve?.photo));
  const ajouterPreuves = () => {
    if (!r) return;
    const maj = correspondances
      .map((c) => {
        const p = etat.paris.find((x) => x.id === c.correspondance!.pariId)!;
        return { ...p, preuve: { ...(p.preuve ?? {}), ...(c.pari.numeroTicket ? { numero: c.pari.numeroTicket } : {}), photo: r.image, empreinte: r.empreinte, ajouteeLe: new Date().toISOString() } };
      });
    majParis(maj);
    notifier(`${maj.length} preuve${maj.length > 1 ? "s" : ""} ajoutée${maj.length > 1 ? "s" : ""} à tes paris.`, "succes");
  };

  return (
    <Carte accent="#34d399">
      <Titre sous="Envoie une capture Winamax (ticket, « Mes paris » ou historique) : l'IA la lit, vérifie les chiffres et prépare le message.">Publier un résultat</Titre>
      {statut && !statut.ia && (
        <p className="mb-3 flex gap-2 rounded-xl bg-alerte/10 p-3 text-[12px] text-alerte">
          <IcAlerte className="mt-0.5 shrink-0" />
          Lecture automatique indisponible (clé ANTHROPIC_API_KEY manquante) : tu pourras écrire le message toi-même, la capture sera jointe.
        </p>
      )}
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-doux">Capture d&apos;écran</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => choisir(e.target.files?.[0] ?? null)}
          className="block w-full text-[13px] text-doux file:mr-3 file:min-h-10 file:rounded-xl file:border-0 file:bg-surface-3 file:px-3 file:text-[13px] file:font-semibold file:text-texte"
        />
      </label>
      {apercu && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={apercu} alt="Aperçu de la capture" className="mt-3 max-h-64 w-full rounded-xl border border-ligne object-contain" />
      )}
      <Champ className="mt-3" label="Contexte (facultatif)" placeholder="ex. résultats de ce soir" value={contexte} onChange={(e) => setContexte(e.target.value)} />
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[14px] font-medium">Publier automatiquement quand la lecture est sûre</div>
          <div className="text-[12px] leading-relaxed text-doux">
            Lecture très nette et chiffres cohérents (gain = mise × cote) : publication immédiate. Au moindre doute, tu relis avant.
          </div>
        </div>
        <Interrupteur
          actif={auto}
          label="Publication automatique"
          onChange={(v) => {
            setAuto(v);
            try {
              localStorage.setItem(CLE_AUTO, v ? "oui" : "non");
            } catch {
              /* stockage indisponible */
            }
          }}
        />
      </div>
      <Bouton className="mt-4 w-full" couleur="#34d399" disabled={!fichier || lecture} onClick={lire}>
        {lecture ? "Lecture de la capture…" : "Lire la capture"}
      </Bouton>

      {r && (
        <div className="apparait mt-4 space-y-3 border-t border-ligne pt-4">
          {r.controle.controles.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between text-[13px]">
                <span className="font-medium">Ce que l&apos;IA a lu</span>
                <span className="text-doux">confiance {r.lecture.confiance}/100</span>
              </div>
              <ul className="divide-y divide-ligne rounded-xl border border-ligne text-[13px]">
                {r.controle.controles.map((c, i) => (
                  <li key={i} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">{c.pari.selection || "?"}</span>
                      <span className="num shrink-0 font-semibold" style={{ color: (c.profit ?? 0) > 0 ? "#34d399" : (c.profit ?? 0) < 0 ? "#f87171" : "#8b97a4" }}>
                        {c.profit !== null ? eurSigne(c.profit) : "—"}
                      </span>
                    </div>
                    <div className="num mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-doux">
                      <span>
                        {STATUTS[c.pari.statut]} · cote {c.pari.cote ? cote(c.pari.cote) : "?"} · mise {c.pari.mise !== null ? eur(c.pari.mise) : "?"}
                        {c.pari.gain !== null ? ` · retour ${eur(c.pari.gain)}` : ""}
                      </span>
                      {c.correspondance ? <Badge couleur="#34d399">✓ dans le journal</Badge> : <Badge couleur="#8b97a4">hors journal</Badge>}
                    </div>
                    {c.probleme && <div className="mt-1 text-[12px] text-alerte">{c.probleme}</div>}
                  </li>
                ))}
              </ul>
              <div className="num mt-2 text-[13px] text-doux">
                Bilan : {r.controle.bilan.gagnes} gagné{r.controle.bilan.gagnes > 1 ? "s" : ""}, {r.controle.bilan.perdus} perdu{r.controle.bilan.perdus > 1 ? "s" : ""}, net{" "}
                <span className="font-semibold" style={{ color: r.controle.bilan.net >= 0 ? "#34d399" : "#f87171" }}>
                  {eurSigne(r.controle.bilan.net)}
                </span>
              </div>
            </div>
          )}
          {r.lecture.remarques && <p className="text-[12px] text-faible">Remarque de l&apos;IA : {r.lecture.remarques}</p>}

          {r.publie ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-[14px] font-semibold text-positif">
                <IcValider /> Publié automatiquement
              </p>
              <CarteActu a={r.publie} />
            </div>
          ) : (
            <div className="space-y-3">
              {r.controle.raisons.length > 0 && (
                <div className="rounded-xl bg-alerte/10 p-3 text-[12px] text-alerte">
                  <div className="font-semibold">À relire avant de publier :</div>
                  <ul className="mt-1 list-inside list-disc">
                    {r.controle.raisons.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Champ label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="ex. ✅ +13,00 € ce soir" />
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium text-doux">Message</span>
                <textarea
                  value={texte}
                  onChange={(e) => setTexte(e.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-ligne bg-surface-2 p-3 text-[14px] leading-relaxed text-texte outline-none focus:border-doux"
                />
              </label>
              <Bouton className="w-full" couleur="#34d399" disabled={!titre.trim() || !texte.trim() || publication} onClick={publier}>
                {publication ? "Publication…" : "Publier dans les actualités"}
              </Bouton>
            </div>
          )}

          {correspondances.length > 0 && (
            <Bouton variante="contour" className="w-full" onClick={ajouterPreuves}>
              🧾 Joindre la capture comme preuve à {correspondances.length} pari{correspondances.length > 1 ? "s" : ""} du journal
            </Bouton>
          )}
        </div>
      )}
    </Carte>
  );
}

function Annonce({ onPublie }: { onPublie: () => void }) {
  const { etat } = useStore();
  const { notifier } = useDonnees();
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const publier = async () => {
    setEnvoi(true);
    try {
      let image: string | undefined;
      if (fichier) {
        const res = await fetch("/api/preuve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profilId: etat.profilId, id: uid(), image: await compresserImage(fichier) }) });
        const d = (await res.json()) as { url?: string; erreur?: string };
        if (!d.url) throw new Error(d.erreur ?? "Envoi de l'image impossible.");
        image = d.url;
      }
      const res = await fetch("/api/actus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profilId: etat.profilId, type: "annonce", titre, texte, image }) });
      const d = (await res.json()) as { erreur?: string };
      if (!res.ok) throw new Error(d.erreur ?? "Publication impossible.");
      setTitre("");
      setTexte("");
      setFichier(null);
      notifier("Annonce publiée.", "succes");
      onPublie();
    } catch (e) {
      notifier((e as Error).message, "alerte");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Carte accent="#a78bfa">
      <Titre sous="Une information pour tes abonnés : nouveauté, pause, changement de méthode…">Écrire une annonce</Titre>
      <div className="space-y-3">
        <Champ label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={4}
          placeholder="Ton message"
          className="w-full rounded-xl border border-ligne bg-surface-2 p-3 text-[14px] leading-relaxed text-texte outline-none placeholder:text-faible focus:border-doux"
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
          className="block w-full text-[13px] text-doux file:mr-3 file:min-h-10 file:rounded-xl file:border-0 file:bg-surface-3 file:px-3 file:text-[13px] file:font-semibold file:text-texte"
        />
        <Bouton className="w-full" couleur="#a78bfa" disabled={!titre.trim() || !texte.trim() || envoi} onClick={publier}>
          {envoi ? "Publication…" : "Publier l'annonce"}
        </Bouton>
      </div>
    </Carte>
  );
}

export default function Admin() {
  const { pret, etat } = useStore();
  const { notifier } = useDonnees();
  const [actus, setActus] = useState<Actu[]>([]);
  const [admin, setAdmin] = useState<boolean | null>(null);

  const charger = () =>
    fetch(`/api/actus?id=${encodeURIComponent(etat.profilId)}&n=30`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { actus: Actu[]; admin: boolean }) => {
        setActus(d.actus);
        setAdmin(d.admin);
      })
      .catch(() => setAdmin(false));

  useEffect(() => {
    if (pret) charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret, etat.profilId]);

  const supprimer = async (id: string) => {
    if (!confirm("Retirer cette publication des actualités ?")) return;
    await fetch(`/api/actus/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profilId: etat.profilId }) });
    notifier("Publication retirée.", "info");
    charger();
  };

  if (admin === null) return <div className="h-48 animate-pulse rounded-2xl border border-ligne bg-surface" />;
  if (!admin)
    return (
      <Vide titre="Espace réservé à l'administrateur" icone={<IcJournal />}>
        <Link href="/actus" className="underline">
          Voir les actualités
        </Link>
      </Vide>
    );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Administration</h1>
        <p className="text-[14px] text-doux">
          Publie tes résultats en une capture. Chaque publication part dans les actualités, chez les abonnés qui suivent le compte et sur Telegram s&apos;il est activé.
        </p>
      </div>
      <Capture onPublie={charger} />
      <Annonce onPublie={charger} />
      <div className="space-y-3">
        <Titre sous="Les bilans automatiques du journal sont publiés chaque soir après 22 h.">Mes publications</Titre>
        {actus.length === 0 ? <p className="text-[13px] text-doux">Rien de publié pour l&apos;instant.</p> : actus.map((a) => <CarteActu key={a.id} a={a} onSupprimer={() => supprimer(a.id)} />)}
      </div>
    </div>
  );
}
