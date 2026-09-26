# Module `game-engine`

## Responsabilité

Faire jouer un exercice généré, comparer la réponse de l'enfant à la
réponse attendue selon la logique propre à son type, et enregistrer chaque
résultat comme un événement. Ce module décide **si c'est correct** ;
`progress` décide **combien d'étoiles ça vaut au total**.

Aucun appel LLM ici : la correction est entièrement déterministe, à la
différence du grader d'ouvert de `review` dans StudIA — le brief ne demande
nulle part une notation par modèle, et un jeu pour un enfant de 6 à 11 ans
n'en a pas besoin (QCM, vrai/faux, calcul, copie, texte à trous,
appariement et remise en ordre se vérifient tous mécaniquement).

Vocabulaire : voir `docs/glossaire.md` pour la correspondance entre les
termes de prose (copie différée, appariement, remise en ordre...) et les
identifiants anglais ci-dessous.

## Domaine

### Les sept types de jeu (agnostiques de la matière)

`GameType` est déclaré dans `packages/contracts` (partagé avec
`exercise-generator`, qui produit le contenu, et exposé dans le contrat
HTTP) :

```ts
type GameType =
  | "delayed_copy"    // un mot/une phrase est montré puis caché, l'enfant le retape de mémoire
  | "mcq"              // question à quatre options, une correcte
  | "matching"         // relier des éléments de deux colonnes
  | "reordering"       // remettre des éléments dans le bon ordre
  | "cloze"            // compléter un texte à trous
  | "true_false"       // affirmation, vrai ou faux
  | "mental_math";     // un calcul, réponse numérique
```

### Contenu d'un exercice, par type

```ts
type ExerciseContent =
  | { type: "delayed_copy"; wordOrPhrase: string }
  | { type: "mcq"; question: string; options: [string, string, string, string]; answer: string }
  | { type: "matching"; pairs: { left: string; right: string }[] }        // 3 à 6 paires
  | { type: "reordering"; elements: string[] }                            // 3 à 6 éléments, dans l'ordre correct
  | { type: "cloze"; text: string; blanks: string[] }                     // texte contient des marqueurs {{0}}, {{1}}, ...
  | { type: "true_false"; statement: string; answer: boolean }
  | { type: "mental_math"; question: string; answer: number };
```

### Le comparateur : jamais une égalité globale

Chaque type a sa propre fonction de comparaison en `domain/`, jamais un
`JSON.stringify(given) === JSON.stringify(expected)` sur l'objet entier —
c'est la règle n°6 de `CLAUDE.md`. Toutes renvoient la même forme : une
liste d'**unités**, chacune correcte ou non. Un exercice à réponse unique
(QCM, vrai/faux, calcul, copie) a une seule unité. Un exercice composite
(appariement, texte à trous, remise en ordre) a une unité par sous-réponse
— ce qui donne mécaniquement "une étoile par bonne réponse" y compris à
l'intérieur d'un seul exercice, sans logique spéciale dans `progress`.

```ts
type UnitResult = { id: string; correct: boolean };
type ComparisonResult = { units: UnitResult[] };

function compareMcq(given: { chosenOption: string }, content: Extract<ExerciseContent, { type: "mcq" }>): ComparisonResult;
function compareTrueFalse(given: { value: boolean }, content: Extract<ExerciseContent, { type: "true_false" }>): ComparisonResult;
function compareMentalMath(given: { value: string }, content: Extract<ExerciseContent, { type: "mental_math" }>): ComparisonResult;
function compareDelayedCopy(given: { text: string }, content: Extract<ExerciseContent, { type: "delayed_copy" }>): ComparisonResult;
function compareMatching(given: { pairs: { left: string; right: string }[] }, content: Extract<ExerciseContent, { type: "matching" }>): ComparisonResult;
function compareReordering(given: { order: string[] }, content: Extract<ExerciseContent, { type: "reordering" }>): ComparisonResult;
function compareCloze(given: { values: string[] }, content: Extract<ExerciseContent, { type: "cloze" }>): ComparisonResult;
```

Règles de normalisation, **différentes selon l'intention pédagogique du
type** — c'est précisément pourquoi il ne peut pas y avoir un seul
comparateur générique :

- **`delayed_copy` est exact**, espaces de début/fin retirés seulement —
  ni la casse ni les accents ne sont assouplis. Le but de l'exercice est de
  reproduire l'orthographe exacte du mot ; l'assouplir viderait l'exercice
  de son sens.
- **`cloze` est tolérant** : casse et accents ignorés, espaces
  normalisés. Ici l'enjeu est le rappel du contenu, pas l'orthographe.
