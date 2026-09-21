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
type ExtractionStatus = "pending" | "running" | "illegible" | "ready" | "failed";

type Course = {
  id: string;
  userId: string;
  title: string;            // proposé par le modèle, ≤ 3 mots, jamais édité
  subject: string;          // proposée par le modèle, ≤ 3 mots
  grade: Grade;             // hérité du compte à la création, jamais deviné
  color: string;            // pastel dérivé de la matière, cf. docs/ui.md
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
  legible: boolean | null;      // null tant que l'extraction n'a pas tourné
  illegibleReason: string | null;
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

Fonctions pures de domaine :

- `isAcceptable(sizeBytes, mimeType)` — 20 Mo par page, liste blanche de
  types MIME image, jamais une vérification par extension seule
- `nextPageIndex(existing)` — ordre contigu, sans trou
- `allPagesLegible(pages)` — vrai seulement si chaque page a `legible: true`

## Ports

```ts
interface FileStore {
  put(userId: string, courseId: string, pageIndex: number, bytes: Buffer, ext: string): Promise<string>;
  read(storedPath: string): Promise<Buffer>;
  delete(storedPath: string): Promise<void>;
}

interface PhotoExtractor {
  extract(input: { bytes: Buffer }): Promise<Result<{ markdown: string; legible: boolean; reason?: string }, ExtractionError>>;
}

interface CourseNamer {
  // Un second appel, léger, séparé de l'extraction elle-même : proposer un
  // titre et une matière ne regarde que le texte déjà extrait, pas la
  // photo, et n'a pas besoin du modèle vision.
  suggest(input: { markdown: string }): Promise<Result<{ title: string; subject: string }, ExtractionError>>;
}
```

`PhotoExtractor` est le pendant du `VisionExtractor` de StudIA : même
schéma de sortie (`markdown`/`legible`/`reason`), même prompt de base,
recopiable tel quel (voir `docs/inventaire-studia.md`, §6).
`legible: false` n'est **pas** une erreur, c'est un résultat métier normal
qui bloque la suite du pipeline.

**L'extraction préserve la hiérarchie de titres** (Markdown `#`/`##`) — le
signal dont `exercise-generator` a besoin pour découper en items. Un
extracteur qui renvoie du texte plat a échoué même s'il a renvoyé du texte.

## Cas d'usage

- `createCourse(userId, now)` — crée la ligne cours avant toute photo,
  `grade` copié depuis le compte, `title`/`subject`/`color` vides jusqu'à
  extraction, `extractionStatus: 'pending'`
- `addPage(userId, courseId, bytes, mimeType, now)` — valide, hash,
  déduplique au sein du cours, stocke, renvoie la page
- `startExtraction(userId, courseId, now)` — enfile un job `extract-course`
- `handleExtractionJob(payload, ctx)` — lit les pages dans l'ordre, appelle
  `PhotoExtractor` par page, marque `legible`/`illegibleReason` sur
  chaque page :
  - si une page est illisible : `extractionStatus = 'illegible'`, pas de
    ligne `extractions` créée, pas d'appel à `CourseNamer`
  - si toutes les pages sont lisibles : concatène les Markdown dans
    l'ordre, écrit `extractions`, appelle `CourseNamer` pour proposer
    `title`/`subject`, dérive `color` de la matière, `extractionStatus = 'ready'`
- `confirmCourse(userId, courseId, now)` — l'enfant appuie sur "Oui, c'est
  ça !" : `confirmed = true`. Seul un cours `confirmed` est listé sur
  l'accueil et ouvrable dans le lecteur.
- `rejectCourse(userId, courseId, now)` — l'enfant appuie sur "Je reprends
  la photo" : équivaut à `deleteCourse`, rien n'est conservé (un cours
  jamais confirmé n'entre pas dans la politique de conservation ci-dessus)
- `retryExtraction(userId, courseId, now)` — uniquement depuis `failed`
  (échec technique, pas `illegible`)
- `getCourse`, `listConfirmedCourses` (triés par `lastAccessedAt` décroissant,
  pour la reprise sur l'accueil — `docs/modules/progress.md`), `readPageFile`
- `recordAccess(userId, courseId, now)` — met à jour `lastAccessedAt` ;
  appelé à l'ouverture du lecteur ou de l'écran jeux, jamais depuis
  l'accueil lui-même (l'ouvrir depuis la liste ne compte pas comme un accès
  avant d'avoir réellement affiché le contenu)
- `deleteCourse(userId, courseId, now)` — ligne, pages, fichiers, en cascade
  et dans le même appel applicatif (jamais seulement la ligne SQL — voir
  Tests clés)

**Le handler d'extraction doit être idempotent** : il supprime toute
extraction existante pour le cours avant d'en écrire une nouvelle. Un job
relancé deux fois après un redémarrage du worker ne doit pas produire deux
extractions.

**Aucun appel LLM à l'intérieur d'une transaction.**

## Persistance

```sql
CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES accounts(id),
  title TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  grade TEXT NOT NULL CHECK (grade IN ('CP','CE1','CE2','CM1','CM2','6e')),
  color TEXT NOT NULL DEFAULT '',
  extraction_status TEXT NOT NULL CHECK (extraction_status IN ('pending','running','illegible','ready','failed')),
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
  illegible_reason TEXT,
  PRIMARY KEY (course_id, page_index),
  UNIQUE (course_id, sha256)
);

CREATE TABLE extractions (
  course_id TEXT PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  markdown TEXT NOT NULL,
  extracted_at TEXT NOT NULL
);
```

Fichiers sur `RAILWAY_VOLUME_MOUNT_PATH/photos/{userId}/{courseId}/{pageIndex}.{ext}`
(`./data/photos/...` en local, `docs/donnees.md`).
**Supprimer un cours supprime son répertoire de fichiers dans le même appel
applicatif** que la suppression des lignes — jamais un nettoyage différé ou
séparé, pour qu'une photo ne survive jamais à la suppression de son cours.

## API

| Route | Rôle |
|---|---|
| `POST /api/courses` | Crée un cours (vide), renvoie son id |
| `POST /api/courses/:id/pages` | Multipart, une page. Répété par photo. |
| `POST /api/courses/:id/extract` | Enfile l'extraction |
| `GET /api/courses` | Liste des cours confirmés du compte, avec couleur ; inclut le nombre d'exercices prêts par cours (lu depuis `exercise-generator` via son `index.ts`, jamais une jointure directe sur ses tables), affiché sur l'accueil (`docs/design/accueil.png` : "12 jeux prêts") |
| `GET /api/courses/:id` | Détail, y compris statut d'extraction et propositions titre/matière |
| `GET /api/courses/:id/pages/:index/file` | Lecture de fichier authentifiée |
| `POST /api/courses/:id/confirm` | Bouton "Oui, c'est ça !" |
| `POST /api/courses/:id/reject` | Bouton "Je reprends la photo" (supprime) |
| `POST /api/courses/:id/retry` | Ré-enfile après un échec technique |
| `DELETE /api/courses/:id` | Ligne, pages, fichiers |

**Les fichiers ne sont jamais servis en statique.** Toute lecture passe par
la route ci-dessus, qui vérifie l'appartenance au compte en premier.

## Hors périmètre

Découpage en items. Annotation par type de jeu. Génération d'exercices.
Tout format autre que la photo. Édition du texte extrait (aucun éditeur,
cf. `docs/ui.md`). Remplacement d'une seule page parmi plusieurs.

## Tests clés

- Unitaire : détection MIME y compris un `.jpg` qui est en fait un autre
  format ; limites de taille ; ordre des pages ; rejet d'une page dupliquée
- Contrat : fixture lisible renvoie un Markdown à hiérarchie de titres ;
  fixture illisible renvoie `legible: false` et une raison ; une réponse
  qui viole le schéma déclenche exactement un retry puis un échec de job
- Intégration : l'upload écrit fichier et ligne ; le worker traite le job ;
  les transitions de statut sont visibles via l'API
- Intégration : relancer le handler deux fois laisse exactement une
  extraction
- Intégration : un cours avec une page illisible reste `illegible`, n'a
  jamais de ligne `extractions`, et `CourseNamer` n'est jamais appelé
- **Intégration : supprimer un cours supprime aussi ses fichiers photo sur
  le disque, pas seulement ses lignes en base** — le test crée un cours
  avec au moins une page, vérifie que le fichier existe sur le volume,
  appelle `deleteCourse`, puis vérifie que le fichier n'existe plus. C'est
  le test qui protège la garantie de suppression en cascade de
  `docs/securite.md`.
- Sécurité : un compte obtient 403 sur la route fichier, le détail, et la
  suppression d'un cours d'un autre compte
- Playwright : upload de trois photos comme un seul cours, statut jusqu'à
  `ready`, écran de validation, confirmation, cours listé sur l'accueil ;
  et le parcours photo illisible avec le message porté par la mascotte

## Questions ouvertes

- Le refus "je reprends la photo" supprime tout le cours, y compris pour un
  cours multi-pages où une seule page pose problème. Faut-il, dans un
  jalon ultérieur, permettre de ne reprendre que la page en cause ? Pas
  nécessaire pour M2 si les leçons photographiées restent courtes (1 à 2
  pages), à observer à l'usage.
- `CourseNamer` est un second appel modèle, séparé de l'extraction. Un
  appel unique qui renverrait `markdown`/`legible`/`title`/`subject` en une
  fois économiserait un aller-retour, mais coupler la détection de
  lisibilité (qui doit bloquer tôt) à une proposition de titre (qui n'a de
  sens que si le texte est bon) complique le schéma de sortie. À trancher
  à l'implémentation selon la latence mesurée.
