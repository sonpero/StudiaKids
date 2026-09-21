# Module `exercise-generator`

## Responsabilité

Transformer le Markdown extrait d'un cours (ou un extrait de ce Markdown,
voir plus bas) en **items** (les unités apprenables) annotés par les types
de jeu qui leur conviennent, puis générer et stocker les exercices
correspondants. Ce module décide **ce qui est demandé** ; `game-engine`
décide **comment c'est joué et corrigé**.

Fusionne, en le simplifiant, ce que StudIA sépare en deux modules
(`content` pour le découpage en notions, `generation` pour les cartes) —
voir `docs/inventaire-studia.md`, §6. La différence structurante par
rapport à StudIA : ici, un item porte une liste de types de jeu
**applicables**, choisie par le modèle parmi les sept types fermés définis
dans `docs/modules/game-engine.md`, au lieu d'un type de carte fixe demandé
par l'utilisateur.

**Ce module est maintenant aussi appelé depuis `tutor`** (le chip "Fais-moi
un jeu là-dessus", `docs/modules/tutor.md`) avec un simple extrait de
cours plutôt qu'un cours entier — voir "Découpage à partir d'un extrait"
plus bas. `exercise-generator` ne dépend jamais de `tutor` en retour ;
seul `tutor` importe `exercise-generator` via son `index.ts`.

Vocabulaire : voir `docs/glossaire.md` pour la correspondance entre les
termes de prose (découpage, couverture, item...) et les identifiants
anglais ci-dessous.

## Domaine

```ts
// GameType vit dans packages/contracts (partagé avec game-engine, exposé
// dans le contrat HTTP) : voir docs/modules/game-engine.md pour les sept
// valeurs et ce que chacune signifie.
import type { GameType } from "@studiakids/contracts";

type GenerationStatus =
  | "not_started"
  | "splitting"
  | "insufficient_coverage"
  | "items_ready"
  | "generating"
  | "ready"
  | "failed";

type Item = {
  id: string;
  courseId: string;
  userId: string;
  title: string;                 // 3 à 60 caractères, un groupe nominal
  body: string;                  // Markdown, autonome
  applicableGameTypes: GameType[];  // au moins 1, choisis par le modèle
  position: number;              // contigu depuis 0, y compris pour les items ajoutés après coup (voir plus bas)
  createdAt: string;
};

type Exercise = {
  id: string;
  itemId: string;
  userId: string;
  type: GameType;
  content: ExerciseContent;   // union discriminée par type, voir game-engine.md
  createdAt: string;
};
```

**Invariants, appliqués en `domain/` et testés :**

- Positions contiguës depuis 0, sans trou, y compris après un ajout
  d'items par extrait (voir plus bas) — les nouveaux items continuent la
  numérotation, ils ne la recommencent jamais
- `body` d'un item est autonome : doit se comprendre lu seul, hors de son
  contexte, puisque c'est ainsi qu'il sera joué
- Titres distincts au sein d'un cours, insensibles à la casse après trim
- **Couverture d'un découpage, les deux bornes documentées ensemble :**

  ```ts
  const COVERAGE_MIN_ITEMS = 8;    // valeur du brief, non négociable — en dessous, `insufficient_coverage`
  const COVERAGE_MAX_ITEMS = 40;   // décidé, point de départ, révisable
  ```

  En dessous de `COVERAGE_MIN_ITEMS`, le job échoue explicitement
  (`insufficient_coverage`) plutôt que de générer des jeux sur une base
  trop pauvre — c'est cette borne qui déclenche, côté `ingestion`, le
  message de la mascotte invitant à reprendre une photo. Au-delà de
  `COVERAGE_MAX_ITEMS`, valeur de départ simple choisie parce qu'elle
  laisse une marge large sans autoriser un cours qui exploserait en
  contenu ingérable, révisable dès que de vraies photos de cours CP à 6e
  auront été observées en éval (même démarche que StudIA pour ses propres
  bornes, `docs/modules/content.md` de StudIA).
- `applicableGameTypes` ne contient que des valeurs de l'énumération fermée
  des sept types, jamais vide

`applicableGameTypes` est une **étiquette**, pas une garantie de qualité :
c'est une entrée pour la génération d'exercices, pas une promesse que
chaque type produira un bon exercice. La génération peut échouer pour un
type donné sans invalider les autres (voir Cas d'usage).

## Ports

```ts
interface ItemSplitter {
  split(input: {
    markdown: string;    // le cours entier, OU un simple extrait (voir plus bas) — le port ne distingue pas les deux cas
    grade: Grade;         // pour calibrer la difficulté du vocabulaire des consignes
  }): Promise<Result<ItemProposal[], SplitError>>;
}
type ItemProposal = { title: string; body: string; applicableGameTypes: GameType[] };

interface ExerciseGenerator {
  generate(input: {
    item: { title: string; body: string };
    type: GameType;
  }): Promise<Result<ExerciseContent, GenerationError>>;
}
```

Conventions Zod, comme `CLAUDE.md` :

- Un schéma par type de jeu, un appel par type — jamais une union
  discriminée dans un seul appel (StudIA : "trois appels plats battent un
  appel malin", même principe étendu à sept types).
- Contraintes réelles dans `.describe()` : `title` est un groupe nominal
  court, `body` est autonome, chaque type de jeu décrit sa propre forme de
  sortie dans son schéma (voir `docs/modules/game-engine.md`).
- `.refine()` porte les invariants métier de chaque type (ex. QCM : la
  réponse est exactement l'une des quatre options).

## Cas d'usage

- `startSplitting(userId, courseId, now)` — n'enfile le job que si le
  cours est `confirmed` et `extractionStatus: 'ready'`. Enfile
  `split-items`.
- `handleSplittingJob(payload, ctx)` — lit l'extraction, appelle
  `ItemSplitter`, valide le compte. **Idempotent** : supprime les items
  existants du cours avant d'en écrire de nouveaux — utilisé uniquement
  pour le découpage initial ou une régénération complète, jamais pour
  l'ajout par extrait ci-dessous.
  - moins de 8 items → `generationStatus = 'insufficient_coverage'`,
    aucun item écrit, le job échoue avec un message clair
  - 8 à 40 items → écrit les items, `generationStatus = 'items_ready'`
- `startGeneration(userId, courseId, now)` — depuis `items_ready` ou
  `ready` (régénération complète). **Jamais déclenché automatiquement**
  après le découpage : la génération coûte des jetons et l'enfant (ou
  l'écran lecteur) doit explicitement demander "Créer mes jeux" — même
  règle que `generation` dans StudIA.
  Enfile **un job par item**, jamais un job par cours : un item en échec
  reste isolé, la progression est reportable `12/20`, chaque job reste
  court — le choix le plus structurant du module, recopié tel quel de
  StudIA (`docs/modules/generation.md`, "le choix le plus lourd de
  conséquences du module").
- `handleGenerationJob(payload, ctx)` — pour l'item du job, génère un
  exercice pour chaque type dans `applicableGameTypes` (pas les sept,
  seulement ceux annotés). **Idempotent** : remplace les exercices
  existants de l'item.
- `regenerateItem(userId, itemId, now)` — régénération manuelle d'un item
- `listItems(userId, courseId, { createdAfter?: string })` — le filtre optionnel
  sert à retrouver les items ajoutés par un job précis (voir plus bas),
  jamais utilisé par l'écran lecteur qui veut toujours la liste complète
- `listExercises(userId, itemId)`
- `getGenerationStatus(userId, courseId)` — `{ status, done, total, failed }`,
  dérivé de `jobs.listJobs('generate-item-exercises')` filtré par `payload.courseId`

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
  8 items minimum, pas un seuil réduit pour l'occasion) : un extrait court
  produira souvent moins de 8 items, et c'est le cas attendu, pas une
  anomalie — la mascotte le dit et propose de jouer sur le cours entier
  plutôt que de livrer un jeu creux (voir `docs/modules/tutor.md`).
- **Mêmes règles d'étoiles que tout autre exercice** : aucun traitement
  particulier dans `game-engine` ou `progress`.

Mécanisme :

- `startGameFromExcerpt(userId, courseId, excerpt: string, now)` →
  `Result<{ jobId: string }, SplitError>`. Enfile **un seul job**,
  `game-from-excerpt`, qui fait le découpage ET la génération.
  **Exception délibérée à la règle "un job par item"** ci-dessus : cette
  règle protège un découpage en lot de dizaines d'items, où isoler les
  échecs a de la valeur ; ici l'extrait produit normalement un seul item,
  l'interaction est live (l'enfant attend, depuis l'écran tuteur), et
  chaîner deux jobs distincts n'apporterait rien qu'un aller-retour de
  latence supplémentaire.
- `handleGameFromExcerptJob(payload, ctx)` :
  1. `ItemSplitter.split({ markdown: excerpt, grade })`
  2. Moins de 8 items → le job échoue, `last_error` commence par le préfixe
     documenté `INSUFFICIENT_COVERAGE:` (convention nécessaire parce que
     `jobs` est frozen et n'a pas de champ de résultat structuré au-delà de
     `last_error`) ; aucun item écrit
  3. Sinon, écrit les nouveaux items **à la suite** des positions
     existantes du cours (jamais un remplacement), puis génère un exercice
     par type annoté pour chacun, dans ce même job
- `getGameFromExcerptStatus(userId, courseId, jobId)` — lit le job via
  `jobs.listJobs(userId, 'game-from-excerpt')`, et sur `status: 'done'`,
  retrouve les items créés via `listItems(userId, courseId, { createdAfter: job.createdAt })`

## Persistance

```sql
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES accounts(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  game_types_json TEXT NOT NULL,   -- GameType[], voir game-engine.md
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (course_id, position)
);
CREATE INDEX idx_items_course ON items(course_id, position);

CREATE TABLE exercises (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES accounts(id),
  type TEXT NOT NULL CHECK (type IN ('delayed_copy','mcq','matching','reordering','cloze','true_false','mental_math')),
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_exercises_item ON exercises(item_id);
```

Ajoutez `generation_status TEXT` à la table `courses` de `docs/modules/ingestion.md`
(migration ultérieure, pas une nouvelle table). **Supprimer un exercice
supprime ses tentatives en cascade**, ce qui détruit l'historique
d'étoiles associé : une régénération doit donc remplacer par id quand la
question n'a pas changé, exactement comme StudIA le fait pour ses cartes
(`docs/modules/generation.md` : "diffez avant d'écrire").

## API

| Route | Rôle |
|---|---|
| `GET /api/courses/:id/items` | Liste, ordonnée |
| `POST /api/courses/:id/split` | Enfile le découpage en items |
| `POST /api/courses/:id/generate` | Enfile un job de génération par item |
| `GET /api/courses/:id/generation-status` | `{ status, done, total, failed }` |
| `GET /api/items/:id/exercises` | Liste des exercices d'un item |
| `POST /api/items/:id/regenerate` | Régénération manuelle |

`startGameFromExcerpt`/`getGameFromExcerptStatus` ci-dessus ne sont
**pas** exposés directement en HTTP par ce module : la route publique
(`POST /api/conversations/:id/game`) vit dans `docs/modules/tutor.md`, qui
appelle ces cas d'usage via l'`index.ts` de `exercise-generator`.

## Hors périmètre

Jouer un exercice, le comparateur de réponse, le calcul des étoiles
(`game-engine`, `progress`). Toute notion d'échéance ou de planification.
Recherche plein texte dans les items (pas demandée par le brief).

## Tests clés

- Unitaire : contiguïté des positions ; unicité des titres ; le contrôle de
  couverture se déclenche à 7 items et pas à 8
- Unitaire : `applicableGameTypes` ne peut contenir que des valeurs de
  l'énumération fermée, jamais un tableau vide
- Contrat : une fixture structurée produit 8 à 40 items avec des titres
  distincts ; une fixture à 5 items échoue le job avec
  `insufficient_coverage` ; une réponse hors schéma retry une fois puis
  échoue
- Intégration : relancer le job de découpage deux fois laisse un seul jeu
  d'items ; un item en échec de génération laisse les autres aboutir ; une
  régénération dont les questions n'ont pas changé préserve les ids
  d'exercice (**le test qui protège les étoiles déjà gagnées, à écrire
  tôt**, même urgence que StudIA pour ses cartes)
- Intégration : `handleGameFromExcerptJob` ajoute ses items à la suite des
  positions existantes sans jamais toucher aux items déjà présents du
  cours ; appelé deux fois avec deux extraits différents, les deux
  ensembles d'items coexistent
- Intégration : `handleGameFromExcerptJob` sur un extrait produisant moins
  de 8 items n'écrit aucun item et laisse `last_error` préfixé
  `INSUFFICIENT_COVERAGE:`
- Sécurité : les items et exercices d'un autre compte sont absents des
  listes et renvoient 403

## Questions ouvertes

- Faut-il limiter le nombre de types de jeu générés par item (ex. jamais
  plus de 3 même si le modèle en annote 5), pour ne pas multiplier les
  appels et le temps d'attente sur un item très polyvalent ? Non tranché.
- Le brief ne précise pas si l'enfant peut choisir *quels* types de jeu
  jouer pour un item, ou si `game-engine` pioche automatiquement parmi les
  exercices disponibles. Cette spec ne préjuge pas de la réponse — voir
  `docs/modules/game-engine.md`.