- **`mental_math`** parse la saisie comme un nombre ; une saisie non
  numérique est incorrecte, jamais une exception qui remonte.
- **`matching`** compare chaque paire soumise à l'ensemble des paires
  attendues par sa clé `left`, indépendamment de l'ordre de saisie.
- **`reordering`** compare position par position (unité = une
  position), pas la liste entière comme un seul bloc — c'est l'exemple le
  plus direct de "jamais une égalité globale" : deux éléments adjacents
  inversés ne doivent pas annuler tout le reste de la séquence correcte.

**Précisé à l'ouverture de M4** (là où la règle ci-dessus se taisait ;
choix marqués *à valider*) :

- `delayed_copy` et `cloze` : l'apostrophe typographique `’` vaut `'`
  (le clavier d'un téléphone la substitue ; ce n'est pas de
  l'orthographe) — *à valider*. `delayed_copy` reste exact pour tout le
  reste, **casse comprise**.
- `cloze` : une ponctuation finale saisie (« verbe. ») est ignorée —
  *à valider*.
- `mental_math` : espaces ignorés (« 1 000 »), virgule ou point décimal
  acceptés — *à valider*.
- `mcq`, `true_false`, `matching`, `reordering` se jouent **au tap**
  (toucher un élément, puis sa cible ou sa place ; jamais de
  glisser-déposer) : l'enfant choisit parmi des chaînes fournies,
  comparées à l'identique. Unités : une par paire attendue (`matching`,
  identifiée par son rang ; une paire absente ou fausse est incorrecte),
  une par position (`reordering`), une par trou (`cloze`), une seule
  sinon (identifiant `"0"`).

### Vue jouable (décidée à l'ouverture de M4)

Le navigateur ne reçoit **jamais la réponse** d'un exercice à jouer :
`playableView(exercise, seed)`, fonction pure de `domain/`, renvoie ce que
l'écran affiche — QCM sans `answer`, texte à trous avec le nombre de trous
mais sans `blanks`, vrai/faux sans `answer`, calcul sans `answer`,
appariement en deux colonnes mélangées, remise en ordre mélangée, dictée
flash avec son mot (il doit être montré) et `displayDurationMs`. Le
mélange est **déterministe** (graine : l'id de l'exercice) et **jamais
l'ordre correct** (ni la colonne de droite dans l'ordre des paires). La
correction se fait uniquement côté serveur.

### Copie différée, spécifications complètes (déjà décidées)

**Nom affiché à l'enfant : "Dictée flash"**, vu dans `docs/design/flash.png`
et `saisie.png` (maquettes apparues dans `docs/design/` pendant la
rédaction de ce document, voir `docs/ui.md`, "Direction visuelle") —
`delayed_copy` reste le nom technique
du type de jeu (`GameType`, base de données, code), "Dictée flash" est
uniquement la copie UI, même distinction que pour les libellés de
navigation (`docs/ui.md`, "Navigation").

```ts
function displayDurationMs(grade: Grade): number;
// CP: 5000 · CE1: 4000 · CE2: 3500 · CM1: 3000 · CM2: 2500 · 6e: 2000
// Point de départ à ajuster à l'observation réelle, comme les bornes de
// docs/modules/exercise-generator.md.
```

Déroulé de l'écran (voir `docs/ui.md` pour l'aspect visuel de l'écran de
flash) :

1. Le mot ou la phrase (`wordOrPhrase`) s'affiche seul sur fond violet
   sombre pendant `displayDurationMs(grade)`.
2. L'écran bascule sur un champ de saisie. **`autocorrect="off"`,
   `autoCapitalize="off"`, `autoComplete="off"`, `spellCheck={false}`** sur
   ce champ, sans exception : un correcteur du navigateur qui "corrige"
   silencieusement l'orthographe viderait l'exercice de son sens.
3. Un bouton "Je relis le mot" permet un second affichage du flash avant
   de valider. **L'utiliser rend cette tentative inéligible à une étoile**
   (`starEligible: false` sur l'événement, voir Persistance) — la
   correction et le retour visuel de la mascotte restent normaux, seule
   l'étoile est retenue. La mascotte ne dit jamais que relire est une
   faute : c'est une option normale, juste sans étoile.

**« Une relecture n'écrit jamais d'événement de réussite »** (critère de
M4), lu ainsi à l'ouverture (*à valider*) : un **événement de réussite**
est une tentative à la fois correcte **et** éligible à une étoile. Après
une relecture, aucune tentative ne l'est — `correct` reste fidèle (retour
immédiat, et `progress` ignore déjà les non-éligibles). Règle pure en
`domain/` (`attemptsFor`), sous mutation testing.

Aucun compte à rebours visible (règle 7 de `CLAUDE.md`) : le flash dure
`displayDurationMs`, sans chiffre ni barre qui décompte.

## Ports

Aucun port externe : ce module est entièrement pur en `domain/`. La seule
`infra/` est le repository des tentatives (SQLite).

```ts
interface AttemptRepository {
  // Écrit toutes les unités d'une soumission en une seule transaction
  // courte — jamais une écriture par unité : une coupure en cours de
  // route ne doit jamais laisser une soumission à moitié enregistrée.
  record(userId: string, attempts: NewAttempt[], now: Date): Promise<void>;
  listByUser(userId: string, since?: string): Promise<Attempt[]>;   // pour progress
}

