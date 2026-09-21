# Module `progress`

## Responsabilité

Transformer le journal de tentatives (`game-engine`) en étoiles visibles :
combien au total, combien depuis un instant donné (aujourd'hui, ou depuis le
début d'une session de jeu), et la série en cours. Ce module ne calcule
jamais depuis un compteur mutable — tout est dérivé à la lecture depuis les
événements bruts, comme demandé.

`progress` compose au-dessus de `game-engine` via son `index.ts` ;
`game-engine` n'importe jamais `progress` en retour — même règle de sens
unique que `workspace`/`review` dans StudIA
(`docs/inventaire-studia.md`, §8).

Sans équivalent direct dans StudIA (dont le module `progress` calcule un
plan de révision vers une échéance, hors sujet ici — collision de nom
assumée, voir `docs/glossaire.md`) — mais le principe "événements en
append-only, compteurs dérivés par une fonction pure" est directement
recopié du `streak` de `workspace` (`docs/inventaire-studia.md`, §8).

Vocabulaire : voir `docs/glossaire.md` pour la correspondance entre les
termes de prose (série, compteurs, palier de bonus...) et les identifiants
anglais ci-dessous.

## Domaine

```ts
type AttemptSummary = { correct: boolean; starEligible: boolean; attemptedAt: string };

type StarsPerAttempt = { attemptedAt: string; stars: 0 | 1 | 2 };  // 2 = bonus de série inclus

type StarCounters = {
  total: number;
  starsSince: number | null;   // null si aucun filtre `since` demandé
  currentStreak: number;
  bestStreak: number;
};

const STREAK_BONUS_THRESHOLD = 5;
// Décidé, valeur de départ simple : toutes les 5 bonnes réponses
// consécutives, une étoile bonus. Choisi parce que c'est assez fréquent
// pour être motivant dans une session courte sans banaliser le bonus ;
// révisable après les premiers essais réels.
```

**`starEligible: false` (relecture en copie différée) est totalement
invisible ici** : ni comptée, ni cassante pour la série. Une relecture n'est
ni une réussite ni un échec au sens des étoiles, elle est hors de
l'économie d'étoiles — exactement ce que le brief demande ("une relecture
du mot possible sans gain d'étoile").

**Fonctions pures :**

```ts
// Une seule passe chronologique sur l'historique complet. Ignore les
// tentatives non éligibles (relecture) : elles ne comptent ni pour le
// total ni pour la série. Un échec remet la série à 0 sans jamais retirer
// une étoile déjà comptée sur une ligne antérieure.
function computeStarsPerAttempt(attempts: AttemptSummary[]): StarsPerAttempt[];

// Somme les étoiles de computeStarsPerAttempt, filtrées par
// `since` si fourni (comparaison ISO simple, ISO 8601 UTC trie
// lexicographiquement comme chronologiquement).
function totalStars(perAttempt: StarsPerAttempt[], since?: string): number;

// Repart de l'historique complet : la série "en cours" et la meilleure
// série jamais atteinte sont des propriétés de tout l'historique, pas
// d'une fenêtre — resynthétiser la série à l'intérieur d'une fenêtre
// `since` produirait un nombre qui ne correspond à rien de réel pour
// l'enfant (une série ne "recommence" pas parce qu'on regarde une autre
// période).
function computeStreaks(attempts: AttemptSummary[]): { currentStreak: number; bestStreak: number };
```

**`since`, jamais une notion de "jour" calculée côté serveur.** Le
principe "conversion en heure locale seulement côté web" de `CLAUDE.md`
s'applique strictement ici : un jour UTC ne correspond pas à la journée que
l'enfant perçoit (le changement de date UTC tombe en pleine soirée en
France). L'écran calcule lui-même l'instant de minuit local et le passe en
paramètre `since` — le domaine ne sait rien de "aujourd'hui", seulement
"depuis cet instant précis". Le même mécanisme sert au récapitulatif de fin
de session (`since` = l'instant d'entrée sur l'écran jeux, gardé
uniquement en mémoire côté client, aucune table `sessions` créée pour ça —
simplification délibérée par rapport aux `sessions` persistées de
`review` dans StudIA : rien ici n'a besoin de survivre à un rechargement de
page).

## Ports

```ts
// Le seul port : une lecture au travers de l'index.ts de game-engine,
// jamais un accès direct à sa table `attempts`.
interface AttemptsQuery {
  listByUser(userId: string): Promise<AttemptSummary[]>;
}
```

## Cas d'usage

- `getCounters(userId, since?: string)` → `StarCounters` — lit
  l'historique complet du compte via `gameEngine.listAttemptsForProgress`
  (une méthode exportée par l'`index.ts` de `game-engine` à cet effet, pas la
  `AttemptRepository` interne), applique les fonctions pures ci-dessus.

Aucune écriture dans ce module : il ne fait jamais qu'agréger ce que
`game-engine` a déjà écrit.

## Persistance

Aucune table propre. `progress` ne fait que lire la table `attempts`
détenue par `game-engine`, exclusivement via son `index.ts`.

## API

| Route | Rôle |
|---|---|
| `GET /api/progress/counters` | `{ total, currentStreak, bestStreak }` — compte connecté |
| `GET /api/progress/counters?since=<ISO>` | Ajoute `starsSince`, calculé par rapport à l'instant fourni par le client |

Un seul endpoint sert donc à la fois le compteur d'accueil (sans `since`),
le total "aujourd'hui" (`since` = minuit local calculé côté client) et le
récapitulatif de fin de session (`since` = l'instant d'entrée sur l'écran
jeux) — pas trois routes différentes pour la même forme de donnée.

## Hors périmètre

L'écriture des tentatives (`game-engine`). La liste des cours à reprendre
sur l'accueil, qui appartient à `ingestion` (`lastAccessedAt`,
`docs/modules/ingestion.md`) — `progress` ne concerne que les étoiles,
pas la navigation entre cours. Tout classement entre enfants ou entre
comptes (explicitement absent du produit).

## Tests clés

- Unitaire : mêmes tentatives en entrée, même résultat en sortie, toujours
  (aucune horloge ni aléatoire interne)
- Unitaire : un échec remet `currentStreak` (via `computeStreaks`) à 0 sans
  jamais diminuer `total`
- Unitaire : le bonus se déclenche exactement à la 5e, 10e, 15e bonne
  réponse consécutive, jamais avant, jamais deux fois pour la même
  tentative
- Unitaire : une tentative `starEligible: false` n'apparaît dans aucun
  compteur et ne casse pas une série en cours
- Unitaire : `totalStars` avec un `since` postérieur à toute tentative
  renvoie 0, jamais une exception ; sans `since`, `starsSince` vaut
  `null`
- Intégration : le total renvoyé par l'API correspond exactement à la
  somme dérivée des lignes `attempts` réellement stockées pour ce compte,
  jamais un compteur mis en cache qui pourrait diverger
- Sécurité : les compteurs d'un compte n'incluent jamais les tentatives
  d'un autre compte (test à deux comptes)

## Questions ouvertes

- Un exercice déjà réussi peut-il être rejoué pour regagner une étoile ?
  Question déjà posée dans `docs/modules/game-engine.md` ; la réponse change
  directement si `computeStarsPerAttempt` doit dédupliquer par
  exercice ou compter chaque tentative sans limite.
