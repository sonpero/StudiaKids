# Module `ingestion`

## Responsabilité

Faire entrer un cours dans le système : la ou les photos prises par
l'enfant, leur stockage sur le volume, l'extraction du texte structuré, la
détection d'une photo inexploitable, et la proposition titre/matière pour
l'écran de validation. `ingestion` s'arrête à "voici le texte, valide ou
recommence" ; découper ce texte en items et l'annoter par types de jeu
appartient à `exercise-generator`.

Adapté de `docs/modules/ingestion.md` de StudIA. Différences principales :
une seule source possible (`photo`, pas de pdf/docx/pptx puisque l'enfant ne
dépose que des photos), un niveau qui n'est jamais deviné par le modèle
(hérité du compte), et un refus qui efface le cours plutôt que de proposer
une édition (pas d'éditeur de texte, cf. `docs/ui.md`).

**Les photos originales sont conservées, pas seulement le texte extrait**
— décision actée (`docs/securite.md`) : le lecteur les affiche
(`docs/modules/reader.md`) et le tuteur peut les citer. Elles ne sont
supprimées qu'en cascade avec le cours, jamais indépendamment de lui. Une
version précédente de ce document envisageait de les supprimer une fois le
cours confirmé, par minimisation ; ce n'est plus la décision retenue.

Vocabulaire : voir `docs/glossaire.md` pour la correspondance entre les
termes de prose (cours, matière, confirmé...) et les identifiants anglais
ci-dessous.

## Domaine

```ts
type ExtractionStatus =
  | "pending" | "running" | "illegible" | "not_a_course_page" | "ready"
  | "failed";               // jamais stocké : dérivé à la lecture, voir plus bas

// Liste fermée : le modèle choisit, il n'invente pas. Libellés affichés en
// français par l'écran ("Maths", "Français", "Histoire", "Géographie",
// "Sciences", "Anglais", "Autre").
type Subject = "maths" | "french" | "history" | "geography" | "science" | "english" | "other";

type Course = {
  id: string;
  userId: string;
  title: string;            // proposé par le modèle, ≤ 3 mots, jamais édité
  subject: Subject | null;  // proposée par le modèle, null jusqu'à l'extraction
  grade: Grade;             // hérité du compte à la création, jamais deviné
  color: string;            // nom du token pastel de la matière (ex. "matiere-maths"), jamais une valeur hexadécimale — cf. docs/ui.md
  extractionStatus: ExtractionStatus;
  confirmed: boolean;       // true une fois l'enfant a confirmé sur l'écran de validation
  pageCount: number;        // >= 1
  createdAt: string;
  lastAccessedAt: string;   // = createdAt à la création, mis à jour à chaque ouverture (lecteur ou jeux)
};

type Page = {
  courseId: string;
  index: number;
  sha256: string;
  storedPath: string;
  sizeBytes: number;
  legible: boolean | null;      // null tant que l'extraction n'a pas tourné sur cette page
  isCoursePage: boolean | null; // idem ; n'a de sens que si legible = true
  unusableReason: string | null; // raison courte renvoyée par le modèle si la page est inexploitable
};

type Extraction = { courseId: string; markdown: string; extractedAt: string };
```

**Le multi-page reste possible** (plusieurs photos d'une même leçon), comme
dans StudIA, mais **la correction ne porte jamais sur une seule page** : si
une page est illisible, tout le cours reste `illegible` et l'enfant
reprend l'intégralité des photos depuis le début (`deleteCourse` puis
nouvelle création) plutôt que de remplacer une seule page. Choix délibéré :
un mécanisme de remplacement partiel demanderait un écran de gestion de
pages, contraire à la contrainte "aucun éditeur" de `docs/ui.md`. Sujet à
revoir si l'usage réel montre que reprendre un cours de 4 pages à cause
d'une seule photo floue frustre trop souvent — voir questions ouvertes.

**Plafond de 5 pages par cours** (`MAX_PAGES_PER_COURSE`) : une leçon
d'école primaire tient en une ou deux pages, cinq laisse de la marge sans
ouvrir la porte à un cours de trente photos. L'écran de capture masque le
bouton "Une autre page" dès la cinquième ; le serveur refuse la sixième
de toute façon.

**JPEG uniquement, métadonnées retirées.** Le navigateur réencode toujours
la photo en JPEG (canvas) avant envoi, à la taille renvoyée par
`nativePhotoSize` (`packages/contracts`) : la plus grande taille, à
proportions conservées, que le modèle voit sans la réduire lui-même. Ça
redresse la photo, évite d'envoyer des pixels que l'API jetterait (plus
de poids et de latence, aucun gain), et retire au passage ses
métadonnées.

**Taille native, à confirmer par `pnpm fixtures:record`** : `claude-sonnet-5`
appartient au niveau haute résolution de la doc Anthropic ("Claude 4.7 et
ultérieurs") — `PHOTO_MAX_EDGE_PX = 2576` sur le bord et
`PHOTO_MAX_VISUAL_TOKENS = 4784` tokens visuels (un par carré de 28 px).
Pour une photo, c'est le budget de tokens qui décide, pas le bord : une
photo 4:3 est ramenée vers 2212 × 1659. Premier appel réel (`--dry-run`,
2026-09-25, page de cours générée en 1659 × 2212, 4740 tokens visuels) :
`input_tokens = 5782`, compatible avec le niveau haute résolution (au
niveau standard, l'image seule plafonnerait à 1568). Ces valeurs restent
néanmoins **à confirmer par le premier enregistrement** (l'outil affiche `usage.input_tokens`,
qui doit tourner autour de 4784 pour une photo) ; changer
`ANTHROPIC_MODEL` pour un modèle d'un autre niveau les rendrait fausses
sans rien casser de visible, l'API se contentant de réduire l'image. Le serveur ne fait pas
confiance au client pour autant : il vérifie le type réel sur les octets
(PNG, WebP ou un faux `.jpg` sont refusés, quel que soit le type annoncé)
et retire de tout fichier stocké les segments de métadonnées JPEG (EXIF
dont GPS, XMP, IPTC, commentaires) — `docs/securite.md`, "Données non
conservées". L'empreinte SHA-256 est calculée sur les octets réellement
stockés.

`FileStore` travaille par cours et non par fichier : supprimer un cours
supprime son répertoire entier, pour qu'aucune photo ne lui survive. Le
dépôt (`CourseRepository`) est défini par les cas d'usage qui l'appellent,
chaque méthode prenant un `userId` (`CLAUDE.md`, règle 1).

**Un seul cours non confirmé à la fois par compte.** Créer un cours
supprime d'abord (lignes et fichiers) tout cours non confirmé existant du
compte. L'accueil peut ainsi toujours ramener l'enfant vers le cours en
attente (un seul, en bandeau), et une photo abandonnée ne survit jamais
au cours suivant — pas de nettoyage différé à programmer.

Fonctions pures de domaine :

- `sniffImageType(bytes)` — type réel lu sur les premiers octets, jamais
  sur l'extension ni sur le type annoncé ; seul `jpeg` est accepté
- `isAcceptable(bytes)` — JPEG réel (`sniffImageType`) et au plus
  7 500 000 octets (`MAX_PAGE_BYTES`) ; un fichier vide n'est jamais un
  JPEG. La limite de l'API Claude (10 Mo par image) porte sur
  l'image **encodée en base64**, qui pèse 4/3 du fichier : 7 500 000
  octets bruts donnent exactement 10 000 000 caractères base64. Un JPEG
  réencodé à la taille native en pèse normalement bien moins ; la limite
  n'arrête que ce qui échouerait de toute façon à l'appel du modèle
- `stripJpegMetadata(bytes)` → `Result<bytes, 'malformed-jpeg'>` — le même
  JPEG sans aucun segment APPn (APP0 à APP15 : JFIF, EXIF dont GPS, XMP,
  ICC, IPTC...) ni commentaire, segments d'image recopiés octet pour octet,
  données compressées après SOS jamais analysées. APP0 (JFIF) part aussi :
  rien avant les données d'image n'est nécessaire pour les décoder.
  **L'orientation EXIF part avec le reste** : une photo qui n'aurait pas
  été réencodée par le canvas du navigateur (qui applique l'orientation
  aux pixels) serait stockée, affichée et envoyée au modèle couchée ou à
  l'envers. Le réencodage n'est donc pas une optimisation facultative :
  l'écran de capture ne doit jamais envoyer le fichier d'origine, ce que
  vérifie le scénario Playwright ci-dessous
- `nextPageIndex(existing)` — ordre contigu, sans trou
- `canAddPage(pageCount)` — faux à partir de `MAX_PAGES_PER_COURSE`
- `outcomeOfPages(pages)` — `illegible` si une page a `legible: false`,
  sinon `not_a_course_page` si une page a `isCoursePage: false`, sinon
  `ready` quand toutes sont traitées, sinon `in_progress` (y compris pour
  un cours sans page) ; l'illisibilité prime (on ne juge pas le contenu
  d'une photo qu'on ne peut pas lire)
- `subjectColor(subject)` — nom du token pastel, total sur `Subject`
- `displayStatus(stored, latestJob)` — `failed` si le dernier job
  `extract-course` du cours est `failed`, sinon le statut stocké (voir
  "Statut `failed`" plus bas)

## Ports

```ts
interface FileStore {
  put(userId: string, courseId: string, pageIndex: number, bytes: Uint8Array): Promise<string>; // toujours .jpg
  read(storedPath: string): Promise<Uint8Array>;
  deleteCourse(userId: string, courseId: string): Promise<void>; // tout le répertoire du cours
}

interface PhotoExtractor {
  extract(input: { bytes: Buffer }): Promise<Result<{ markdown: string; legible: boolean; isCoursePage: boolean; reason?: string }, ExtractionError>>;
}

interface CourseNamer {
  // Un second appel, léger, séparé de l'extraction elle-même : proposer un
  // titre et une matière ne regarde que le texte déjà extrait, pas la
  // photo, et n'a pas besoin du modèle vision.
  suggest(input: { markdown: string }): Promise<Result<{ title: string; subject: Subject }, ExtractionError>>;
}

interface CourseRepository { /* chaque méthode prend userId et filtre dessus (CLAUDE.md, règle 1) */ }
```

### Client modèle

Les adaptateurs réels (`ClaudePhotoExtractor`, `ClaudeCourseNamer`) sont
construits par `createLanguageModel` (`packages/core/src/shared/`),
`ai` 4.3.19 + `@ai-sdk/anthropic` 1.2.12 comme StudIA, modèle lu depuis
`ANTHROPIC_MODEL` (défaut `claude-sonnet-5`).

**Un seul point d'adaptation à `claude-sonnet-5`, à retirer lors d'une
montée en `ai` v5+** : le `fetch` de `createLanguageModel` réécrit le
corps de chaque requête, parce que `ai` 4.x / `@ai-sdk/anthropic` 1.2.12
ne savent pas l'exprimer :

- retrait de `temperature`, `top_p` et `top_k` : `ai` 4.x envoie
  `temperature: 0` quand l'appelant ne précise rien, et `claude-sonnet-5`
  rejette tout paramètre d'échantillonnage (400) ;
- `thinking: { type: "disabled" }` : le thinking adaptatif, actif par
  défaut, consomme `max_tokens` et fait courir un risque de troncature ;
  le fournisseur ne transmet `thinking` que s'il est activé. Le `tool_choice`
  forcé de `generateObject` reste accepté par `claude-sonnet-5` ;
- `max_tokens` fixé à `DEFAULT_MAX_TOKENS` (16 000) au lieu du 4096 par
  défaut du fournisseur : de la marge pour une page dense, tokenizer plus
  lourd compris. À la suppression de cette réécriture, `max_tokens` passe
  au réglage `maxTokens` des appelants, il ne disparaît pas.

Testé sans réseau (`model-client.unit.test.ts`) sur le corps de requête
réellement envoyé. `pnpm fixtures:record` affiche pour chaque appel la
présence de blocs de thinking, l'acceptation du `tool_choice` forcé,
`stop_reason`, `usage.input_tokens` / `output_tokens` et la latence : le
premier enregistrement sert de test de fumée de cette adaptation.

`PhotoExtractor` est le pendant du `VisionExtractor` de StudIA : même
schéma de sortie (`markdown`/`legible`/`reason`), même prompt de base
(voir `docs/inventaire-studia.md`, §6), **plus un champ plat
`isCoursePage`** : faux si la photo lisible ne montre pas une page de
cours ou d'exercice scolaire (un jouet, un visage, une pièce...) —
`docs/securite.md`, "Sécurité de l'étape photo". `legible: false` et
`isCoursePage: false` ne sont **pas** des erreurs, ce sont des résultats
métier normaux qui bloquent la suite du pipeline.

**L'extraction préserve la hiérarchie de titres** (Markdown `#`/`##`) — le
signal dont `exercise-generator` a besoin pour découper en items. Un
extracteur qui renvoie du texte plat a échoué même s'il a renvoyé du texte.

## Cas d'usage

- `createCourse(userId, grade, now)` — supprime d'abord tout cours non
  confirmé du compte (lignes et fichiers, comme `deleteCourse`), puis crée
  la ligne cours avant toute photo, `grade` passé par l'API depuis le
  compte authentifié (jamais deviné, jamais fourni par le client),
  `title`/`subject`/`color` vides jusqu'à extraction,
  `extractionStatus: 'pending'`
- `addPage(userId, courseId, bytes, now)` — vérifie le type réel et la
  taille, refuse au-delà de 5 pages, retire les métadonnées, hash,
  déduplique au sein du cours, stocke, renvoie la page. Le type annoncé
  par le client n'est jamais consulté. Erreurs : `not-found`, `locked`
  (le cours n'est plus `pending` : ses photos sont déjà lues),
  `unsupported`, `too-large`, `too-many-pages`, `duplicate`.
- `startExtraction(userId, courseId, now)` — enfile un job `extract-course`
  pour un cours `pending` avec au moins une page ; **sans effet si la
  lecture est déjà lancée** (job en attente, lecture en cours, terminée
  ou en échec technique) : même succès, aucun nouveau job (double appui
  sur "C'est tout !", écran qui revient sur un cours déjà lu). Un échec
  technique se relance par `retryExtraction`, jamais par ici. Erreurs :
  `not-found`, `no-pages`, `already-confirmed`
- `handleExtractionJob(payload, ctx)` — se termine sans rien faire si le
  cours n'existe plus (refusé ou remplacé entre-temps) ou si son résultat
  est déjà stocké (job rejoué après un crash : rien n'est repayé) ; sinon
  passe le cours à `running`, remet à zéro les résultats de pages, lit
  les pages dans l'ordre, appelle `PhotoExtractor` par page, marque
  `legible`/`isCoursePage`/`unusableReason` sur chaque page, et
  **s'arrête à la première page inexploitable** (les suivantes gardent
  `null` : inutile de payer un appel modèle pour un cours qui sera repris
  en entier) :
  - si une page est illisible : `extractionStatus = 'illegible'` ; si
    elle est lisible mais n'est pas une page de cours :
    `extractionStatus = 'not_a_course_page'`. Dans les deux cas, pas de
    ligne `extractions` créée, pas d'appel à `CourseNamer`, et le job se
    termine avec succès (résultat métier, pas un échec à retenter)
  - si toutes les pages sont exploitables : concatène les Markdown dans
    l'ordre, écrit `extractions`, appelle `CourseNamer` pour proposer
    `title`/`subject`, dérive `color` de la matière, `extractionStatus = 'ready'`
  - rien n'est mis en file après : la génération est déclenchée à la main
    (`docs/jalons.md`, M3), jamais par l'extraction
- `confirmCourse(userId, courseId, now)` — l'enfant appuie sur "Oui, c'est
  ça !" : `confirmed = true`, uniquement pour un cours `ready`
  (`not-ready` sinon). Seul un cours `confirmed` est listé sur
  l'accueil et ouvrable dans le lecteur.
- `rejectCourse(userId, courseId, now)` — l'enfant appuie sur "Je reprends
  la photo", depuis l'écran de validation ou depuis le message d'une photo
  inexploitable : équivaut à `deleteCourse`, rien n'est conservé (un cours
  jamais confirmé n'entre pas dans la politique de conservation ci-dessus).
  Refusé pour un cours confirmé (`already-confirmed`) : celui-là se
  supprime par `deleteCourse`
- `retryExtraction(userId, courseId, now)` — uniquement depuis `failed`
  (échec technique, pas `illegible` ni `not_a_course_page`)
- `getCourse`, `listConfirmedCourses` (triés par `lastAccessedAt` décroissant,
  pour la reprise sur l'accueil — `docs/modules/progress.md`),
  `getUnconfirmedCourse` (le cours en attente du compte, ou aucun — pour
  le bandeau de l'accueil), `readPageFile`
- `recordAccess(userId, courseId, now)` — met à jour `lastAccessedAt` ;
  appelé à l'ouverture du lecteur ou de l'écran jeux, jamais depuis
  l'accueil lui-même (l'ouvrir depuis la liste ne compte pas comme un accès
  avant d'avoir réellement affiché le contenu)
- `deleteCourse(userId, courseId, now)` — ligne, pages, fichiers, en cascade
  et dans le même appel applicatif (jamais seulement la ligne SQL — voir
  Tests clés)

**Le handler d'extraction doit être idempotent** : `completeExtraction`
remplace toute extraction existante dans la même transaction qui passe le
cours à `ready` (une extraction n'existe donc que pour un cours `ready`),
et un cours déjà `ready` n'est jamais retraité. Un job relancé deux fois
après un redémarrage du worker ne produit jamais deux extractions.

**`not-found` couvre aussi le cours d'un autre compte** : le dépôt filtre
toujours sur `userId` et ne peut pas distinguer les deux cas, par
construction (`CLAUDE.md`, règle 1). L'API répond **404 dans les deux
cas**, même corps, même en-têtes (`docs/securite.md`) : c'est aussi le
cas nominal d'un écran qui redemande un cours non confirmé remplacé
entre-temps par une nouvelle photo (un seul cours non confirmé par
compte).

**Aucun appel LLM à l'intérieur d'une transaction.**

**Statut `failed` : dérivé, jamais stocké** (même mécanisme que StudIA).
Un échec technique est retenté automatiquement par le noyau `jobs` avec
backoff ; le handler ne sait pas s'il vit sa dernière tentative. Seul le
job le sait : `getCourse` et `getUnconfirmedCourse` lisent le dernier job
`extract-course` du cours via l'`index.ts` de `jobs` et appliquent
`displayStatus`. Tant que des tentatives restent, l'enfant voit
`running` ("je regarde ta photo…"), jamais un échec intermédiaire.

## Persistance

```sql
CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  subject TEXT CHECK (subject IN ('maths','french','history','geography','science','english','other')),
  grade TEXT NOT NULL CHECK (grade IN ('CP','CE1','CE2','CM1','CM2','6e')),
  color TEXT NOT NULL DEFAULT '',
  extraction_status TEXT NOT NULL CHECK (extraction_status IN ('pending','running','illegible','not_a_course_page','ready')),
  confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL
);
CREATE INDEX idx_courses_user_last_accessed ON courses(user_id, last_accessed_at DESC);

CREATE TABLE pages (
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  legible INTEGER,               -- NULL tant que non traité, 0/1 ensuite
  is_course_page INTEGER,        -- idem
  unusable_reason TEXT,
  PRIMARY KEY (course_id, page_index),
  UNIQUE (course_id, sha256)
);

CREATE TABLE extractions (
  course_id TEXT PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  markdown TEXT NOT NULL,
  extracted_at TEXT NOT NULL
);
```

`failed` n'apparaît pas dans le `CHECK` de `extraction_status` : il n'est
jamais écrit (voir "Statut `failed`"). `courses.user_id` est en
`ON DELETE CASCADE` pour que `pnpm accounts:delete` supprime les cours du
compte avec lui (`docs/securite.md`, "Suppression et droit à l'oubli") —
les fichiers, eux, sont supprimés par l'application dans le même appel.

Fichiers sur `RAILWAY_VOLUME_MOUNT_PATH/photos/{userId}/{courseId}/{pageIndex}.jpg`
(`./data/photos/...` en local, `docs/donnees.md`).
**Supprimer un cours supprime son répertoire de fichiers dans le même appel
applicatif** que la suppression des lignes — jamais un nettoyage différé ou
séparé, pour qu'une photo ne survive jamais à la suppression de son cours.

## API

| Route | Rôle |
|---|---|
| `POST /api/courses` | Crée un cours (vide), renvoie son id ; supprime le cours non confirmé précédent |
| `POST /api/courses/:id/pages` | Multipart, une page JPEG. Répété par photo, 5 au plus. |
| `POST /api/courses/:id/extract` | Enfile l'extraction |
| `GET /api/courses` | Liste des cours confirmés du compte, avec couleur. **À partir de M3** : ajoute un champ optionnel, le nombre d'exercices prêts par cours (lu depuis `exercise-generator` via son `index.ts`, jamais une jointure directe sur ses tables), affiché sur l'accueil (`docs/design/accueil.png` : "12 jeux prêts") — absent en M2, le module n'existant pas encore |
| `GET /api/courses/unconfirmed` | Le cours non confirmé du compte (au plus un), ou `null` — bandeau de l'accueil |
| `GET /api/courses/:id` | Détail, y compris statut d'extraction et propositions titre/matière |
| `GET /api/courses/:id/pages/:index/file` | Lecture de fichier authentifiée |
| `POST /api/courses/:id/confirm` | Bouton "Oui, c'est ça !" |
| `POST /api/courses/:id/reject` | Bouton "Je reprends la photo" (supprime) |
| `POST /api/courses/:id/retry` | Ré-enfile après un échec technique |
| `DELETE /api/courses/:id` | Ligne, pages, fichiers |

**Les fichiers ne sont jamais servis en statique.** Toute lecture passe par
la route ci-dessus, qui vérifie l'appartenance au compte en premier (404
sinon, comme pour un identifiant inconnu). Elle répond
`Content-Type: image/jpeg`, `X-Content-Type-Options: nosniff` et
`Cache-Control: private, no-store`.

**Codes de réponse.** Création et upload : `201` ; extraction : `202`
avec l'état courant de la lecture (`{ extractionStatus }`), le même
qu'elle vienne d'être lancée ou qu'elle l'ait déjà été ; relance : `202`
sans corps ; confirmation, refus et suppression : `204`. Tout refus
porte un corps `{ error: <code> }` stable, d'où l'écran tire le message
de la mascotte (`courseErrorSchema`, `packages/contracts`) :
`not_found` (404, identique pour un identifiant inconnu et le cours d'un
autre compte), `missing_file` (400), `too_large` (413), `unsupported`
(415), et en 409 `locked`, `too_many_pages`, `duplicate`, `no_pages`,
`not_ready`, `already_confirmed`, `not_failed`.

**Upload** : une photo par requête, plafonnée à 7 500 000 octets dès la
lecture du flux multipart (`limits.fileSize`, `limits.files: 1`), avant
tout appel à `addPage` : un fichier trop gros n'atteint ni le disque ni
la base. `addPage` refait le contrôle de taille sur les octets. **Une
requête qui porte plusieurs fichiers n'est pas refusée : seule la
première photo est lue et stockée (`201`), les suivantes sont ignorées**
— l'écran de capture n'en envoie jamais qu'une à la fois.

## Enregistrement des fixtures

`pnpm fixtures:record ingestion <legible|illegible|not-a-course> --photo <fichier.jpg>`,
puis `pnpm fixtures:record ingestion namer` (qui nomme le texte enregistré
par `legible`). Manuel, payant, jamais lancé par `pnpm test` ; clé lue
dans l'environnement ou le `.env` (ignoré par git).

- La photo doit être un vrai JPEG **déjà à la taille native**
  (`nativePhotoSize`) : c'est ce que le navigateur enverra, et c'est la
  seule façon pour `input_tokens` de dire quelque chose de la résolution
  native. Plus grande, l'outil refuse avant tout appel et donne la commande
  `sips` qui la réduit.
- Ses métadonnées sont retirées (`stripJpegMetadata`) avant l'envoi et
  avant l'écriture dans `tests/fixtures/ingestion/photos/`.
- **Le dépôt est public** : seul le corps des réponses HTTP est écrit,
  aucun en-tête (identifiant d'organisation, request-id), et l'identifiant
  de message est neutralisé. Jamais le corps des requêtes (la photo est
  déjà stockée à part).
- Rien n'est écrasé sans `--force`.
- `--dry-run` fait l'appel réel et affiche le test de fumée, mais n'écrit
  rien (ni fixture, ni photo) : pour vérifier l'adaptation au modèle sans
  produire de fixture.
- `--show` affiche le Markdown complet et, pour un cas photo lisible, la
  proposition du namer (un appel réel de plus, jamais enregistré).
- Chaque appel est un test de fumée de l'adaptation à `claude-sonnet-5` :
  latence, `stop_reason`, `input_tokens` / `output_tokens`, présence de
  thinking, acceptation du `tool_use` forcé. Échec si HTTP ≠ 200, thinking
  présent, pas de `tool_use`, troncature (`max_tokens`), `input_tokens`
  inférieur aux tokens visuels de la photo (image réduite côté API), ou
  réponse qui ne correspond pas au cas demandé : dans tous ces cas, rien
  n'est écrit.

### Fixtures synthétiques (provisoires)

Tant qu'aucune photo réelle n'est enregistrée, les tests de contrat lisent
des **réponses synthétiques**, écrites à la main, dans
`tests/fixtures/ingestion/synthetic/` : chaque fichier porte
`"synthetic": true` et une note qui le dit, et le sélecteur unique
`FIXTURE_SOURCE` (`tests/support/llm-fixtures.ts`) vaut `"synthetic"`.
Leur enveloppe (réponse Messages API, `tool_use` forcé, `usage`) et la
forme de leur Markdown sont calquées sur un vrai appel `--dry-run
--show` du 2026-09-25 (deux `#` : en-tête de page puis titre ; parties
numérotées en `##` ; pseudo-listes à tiret cadratin sur des lignes
simples, qui ne sont pas des listes Markdown ; encadré « À retenir » en
`##`), le contenu est inventé et la réponse réelle n'est pas commitée.

**Ces tests de contrat valident le câblage, pas le format du modèle** :
rejeu d'une réponse brute à travers l'adaptateur réel, validation Zod,
chemin du retry unique. Ils ne prouvent rien de ce que le modèle répond
vraiment. Ils seront **rebranchés sur les vraies fixtures**
(`FIXTURE_SOURCE = "recorded"`, fichiers de `tests/fixtures/ingestion/`)
avant que le critère A2 puisse être coché ; M2 ne peut pas être clos sur
des fixtures synthétiques (`docs/jalons.md`).

Les adaptateurs réels ont aussi des tests unitaires contre des réponses
minimales écrites dans le test (forme de la requête, retry unique) : ce
ne sont pas des fixtures de contrat, qui ne viennent que de cet outil.

## Hors périmètre

Découpage en items. Annotation par type de jeu. Génération d'exercices.
Tout format autre que la photo (et, côté serveur, tout format d'image
autre que JPEG). Édition du texte extrait (aucun éditeur, cf.
`docs/ui.md`). Remplacement d'une seule page parmi plusieurs. Tout
compteur ou suivi des photos "pas une page de cours" au-delà de la vie du
cours (`docs/securite.md` exclut la télémétrie comportementale).

## Tests clés

- Unitaire : détection du type réel, y compris un `.jpg` qui est en fait
  un PNG ou un WebP ; limites de taille ; ordre des pages ; rejet d'une
  page dupliquée ; sixième page refusée ; un JPEG avec EXIF/GPS en ressort
  sans aucun segment de métadonnées et avec des données d'image identiques ;
  `outcomeOfPages` (l'illisibilité prime sur "pas un cours")
- Contrat : fixture lisible renvoie un Markdown à hiérarchie de titres ;
  fixture illisible renvoie `legible: false` et une raison ; fixture "pas
  un cours" renvoie `isCoursePage: false` ; une réponse qui viole le
  schéma déclenche exactement un retry puis un échec de job. Fixtures
  enregistrées sur de vraies photos par `pnpm fixtures:record`, jamais
  écrites à la main
- Intégration : l'upload écrit fichier et ligne ; le worker traite le job ;
  les transitions de statut sont visibles via l'API
- Intégration : relancer le handler deux fois laisse exactement une
  extraction
- Intégration : un cours avec une page illisible reste `illegible` (ou
  `not_a_course_page`), n'a jamais de ligne `extractions`, et
  `CourseNamer` n'est jamais appelé
- Intégration : créer un cours supprime le cours non confirmé précédent
  du compte, fichiers compris, et ne touche jamais aux cours confirmés
- Intégration : un job `extract-course` épuisé rend le cours `failed` à
  la lecture ; un job encore en attente de retry le laisse `running`
- **Intégration : supprimer un cours supprime aussi ses fichiers photo sur
  le disque, pas seulement ses lignes en base** — le test crée un cours
  avec au moins une page, vérifie que le fichier existe sur le volume,
  appelle `deleteCourse`, puis vérifie que le fichier n'existe plus. C'est
  le test qui protège la garantie de suppression en cascade de
  `docs/securite.md`.
- Sécurité : un compte obtient 404 sur chaque route d'un cours d'un autre
  compte (fichier, détail, upload, extraction, confirmation, refus,
  relance, suppression), avec une réponse identique à celle d'un
  identifiant inconnu
- Playwright : upload de trois photos comme un seul cours, statut jusqu'à
  `ready`, écran de validation, confirmation, cours listé sur l'accueil ;
  le parcours photo illisible avec le message porté par la mascotte ; le
  bouton "Une autre page" disparaît à la cinquième page ; la photo envoyée
  par l'écran de capture est toujours celle réencodée par le canvas, jamais
  le fichier d'origine (JPEG aux dimensions renvoyées par
  `nativePhotoSize`, vérifiées sur la requête d'upload)

## Questions ouvertes

- Le refus "je reprends la photo" supprime tout le cours, y compris pour un
  cours multi-pages où une seule page pose problème. Faut-il, dans un
  jalon ultérieur, permettre de ne reprendre que la page en cause ? Pas
  nécessaire pour M2 si les leçons photographiées restent courtes (1 à 2
  pages), à observer à l'usage.
- `CourseNamer` reste un second appel modèle, séparé de l'extraction
  (décidé à l'ouverture de M2) : coupler la détection de lisibilité (qui
  doit bloquer tôt) à une proposition de titre (qui n'a de sens que si le
  texte est bon) compliquerait le schéma de sortie. À revoir seulement si
  la latence mesurée le justifie.
