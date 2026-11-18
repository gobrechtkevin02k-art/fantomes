# Pilote : tout ce qu'il reste à faire (mémo pour vendredi)

Ce mémo regroupe toutes tes idées déjà intégrées, les manipulations à faire de ton côté, dans l'ordre, et mes propositions d'améliorations.

---

## 0. Le code est sauvegardé

Tout est sur GitHub, dépôt `fantomes`, branche `claude/winamax-betting-tool-uly3of` (dossier `pilote/`). Fantômes n'a pas été touché. Pour mettre Pilote en ligne, il suffira de fusionner cette branche ou de pointer Vercel dessus.

---

## 1. Ce que fait Pilote aujourd'hui (tes idées intégrées)

| Idée | État |
| --- | --- |
| Cotes Winamax en direct, indice de confiance, mise calculée seule | Fait (The Odds API, `winamax_fr`) |
| 3 gammes : Classique (sérieux, avec objectif), Objectif cote (fun), Jackpot (fun) | Fait, chaque gamme a sa poche |
| Suivi de bankroll et d'objectif | Fait |
| Conseiller qui parle : « j'ai pris la décision de monter la mise… », « voyons demain », « attendons la compo de 19h » | Fait |
| Récap des gains de la nuit à l'ouverture + notification à 7h si l'appli n'est pas ouverte | Fait |
| Notification à l'heure de jouer + validation en 1 clic | Fait (le dernier geste se fait sur Winamax, voir plus bas) |
| Débutants : lire et cliquer, analyse IA complète au choix | Fait (mode simple + réglage « afficher automatiquement l'analyse ») |
| Gagné → mise recalculée sur la bankroll en temps réel | Fait (contrôle toutes les 3 min appli ouverte, 15 min appli fermée) |
| Perdu → on cherche la prochaine vraie occasion | Fait, **sans courir après la perte** (voir ci-dessous) |
| Doute pendant le match → conseil de cash-out (sécuriser / limiter la casse) + notification | Fait (offre Élite) |
| Skills pour l'IA | Fait : fiches d'expertise `skills/` (méthode, football, basket, tennis) |
| Temps réel et gestion de bankroll uniquement sur le Classique ; modes fun sans notification | Fait |
| Offres d'abonnement | Fait : 4 niveaux (ci-dessous) |
| Onglet Résultats : compte réel depuis le 1er dépôt, en temps réel, retraits et réinjections visibles | Fait (journal public scellé, voir 1 bis) |
| Améliorations des résultats : ancrage externe, preuves Winamax, relevé de solde, cote de clôture, indice contre réussite, stats fines, paris scellés pour les non-abonnés, simulateur, suivi du compte, carte à partager, alerte de synchro, pertes aussi visibles que les gains | Fait |

### Pourquoi l'agent ne monte pas la mise *à cause* d'une perte
Monter la mise pour « se refaire » après une perte est la principale cause de ruine d'une bankroll, même avec un bon modèle. Pilote fait donc ceci :
- après une perte, l'agent te prévient et t'indique la prochaine occasion ;
- la mise suit la bankroll (elle baisse donc un peu après une perte et remonte après un gain) ;
- elle n'est **relevée** que si le pari lui-même est exceptionnel (indice ≥ 85 et cote au moins 4 % au-dessus du juste prix), exactement comme les autres jours. La perte précédente ne joue jamais.

### 1 bis. L'onglet Résultats (transparence totale)
- Visible par tout le monde, même sans compte : un argument de vente en soi.
- Affiche la bankroll, l'argent déposé (1er dépôt + réinjections), l'argent retiré, le résultat des paris, la courbe, les paris en cours avec le score en direct.
- **Journal du compte** : chaque opération y entre automatiquement, y compris les suppressions et corrections. Rien ne peut en être retiré : chaque ligne est scellée avec l'empreinte de la précédente, et le téléphone de chaque visiteur vérifie que la chaîne est intacte.
- L'heure qui fait foi est celle du serveur : un pari enregistré après le début du match est signalé.
- Conseil : commence le compte public avec ton vrai premier dépôt, et utilise « Synchroniser mon solde » quand ton solde Winamax diffère (la correction apparaîtra, c'est normal et honnête).
- **Avant de lancer** : ouvre un nouveau profil « propre » pour le compte public (sans tes paris d'essai), puis mets son code dans `PILOTE_PROFIL_PUBLIC`. Le journal s'ouvre à sa première synchronisation.
- **Rendu infalsifiable** : chaque jour, l'empreinte du journal est publiée hors de Pilote (OpenTimestamps, gratuit et automatique ; Telegram si tu crées un canal : voir 3.2).
- **Preuve de chaque pari** : après avoir joué, Suivi → « 🧾 Ajouter la preuve » (numéro du ticket Winamax et/ou photo). Vise 100 % de paris avec preuve : c'est affiché.
- **Relevé de solde chaque mois** : Suivi → Dépôts & solde → « Relevé de solde Winamax », avec une capture de ton solde.
- **Paris scellés pour les non-abonnés** : ils voient tes paris au coup d'envoi (l'empreinte est publiée avant), tes abonnés les voient tout de suite et peuvent « Suivre ce compte ».
- **Qualité, statistiques, simulateur, carte du bilan à partager** : tout est calculé automatiquement.

### Pourquoi le dernier clic se fait sur Winamax
Winamax n'a pas d'API publique pour parier. Un robot connecté avec tes identifiants mettrait ton compte (et ton argent) en danger. Pilote fait tout le reste : choix, mise, heure, enregistrement, suivi, résultats.

---

## 2. Les offres

| | Découverte | Essentiel | Pro | Élite |
| --- | --- | --- | --- | --- |
| Prix | gratuit | 4,99 €/mois | 9,99 €/mois | 19,99 €/mois |
| Paris Classique conseillés / jour | 1 | 2 | 5 | illimités |
| Mise calculée, bankroll, objectif, garde-fous | ✓ | ✓ | ✓ | ✓ |
| Récap du matin (notification) | – | ✓ | ✓ | ✓ |
| Notification à l'heure de jeu, validation 1 clic | – | – | ✓ | ✓ |
| Résultats en temps réel, mises recalculées | – | – | ✓ | ✓ |
| Mise relevée sur cote exceptionnelle | – | – | ✓ | ✓ |
| Analyses IA / jour | 0 | 1 | 5 | 20 |
| Suivi en direct + conseil cash-out | – | – | – | ✓ |
| Objectif cote (fun) | – | – | ✓ | ✓ |
| Jackpot (fun) | – | – | – | ✓ |
| Synchronisation multi-appareils | – | ✓ | ✓ | ✓ |

Pourquoi 4 niveaux : un niveau gratuit fait découvrir la méthode (et donne envie), puis chaque palier ajoute une vraie promesse (le conseiller, puis l'agent qui joue avec toi, puis le direct). Les limites d'analyses IA protègent tes coûts (environ 10 à 20 centimes par nouvelle analyse ; une analyse déjà faite pour un match est partagée et gratuite pour tous les abonnés).

Tout se règle dans `lib/offres.ts` (prix, limites, textes) : une seule ligne à changer pour ajuster une offre.

---

## 3. Les manipulations, dans l'ordre

### 3.1 Vercel
1. Nouveau projet à partir du dépôt `fantomes`, **Root Directory : `pilote`**.
2. Storage → créer une base **Upstash Redis** (gratuite) et la relier au projet : les variables sont ajoutées automatiquement.

### 3.2 Variables d'environnement (Settings → Environment Variables)
| Variable | Où la trouver |
| --- | --- |
| `ODDS_API_KEY` | the-odds-api.com (gratuit pour tester ; l'offre 20 000 crédits est conseillée en production) |
| `ANTHROPIC_API_KEY` | console.anthropic.com (analyste IA) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `npm run vapid` dans le dossier `pilote` (ou demande à Claude de les générer) |
| `VAPID_SUBJECT` | `mailto:` suivi de ton adresse de contact |
| `CRON_SECRET` | une longue suite de caractères au hasard |
| `STRIPE_SECRET_KEY` | tableau de bord Stripe (commence par `sk_test_` pour les essais) |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Développeurs → Webhooks (voir 3.4) |
| `PILOTE_ACCES_COMPLET` | **ton** code personnel (Pilote → Réglages → Synchronisation) : tu as tout débloqué sans payer |
| `PILOTE_PROFIL_PUBLIC` | **le même code** : ton compte réel alimente l'onglet Résultats public (journal scellé) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CANAL` | facultatif : un bot créé avec @BotFather, administrateur de ton canal public (`@moncanal`) ; l'empreinte du journal y est publiée chaque jour |
| `APP_PASSWORD` | à garder pendant les tests ; **à retirer** quand tu vends l'appli (sinon tes clients sont bloqués) |

### 3.3 Réveil de l'agent
Sur https://cron-job.org (gratuit) : une tâche toutes les 15 minutes vers `https://TON-SITE.vercel.app/api/cron?cle=TON_CRON_SECRET`.

### 3.4 Stripe
1. **Avant de vendre**, écris au support Stripe pour décrire le service (conseils de paris sportifs par abonnement, sans jeu d'argent sur la plateforme). Stripe classe certaines activités liées aux paris parmi les activités restreintes : un accord écrit évite une fermeture de compte.
2. Conseil : un **compte Stripe séparé** de celui de Fantômes, pour qu'un éventuel souci sur Pilote ne bloque pas les paiements de Fantômes.
3. Webhooks → ajouter l'adresse `https://TON-SITE.vercel.app/api/abonnement/webhook` avec les événements `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copier le secret dans `STRIPE_WEBHOOK_SECRET`.
4. Paramètres → Facturation → **Portail client** : l'activer (résiliation et changement d'offre par le client).
5. Tester avec la carte `4242 4242 4242 4242`, date future, n'importe quel code.

### 3.5 Tests sur ton téléphone
- [ ] **Liens Winamax** : avec les vraies cotes, touche « Winamax · mise copiée » sur un pari. Vérifie qu'il ouvre directement le bon match (sinon, dis-le à Claude : le format du lien sera corrigé), touche la sélection, colle la mise, valide.
- [ ] Ouvrir l'appli, faire l'accueil, noter son code (Réglages → Synchronisation) et le mettre dans `PILOTE_ACCES_COMPLET`.
- [ ] **Installer l'appli** (voir la section 3 quater) : sur iPhone, Safari → Partager → « Sur l'écran d'accueil », puis ouvrir depuis l'icône ; sur Android, bouton « Installer » de la bannière d'accueil.
- [ ] Réglages → Notifications → Activer, puis « Envoyer un test ».
- [ ] Vérifier le plan du jour, valider une session en un clic.
- [ ] Le lendemain : notification de 7h, récap à l'ouverture.
- [ ] Avec un deuxième téléphone (offre gratuite) : acheter Essentiel en mode test, vérifier le déblocage, résilier via le portail.

### 3.6 Avant d'ouvrir au public
- CGV, mentions légales et politique de confidentialité propres à Pilote (abonnement, données, résiliation).
- Vérifier les règles de l'ANJ sur la promotion des jeux d'argent (messages de prévention, interdiction aux mineurs, pas d'incitation excessive). Un avis d'avocat est recommandé avant de commercialiser.

---

## 3 quater. L'appli mobile (iPhone et Android)

Pilote **est déjà une appli mobile** : elle s'installe depuis son site, sans passer par l'App Store ni le Play Store. Une fois installée : icône sur l'écran d'accueil, plein écran, écran de démarrage, notifications (sur iPhone, seulement depuis l'appli installée, iOS 16.4 minimum), pastille sur l'icône avec le nombre de paris à valider, page « Pas de connexion » quand le réseau coupe, raccourcis par appui long sur l'icône (Android).

- [ ] Sur ton iPhone, ouvre l'adresse Vercel dans **Safari** → Partager (sur iOS 26 : derrière le bouton ⋯ en bas à droite) → « Sur l'écran d'accueil » → Ajouter. Ouvre Pilote depuis l'icône : l'écran de démarrage sombre doit apparaître, puis l'appli **sans barre Safari**, le haut de l'écran sous l'heure et la batterie bien dégagé.
- [ ] Sur un Android (si tu en as un sous la main) : Chrome → bannière d'accueil → « Installer ».
- [ ] Dans l'appli installée : Réglages → Notifications → Activer → « Envoyer un test ».
- [ ] Mode avion puis ouvre une page : la page « Pas de connexion » doit s'afficher, puis l'appli revient seule avec le réseau.
- [ ] **Page à partager à tes abonnés : `ton-adresse/installer`.** Elle détecte l'appareil et donne la bonne marche à suivre. Sur ordinateur, elle affiche un QR code à scanner avec le téléphone. Si le lien est ouvert depuis Instagram, Facebook ou TikTok (qui ne permettent pas d'installer), elle demande de copier le lien dans Safari ou Chrome.

**Et l'App Store / le Play Store ?** Pas recommandé pour l'instant :
- **Apple** demande un Mac pour fabriquer l'appli, 99 €/an, classe facilement les applis de pronostics dans les jeux d'argent (règle 5.3) et impose son propre paiement pour les abonnements vendus dans l'appli (commission de 15 à 30 %).
- **Google** interdit les applis qui « facilitent » les paris d'argent sans autorisation : le lien vers Winamax avec la mise copiée peut être vu comme tel. Inscription 25 $ une fois.
- Si un jour tu veux tenter le Play Store après avis d'avocat : [PWABuilder](https://www.pwabuilder.com) fabrique l'appli Android à partir de l'adresse du site, sans rien coder. Il te donne un nom de paquet et une empreinte : mets-les dans `ANDROID_PACKAGE` et `ANDROID_SHA256` sur Vercel (Pilote les publie alors sur `/.well-known/assetlinks.json`, ce qui retire la barre d'adresse dans l'appli Android).

Changer le logo plus tard : modifier `app/icon.svg` et `scripts/visuels.cjs`, lancer `node scripts/visuels.cjs`, puis changer `CACHE` (ex. `pilote-v3`) dans `public/sw.js` pour que les téléphones prennent les nouvelles icônes.

---

## 3 ter. Publier tes résultats en une capture (Administration)

- Réglages → **Administration** (ou `/admin`). Envoie une capture Winamax : l'IA lit les paris, vérifie que gain = mise × cote, cherche chaque pari dans ton journal, et prépare le message.
- **Publication automatique** (activée par défaut) seulement si la lecture est nette et les chiffres cohérents ; sinon tu relis et tu corriges avant de publier.
- Le message part dans **Actualités**, chez les abonnés qui te suivent, et sur Telegram si tu as créé le canal.
- Bouton « Joindre la capture comme preuve » : tes paris reconnus reçoivent la capture comme preuve Winamax.
- Chaque soir après 22 h, un **bilan du jour** est publié automatiquement à partir de ton journal (gains et pertes).
- Il faut la clé `ANTHROPIC_API_KEY` pour la lecture automatique (sans elle, tu écris le message toi-même, la capture est quand même jointe).

## 3 bis. Tester la méthode sur l'historique (à faire avant de miser ou de vendre)

La page **Test historique** (lien dans Réglages, ou `/backtest`) rejoue exactement ce que Pilote aurait fait sur des matchs déjà joués, avec les cotes Winamax de l'époque : juste prix, indice, mises, garde-fous, mise relevée, cote de clôture. Les scores viennent gratuitement de football-data.co.uk (Ligue 1, Ligue 2, Premier League, LaLiga, Serie A, Bundesliga, Eredivisie, Liga Portugal).

1. Passe ta clé The Odds API sur une **offre payante** pour un mois : l'historique n'est pas dans l'offre gratuite (10 crédits par relevé de cotes).
2. **Premier essai à petit prix** : une seule ligue sur 2 semaines (environ 300 crédits), pour vérifier que l'historique de Winamax existe bien sur la période. S'il est trop court, le rapport affichera 0 match : avance alors la période.
3. **Vrai test** : Ligue 1 + Premier League sur une saison complète, décision « le matin ». La page affiche le coût estimé avant de lancer (compter environ 5 000 à 6 500 crédits par championnat et par saison en 1N2). La collecte avance jour par jour et se pilote depuis le téléphone ; tu peux l'interrompre et la reprendre sans payer deux fois.
4. Lis le **verdict** : le chiffre qui compte est la part de paris qui battent la cote de clôture. Puis change les réglages (indice minimum, avantage minimum, cotes) et clique « Relancer le test avec ces réglages » : c'est gratuit, sans recollecter.
5. **Anti-piège** : une fois de bons réglages trouvés, vérifie-les sur une **autre saison**. S'ils ne tiennent pas, c'était du hasard.

Le rapport est visible par tous dans `/backtest`, avec ses limites expliquées (un backtest est souvent plus optimiste que la réalité).

## 4. Mes propositions d'améliorations (par ordre de priorité)

1. **De vrais comptes clients (e-mail + lien de connexion)** : aujourd'hui un abonnement est rattaché à un code anonyme ; pour vendre, il faut un compte (récupération, partage de code impossible).
2. **Prouver que la méthode marche** : mesurer la *CLV* (la cote obtenue bat-elle la cote de clôture ?) et un graphique « indice annoncé vs réussite réelle ». C'est le meilleur argument de vente, et un garde-fou honnête.
3. **Essai gratuit de 7 jours de Pro** et **tarif annuel** (2 mois offerts).
4. **Notifications Telegram** en plus du web : plus fiables sur iPhone, sans installation.
5. ~~Tester le modèle sur l'historique~~ : fait (voir 3 bis).
6. **Tableau de bord administrateur** : abonnés, revenus, coûts d'API et d'IA.
7. **Lien direct vers le ticket Winamax** quand la source de cotes le fournit (déjà pris en charge s'il existe).

---

## 5. Où est quoi dans le code
- `lib/offres.ts` : les offres et leurs limites.
- `lib/engine/conseiller.ts` : les décisions du conseiller (mise relevée, heure, plan, récap).
- `lib/engine/direct.ts` : le suivi en direct et le conseil de cash-out.
- `lib/serveur/agent.ts` : l'agent du cron (7h, heures de jeu, résultats, direct).
- `lib/serveur/analyste.ts` + `skills/` : l'analyste IA et ses fiches d'expertise.
- `lib/serveur/abonnements.ts` : Stripe (paiement, portail, webhook).
- `components/Installation.tsx` + `lib/installation.ts` + `public/sw.js` : l'appli mobile (installation guidée, hors connexion, pastille).
