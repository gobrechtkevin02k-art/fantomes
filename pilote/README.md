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
2. Ajoute les variables d'environnement :
   - `ODDS_API_KEY` : ta clé The Odds API (500 crédits gratuits par mois) ;
   - `APP_PASSWORD` : un mot de passe, pour que personne d'autre n'utilise ton quota (fortement conseillé).
3. Déploie, puis ouvre l'URL sur ton téléphone et « Ajouter à l'écran d'accueil ».

**Quota :** une actualisation coûte (nombre de compétitions × nombre de marchés) crédits. Les cotes sont mises en cache 10 min côté serveur et 30 min dans le navigateur ; le nombre de crédits restants s'affiche dans les réglages.

## Organisation du code

```
lib/engine/   moteur pur et testé : proba, valeur (juste prix + indice), mise (Kelly + garde-fous),
              combos (programmation dynamique), modes, bankroll (poches, stats, projection), reglement
lib/oddsapi.ts  client serveur The Odds API (la clé ne quitte jamais le serveur)
lib/demo.ts     générateur de matchs et de cotes réalistes pour le mode démo
lib/store.tsx   état local (localStorage) ; lib/donnees.tsx : cotes, résultats, calculs dérivés
app/            pages : accueil, classique, objectif, jackpot, suivi, reglages + routes /api
```

Les données (bankroll, paris, réglages) restent dans le navigateur de l'appareil : pense à exporter une sauvegarde depuis les réglages.