// Les exercices viennent d'exercise-generator, par son index : jamais une
// lecture directe de ses tables.
interface ExerciseSource {
  findExercise(userId: string, exerciseId: string): Promise<Exercise | null>;
  listCourseExercises(userId: string, courseId: string): Promise<Result<{ exercise: Exercise; itemTitle: string }[], "not-found">>;
}
```

## Cas d'usage

- `playExercise(userId, exerciseId, givenAnswer, options: { reread?: boolean }, now)`
  → `Result<{ result: ComparisonResult }, GameError>`
  1. Charge l'exercice et vérifie, via la chaîne
     `exercise → item → course`, qu'il appartient bien au `userId` appelant
     (jamais un exercice chargé sans cette vérification)
  2. Appelle le comparateur du type de l'exercice
  3. Construit un `Attempt` par unité de `result.units`, avec
     `starEligible: !options.reread`
  4. Écrit tout en une transaction via `AttemptRepository.record`
  5. Renvoie `result` — le retour immédiat (mascotte `joy` ou pose
     d'encouragement) est décidé côté écran à partir de ce résultat, pas
     recalculé
- `listPlayableExercises(userId, courseId, grade)` — pour l'écran
  "Jouer" : la vue jouable de chaque exercice du cours (ordre des items,
  puis des types), le titre de son item, et `nextExerciseId`
  (`nextExercise` ci-dessous) ; `not-found` pour un cours d'un autre
  compte
- `nextExercise(userId, courseId, now)` — **décidé, valeur de départ
  simple, révisable après les premiers essais** : le premier exercice, dans
  l'ordre des items puis des types au sein d'un item, qui n'a encore aucune
  tentative correcte et éligible pour ce compte ; si tous ont déjà été
  réussis, reprend depuis le premier exercice du cours. Raison du choix :
  déterministe, ne demande aucun état de session côté serveur, et évite
  naturellement de reproposer indéfiniment ce que l'enfant maîtrise déjà
  tant qu'il reste du nouveau contenu. `docs/design/flash.png` suggère un
  regroupement par séance pour la dictée flash ("Mot 3 sur 8") ; cette
  fonction reste compatible avec un tel regroupement côté écran (l'écran
  peut appeler `nextExercise` en boucle pour constituer sa file), sans
  que le domaine ait besoin de connaître la notion de séance.

  **À noter, sans action immédiate.** "Premier non-réussi, boucle sinon"
  ramènera toujours l'enfant sur le même item raté en premier tant qu'il
  n'est pas réussi — correct pour démarrer, mais potentiellement
  démotivant si cet item résiste (l'enfant retombe systématiquement dessus
  avant de voir autre chose). Une rotation entre les exercices non
  réussis, ou un tirage pondéré qui laisse une chance au reste du cours
  d'apparaître, sera probablement nécessaire après les premiers essais
  réels — non implémenté ici, juste anticipé.

**`playExercise` ne modifie jamais l'exercice lui-même.** Un exercice reste
strictement en lecture une fois généré (règle n°5 de `CLAUDE.md`) ; seule la
table `attempts` grandit.

## Persistance

```sql
CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  unit_id TEXT NOT NULL,             -- '0' pour un exercice à réponse unique
  correct INTEGER NOT NULL,
  star_eligible INTEGER NOT NULL DEFAULT 1,
  attempted_at TEXT NOT NULL
);
CREATE INDEX idx_attempts_user ON attempts(user_id, attempted_at);
CREATE INDEX idx_attempts_exercise ON attempts(exercise_id);
```

**Minimisation (décidé à l'ouverture de M4, `docs/securite.md`)** : la
réponse saisie par l'enfant n'est **jamais** stockée — ni texte, ni choix ;
une tentative garde le résultat, le type de jeu, l'exercice, l'unité,
l'éligibilité et l'horodatage. La colonne `given_answer_json` d'abord
prévue est retirée. `user_id` en `ON DELETE CASCADE` : `accounts:delete`
efface les tentatives (testé).

**Append-only.** Aucune ligne n'est jamais modifiée ou supprimée après
écriture (sauf cascade sur suppression de l'exercice parent). C'est le
journal que `progress` lit pour dériver les compteurs — même principe
que les `reviews` de StudIA, jamais un compteur incrémenté directement.

## API

| Route | Rôle |
|---|---|
| `GET /api/courses/:id/exercises` | `{ exercises: PlayableExercise[], nextExerciseId }` — vue jouable, jamais de réponse |
| `POST /api/exercises/:id/answer` | `{ givenAnswer, reread? }` → `{ result, correction? }` — `correction` (la bonne réponse, forme d'une réponse donnée, `correctionOf`) seulement après une réponse fausse ; `givenAnswer` validé par le schéma du type de l'exercice (`400 invalid_answer` sinon) |

404 uniforme pour un cours ou un exercice d'un autre compte
(`docs/securite.md`).

`GET /api/items/:id/exercises` est déjà exposée par
`docs/modules/exercise-generator.md` ; ce module ne la duplique pas.

## Écran (M4)

Voir `docs/ui.md`, "Jouer (M4)". La liste vient de
`GET /api/courses/:id/exercises` ; « Jeu suivant » prend le suivant dans
cette liste (l'ordre du cours), `nextExerciseId` ne sert qu'à marquer
« À toi de jouer ! ».

**Après une réponse fausse, la bonne réponse s'affiche brièvement**,
portée par la mascotte (décidé à la clôture de M4) : le serveur ne
l'envoie qu'avec le résultat d'une réponse fausse (`correctionOf`,
fonction pure, sous la forme d'une réponse donnée) — jamais avant que
l'enfant ait répondu ; l'écran la montre sous la phrase de la mascotte
pendant `CORRECTION_MS` (4 s, *à valider*), puis la retire.

## Hors périmètre

Génération d'exercices. Calcul des étoiles, des séries et des bonus
(`progress`). Toute notation par modèle.

## Tests clés

- Unitaire, un test par type avec un cas correct et un cas incorrect, plus
  au minimum :
  - `reordering` : deux positions adjacentes inversées ne rendent pas
    les autres positions incorrectes
  - `matching` : les paires soumises dans un ordre différent de l'ordre
    de génération sont quand même comparées correctement
  - `delayed_copy` : une différence de casse ou d'accent est bien comptée
    incorrecte (exact), alors que la même différence est ignorée par
    `cloze` (tolérant) — le test qui prouve que les deux
    comparateurs ne partagent pas la même normalisation par erreur
  - `mental_math` : une saisie non numérique est incorrecte, ne lève
    jamais d'exception
- Unitaire : une soumission avec `reread: true` produit des tentatives
  `starEligible: false`, tout en gardant `correct` fidèle au résultat
  réel
- Intégration : `playExercise` refuse un exercice qui n'appartient pas au
  compte appelant (404 au niveau route, indiscernable d'un identifiant
  inconnu, `docs/securite.md`)
- Intégration : une soumission à plusieurs unités (appariement à 4 paires)
  écrit exactement 4 lignes `attempts` en une seule transaction
- Unitaire : `nextExercise` ignore un exercice déjà réussi tant qu'il
  en reste un autre jamais réussi, et reboucle sur le premier exercice du
  cours une fois tous réussis
- Playwright : un scénario par type de jeu (voir `docs/jalons.md`, M4),
  plus le parcours complet de copie différée avec relecture

## Questions ouvertes

- ~~Montrer la bonne réponse après une erreur~~ — **tranché** à la
  clôture de M4 : oui, brièvement, portée par la mascotte.
- `delayed_copy` sensible à la casse (spec) alors que le défaut proposé
  pour les tolérances non tranchées était « casse ignorée » : la spec a
  été appliquée ; à confirmer.

- Un exercice déjà réussi peut-il être rejoué **volontairement** (pas via
  `nextExercise`, mais si l'enfant revient dessus depuis une liste) pour
  gagner à nouveau une étoile ? Le brief ne l'interdit pas explicitement
  mais "une étoile par bonne réponse" pourrait aussi vouloir dire "par
  exercice unique, une seule fois". À trancher avant `progress`
  (`docs/modules/progress.md` en dépend directement).
- `docs/design/flash.png` montre un regroupement en séance pour la dictée
  flash ("Mot 3 sur 8"). `nextExercise` reste compatible avec un tel
  regroupement côté écran, mais rien ne dit si les six autres types de jeu
  doivent aussi être présentés par séquences plutôt qu'un par un.
