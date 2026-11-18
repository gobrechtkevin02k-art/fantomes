"use client";

// Installer Pilote sur le téléphone : un bouton sur Android, la marche à suivre sur iPhone,
// un QR code sur ordinateur. Pas de store : l'appli s'installe depuis le site et se met à jour seule.

import { useEffect, useState } from "react";
import { useInstallation, type EtatInstallation } from "@/lib/installation";
import { Bouton, Modal, Puces, cx } from "./ui";
import { IcAjouter, IcCopier, IcFermer, IcMenuPoints, IcPartager, IcPlusPoints, IcTelephone, IcValider, Logo } from "./Icones";

type Appareil = "iphone" | "android" | "ordinateur";

const APPAREIL: Record<EtatInstallation, Appareil> = {
  chargement: "iphone",
  installee: "iphone",
  android: "android",
  android_manuel: "android",
  ios_safari: "iphone",
  ios_autre: "iphone",
  integre: "iphone",
  ordinateur: "ordinateur",
};

export const AVANTAGES = [
  { titre: "Une icône sur ton écran d'accueil", texte: "Pilote s'ouvre en plein écran, comme une appli, sans barre de navigateur." },
  { titre: "Les notifications", texte: "Le récap de 7 h, l'heure de jouer, les conseils pendant le match. Sur iPhone, elles ne marchent qu'une fois Pilote installée." },
  { titre: "Toujours à jour", texte: "Pas de store, pas de mise à jour à télécharger : tu as toujours la dernière version." },
];

