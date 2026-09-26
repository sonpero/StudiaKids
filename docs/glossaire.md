# StudiaKids — Glossaire

Ce document est le pont entre le vocabulaire de prose (français, utilisé
dans les specs et par l'enfant) et les identifiants de code (anglais) —
voir `CLAUDE.md`, "Convention de langue". **Toute création de terme de
domaine ultérieure passe par ce fichier** : avant de nommer un nouveau
type, une nouvelle colonne ou une nouvelle route, vérifiez qu'un terme
français équivalent n'existe pas déjà ici, et ajoutez la ligne
correspondante en même temps que le renommage.

Une ligne par terme. La définition n'est donnée que lorsque le terme est
ambigu ou non transparent (un mot anglais qui pourrait avoir un autre sens
usuel, ou un mot qui ne se traduit pas mot à mot).

---

## Exceptions assumées à la convention "code en anglais"

- **Codes de niveau scolaire non traduits** : `CP`, `CE1`, `CE2`, `CM1`,
  `CM2`, `6e` apparaissent tels quels dans le type `Grade`, en base et dans
  l'API — jamais traduits en `1st-grade`/`2nd-grade`/etc. Ce sont des codes
  du système scolaire français, pas du vocabulaire métier ; les traduire
  produirait un mappage approximatif (les systèmes scolaires ne
  s'alignent pas année pour année) sans aucun bénéfice pour un produit qui
  ne s'adresse qu'à des enfants scolarisés en France.
- **`color` (orthographe américaine), divergence assumée avec StudIA**,
  qui utilise `colour` (`docs/inventaire-studia.md`, §1). Le code
  StudiaKids manipule directement des propriétés CSS et DOM (`color`,
  `background-color`), qui s'écrivent en orthographe américaine ; aligner
  le nom de la colonne/propriété métier sur cette orthographe évite une
  traduction silencieuse à la frontière UI. Ce n'est pas une erreur si vous
  la recroisez à côté d'un `colour` StudIA dans `docs/inventaire-studia.md`.
- **Tokens de design nommés en français**, en place depuis M0 et écrits
  ici à l'ouverture de M2 : les noms de token de `tokens.css` reprennent
  la palette de `docs/design/tokens.md` telle que la maquette la nomme
  (`--color-mandarine`, `--color-turquoise`, `--color-soleil`,
  `--color-succes`, `--color-peche`, `--color-vert-clair`,
  `--color-violet-nuit`, `--matiere-*`). Ce sont des noms de design, pas
  du vocabulaire métier : les traduire casserait la correspondance
  directe avec la maquette, seule référence visuelle. Les rôles sans nom
  de couleur restent en anglais (`--color-canvas`, `--color-ink`,
  `--color-ink-soft`). L'exception suit le nom du token partout où il
  est cité, y compris comme valeur stockée (`courses.color =
  'matiere-maths'`) — jamais pour un identifiant métier (la matière
  elle-même reste `french`, pas `francais`).

## Règle `grade`

**`grade` désigne exclusivement le niveau scolaire** (`Grade`, CP à 6e).
Aucun score, pourcentage ou note ne s'appelle jamais `grade` dans ce
projet, même si le mot anglais `grade` a aussi ce sens ailleurs : la
progression de l'enfant se compte en étoiles, jamais en note chiffrée. Si
un futur module a besoin d'un concept de score ou de pourcentage, il doit
choisir un autre nom (`score`, `percentage`...), jamais `grade`.

---

## Modules (`packages/core/src/<module>/`)

| Terme de prose | Module | Note |
|---|---|---|
| générateur d'exercices | `exercise-generator` | |
| moteur de jeu | `game-engine` | |
| mascotte | `mascot` | |
| progression (étoiles, séries) | `progress` | **Collision de nom assumée** avec le module StudIA `progress` (plan de révision vers une échéance, écarté — `docs/inventaire-studia.md`, §8) : même nom, aucun rapport de contenu. |
| tuteur | `tutor` | |
| lecteur | `reader` | |

`auth`, `ingestion`, `jobs`, `shared` ne changent pas de nom (déjà
compatibles anglais/français ou déjà en anglais).

---

## Comptes (`auth`)

| Terme de prose | Identifiant | Note |
|---|---|---|
| compte | `Account` | |
| identifiant (de connexion) | `username` | |
| prénom | `firstName` | |
| niveau | `grade` | Voir "Règle `grade`" ci-dessus. |

## Cours (`ingestion`)

| Terme de prose | Identifiant | Note |
|---|---|---|
| cours | `Course` / table `courses` | |
| matière | `subject` | |
| couleur | `color` | Voir "Exceptions assumées" ci-dessus. |
| confirmé (bouton "Oui, c'est ça !") | `confirmed` | |
| dernier accès | `lastAccessedAt` | |
| titre | `title` | Titre de la leçon tel qu'écrit sur la page, sans code ni numéro (« NUM1 », « Leçon 3 »), 3 à 60 caractères (`COURSE_TITLE_MIN_CHARS` / `COURSE_TITLE_MAX_CHARS`, les bornes des titres d'items). |
| code de leçon | `startsWithLessonCode` / `stripLessonCode` | Code ou numéro en tête d'un titre (« NUM1 – », « Leçon 3 : »), jamais repris dans le titre. |
| cours non confirmé | `unconfirmed` (`getUnconfirmedCourse`, `GET /api/courses/unconfirmed`) | Au plus un par compte. |
| confirmer / refuser (un cours) | `confirmCourse` / `rejectCourse` | "Oui, c'est ça !" / "Je reprends la photo". |
| relancer (après un échec technique) | `retryExtraction` | Jamais après `illegible` ni `not_a_course_page`. |
| enregistrer un accès | `recordAccess` | |
| lancer la lecture (bouton "C'est tout !") | `startExtraction` | Sans effet si la lecture est déjà lancée : même succès, aucun nouveau job. |
| supprimer un cours | `deleteCourse` | Lignes et fichiers, dans le même appel. |
| supprimer les photos d'un compte | `deleteAccountFiles` (`FileStore`) | Tout `photos/{userId}`, pour `accounts:delete`. |
| taille native (d'une photo) | `nativePhotoSize` (`packages/contracts`) | La plus grande taille que le modèle voit sans la réduire ; le navigateur réencode à cette taille. |
| tâche de lecture d'un cours | job `extract-course` (`EXTRACT_COURSE_JOB`, `extractCourseJobHandler`) | Enregistrée par le worker au démarrage. |
| adaptateur fixture | `FixturePhotoExtractor` / `FixtureCourseNamer` | Choisis par le worker avec `LLM_ADAPTER=fixture` ; aucune requête réseau. |
| page (photo d'un cours) | `Page` / table `pages` | |
| plafond de pages | `MAX_PAGES_PER_COURSE` | 5. |
| chemin stocké | `storedPath` | Relatif à la racine du volume, jamais absolu. |
| empreinte | `sha256` | Calculée sur les octets stockés (métadonnées retirées). |
| type réel (d'un fichier) | `sniffImageType` | Lu sur les octets, jamais sur l'extension ni sur le type annoncé. |
| retirer les métadonnées | `stripJpegMetadata` | |
| stockage de fichiers | `FileStore` | |
| extraction (texte tiré des photos) | `Extraction` / table `extractions` | Mot interdit à l'écran (`docs/ui.md`, "Copie"). |
| statut stocké (sans `failed`) | `StoredExtractionStatus` | `failed` n'est jamais écrit en base. |
| issue des pages | `PagesOutcome` (`outcomeOfPages`) | `illegible`, `not_a_course_page`, `ready`, ou `in_progress` (encore des pages à traiter). |
| statut affiché | `displayStatus` | Dérive `failed` du dernier job ; un résultat stocké gagne toujours. |
| taille maximale d'une page | `MAX_PAGE_BYTES` | 7 500 000 octets. |
| statut d'extraction | `extractionStatus` | Valeurs : `pending` (en attente), `running` (en cours), `illegible`, `not_a_course_page`, `ready`, `failed` (échec technique, dérivé, jamais stocké). |
| extracteur de photo | `PhotoExtractor` | |
| proposition de titre et de matière | `CourseNamer` | |
| lisible | `legible` | |
| illisible | `illegible` | Valeur de `extractionStatus`. |
| page de cours (la photo en montre une) | `isCoursePage` (`is_course_page` en base) | |
| pas une page de cours | `not_a_course_page` | Valeur de `extractionStatus`. |
| inexploitable (illisible ou pas une page de cours) | `unusable` (`unusableReason`, `unusable_reason` en base) | |
| prêt | `ready` | Valeur de `extractionStatus`. |
| écran de validation | `ConfirmationScreen` | |
| vue d'un cours (statut affiché) | `CourseView` | `extractionStatus` peut y valoir `failed`. |
| dépôt des cours | `CourseRepository` | |
| verrouillé (plus de page possible) | `locked` | Le cours n'est plus `pending`. |
| écran de capture | `CaptureScreen` | |

Matières (`Subject`, liste fermée ; le libellé affiché reste en français) :

| Terme de prose | Identifiant | Token de couleur |
|---|---|---|
| Maths | `maths` | `matiere-maths` |
| Français | `french` | `matiere-francais` |
| Histoire | `history` | `matiere-histoire` |
| Géographie | `geography` | `matiere-geographie` (provisoire) |
| Sciences | `science` | `matiere-sciences` (provisoire) |
| Anglais | `english` | `matiere-anglais` (provisoire) |
| Autre | `other` | `matiere-autre` (provisoire) |

Les noms de token `--matiere-*` sont en français : voir "Exceptions
assumées" plus haut.

## Tâches de fond (`jobs`)

| Terme de prose | Identifiant | Note |
|---|---|---|
| tâche de fond | `Job` / table `jobs` | Mot interdit à l'écran. |
| lire les photos d'un cours | job `extract-course` | |
| tentatives | `attempts` / `maxAttempts` | À ne pas confondre avec `Attempt` (`game-engine`), une réponse de l'enfant. |
| dernière erreur | `lastError` | |

## Découpage et génération (`exercise-generator`)

| Terme de prose | Identifiant | Note |
|---|---|---|
| découpage (en items) | `splitting` / `split` (verbe), job `split-items` | |
| couverture (contrôle de couverture) | `coverage` (`COVERAGE_MIN_ITEMS`, `COVERAGE_MAX_ITEMS`) | |
| couverture insuffisante | `insufficient_coverage` | Valeur de `GenerationStatus`. |
| items prêts | `items_ready` | Valeur de `GenerationStatus`. |
| corps (d'un item) | `body` | |
| jeu depuis un extrait | `game-from-excerpt` | Nom de job ; côté domaine, `startGameFromExcerpt`. |

## Types de jeu (`game-engine`)

| Terme de prose | Identifiant | Définition |
|---|---|---|
| copie différée | `delayed_copy` | Un mot/une phrase est montré puis caché, l'enfant le retape de mémoire. Nom affiché à l'enfant : "Dictée flash". |
| QCM | `mcq` | Question à choix multiples (*multiple-choice question*), quatre options. |
| appariement | `matching` | Relier des éléments de deux colonnes. |
| remise en ordre | `reordering` | Remettre des éléments dans le bon ordre. |
| texte à trous | `cloze` | Terme pédagogique standard pour un texte à compléter ; valeur persistée courte. Comparateur tolérant (casse/accents ignorés). |
| vrai/faux | `true_false` | |
| calcul flash | `mental_math` | Le cœur pédagogique est l'absence de calculatrice (calcul mental) ; la contrainte de temps n'est qu'un paramètre d'affichage (`displayDurationMs`), pas ce que désigne le nom du type. |

| Terme de prose | Identifiant | Note |
|---|---|---|
| tentative | `Attempt` / table `attempts` | |
| unité (d'une comparaison) | `UnitResult` | Une unité par sous-réponse pour un exercice composite. |
| éligible à une étoile | `starEligible` | `false` uniquement pour une tentative avec relecture en copie différée. |
| relire / relecture | `reread` (option `{ reread?: boolean }`) | |

## Poses de la mascotte (`mascot`)

Liste fermée, sept poses :

| Terme de prose | Identifiant |
|---|---|
| repos | `idle` |
| observation | `watching` |
| écoute | `waiting` — **pas `thinking`** : attribuer un état mental à la mascotte est précisément ce qu'interdit `docs/securite.md` ("Contraintes sur le texte généré"), le vocabulaire ne doit pas s'installer dans les identifiants non plus. |
| joie | `joy` |
| embarras | `sorry` — ni `embarrassed`, ni `sheepish`, ni `oops`. |
| panne | `glitch` — clairement technique, sans suggérer que l'application entière est cassée. |
| refus | `refusal` |

`presenter` (la fonction qui choisit une pose) devient `present`, en verbe.

| Terme de prose | Identifiant | Note |
|---|---|---|
| signal (ce qui se passe dans l'app) | `Signal` | Union fermée, `docs/modules/mascot.md`. |
| présentation (pose + phrase) | `Presentation` | |
| variante (de phrase) | `variantIndex` | Fourni par l'appelant, jamais tiré au hasard. |
| présentation par défaut | `DEFAULT_PRESENTATION` | `idle` + "Coucou !", pour tout signal inconnu. |

## Tuteur (`tutor`)

| Terme de prose | Identifiant | Définition |
|---|---|---|
| détresse | `distress` | Issue de classification qui déclenche le rendu hors-fil, jamais un simple refus. |
| hors-sujet | `off_topic` | Valeur de `RefusalReason`. |
| sensible | `sensitive` | Valeur de classification et de `RefusalReason`. |
| en rapport (avec le cours) | `onTopic` | |
| hors-fil | `outOfBand` (`out_of_band` en base) | Booléen : `true` uniquement pour un message `issue: 'distress'`, qui ne s'affiche pas comme une bulle de conversation. **Pourra devenir une colonne `kind`** si d'autres types de message hors fil apparaissent — voir `docs/donnees.md`, table `messages`. |
| rôle du message (l'enfant) | `Message.role: "user"` | `user` désigne l'enfant dans ce schéma, parce que cette colonne alimente directement les appels au modèle (`ChatModel.stream`) ; une convention différente (ex. `child`) imposerait une couche de correspondance permanente à l'appel du modèle. |
| aucun passage disponible | `no-excerpt-available` | Erreur de `generateGameFromConversation`. |
| message d'information sur la consultation par l'adulte | `showDisclosure` (retour de `createConversation`), table `tutor_disclosures` | Affiché une seule fois par compte, jamais lié au cycle de vie d'une conversation précise — voir `docs/securite.md`, "Historique du tuteur : consultable, jamais secret". |

## Progression (`progress`)

| Terme de prose | Identifiant | Note |
|---|---|---|
| compte-rendu de tentative (pour le calcul) | `AttemptSummary` | |
| port de lecture des tentatives | `AttemptsQuery` | Nom réservé : `Reader` désigne déjà le module `reader`, `AttemptsQuery` évite la collision tout en restant descriptif. |
| série (en cours / meilleure) | `currentStreak` / `bestStreak` | |
| palier de bonus de série | `STREAK_BONUS_THRESHOLD` | |
| valide (statut d'un cours) | `confirmed` | |

## Fonctions et verbes divers

| Terme de prose | Identifiant |
|---|---|
| présenter (une pose/phrase) | `present` |
| classifier (une question) | `classify` |
| générer (un exercice) | `generate` |
| découper (en items) | `split` |

---

## Divergences de nommage entre StudIA et StudiaKids

- `color` (StudiaKids) vs `colour` (StudIA) — voir "Exceptions assumées"
  ci-dessus.
- Le module `progress` de StudiaKids (étoiles, séries) ne doit pas être
  confondu avec le module `progress` de StudIA (plan de révision), écarté
  et sans équivalent ici — voir `docs/inventaire-studia.md`, §8.
