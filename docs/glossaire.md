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
| illisible | `illegible` | Valeur de `extractionStatus` et raison de page (`illegibleReason`). |
| prêt | `ready` | Valeur de `extractionStatus`. |

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
