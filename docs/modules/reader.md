# Module `reader`

## Responsabilité

L'écran de lecture continue d'un cours : afficher le texte extrait **et les
photos du cours**, et préparer la lecture à voix haute. Ce module ne
possède aucune donnée propre — il compose `ingestion` pour le texte et les
photos, et déclenche la mise à jour de "dernier accès" définie dans
`docs/modules/ingestion.md`.

Vocabulaire : voir `docs/glossaire.md` pour la correspondance entre les
termes de prose et les identifiants anglais ci-dessous.

**Affichage des photos, décision actée (`docs/securite.md`) :** les photos
sont conservées tant que le cours existe précisément pour que le lecteur
puisse les montrer — un enfant qui veut revérifier un détail (un schéma,
une écriture particulière) doit pouvoir revoir la photo, pas seulement le
texte que le modèle en a tiré. Ce sont les photos **telles que stockées** :
réencodées par le navigateur et sans métadonnées, jamais le fichier
d'origine de l'appareil.

N'existe pas comme module séparé dans StudIA (le texte source y est lu
directement par l'écran React, et la lecture à voix haute n'existe pas du
tout dans StudIA). Isolé ici parce que le brief le nomme comme un des
quatre écrans et parce que le texte à lire à voix haute mérite d'être un
point unique, testable indépendamment de l'écran.

## Domaine

```ts
function speakableText(markdown: string): string;
```

Fonction pure : le texte que la synthèse vocale lit, tiré du Markdown —
titres, listes et emphases sans leurs symboles (`#`, `-`, `1.`, `**`), liens
réduits à leur texte, adresses web retirées, une phrase par ligne. Jamais
le Markdown brut : une voix qui lit « dièse dièse » ou une URL perd un
enfant de 6 ans.

**La voix n'est jamais activée d'office** (décidé à l'ouverture de M3,
remplace « activée par défaut pour CP et CE1 ») : les navigateurs refusent
`speechSynthesis.speak()` sans geste de l'utilisateur. La lecture démarre
au **premier appui de l'enfant** sur le bouton « Écouter » et s'arrête
sur « Stop ». Aucun état de lecture n'est persisté : c'est un état
d'écran, oublié au rechargement.

**Uniquement la synthèse (sortie), jamais la reconnaissance (entrée).**
La saisie vocale des questions du tuteur est explicitement écartée
(`docs/modules/tutor.md`, "Hors périmètre").

## Ports

Aucun. Ce module n'a pas d'`infra/` propre : il n'appelle ni modèle, ni
base de données directement.

## Cas d'usage

- `openCourseForReading(userId, courseId, now)` →
  `Result<{ markdown: string; speech: string; photos: { index: number }[] }, ReadError>`
  1. Vérifie via `ingestion` que le cours existe, appartient au compte, est
     `confirmed` et `ready` — sinon `not-found` (404 uniforme) ou
     `not-ready` : jamais un état "lecture" pour un cours pas encore prêt
  2. Lit le Markdown via `ingestion` (exporté par son `index.ts`, la table
     `extractions` reste interne à `ingestion`)
  3. Liste les pages du cours, dans l'ordre (l'écran construit l'URL de
     chaque photo sur la route authentifiée existante
     `GET /api/courses/:id/pages/:index/file`)
  4. Appelle `ingestion.recordAccess(userId, courseId, now)`
  5. Renvoie le Markdown, `speakableText(markdown)` et les photos

## Persistance

Aucune table propre.

## API

| Route | Rôle |
|---|---|
| `GET /api/courses/:id/text` | `{ markdown, speech, photos }` ; met à jour `lastAccessedAt` ; 404 uniforme, `409 not_ready` pour un cours pas prêt ou pas confirmé |

## Écran

Décidé à l'ouverture de M3, en l'absence de maquette du lecteur dans
`docs/design/` (textes « à valider », `docs/ui.md`) :

- le texte du cours rendu en Markdown (`react-markdown`, dépendance
  acceptée, déjà utilisée par StudIA), taille de police fixe et généreuse
  (18 px, échelle de `docs/ui.md`), pas de réglage ;
- sous le texte, les photos du cours en vignettes, agrandies d'un appui ;
- en haut, le bouton « Écouter » / « Stop » ; en bas, « Créer mes jeux »
  (`docs/modules/exercise-generator.md`) et son avancement ;
- un bouton « Accueil » ramène à l'accueil. La barre d'onglets arrive avec
  l'écran « Jouer » (M4).

## Hors périmètre

L'extraction elle-même, le stockage des photos (`ingestion`). Le découpage
en items et la génération d'exercices (`exercise-generator`) — le
lecteur affiche le texte source intégral, jamais les items découpés.
Toute synchronisation mot-à-mot entre la voix et le texte affiché
(surlignage progressif). La saisie vocale.

## Tests clés

- Unitaire : `speakableText` retire les symboles de titre, de liste et
  d'emphase, réduit un lien à son texte, retire une URL nue
- Intégration : `openCourseForReading` refuse un cours non `confirmed` ou
  pas `ready` avec l'état exact attendu par l'écran (jamais une 500)
- Intégration : les photos renvoyées correspondent exactement aux pages du
  cours, dans l'ordre ; chaque appel réussi met à jour `lastAccessedAt`
- Sécurité : `GET /api/courses/:id/text` renvoie 404 pour le cours d'un
  autre compte, indiscernable d'un identifiant inconnu (`docs/securite.md`)
- Playwright : le texte et les photos s'affichent ; la voix démarre au
  premier appui et s'arrête (`speechSynthesis` simulé : Chromium headless
  n'a souvent aucune voix française) ; le bouton fonctionne au clavier

## Questions ouvertes

- Une préférence de voix explicite, persistée par compte, ajouterait un
  champ à `accounts` non prévu par le brief — non demandée en M3.
- ~~Listes à tirets « – » qui ne sont pas des listes Markdown~~ —
  **tranché à la source** (2026-09-26) : l'extraction impose et vérifie
  des listes `- ` / `1. ` (`docs/modules/ingestion.md`).
