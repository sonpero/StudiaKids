# Module `reader`

## Responsabilité

L'écran de lecture continue d'un cours : afficher le texte extrait **et les
photos originales**, et piloter la lecture à voix haute. Ce module ne
possède aucune donnée propre — il compose `ingestion` pour le texte et les
photos, expose une règle de domaine pour la voix, et déclenche la mise à
jour de "dernier accès" définie dans `docs/modules/ingestion.md`.

Vocabulaire : voir `docs/glossaire.md` pour la correspondance entre les
termes de prose et les identifiants anglais ci-dessous.

**Affichage des photos originales, décision actée (`docs/securite.md`) :**
les photos sont conservées tant que le cours existe précisément pour que le
lecteur puisse les montrer — un enfant qui veut revérifier un détail (un
schéma, une écriture particulière) doit pouvoir revoir la photo, pas
seulement le texte que le modèle en a tiré.

N'existe pas comme module séparé dans StudIA (le texte source y est lu
directement depuis `ingestion`/`content` par l'écran React, et la lecture à
voix haute n'existe pas du tout dans StudIA). Isolé ici parce que le brief
le nomme comme un des quatre écrans et parce que la règle "voix activée par
défaut selon le niveau" mérite d'être un point unique, testable
indépendamment de l'écran.

## Domaine

```ts
function voiceEnabledByDefault(grade: Grade): boolean;
// true pour CP et CE1, false pour CE2, CM1, CM2, 6e.
```

Fonction pure, entièrement déterministe : le choix par défaut ne dépend que
du niveau du compte, jamais d'un état caché.

**Aucun état de lecture (position dans le texte, vitesse de la voix) n'est
persisté.** La synthèse vocale elle-même passe par la Web Speech API
directement dans le navigateur (`SpeechSynthesisUtterance`, voix
française) : aucun appel serveur, aucune dépendance à un module LLM. Le
bouton play/pause de la voix est un état d'écran, oublié au rechargement de
la page — voir Questions ouvertes pour la persistance éventuelle d'une
préférence explicite de l'enfant.

**Uniquement la synthèse (sortie), jamais la reconnaissance (entrée).** Ne
pas confondre avec une éventuelle saisie vocale des questions du tuteur —
explicitement écartée, voir `docs/modules/tutor.md`, "Hors périmètre" :
le support de `SpeechRecognition` sur Safari iOS est insuffisant pour une
cible qui inclut probablement l'iPad. `voiceEnabledByDefault` et
`SpeechSynthesisUtterance` ne sont pas concernés par cette limite, qui ne
touche que la reconnaissance.

## Ports

Aucun. Ce module n'a pas d'`infra/` propre : il n'appelle ni modèle, ni
base de données directement.

## Cas d'usage

- `openCourseForReading(userId, courseId, now)` → `Result<{ markdown: string; photos: { index: number; url: string }[]; voiceEnabledByDefault: boolean }, ReadError>`
  1. Vérifie via `ingestion.getCourse(userId, courseId)` que le cours existe,
     appartient au compte, est `confirmed` et `extractionStatus: 'ready'` —
     sinon renvoie l'état déjà porté par l'écran de validation ou
     d'attente, jamais un état "lecture" séparé pour un cours pas encore
     prêt
  2. Lit le Markdown via `ingestion` (méthode exportée à cet effet dans son
     `index.ts`, la table `extractions` reste interne à `ingestion`)
  3. Construit la liste des photos à partir des pages du cours
     (`ingestion.listPages` ou équivalent exporté), chaque `url` pointant
     vers la route authentifiée existante
     `GET /api/courses/:id/pages/:index/file` — ce module ne stocke ni ne
     sert lui-même les fichiers, il assemble seulement les URLs
  4. Appelle `ingestion.recordAccess(userId, courseId, now)`
  5. Renvoie le Markdown, les photos, et `voiceEnabledByDefault(account.grade)`

## Persistance

Aucune table propre.

## API

| Route | Rôle |
|---|---|
| `GET /api/courses/:id/text` | `{ markdown, photos, voiceEnabledByDefault }` ; met à jour `lastAccessedAt` |

## Hors périmètre

L'extraction elle-même, le stockage des photos (`ingestion`). Le découpage
en items et la génération d'exercices (`exercise-generator`) — le
lecteur affiche le texte source intégral, jamais les items découpés.
Toute synchronisation mot-à-mot entre la voix et le texte affiché
(surlignage progressif) : agréable mais non demandée par le brief, à ne pas
construire tant qu'un jalon ne le demande pas explicitement. La saisie
vocale (reconnaissance de la parole) — voir `docs/modules/tutor.md`.

## Tests clés

- Unitaire : `voiceEnabledByDefault` vraie pour CP et CE1, fausse
  pour les quatre autres niveaux — un cas par niveau, jamais une simple
  comparaison de plage qui masquerait un niveau mal placé
- Intégration : `openCourseForReading` refuse un cours non `confirmed` ou
  dont l'extraction n'est pas `ready`, avec l'état exact attendu par l'écran
  (jamais une 500 générique)
- Intégration : la liste `photos` renvoyée correspond exactement aux pages
  du cours, dans l'ordre
- Intégration : chaque appel réussi met à jour `lastAccessedAt` du cours
- Sécurité : `GET /api/courses/:id/text` renvoie 404 pour le cours d'un
  autre compte, indiscernable d'un identifiant inconnu (`docs/securite.md`)
- Playwright : le texte du cours s'affiche, les photos originales sont
  visibles et consultables ; la voix démarre par défaut pour un compte CP
  et pas pour un compte 6e sur le même cours ; le play/pause de la voix
  fonctionne au clavier (accessibilité)

## Questions ouvertes

- Une préférence de voix explicite (l'enfant coupe la voix une fois,
  est-ce qu'elle reste coupée la prochaine fois ?) mériterait probablement
  d'être persistée par compte plutôt que réinitialisée à chaque ouverture,
  mais cela ajoute un champ à `accounts` (`docs/modules/auth.md`) non prévu
  par le brief. À confirmer avant M3.
- Taille de police du lecteur : réglable par l'enfant, ou fixe par niveau
  comme la voix ? Le brief ne le précise pas ; `docs/ui.md` recommande
  seulement une taille généreuse par défaut.
- Présentation des photos à côté du texte : côte à côte, en dessous, ou
  dans un onglet séparé au sein du même écran ? Non tranché, à décider
  avec `docs/design/` — pas encore couvert par une maquette existante.
- ~~Listes à tirets « – » qui ne sont pas des listes Markdown~~ —
  **tranché à la source** (2026-09-26) : l'extraction impose et vérifie
  des listes `- ` / `1. ` (`docs/modules/ingestion.md`, "Forme du
  Markdown"). Le lecteur peut rendre le Markdown tel quel.
