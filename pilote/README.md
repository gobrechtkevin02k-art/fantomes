# Pilote

Assistant de paris sportifs pour Winamax : il compare chaque cote Winamax au juste prix du marché, calcule un **indice de confiance** et **fixe seul la mise** selon ta bankroll, tes poches et tes objectifs.

> Interdit aux moins de 18 ans. Jouer comporte des risques : endettement, isolement, dépendance. Pour être aidé, appelez le 09 74 75 13 13 (appel non surtaxé). Aucun outil ne garantit des gains.

## Les trois gammes

| Gamme | Pour quoi faire | Comment la mise est fixée |
| --- | --- | --- |
| **Classique** | Faire grossir la bankroll sans prise de risque | Critère de Kelly fractionné (×0,15 / 0,25 / 0,35 selon le profil), avantage réduit selon l'indice de confiance, plafonné à 2 / 3 / 5 % de la bankroll par pari |
| **Objectif cote** | Tu donnes une cote minimum et un horizon (24 h à 3 semaines), Pilote trouve le combiné qui a le plus de chances de passer | De 1 % de la poche (indice ≤ 40) à 5 % (indice ≥ 90), jamais plus de 2 % de la bankroll |
| **Jackpot** | Toutes petites mises sur de très grosses cotes (50 à 1000) | 2 % de la poche modulés par l'indice, jamais plus de 0,5 % de la bankroll |

Chaque gamme mise uniquement dans **sa poche** (par défaut 80 / 15 / 5 %) : le fun ne peut pas manger la bankroll sérieuse.

## Le conseiller (l'agent)

Le conseiller prend les décisions finales et les explique en français, à la première personne. Il suffit de lire et de cliquer.

- **Plan du jour en sessions horaires.** Par exemple : « 1 pari tout de suite, 2 à 18h55 après les compositions ». Chaque session se valide en **un clic** : les paris sont enregistrés, Winamax s'ouvre et un ticket à cocher liste exactement quoi reproduire.
- **Il peut relever la mise.** Quand l'indice dépasse 85 et que la cote dépasse le juste prix d'au moins 4 %, il mise jusqu'à ×1,5 (réglable : ×1,25, ×1,5 ou ×2) le conseil de gestion de bankroll et le dit : « J'ai pris la décision de monter la mise à 12,60 € au lieu des 8,40 € prévus… ». Il ne dépasse **jamais** le plafond de sécurité du profil, ni pendant un stop-loss, ni en mode prudence.
- **Il choisit le moment.** Au football, il attend les compositions officielles (environ une heure avant le match), sauf si la cote est si généreuse qu'elle risque d'être corrigée. Un match lointain est réévalué le jour même.
- **Il sait dire non.** « Aujourd'hui, nous n'avons pas d'indice de confiance assez élevé pour jouer. Voyons demain. »
- **Il suit les cotes.** « La cote grimpe (2,05 → 2,20 depuis 9h05) ».
- **Récapitulatif.** À l'ouverture : bilan depuis la dernière visite (« Cette nuit : 2 paris gagnés sur 3, +14,00 € »).
- **Analyste IA (facultatif).** Avec une clé Claude, un bouton « Voir l'analyse complète » (ou l'affichage automatique, au choix dans les réglages) lance une recherche web sur les compositions, absences et le contexte. Le verdict s'applique au plan : *confirmer*, *prudence* (mise ÷ 2) ou *éviter* (le pari est retiré). L'IA ne peut jamais **augmenter** une mise.
- **Mode simple** pour les débutants (activé par défaut) : les chiffres détaillés restent à un geste.

### Notifications et agent autonome

Une fois les notifications activées (Réglages → Notifications), un agent côté serveur, appelé toutes les 15 minutes :
- à **7h** (heure réglable), si l'appli n'a pas encore été ouverte, envoie le bilan de la nuit et le plan du jour ;
- à **chaque heure de jeu**, envoie « ⏰ 18h55 : c'est l'heure de jouer — 2 paris prêts pour 8,40 € ». La notification ouvre directement la session, il ne reste qu'à toucher **Valider**.

Sur iPhone, les notifications web demandent d'abord d'ajouter Pilote à l'écran d'accueil (Partager → « Sur l'écran d'accueil »).

