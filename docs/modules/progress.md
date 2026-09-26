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

**Réécrit à l'ouverture de M5** (décisions d'Alexandre, journal de
session ; valeurs *à valider*).

```ts
// Une ligne par unité, telle que game-engine l'a écrite.
type AttemptEvent = { exerciseId: string; attemptedAt: string; correct: boolean; starEligible: boolean };

// Une réponse à un exercice : les unités d'une même soumission partagent
// exercice et instant. Un succès = toutes ses unités justes.
type Submission = { exerciseId: string; at: string; correct: boolean; eligible: boolean };

type Celebration = "streak-bonus" | "comeback";
type SubmissionStars = { exerciseId: string; at: string; stars: 0 | 1; bonus: 0 | 1; celebrate: Celebration | null };

type Progress = { total: number; currentStreak: number; bestStreak: number; submissions: SubmissionStars[] };

const STREAK_BONUS_THRESHOLD = 5;   // fixé par cette spec ; la décision « 3 » ne valait que si la spec se taisait
const PROGRESS_TIME_ZONE = "Europe/Paris";

function deriveProgress(events: AttemptEvent[], timeZone: string): Progress;
function calendarDay(instant: string, timeZone: string): string;   // "AAAA-MM-JJ" dans ce fuseau
```

Une seule passe chronologique sur les soumissions (fonction pure : aucune
horloge, aucun aléatoire, **le fuseau horaire est le seul paramètre
externe**) :

- **Réponse aidée** (`eligible: false`, relecture) : invisible — ni
  étoile, ni série prolongée, ni série cassée, qu'elle soit juste ou
  fausse.
- **Réponse fausse** (une unité au moins fausse) : la série revient à 0 ;
  **aucune étoile n'est jamais retirée** (le total ne décroît jamais).
- **Réponse juste et éligible** :
  - **une étoile** si l'exercice n'a pas encore été récompensé **ce jour
    calendaire en heure de Paris** — donc une au premier succès, puis au
    plus une de plus par exercice et par jour (décision d'Alexandre) ;
    sinon 0 (« déjà récompensée aujourd'hui ») ;
  - la série augmente de 1 dans tous les cas (y compris déjà récompensée
    aujourd'hui) ; **une étoile bonus** chaque fois qu'elle atteint un
    multiple de `STREAK_BONUS_THRESHOLD` ;
  - **fête** : `streak-bonus` sur un bonus ; sinon `comeback` pour la
    **première réussite d'un exercice qui avait d'abord été manqué**
    (réussite marquante, *à valider*) ; sinon rien.
- Unité d'étoile = la réponse à un exercice, pas l'unité d'un exercice
  composite (un appariement réussi à moitié ne rapporte rien, ne retire
  rien) — *à valider*.

Le jour se calcule **côté serveur, en heure de Paris** (décision de M5, qui
remplace « jamais une notion de jour côté serveur ») : bornes à 23 h 59 /
0 h 00 et changements d'heure testés.

## Ports

```ts
// Le seul port : une lecture au travers de l'index.ts de game-engine,
// jamais un accès direct à sa table `attempts`.
interface AttemptsQuery {
  listByUser(userId: string): Promise<AttemptSummary[]>;
}
```

## Cas d'usage

- `getProgress(userId, { since?, submission? })` → `{ total,
  currentStreak, bestStreak, starsSince, successesSince, submission }` —
  lit toutes les tentatives du compte via `gameEngine.listAttemptsForProgress`
  (exporté par l'`index.ts` de `game-engine`), applique `deriveProgress`
  avec `PROGRESS_TIME_ZONE`. `since` (instant fourni par l'écran : entrée
  dans Jouer) donne les étoiles gagnées et les bonnes réponses (aidées
  comprises) depuis ; `submission` (`{ exerciseId, at }`) renvoie ce que
  cette réponse a rapporté et sa fête.

Aucune écriture dans ce module : il ne fait jamais qu'agréger ce que
`game-engine` a déjà écrit — **aucune colonne d'étoiles, aucun compteur
stocké**.

## Persistance

Aucune table propre. `progress` ne fait que lire la table `attempts`
détenue par `game-engine`, exclusivement via son `index.ts`.

## API

| Route | Rôle |
|---|---|
| `GET /api/progress` | `{ total, currentStreak, bestStreak }` — compte connecté |
| `GET /api/progress?since=<ISO>` | Ajoute `starsSince` et `successesSince` (récapitulatif de session) |

`POST /api/exercises/:id/answer` (`game-engine`) renvoie en plus
`progress: { total, currentStreak, bestStreak, stars, celebrate }` —
composé dans la route API, pour que le compteur se mette à jour sans
rechargement.

## Hors périmètre

L'écriture des tentatives (`game-engine`). La liste des cours à reprendre
sur l'accueil, qui appartient à `ingestion` (`lastAccessedAt`,
`docs/modules/ingestion.md`) — `progress` ne concerne que les étoiles,
pas la navigation entre cours. Tout classement entre enfants ou entre
comptes (explicitement absent du produit).

## Tests clés

- Unitaire : mêmes événements en entrée, même résultat en sortie (test
  explicite, ordre des événements mélangé compris)
- Unitaire : un échec ne diminue jamais le total (ajout d'un échec à
  n'importe quel historique)
- Unitaire : une étoile au premier succès, puis au plus une par exercice et
  par jour de Paris — bornes 23 h 59 / 0 h 00 en heure d'hiver et d'été, et
  les deux nuits de changement d'heure
- Unitaire : bonus exactement à la 5e, 10e bonne réponse consécutive ;
  réponse aidée neutre ; réponse déjà récompensée aujourd'hui qui prolonge
- Unitaire : fête `comeback` et `streak-bonus`
- Mutation testing sur tout ce qui précède
- Intégration : le total renvoyé par l'API correspond exactement à la
  dérivation des lignes `attempts` réellement stockées pour ce compte
- Sécurité : les compteurs d'un compte n'incluent jamais les tentatives
  d'un autre compte (test à deux comptes)

## Questions ouvertes

- ~~Rejouer un exercice réussi pour regagner une étoile~~ — **tranché à
  l'ouverture de M5** : au plus une étoile de plus par exercice et par
  jour de Paris.
