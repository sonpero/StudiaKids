# Module `exercise-generator`

## Responsabilité

Transformer le Markdown extrait d'un cours (ou un extrait de ce Markdown,
voir plus bas) en **items** (les unités apprenables) annotés par les types
de jeu qui leur conviennent, puis générer et stocker les exercices
correspondants. Ce module décide **ce qui est demandé** ; `game-engine`
décide **comment c'est joué et corrigé**.

Fusionne, en le simplifiant, ce que StudIA sépare en deux modules
(`content` pour le découpage en notions, `generation` pour les cartes) —
voir `docs/inventaire-studia.md`, §6. Différence structurante : ici un item
porte une liste de types de jeu **applicables** (au plus 3), choisie par le
modèle parmi les sept types fermés de `docs/modules/game-engine.md`, et la
génération fait **un appel par type pour tout le cours**, pas un appel par
item (décidé à l'ouverture de M3, validé par un dry-run réel : 7 appels et
environ 0,05 à 0,07 $ par cours, au lieu de jusqu'à 281 appels).

**Ce module est aussi appelé depuis `tutor`** (le chip "Fais-moi un jeu
là-dessus", `docs/modules/tutor.md`, M6) avec un simple extrait de cours
— voir "Découpage à partir d'un extrait" plus bas. `exercise-generator` ne
dépend jamais de `tutor` ; il dépend d'`ingestion` (texte extrait, niveau
et matière du cours, et `generateWithRetry`) via son `index.ts`, jamais l'inverse.

Vocabulaire : voir `docs/glossaire.md`.

## Règle d'ancrage — prioritaire sur toute autre règle de qualité

**Chaque exercice, réponse comprise, doit être vérifiable à partir du
texte du cours.** Aucun fait, aucun ordre, aucun exemple absent de la
leçon : un QCM ne teste que ce que la leçon dit, un texte à trous ne troue
qu'un mot de la leçon, une remise en ordre ne reprend qu'une suite que la
leçon donne dans cet ordre, un calcul ne reprend qu'un calcul de la leçon.
Décidé à l'ouverture de M3, après un dry-run où le modèle avait inventé
l'ordre « fossé, pont-levis, murailles, donjon ».

Inscrite dans la consigne de découpage (le corps d'un item recopie la
leçon) et dans celle de génération — qui écartent aussi la section
« Exercices » de la page : ses questions n'ont pas leur réponse dans la
leçon (mesuré par l'évaluation, consignes v3) — et **vérifiée mécaniquement** en
`domain/` quand c'est possible (`anchoringProblem`) :

| Type | Vérification mécanique (texte normalisé : casse, accents, espaces, apostrophes) |
|---|---|
| `cloze` | chaque réponse attendue figure dans le texte du cours |
| `delayed_copy` | le mot ou la phrase figure tel quel dans le texte du cours |
| `reordering` | chaque élément figure dans le texte, **dans cet ordre** (chaque élément cherché après le précédent) ; une suite de nombres ou de calculs est de toute façon interdite, voir « Règles par matière » |
| `matching` | chaque élément de gauche et de droite figure dans le texte |
| `mcq` | la bonne réponse figure dans le texte |
| `mental_math` | le calcul est juste, ses nombres figurent dans le texte, et **le cours écrit ce calcul avec son résultat** dans une même chaîne d'égalités (« 5 + 8 = 8 + 5 = 13 », « 8 352 = 8 000 + … », « 2 × 3 = 6 cm ») ; un calcul seulement demandé (« 7 + 7 = … », section Exercices de la page) est écarté — ajouté le 2026-09-26 après le tri des rejets de l'évaluation |
| `true_false` | la phrase ne contient pas sa propre réponse (« vrai », « faux », « c'est vrai ») ; sa justesse n'est pas vérifiable mécaniquement |

Ce qui n'est pas vérifiable mécaniquement (justesse d'un vrai/faux, d'un
QCM, d'une paire) est jugé par l'outil d'évaluation (`pnpm eval`, consigne
de jugement versionnée dans `tests/eval/`), jamais en production. **Un
type pour lequel la règle d'ancrage s'avère impossible à tenir est retiré
de la liste proposée au découpage** (noté dans `docs/jalons.md`).

## Règles par matière

Décidées le 2026-10-04 (« jeux de maths centrés sur le calcul ») ; elles
s'ajoutent à la règle d'ancrage, qui reste inchangée et prioritaire.

1. **Jamais de remise en ordre (`reordering`) pour une table de
   multiplication, une suite de calculs ou une suite de nombres**, quelle
   que soit la matière : un élément qui n'est qu'un nombre (en chiffres ou
   en lettres) ou un calcul (`isNumberOrCalculation`) suffit à écarter
   l'exercice. Une suite d'étapes (« J'aligne les unités… ») ou une
   chronologie datée (« 1789 : la Révolution ») reste permise.
2. **En maths, on travaille le calcul, pas l'orthographe** : jamais de
   copie différée (`delayed_copy`) ; un texte à trous (`cloze`) n'a que
   des trous qui sont des nombres écrits en chiffres (« 56 », « 8 000 »,
   « 3,5 », « 3/4 » ; jamais « somme », ni « douze »). À privilégier :
   calcul mental, QCM et vrai/faux sur des calculs, appariement calcul et
   résultat. « À privilégier » reste une consigne : un QCM de vocabulaire
   ancré n'est pas écarté.

La matière est celle du cours (`Subject`, `docs/modules/ingestion.md`),
lue par `CourseTextSource.readSubject` ; `null` (matière inconnue) n'applique
que la règle 1. Appliquées à deux niveaux :

- **dans les consignes** (version 5) : la consigne de découpage interdit
  la remise en ordre de nombres pour toutes les matières et, en maths,
  exclut `delayed_copy` et restreint `cloze` ; la consigne de génération
  ajoute, en maths, sa règle propre à `cloze`, `mcq`, `true_false` et
  `matching` ;
- **après génération, de façon déterministe** (`subjectProblem`, en
  `domain/`, mutation testing) : un exercice interdit pour la matière est
  écarté comme un exercice invalide, quoi que le modèle ait renvoyé. Au
  découpage, un type interdit (`isGameTypeAllowed`) est retiré des types
  d'un item comme un type inconnu (un item qui n'en garde aucun est
  invalide), et la génération d'un type interdit ne fait **aucun appel**.

Un exercice déjà en base que ces règles interdisent est enlevé à la
génération suivante de son type, même si rien ne le remplace — retiré
s'il a déjà été joué (voir « Exercice retiré »).

## Domaine

```ts
// GameType vit dans packages/contracts (partagé avec game-engine, exposé
// dans le contrat HTTP) : voir docs/modules/game-engine.md.
import type { GameType } from "@studiakids/contracts";

type Item = {
  id: string;
  courseId: string;
  userId: string;
  title: string;                   // 3 à 60 caractères, un groupe nominal, distinct dans le cours
  body: string;                    // Markdown autonome, recopié de la leçon
  applicableGameTypes: GameType[]; // 1 à 3, valeurs de l'énumération fermée
  position: number;                // contigu depuis 0
  createdAt: string;
};

type Exercise = {
  id: string;
  itemId: string;
  userId: string;
  type: GameType;
  content: ExerciseContent;        // union discriminée par type, voir game-engine.md
  createdAt: string;
};

// Issue du découpage, stockée ; le reste du statut est dérivé des jobs.
type SplitOutcome = "items_ready" | "insufficient_coverage";
type GenerationStatus = "not_started" | "splitting" | "insufficient_coverage" | "generating" | "ready" | "failed";
```

**Invariants, appliqués en `domain/` et testés (mutation testing sur la
couverture et les validateurs, `CLAUDE.md`) :**

- **Couverture** :

  ```ts
  const COVERAGE_MIN_ITEMS = 8;    // valeur du brief, non négociable — en dessous, insufficient_coverage
  const COVERAGE_MAX_ITEMS = 40;   // décidé, révisable — au-delà, les 40 premiers items sont gardés
  ```

  La couverture se compte sur les items **valides** (titre de 3 à 60
  caractères, corps non vide, au moins un type connu). En dessous de 8,
  aucun item n'est écrit et la mascotte invite à reprendre une photo.
- `applicableGameTypes` : seules les valeurs de l'énumération fermée sont
  gardées, dans l'ordre donné, **au plus 3** (`ITEM_MAX_GAME_TYPES`) ; un
  item sans aucun type connu est invalide
- Positions contiguës depuis 0 ; titres distincts dans un cours,
  insensibles à la casse après trim (un doublon est écarté)
- **Validation exercice par exercice** (`exerciseProblem`) : forme propre
  au type (QCM : 4 options distinctes, bonne réponse parmi elles ; texte à
  trous : autant de trous `{{n}}` que de réponses ; appariement et remise
  en ordre : 3 à 6 éléments ; copie différée : 1 à 6 mots ; calcul : un
  nombre), item désigné dans la liste, puis règle d'ancrage. **Un exercice
  invalide est écarté seul** ; les autres sont gardés.
- **Seuil de régénération** (`needsRegeneration`) : un type est régénéré
  **une seule fois** si moins de la moitié des exercices demandés sont
  valides, ou si aucun ne l'est. Après cette unique régénération, les
  exercices valides de la meilleure des deux réponses sont gardés, même
  s'ils sont peu nombreux.

`applicableGameTypes` est une **étiquette**, pas une garantie : la
génération peut ne produire aucun exercice valide pour un item et un type.

## Ports

```ts
interface ItemSplitter {
  split(input: { markdown: string; grade: Grade; subject?: CourseSubject }): Promise<Result<ItemProposal[], GenerationError>>;
}
type ItemProposal = { title: string; body: string; applicableGameTypes: string[] }; // filtré en domain/

interface ExerciseGenerator {
  // Un appel pour un type et tous les items qui le portent. Chaque exercice
  // désigne son item par son numéro dans la liste donnée.
  generate(input: {
    type: GameType;
    items: { title: string; body: string }[];
    courseMarkdown: string;   // le texte de référence de la règle d'ancrage
    grade: Grade;
    subject?: CourseSubject;  // les règles par matière ; absent = null
  }): Promise<Result<ExerciseProposal[], GenerationError>>;
}
type ExerciseProposal = { item: number; content: unknown }; // validé exercice par exercice en domain/

// Le texte d'un cours confirmé et prêt, et sa matière, lus via ingestion.
interface CourseTextSource {
  read(userId: string, courseId: string): Promise<Result<{ markdown: string; grade: Grade }, "not-found" | "not-ready">>;
  readSubject(userId: string, courseId: string): Promise<CourseSubject>; // Subject | null
}
```

Conventions Zod (`CLAUDE.md`, règle 4, avec son exception) :

- **Un schéma plat par type de jeu, un appel par type** — jamais une union
  discriminée dans un seul appel. La réponse est un objet `{ exercises: [...] }`.
- Contraintes dans `.describe()`. **Pas de `.refine()` sur la forme d'un
  exercice** : un exercice invalide ne doit pas faire échouer tout le lot,
  il est écarté en `domain/` (exception à la règle 4, décidée à
  l'ouverture de M3). Le retry unique de la règle 4 ne sert plus qu'à une
  réponse qui ne se lit pas du tout (schéma global).
- **Réparation des tableaux sérialisés** : `claude-sonnet-5` renvoie
  presque toujours un tableau racine encodé en chaîne JSON (6 appels sur 7
  au dry-run), parfois ré-emballé dans sa propre clé ;
  `generateWithRetry` (`ingestion`) le décode avant validation.

## Cas d'usage

- `startGeneration(userId, courseId, now)` — le bouton **« Créer mes
  jeux »** (lecteur ou accueil). Uniquement pour un cours `confirmed` et
  `ready` dont le statut de génération est `not_started` ou `failed` ; sans
  effet si un découpage ou une génération est déjà en cours (même succès).
  Enfile `split-items`. **Jamais déclenché automatiquement** après
  l'extraction.
- `handleSplittingJob({ courseId }, ctx)` — lit le texte extrait et le
  niveau via `ingestion`, appelle `ItemSplitter`, filtre et valide les
  items en `domain/`, contrôle la couverture :
  - moins de 6 items valides → issue `insufficient_coverage`, aucun item
    écrit, le job se termine **avec succès** (résultat métier, jamais
    retenté ni repayé) ;
  - sinon → écrit les items (en remplaçant ceux d'un découpage précédent
    sans exercice), issue `items_ready`, puis **enfile un job
    `generate-exercises` par type présent** sur au moins un item.
  - **Idempotent** : un cours qui a déjà ses items n'est pas redécoupé
    (rien n'est repayé) ; seuls les jobs de type manquants sont enfilés.
- `handleGenerationJob({ courseId, type, itemIds? }, ctx)` — les items du
  cours qui portent ce type (ou seulement `itemIds`, pour une régénération
  d'item), **un appel** `ExerciseGenerator`, validation exercice par
  exercice, régénération unique sous le seuil, puis écriture :
  - **un exercice au plus par item et par type** ;
  - **comparaison avant écriture** (recopié de StudIA) : un exercice dont
    le contenu n'a pas changé garde son id (et donc, à partir de M4, ses
    tentatives et ses étoiles) ; un contenu changé remplace l'ancien sous
    un nouvel id — **sauf si l'ancien a déjà été joué : il reste alors tel
    quel** (voir « Exercice retiré ») ; jamais de doublon.
  - règles par matière : un type interdit pour la matière ne fait aucun
    appel et ses exercices existants sont enlevés ; un exercice existant
    interdit est enlevé même sans remplaçant.
  - Une erreur technique (modèle, réseau) renvoie une erreur : le noyau
    `jobs` retente. Un manque d'exercices valides n'est pas une erreur.
- `regenerateItem(userId, itemId, now)` — enfile un job
  `generate-exercises` par type de l'item, limité à cet item.
- `regenerateCourse(userId, courseId, now)` → `Result<{ types, failed }>` —
  voir « Régénérer un cours déjà généré ».
- `listItems(userId, courseId, { createdAfter? })`, `listExercises(userId, itemId)`,
  `countExercises(userId, courseId)` (le nombre de jeux prêts de l'accueil)
- `getGenerationStatus(userId, courseId)` → `{ status, done, total, failed, itemCount }`,
  **dérivé** (`generationStatus`, fonction pure de `domain/`, même
  mécanisme que `failed` en M2) de l'issue stockée du découpage et des
  jobs `split-items` et `generate-exercises` du cours :
  - aucun job de découpage → `not_started` ; découpage en attente ou en
    cours → `splitting` ; découpage épuisé sans issue → `failed` ;
  - `insufficient_coverage` stocké → `insufficient_coverage` ;
  - `items_ready` : un job de type en attente ou en cours → `generating`
    (`done`/`total` en types) ; tous terminés → `ready`, même si certains
    ont échoué (`failed` les compte) ; tous en échec → `failed`.

**Aucun appel LLM à l'intérieur d'une transaction.**

### Découpage à partir d'un extrait (déclenché par le tuteur)

Le chip "Fais-moi un jeu là-dessus" du tuteur (`docs/modules/tutor.md`)
transmet **le passage du cours sur lequel portait le dernier échange**
(les sections citées par la dernière réponse complète, jamais la question
de l'enfant), pas le cours entier. Conséquences actées :

- **Aucun jeu éphémère.** Le résultat est ajouté à la liste normale des
  items et exercices du cours, dans les mêmes tables, avec le même cycle
  de vie — rien ici ne sort du modèle de données déjà décrit.
- **Le contrôle de couverture s'applique à l'identique** (le même seuil de
  6 items minimum, pas un seuil réduit pour l'occasion) : un extrait court
  produira souvent moins de 6 items, et c'est le cas attendu, pas une
  anomalie — la mascotte le dit et propose de jouer sur le cours entier
  plutôt que de livrer un jeu creux (voir `docs/modules/tutor.md`).
- **Mêmes règles d'étoiles que tout autre exercice** : aucun traitement
  particulier dans `game-engine` ou `progress`.

Mécanisme :

- `startGameFromExcerpt(userId, courseId, excerpt: string, now)` →
  `Result<{ jobId: string }, SplitError>`. Enfile **un seul job**,
  `game-from-excerpt`, qui fait le découpage ET la génération.
  **Exception délibérée à la règle "un job par type"** ci-dessus : cette
  règle sert un cours entier, où isoler les types a de la valeur ; ici
  l'extrait produit normalement peu d'items, l'interaction est live
  (l'enfant attend, depuis l'écran tuteur), et chaîner des jobs distincts
  n'apporterait qu'une latence supplémentaire.
- `handleGameFromExcerptJob(payload, ctx)` :
  1. `ItemSplitter.split({ markdown: excerpt, grade })`
  2. Moins de 6 items → le job échoue, `last_error` commence par le préfixe
     documenté `INSUFFICIENT_COVERAGE:` (convention nécessaire parce que
     `jobs` est frozen et n'a pas de champ de résultat structuré au-delà de
     `last_error`) ; aucun item écrit
  3. Sinon, écrit les nouveaux items **à la suite** des positions
     existantes du cours (jamais un remplacement), puis un appel de
     génération par type présent sur ces items, dans ce même job, avec les
     mêmes règles (ancrage, écart un par un, régénération sous le seuil)
- `getGameFromExcerptStatus(userId, courseId, jobId)` — lit le job via
  `jobs.listJobs(userId, 'game-from-excerpt')`, et sur `status: 'done'`,
  retrouve les items créés via `listItems(userId, courseId, { createdAfter: job.createdAt })`

### Régénérer un cours déjà généré

Ajouté le 2026-10-04 pour les cours de maths générés avant les règles par
matière. `regenerateCourse` lance, **sans job et sans nouveau découpage**,
la génération de chaque type porté par les items du cours, une fois, pour
tout le cours, sous les consignes et règles du jour (même code que
`handleGenerationJob`) ; un type dont l'appel échoue est signalé, les
autres continuent. Les items, leurs types et leurs positions ne changent
pas (pas de redécoupage : il remplacerait les items, donc les exercices
joués).

`pnpm exercises:regenerate-maths <username> [--dry-run]` (CLI seulement,
`apps/api`) l'applique aux cours de maths confirmés et prêts d'un compte,
puis affiche le total d'étoiles avant et après et échoue bruyamment s'il a
baissé. `--dry-run` liste les cours et les types sans appel ni écriture.
Coût : environ un appel par type et par cours, deux si le seuil de
régénération est franchi (≈ 0,05 $ par cours d'après le dry-run de M3).
À lancer dans le conteneur de production, compte par compte, `--dry-run`
d'abord.

**Aucune étoile perdue** : les étoiles sont dérivées des tentatives
(`docs/modules/progress.md`), qui partent en cascade avec leur exercice ;
la régénération s'appuie donc sur « Exercice retiré » ci-dessous.

### Exercice retiré

**Un exercice qui a déjà au moins une tentative n'est jamais supprimé**
(décidé le 2026-10-04) : supprimé, il emporterait ses tentatives, donc les
étoiles de l'enfant, alors que « le total ne décroît jamais ». Garanti dans
la transaction d'écriture (`applyExercises`, qui lit `attempts` par une
requête liée, comme `courses` pour la propriété) :

- **remplacé** (même item, même type) : il reste tel quel, le nouveau
  contenu n'est pas écrit ;
- **enlevé sans remplaçant** (règles par matière) : il est **retiré**
  (`exercises.retired = 1`) — absent de toutes les listes, de
  `findExercise` et du nombre de jeux prêts, gardé avec ses tentatives,
  supprimé avec son cours ou son compte ;
- l'emplacement (item, type) d'un exercice retiré ne prend pas de nouvel
  exercice ;
- un exercice jamais joué est supprimé comme avant.

Conséquence assumée : `regenerateItem` ne change plus un exercice déjà
joué.

*Depuis le 2026-10-04* (suppression d'un cours confirmé, migration 0008),
une tentative survit de toute façon à son exercice
(`docs/modules/game-engine.md`) : supprimer un exercice joué ne retirerait
plus d'étoile. La règle ci-dessus est gardée telle quelle : un exercice
retiré reste caché sans perdre son emplacement.

## Persistance

```sql
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  game_types_json TEXT NOT NULL,   -- GameType[], 1 à 3
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (course_id, position)
);
CREATE INDEX idx_items_course ON items(course_id, position);

CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('delayed_copy','mcq','matching','reordering','cloze','true_false','mental_math')),
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  retired INTEGER NOT NULL DEFAULT 0,  -- "Exercice retiré", migration 0007
  UNIQUE (item_id, type)
);
CREATE INDEX idx_exercises_item ON exercises(item_id);

-- Issue du découpage d'un cours ; le reste du statut est dérivé des jobs.
CREATE TABLE course_generations (
  course_id TEXT PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  split_outcome TEXT NOT NULL CHECK (split_outcome IN ('items_ready','insufficient_coverage')),
  item_count INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
```

**`ON DELETE CASCADE` sur chaque `user_id`** (décidé à l'ouverture de M3) :
`pnpm accounts:delete` efface items, exercices et issues de découpage,
prouvé par un test. `course_generations` remplace la colonne
`courses.generation_status` d'abord envisagée : l'issue du découpage
appartient à ce module, pas à la table d'`ingestion`. **Supprimer un
exercice supprime ses tentatives en cascade** (M4) : c'est pourquoi la
comparaison avant écriture garde l'id d'un exercice inchangé, et pourquoi
un exercice déjà joué est retiré plutôt que supprimé.

## API

| Route | Rôle |
|---|---|
| `POST /api/courses/:id/generate` | « Créer mes jeux » : enfile le découpage ; `202` avec le statut courant |
| `GET /api/courses/:id/generation-status` | `{ status, done, total, failed, itemCount }` |
| `GET /api/courses/:id/items` | Liste ordonnée |
| `GET /api/items/:id/exercises` | Exercices d'un item |
| `POST /api/items/:id/regenerate` | Régénération d'un item |

Erreurs : `404 not_found` (identique pour un id inconnu et le cours ou
l'item d'un autre compte) et `409 not_ready` (cours pas encore confirmé) —
les codes de `courseErrorSchema`, aucun code propre à la génération n'a
été nécessaire. Un second « Créer mes jeux » répond le même `202` avec le
statut courant.

Adaptateurs fixture (`LLM_ADAPTER=fixture`, worker et e2e) : les vrais
adaptateurs nourris des réponses enregistrées ; un découpage répond au
texte de la fixture d'ingestion nommée par sa `source` (ou à un cours de
plusieurs photos de cette même page), une génération à son type ; un texte
ou un type inconnu échoue bruyamment.

Le nombre de jeux prêts affiché sur les cartes "Mes cours" est ajouté à
`GET /api/courses` **dans la route API**, qui compose `ingestion` et ce
module : `ingestion` n'importe jamais `exercise-generator` (cycle interdit
par dependency-cruiser). 404 uniforme pour un cours ou un item d'un autre
compte. `startGameFromExcerpt`/`getGameFromExcerptStatus` ne sont pas
exposés ici : la route publique vit dans `docs/modules/tutor.md` (M6).

## Hors périmètre

Jouer un exercice, le comparateur de réponse, le calcul des étoiles
(`game-engine`, `progress`). Une régénération complète d'un cours déjà
généré **depuis l'interface** (seule la CLI `pnpm exercises:regenerate-maths`
existe, sans redécoupage). Toute notion
d'échéance. Recherche plein texte dans les items.

## Tests clés

- Unitaire : couverture à 5 refusée, à 6 acceptée, 40 gardés sur 41 ;
  types hors énumération écartés, au plus 3, item sans type invalide ;
  titres distincts ; positions contiguës
- Unitaire : un validateur et une vérification d'ancrage par type (dont
  l'ordre de la remise en ordre) ; seuil de régénération — mutation
  testing
- Unitaire : `generationStatus` dans chacun de ses cas
- Unitaire : règles par matière (`subjectProblem`, `isGameTypeAllowed`,
  `isNumberOrCalculation`) — mutation testing ; la matière transmise au
  découpeur et au générateur ; en maths, une copie différée jamais
  demandée et un trou-mot écarté ; partout, une remise en ordre de table
  de multiplication écartée même écrite dans cet ordre par la leçon ;
  consignes v5 (`prompts.subject.unit.test.ts`)
- Intégration : **un exercice déjà joué n'est jamais supprimé** — gardé
  s'il est remplacé, retiré s'il est enlevé, caché des listes, ses
  tentatives intactes, emplacement d'un retiré jamais repris, cascade du
  cours inchangée (`exercise-retirement.int.test.ts`) — mutation testing
- Intégration : `pnpm exercises:regenerate-maths` régénère les cours de
  maths du compte seulement, **sans perdre une étoile**, `--dry-run` sans
  appel ni écriture (`maths-regeneration.int.test.ts`)
- Contrat : une fixture de découpage produit au moins 6 items ; une
  fixture de leçon courte en produit moins de 6 et le job se termine en
  `insufficient_coverage` avec un message clair ; une fixture de
  génération produit des exercices dans au moins deux types ; un tableau
  sérialisé est réparé ; une réponse illisible retry une fois puis échoue
- Intégration : **la génération est isolée par type et par exercice** —
  un exercice invalide est écarté seul, un type en échec n'empêche pas les
  autres d'aboutir ; une régénération dont le contenu n'a pas changé garde
  les ids d'exercice, et ne duplique jamais de ligne (**le test qui protège
  les étoiles, écrit tôt**)
- Intégration : relancer le job de découpage laisse un seul jeu d'items et
  ne rappelle pas le modèle ; `accounts:delete` efface items, exercices et
  issues de découpage
- Intégration : `handleGameFromExcerptJob` (M6) — voir plus haut
- Sécurité : items et exercices d'un autre compte absents des listes et en
  404, indiscernables d'un identifiant inconnu (`docs/securite.md`)
- Évaluation (`pnpm eval`, manuel, payant, jamais en CI) : ancrage,
  vrai/faux qui donnent leur réponse, trous bavards ou sans intérêt,
  variété des types, validité — sur un corpus de pages générées
  (`tests/eval/`). Scores par version des consignes dans
  `tests/eval/results/` ; consignes retenues en M3 : v4 (ancrage 95 %,
  validité 95 %, sur une seule course par version). **Consignes v5 (règles
  par matière) pas encore évaluées** : `pnpm eval` passe désormais la
  matière du corpus et compte un exercice interdit comme rejet mécanique

## Enregistrement des fixtures

`pnpm fixtures:record exercise-generator <split|split-short|generate>`
(mêmes options et mêmes garde-fous que pour `ingestion` : test de fumée,
rien d'écrasé sans `--force`, corps de réponse seul) :

- `split` découpe le texte enregistré par `ingestion/legible` ; refusé s'il
  donne moins de 6 items valides. `split-short` découpe celui de
  `ingestion/legible-short` ; refusé s'il en donne 6 ou plus.
- `generate` relit `split.json` par le vrai adaptateur (sans appel) et
  enregistre une réponse par type proposé : `generate-<type>.json`.
- Chaque fichier nomme sa `source` (le corps des requêtes n'est jamais
  écrit). `schema-violation.json` est la seule fixture retouchée à la main
  (`degradedFrom: split.json`), pour le chemin du retry unique.

Enregistrées le 2026-09-26 avec les consignes v4 (13 items pour « Le
verbe », 5 pour « Le son [a] », six types générés). Toutes les réponses de
génération et celle de `split-short` arrivent sérialisées en chaîne JSON :
les tests de contrat couvrent la réparation sur des réponses réelles.
Elles n'ont pas été réenregistrées avec les consignes v5 : leçon de
français, seule la règle 1 la concerne, et aucun de ses exercices ne la
viole ; aucune fixture de leçon de maths n'est enregistrée.

## Questions ouvertes

- Le brief ne précise pas si l'enfant choisit *quels* types jouer pour un
  item, ou si `game-engine` pioche parmi les exercices disponibles — voir
  `docs/modules/game-engine.md` (M4).
- ~~Limiter les types par item~~ — **tranché** : au plus 3.
- ~~En-tête de page sorti en `#`~~ — **tranché à la source** (2026-09-26,
  `docs/modules/ingestion.md`, "Forme du Markdown"). Un cours de plusieurs
  pages peut porter un `#` par page : la consigne de découpage le traite
  comme un seul cours.
- ~~Seuil de 8 items et pages courtes~~ — **tranché** (2026-09-26) :
  seuil abaissé à **6** (`COVERAGE_MIN_ITEMS`). Sur le corpus, deux leçons
  d'une page bien remplie (le cercle en 6e, le passé composé en CM2)
  donnaient 7 items honnêtes. La consigne de découpage (« entre 8 et 40
  items quand la leçon le permet », consignes v4) n'a pas été changée :
  elle n'a pas été réévaluée, et viser plus haut que le seuil ne gêne pas.
- Jeu d'évaluation sur de **vraies photos de téléphone** : dette ouverte de
  M3, non bloquante pour sa clôture (aucune photo réelle disponible ;
  l'évaluation se fait sur un corpus d'images générées).
