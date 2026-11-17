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

### Pourquoi l'agent ne monte pas la mise *à cause* d'une perte
Monter la mise pour « se refaire » après une perte est la principale cause de ruine d'une bankroll, même avec un bon modèle. Pilote fait donc ceci :
- après une perte, l'agent te prévient et t'indique la prochaine occasion ;
- la mise suit la bankroll (elle baisse donc un peu après une perte et remonte après un gain) ;
- elle n'est **relevée** que si le pari lui-même est exceptionnel (indice ≥ 85 et cote au moins 4 % au-dessus du juste prix), exactement comme les autres jours. La perte précédente ne joue jamais.

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
- [ ] Ouvrir l'appli, faire l'accueil, noter son code (Réglages → Synchronisation) et le mettre dans `PILOTE_ACCES_COMPLET`.
- [ ] iPhone : Partager → « Sur l'écran d'accueil », puis ouvrir depuis l'icône.
- [ ] Réglages → Notifications → Activer, puis « Envoyer un test ».
- [ ] Vérifier le plan du jour, valider une session en un clic.
- [ ] Le lendemain : notification de 7h, récap à l'ouverture.
- [ ] Avec un deuxième téléphone (offre gratuite) : acheter Essentiel en mode test, vérifier le déblocage, résilier via le portail.

### 3.6 Avant d'ouvrir au public
- CGV, mentions légales et politique de confidentialité propres à Pilote (abonnement, données, résiliation).
- Vérifier les règles de l'ANJ sur la promotion des jeux d'argent (messages de prévention, interdiction aux mineurs, pas d'incitation excessive). Un avis d'avocat est recommandé avant de commercialiser.

---

## 4. Mes propositions d'améliorations (par ordre de priorité)

1. **De vrais comptes clients (e-mail + lien de connexion)** : aujourd'hui un abonnement est rattaché à un code anonyme ; pour vendre, il faut un compte (récupération, partage de code impossible).
2. **Prouver que la méthode marche** : mesurer la *CLV* (la cote obtenue bat-elle la cote de clôture ?) et un graphique « indice annoncé vs réussite réelle ». C'est le meilleur argument de vente, et un garde-fou honnête.
3. **Essai gratuit de 7 jours de Pro** et **tarif annuel** (2 mois offerts).
4. **Notifications Telegram** en plus du web : plus fiables sur iPhone, sans installation.
5. **Tester le modèle sur l'historique** (cotes passées) avant le lancement public, pour fixer les seuils avec des chiffres.
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