function Etape({ n, children, icone }: { n: number; children: React.ReactNode; icone?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 text-[13px] font-bold">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5 text-[14px] leading-relaxed">{children}</div>
      {icone && <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-ligne bg-surface-2 text-[18px] text-[#4f9dff]">{icone}</span>}
    </li>
  );
}

function CopierLien() {
  const [copie, setCopie] = useState(false);
  return (
    <Bouton
      variante="contour"
      className="w-full"
      onClick={() => {
        try {
          void navigator.clipboard?.writeText(location.origin);
          setCopie(true);
          setTimeout(() => setCopie(false), 2500);
        } catch {
          /* presse-papiers indisponible */
        }
      }}
    >
      {copie ? <IcValider /> : <IcCopier />}
      {copie ? "Lien copié" : "Copier le lien de Pilote"}
    </Bouton>
  );
}

function GuideIphone({ autreNavigateur }: { autreNavigateur?: boolean }) {
  return (
    <div>
      <ol className="space-y-3">
        {autreNavigateur ? (
          <Etape n={1} icone={<IcPartager />}>
            Touche le bouton <b>Partager</b> (dans la barre d'adresse sur Chrome, dans le menu sur Firefox et Edge).
          </Etape>
        ) : (
          <Etape n={1} icone={<IcPartager />}>
            Touche le bouton <b>Partager</b> de Safari. Sur iOS 26, il se trouve derrière le bouton <IcPlusPoints className="inline align-[-2px]" /> en bas à droite.
          </Etape>
        )}
        <Etape n={2} icone={<IcAjouter />}>
          Fais défiler et choisis <b>« Sur l'écran d'accueil »</b>.
        </Etape>
        <Etape n={3}>
          Laisse <b>« Ouvrir en tant qu'app web »</b> activé s'il est proposé, puis touche <b>Ajouter</b>.
        </Etape>
        <Etape n={4}>Ouvre Pilote depuis sa nouvelle icône et active les notifications dans les Réglages.</Etape>
      </ol>
      {autreNavigateur && <p className="mt-3 text-[13px] text-doux">L'option n'apparaît pas ? Ouvre Pilote dans Safari et recommence (il faut iOS 16.4 ou plus récent).</p>}
    </div>
  );
}

function GuideAndroid() {
  return (
    <ol className="space-y-3">
      <Etape n={1} icone={<IcMenuPoints />}>
        Touche le menu <b>⋮</b> en haut à droite de Chrome (sur Samsung Internet : le menu ≡ en bas).
      </Etape>
      <Etape n={2} icone={<IcAjouter />}>
        Choisis <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>.
      </Etape>
      <Etape n={3}>Confirme : l'icône Pilote apparaît avec tes autres applis. Ouvre-la et active les notifications dans les Réglages.</Etape>
    </ol>
  );
}

function GuideOrdinateur({ invitation, installer }: { invitation: boolean; installer: () => Promise<boolean> }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/installer/qr" alt="QR code vers Pilote" width={156} height={156} className="size-[156px] shrink-0 rounded-2xl bg-white p-2" />
      <div className="space-y-2 text-[14px] leading-relaxed">
        <p>
          <b>Scanne ce code avec l'appareil photo de ton téléphone</b> : Pilote s'ouvre directement, il ne reste plus qu'à l'installer.
        </p>
        <p className="text-doux">Ou envoie-toi le lien par message.</p>
        {invitation && (
          <Bouton variante="contour" onClick={() => void installer()}>
            Installer aussi sur cet ordinateur
          </Bouton>
        )}
      </div>
    </div>
  );
}

/** Marche à suivre adaptée à l'appareil, avec la possibilité de voir celle des autres appareils. */
export function GuideInstallation({ choixAppareil = false }: { choixAppareil?: boolean }) {
  const { etat, invitation, installer } = useInstallation();
  const [appareil, setAppareil] = useState<Appareil | null>(null);
  if (etat === "chargement") return <div className="h-24" />;
  const parDefaut: Appareil = etat === "integre" && /Android/i.test(navigator.userAgent) ? "android" : APPAREIL[etat];
  const vu = appareil ?? parDefaut;
  const montrerGuide = etat !== "installee" || choixAppareil;

  const intro = (() => {
    if (etat === "installee")
      return (
        <div className="flex items-center gap-3 rounded-xl bg-classique/10 p-3 text-[14px] text-classique">
          <IcValider className="shrink-0 text-lg" />
          Pilote est installée sur cet appareil.
        </div>
      );
    if (etat === "android" && vu === "android")
      return (
        <div className="space-y-2">
          <Bouton className="w-full" couleur="#34d399" onClick={() => void installer()}>
            <IcTelephone /> Installer Pilote
          </Bouton>
          <p className="text-center text-[12px] text-faible">Gratuit, sans passer par le Play Store.</p>
        </div>
      );
    if (etat === "integre")
      return (
        <div className="space-y-3 rounded-xl bg-alerte/10 p-3 text-[14px] text-alerte">
          <p>Tu es dans le navigateur d'une autre appli (Instagram, Facebook, TikTok…) : il ne permet pas d'installer Pilote.</p>
          <p className="text-texte">Copie le lien, puis colle-le dans Safari (iPhone) ou Chrome (Android).</p>
          <CopierLien />
        </div>
      );
    return null;
  })();

  return (
    <div className="space-y-4">
      {intro}
      {choixAppareil && (
        <Puces
          label="Appareil"
          valeur={vu}
          onChange={setAppareil}
          options={[
            { v: "iphone", l: "iPhone" },
            { v: "android", l: "Android" },
            { v: "ordinateur", l: "Ordinateur" },
          ]}
        />
      )}
      {montrerGuide && vu === "iphone" && <GuideIphone autreNavigateur={etat === "ios_autre"} />}
      {montrerGuide && vu === "android" && (etat !== "android" || choixAppareil) && <GuideAndroid />}
      {montrerGuide && vu === "ordinateur" && <GuideOrdinateur invitation={invitation} installer={installer} />}
    </div>
  );
}

export function ModalInstallation({ ouvert, onFermer }: { ouvert: boolean; onFermer: () => void }) {
  return (
    <Modal ouvert={ouvert} onFermer={onFermer} titre="Installer Pilote">
      <ul className="mb-5 space-y-2">
        {AVANTAGES.map((a) => (
          <li key={a.titre} className="flex gap-2.5 text-[13px] leading-relaxed text-doux">
            <IcValider className="mt-0.5 shrink-0 text-classique" />
            <span>
              <b className="text-texte">{a.titre}.</b> {a.texte}
            </span>
          </li>
        ))}
      </ul>
      <GuideInstallation />
    </Modal>
  );
}

const CLE_MASQUE = "pilote:installation-masquee";

/** Bannière de l'accueil : propose l'installation tant que Pilote n'est pas installée (masquable 14 jours). */
export function BanniereInstallation() {
  const { etat, invitation, installer } = useInstallation();
  const [masquee, setMasquee] = useState(true);
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => {
    try {
      const t = Number(localStorage.getItem(CLE_MASQUE) ?? 0);
      setMasquee(Date.now() - t < 14 * 86_400_000);
    } catch {
      setMasquee(false);
    }
  }, []);
  if (masquee || etat === "chargement" || etat === "installee") return null;
  const masquer = () => {
    setMasquee(true);
    try {
      localStorage.setItem(CLE_MASQUE, String(Date.now()));
    } catch {
      /* stockage indisponible */
    }
  };
  const ordinateur = etat === "ordinateur";
  return (
    <>
      <section className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-ligne bg-gradient-to-r from-classique/10 via-objectif/10 to-jackpot/5 p-3.5 pr-11">
        <Logo className="size-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-snug">{ordinateur ? "Pilote sur ton téléphone" : "Installe Pilote sur ton téléphone"}</p>
          <p className="text-[12px] leading-snug text-doux">{ordinateur ? "Scanne un QR code et c'est prêt." : "Plein écran, notifications, ouverture en un geste."}</p>
        </div>
        <Bouton
          className="min-h-10 shrink-0 px-3.5 text-[13px]"
          onClick={async () => {
            if (invitation && !ordinateur) {
              if (await installer()) return;
            }
            setOuvert(true);
          }}
        >
          {ordinateur ? "Voir" : "Installer"}
        </Bouton>
        <button onClick={masquer} className={cx("absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full text-faible hover:bg-surface-2 hover:text-texte")} aria-label="Masquer">
          <IcFermer />
        </button>
      </section>
      <ModalInstallation ouvert={ouvert} onFermer={() => setOuvert(false)} />
    </>
  );
}