**Pourquoi le clic final reste chez Winamax :** Winamax n'a pas d'API publique pour parier. Un robot qui se connecterait avec tes identifiants mettrait ton compte en danger. Pilote fait tout le reste : choix, mise, heure, enregistrement, suivi et résultats.

## Offres d'abonnement

| | Découverte | Essentiel | Pro | Élite |
| --- | --- | --- | --- | --- |
| Prix | gratuit | 4,99 €/mois | 9,99 €/mois | 19,99 €/mois |
| Paris Classique / jour | 1 | 2 | 5 | illimités |
| Notifications | – | récap du matin | + heures de jeu, résultats en temps réel | + suivi en direct |
| Mise relevée | – | – | ✓ | ✓ |
| Analyses IA / jour | 0 | 1 | 5 | 20 |
| Modes fun | – | – | Objectif cote | Objectif cote + Jackpot |

Paiement par Stripe (Checkout, portail client, webhook). Limites et prix dans `lib/offres.ts`. Les fonctionnalités coûteuses (IA, notifications, direct) sont contrôlées côté serveur. Le mémo `VENDREDI.md` détaille la mise en route.

## Temps réel (mode Classique uniquement)

- **Résultats** : vérifiés toutes les 3 minutes appli ouverte, toutes les 15 minutes par l'agent. Notification « ✅ Gagné / ❌ Perdu », bankroll mise à jour, prochaines mises recalculées.
- **Après une perte**, l'agent indique la prochaine occasion ; la mise suit la bankroll et n'est relevée que si le pari est exceptionnel, jamais pour « se refaire ».
- **Suivi en direct** (Élite) : probabilité actuelle du pari, d'après les cotes en direct ou, à défaut, un modèle score + temps. Conseil « sécuriser » (gros gain bien parti) ou « limiter la casse », avec le montant minimum de cash-out à accepter sur Winamax.
- Les modes Objectif cote et Jackpot sont à haut risque : ni plan, ni mise relevée, ni notification.

## Résultats publics (transparence totale)

L'onglet **Résultats** montre à tous (abonnés et visiteurs, sans inscription) le compte réel du fondateur, désigné par `PILOTE_PROFIL_PUBLIC`, depuis le premier dépôt :
- bankroll, argent déposé (premier dépôt et réinjections), argent retiré, résultat des paris et ROI. Seul le résultat des paris mesure la performance : l'argent déposé n'est jamais compté comme un gain ;
- courbe du résultat des paris et courbe de la bankroll ;
- paris en cours avec le score en direct, et résultat officiel affiché dès la fin du match (actualisation toutes les 30 secondes) ;
- **journal du compte** : chaque dépôt, retrait, pari, résultat, correction et suppression, horodaté à la réception par le serveur. Un pari enregistré après le coup d'envoi est signalé.

Le journal ne fait qu'ajouter des entrées, et chacune contient l'empreinte SHA-256 de la précédente. Le navigateur du visiteur recalcule toute la chaîne et affiche « intacte » ou l'entrée altérée. Les paris faits en mode démo n'y figurent jamais.

Ce qui rend la transparence vérifiable :
- **Ancrage externe** : chaque jour, le cron publie l'empreinte du journal hors de Pilote (horodatage OpenTimestamps inscrit dans la blockchain Bitcoin, et canal Telegram si `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CANAL` sont définis). Les fichiers `.txt` et `.ots` se téléchargent depuis la page et se vérifient sur opentimestamps.org.
- **Preuves Winamax** : numéro et/ou photo du ticket pour chaque pari (Suivi → « Ajouter la preuve »), avec l'empreinte de la photo inscrite dans le journal.
- **Relevé de solde mensuel** : solde Winamax (capture) comparé au solde calculé par Pilote, écart affiché.
- **Paris scellés** : pour les visiteurs sans offre payante, un pari n'est révélé qu'au coup d'envoi ; avant, seule son empreinte est publiée, et le contenu révélé doit lui correspondre. Les abonnés voient tout en direct et peuvent **suivre le compte** (notification à chaque pari et à chaque résultat).
- **Qualité des paris** : cote obtenue contre cote de clôture (relevée par le cron dans les 20 minutes avant chaque match), part de chance (attendu contre réel), indice annoncé contre réussite réelle.
- **Statistiques** mois par mois, par sport, par cote ; le meilleur et le pire côte à côte (plus grosse perte, pire mois, plus grosse baisse, plus longue série perdante) ; **simulateur** « si tu avais suivi avec 100 € » ; **carte du bilan du mois** à partager (`/api/carte-bilan`), pertes comprises.
- **Alerte** visible si le compte n'a pas été synchronisé depuis plus de 24 h, et rappel au propriétaire après 20 h.

