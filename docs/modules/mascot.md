# Module `mascot`

## Responsabilité

Décider, à partir d'un signal applicatif (une extraction qui échoue, une
bonne réponse, un tuteur qui réfléchit...), **quelle pose et quelle phrase**
présenter. Centralise cette décision pour qu'elle ne soit pas réinventée
différemment dans chaque écran, et pour qu'elle reste testable sans monter
un composant React.

Le contrat visuel du composant (les sept poses, liste fermée, leurs props,
où chacune apparaît) est spécifié dans `docs/ui.md`, section "La
mascotte" — ce document-ci ne le répète pas, il spécifie la **logique** qui
choisit une pose parmi cette liste à partir d'un signal applicatif, pas le
rendu.

Vocabulaire : voir `docs/glossaire.md` pour la correspondance entre les
poses et signaux nommés en prose ici et leurs identifiants anglais.

**Liste fermée, sept poses** : `idle`, `watching`, `waiting`, `joy`
(référence SVG existante, `docs/design/mascotte-etats.html`), plus
`sorry` (photo illisible), `glitch` (échec technique) et `refusal`
(question hors cours) — ces trois dernières sont spécifiées ici
sémantiquement mais **leur SVG reste à ajouter dans `docs/design/`** ; ne
pas en dessiner dans ce dépôt de cadrage.

N'existe pas dans StudIA sous cette forme : `Fiche` y est choisie
directement par chaque écran au cas par cas. Ici, centraliser est justifié
par un besoin propre à StudiaKids qui n'existe pas dans StudIA : garantir
mécaniquement, par un test, qu'aucune phrase ne contient de jargon
technique et qu'aucune pose "négative" n'existe pour un échec de l'enfant
(voir Tests clés).

## Domaine

```ts
type Signal =
  | { type: "home"; hasExistingCourses: boolean }
  | { type: "extraction-in-progress" }
  | { type: "extraction-illegible"; reason: string }
  | { type: "extraction-failed" }
  | { type: "generation-in-progress" }
  | { type: "generation-failed" }
  | { type: "game-from-excerpt-in-progress" }   // chip "Fais-moi un jeu là-dessus", docs/modules/tutor.md
  | { type: "game-answer"; correct: boolean; streakBonus: boolean }
  | { type: "session-complete"; starsEarned: number }
  | { type: "tutor-thinking" }
  | { type: "tutor-refusal" };

type Presentation = { pose: MascotPose; line: string };  // MascotPose : docs/ui.md

function present(signal: Signal, variantIndex: number): Presentation;
```

**`variantIndex`, pas `Math.random()` interne.** Plusieurs phrases possibles
existent par signal pour éviter la répétition ("Je regarde ta photo…", "Je
jette un œil à ton cours…"), mais la fonction reste pure : l'appelant fait
tourner un compteur (par exemple le nombre de fois que ce signal est apparu
dans la session) et le passe explicitement. Même principe que l'horloge
injectée du reste du projet (`CLAUDE.md`) : rien ici n'a d'état caché.

**Règle de robustesse.** `Signal` est un type fermé, mais `present` reste
défensif : toute valeur qui n'y correspond pas (un type ajouté ailleurs
sans mise à jour de ce module, une valeur corrompue venue d'un état
sérialisé) produit `{ pose: 'idle', line: <phrase neutre par défaut> }`,
jamais une exception, jamais un écran vide. Un test dédié le vérifie en
forçant une valeur hors du type au moyen d'un cast — voir Tests clés.

**Table de correspondance signal → pose**, reprise de `docs/ui.md` :

| Signal | Pose |
|---|---|
| `home` (sans cours) | `idle` — différencié par la phrase, pas le dessin |
| `home` (avec cours) | `idle` |
| `extraction-in-progress` | `waiting` |
| `extraction-illegible` | `sorry` |
| `extraction-failed` | `glitch` |
| `generation-in-progress` | `waiting` |
| `generation-failed` | `glitch` |
| `game-from-excerpt-in-progress` | `waiting` — même pose que `generation-in-progress`, mais avec sa propre phrase ("Je te prépare un jeu sur ce passage…"), voir `docs/modules/tutor.md` |
| `game-answer` correcte, sans bonus | `joy` |
| `game-answer` correcte, avec bonus | `joy` — la distinction se fait par la phrase et l'intensité de l'animation, pas par le dessin |
| `game-answer` incorrecte | `waiting` — décision délibérée de réutiliser une pose calme plutôt que d'inventer une huitième pose ; jamais `sorry` (réservée à la photo) ni `glitch` (réservée à l'échec technique), ni aucune pose qui suggérerait la déception |
| `session-complete` | `joy` |
| `tutor-thinking` | `waiting` |
| `tutor-refusal` | `refusal` |