## Actualités et module Admin

- **Actualités** (`/actus`, publique, sans inscription) : résultats, annonces et bilans, gains comme pertes ; une pastille signale les nouveautés dans l'en-tête.
- **Administration** (`/admin`, propriétaire) : tu envoies une capture Winamax (ticket, « Mes paris », historique) ; Claude la lit (vision), relève chaque pari (sélection, cote, mise, retour, résultat, numéro de ticket) et rédige un message sobre.
- **Contrôles avant publication** : gain = mise × cote, valeurs illisibles, confiance de lecture, rapprochement avec le journal public (« ✓ dans le journal » ou « hors journal »).
- **Publication automatique** quand la lecture est sûre (confiance ≥ 85 et chiffres cohérents) ; sinon un brouillon modifiable est proposé. Chaque publication part dans les actualités, chez les abonnés qui suivent le compte (notification) et sur le canal Telegram s'il est configuré. La capture est jointe, et peut être ajoutée en un clic comme preuve aux paris reconnus.
- **Bilan du jour automatique** chaque soir après 22 h, calculé à partir du journal public (pas d'une capture).

## Test sur l'historique (backtest)

La page `/backtest` rejoue le vrai moteur (mêmes fonctions que l'appli) sur des matchs passés :
- **collecte** pas à pas depuis le téléphone (`/api/backtest`, réservé au propriétaire) : liste des matchs du jour, relevé des cotes au moment de la décision (le matin ou N heures avant) et à la clôture via l'historique payant de The Odds API, stocké jour par jour (jamais refacturé) ;
- **scores** gratuits de football-data.co.uk, rapprochés par date et ressemblance des noms d'équipes ; les matchs sans score sont écartés ;
- **rapport** : verdict prudent, résultat et ROI sur une bankroll simulée, cote de clôture battue, réussite par indice, plus grosse baisse, statistiques par mois / sport / cote, et les limites d'un backtest ;
- **réglages** de la stratégie (profil, indice et avantage minimum, cotes, mise relevée) rejouables gratuitement sur les données déjà collectées ;
- un **mode démonstration** (120 jours simulés) pour vérifier la chaîne sans dépenser de crédits.

Code : `lib/backtest/` (moteur, scores, types), `lib/serveur/backtest.ts` (collecte, exécution, stockage du rapport).

## Skills de l'analyste IA

Les fiches `skills/<nom>/SKILL.md` (méthode générale, football, basket, tennis) sont ajoutées aux instructions de l'analyste selon le sport du match. Pour enrichir l'expertise, il suffit d'éditer ou d'ajouter une fiche.

## Comment ça marche

1. **Juste prix.** Pour chaque issue, Pilote retire la marge de chaque bookmaker de référence (méthode « puissance », qui corrige le biais favori / outsider) puis fait une moyenne pondérée en log-cote. Pinnacle et Betfair pèsent plus lourd.
2. **Valeur.** Avantage = probabilité juste × cote Winamax − 1. Seuls les paris à avantage positif sont proposés en Classique.
3. **Indice de confiance (0-100).** Probabilité, selon le modèle, que la cote Winamax soit réellement au-dessus du juste prix. L'incertitude augmente avec peu de bookmakers, leur désaccord, un match lointain et les très grosses cotes. Un avantage supérieur à 20 % est signalé comme suspect (cote erronée ou marché différent).
4. **Combinés.** Programmation dynamique (sac à dos à choix multiples) : on minimise Σ −log(p) sous la contrainte Σ log(cote) ≥ log(cible), une seule sélection par match. Testé contre une recherche exhaustive.
5. **Garde-fous.** Limite de perte par jour et sur 7 jours, argent en jeu maximum, mode prudence (mises ÷ 2) après une baisse de 25 % depuis le plus haut, pause volontaire. Un objectif en retard n'augmente **jamais** les mises.
6. **Suivi.** Règlement automatique des paris (1N2, plus/moins, handicap) à partir des scores, statistiques par gamme, courbe de bankroll, projection vers l'objectif, synchronisation avec le solde Winamax réel, export / import de sauvegarde.

## Connexion à Winamax

Winamax ne propose pas d'API publique, et confier ses identifiants à un robot qui parie à sa place exposerait le compte à une fermeture. Pilote récupère donc les **cotes Winamax en temps réel** via [The Odds API](https://the-odds-api.com) (bookmaker `winamax_fr`, comparé à Pinnacle, Betfair, Betclic, Unibet, PMU, NetBet…), calcule tout, puis tu valides le pari sur Winamax en deux touches. Les résultats sont réglés automatiquement.

Sans clé d'API, l'application tourne en **mode démo** avec des matchs et des cotes simulés (déterministes).

## Lancer en local

```bash
cd pilote
npm install
cp .env.example .env.local   # puis renseigne ODDS_API_KEY (facultatif)
npm run dev                  # http://localhost:3000
npm test                     # tests du moteur
```

## Mettre en ligne sur Vercel

1. Sur Vercel, crée un **nouveau projet** à partir de ce dépôt et règle **Root Directory** sur `pilote`.
2. Ajoute les variables d'environnement (toutes listées dans `.env.example`) :
   - `ODDS_API_KEY` : ta clé The Odds API (500 crédits gratuits par mois) ;
   - `APP_PASSWORD` : un mot de passe, pour que personne d'autre n'utilise ton quota (fortement conseillé) ;
   - `ANTHROPIC_API_KEY` *(facultatif)* : active l'analyste IA ;
   - pour les notifications : `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` (génère-les avec `npm run vapid`), `VAPID_SUBJECT` (ex. `mailto:toi@exemple.fr`), `CRON_SECRET` (une longue chaîne au hasard) ;
   - une base **Upstash Redis** gratuite (Vercel → Storage → Upstash) : elle ajoute `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (ou `KV_REST_API_URL` / `KV_REST_API_TOKEN`). Sans elle, pas de synchronisation ni de notifications appli fermée.
3. Déploie, puis ouvre l'URL sur ton téléphone et « Ajouter à l'écran d'accueil ».
4. **Réveil de l'agent.** `vercel.json` déclare un passage quotidien (vers 7h, heure de Paris en hiver), c'est le maximum autorisé par l'offre gratuite de Vercel. Pour les notifications à l'heure de jeu, crée une tâche gratuite sur [cron-job.org](https://cron-job.org) qui appelle toutes les 15 minutes `https://ton-site.vercel.app/api/cron` avec l'en-tête `Authorization: Bearer <CRON_SECRET>` (ou l'URL `…/api/cron?cle=<CRON_SECRET>`).

**Coûts à prévoir.** The Odds API : 500 crédits gratuits par mois, juste pour un usage léger ; avec l'agent qui prépare le plan chaque matin, l'offre à 20 000 crédits est plus confortable. Analyste IA : chaque analyse (modèle Claude Opus 5.5 + quelques recherches web) coûte environ 10 à 20 centimes ; elles sont gardées en cache 3 h et limitées à 30 par heure (`ANALYSE_MAX_HEURE`).

**Quota :** une actualisation coûte (nombre de compétitions × nombre de marchés) crédits. Les cotes sont mises en cache 10 min côté serveur et 30 min dans le navigateur ; le nombre de crédits restants s'affiche dans les réglages.

## Organisation du code

```
lib/engine/   moteur pur et testé : proba, valeur (juste prix + indice), mise (Kelly + garde-fous),
              combos (programmation dynamique), modes, bankroll (poches, stats, projection), reglement,
              conseiller (décisions, heures de jeu, plan du jour, récap), temps (fuseaux horaires)
lib/serveur/  analyste (Claude + recherche web), agent (tâche du cron), push (Web Push), stockage
lib/autonomie.tsx  service worker, notifications, synchronisation, validation en un clic
lib/oddsapi.ts  client serveur The Odds API (la clé ne quitte jamais le serveur)
lib/demo.ts     générateur de matchs et de cotes réalistes pour le mode démo
lib/store.tsx   état local (localStorage) ; lib/donnees.tsx : cotes, résultats, calculs dérivés
app/            pages : accueil, classique, objectif, jackpot, suivi, reglages + routes /api
```

Les données (bankroll, paris, réglages) restent dans le navigateur de l'appareil : pense à exporter une sauvegarde depuis les réglages.