**`distress` n'apparaît pas dans cette table.** Son déclenchement et son
rendu sont spécifiés dans `docs/modules/tutor.md` ("Rendu de l'issue
distress"), pas ici : ce n'est pas une réaction ordinaire du tuteur qui
choisirait une pose parmi les sept, c'est un rendu hors du fil normal de la
conversation, structurellement différent d'un appel à `present`.

Cette table est la spécification exécutable : un test paramétré vérifie
`present` contre chaque ligne.

## Ports

Aucun. Ce module est entièrement pur, sans I/O, sans LLM, sans base de
données — uniquement du `domain/`, pas d'`application/` ni d'`infra/`.

## Cas d'usage

Aucun au sens "orchestration + ports" du reste du projet. `present` est
appelée directement par les composants d'écran (`apps/web`) à chaque
changement de signal pertinent (un statut d'extraction qui change, une
réponse soumise, etc.).

## Persistance

Aucune.

## API

Aucune. Ce module n'est jamais exposé en HTTP ; il est importé directement
par `apps/web` via `packages/core`'s `mascot/index.ts`.

## Hors périmètre

Le rendu SVG des poses (`apps/web/src/components/mascot/`, spécifié dans
`docs/ui.md`). Le texte des réponses du tuteur — ce module ne fournit
jamais ce texte-là, seulement une phrase fixe du catalogue ci-dessus pour
les signaux `tutor-thinking` et `tutor-refusal`. Le rendu de l'issue
`distress` (`docs/modules/tutor.md`). L'avatar de mascotte affiché à côté
des réponses du tuteur (`docs/ui.md`, taille `"avatar"`) — décidé, mais
géré par l'écran tuteur directement, pas par `present()`.

## Tests clés

- Unitaire, paramétré sur la table ci-dessus : chaque `Signal` produit
  exactement la `MascotPose` attendue
- Unitaire : une valeur hors du type `Signal` (forcée par cast dans le
  test) produit `{ pose: 'idle', line: <phrase par défaut> }`, jamais
  une exception — le test de la règle de robustesse
- Unitaire : `game-answer` avec `correct: false` ne produit **jamais**
  `joy`, `sorry` ni `glitch` — test qui protège la règle "aucune perte,
  jamais de jugement" au niveau du code, pas seulement de la revue humaine
- Unitaire : `extraction-illegible` et `extraction-failed` produisent bien
  deux poses distinctes (`sorry` vs `glitch`) — le test qui protège la
  distinction "résultat métier normal" vs "vrai bug technique"
- Unitaire : **aucune phrase du catalogue ne contient un mot de la liste
  interdite** (`extraction`, `job`, `génération`, `backend`, `serveur`,
  `erreur 500`, etc.) — un test qui itère tout le catalogue de phrases
  contre cette liste, pour empêcher qu'un jargon technique ne s'introduise
  silencieusement dans une future phrase ajoutée
- Unitaire : `present` est déterministe — mêmes `signal` et
  `variantIndex`, même résultat, toujours (pas d'appel horloge ni aléatoire
  interne)

## Questions ouvertes

- Le nombre de variantes de phrases par signal (une seule pour l'instant
  dans cette spec, plusieurs à terme) : combien en écrire avant que la
  répétition devienne perceptible par un enfant qui joue longtemps ? Pas
  de réponse a priori, à ajuster à l'usage.
- Faut-il une pose spécifique pour "premier cours jamais créé" (onboarding) ?
  Le brief ne détaille pas d'écran d'onboarding séparé ; cette spec suppose
  que `idle` + l'invitation à photographier suffit.
- Les SVG de `sorry`, `glitch` et `refusal` restent à ajouter dans
  `docs/design/` avant, respectivement, M2 (les deux premières) et M6 (la
  troisième) — ce document en fixe déjà la sémantique et le mapping, il ne
  manque que le dessin.
