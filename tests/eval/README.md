# Évaluation de la génération (M3)

`pnpm eval` enchaîne, sur chaque page de `corpus/`, les vrais appels
modèle : extraction, découpage en items, génération par type, puis un appel
de jugement (`judge-prompt.md`, versionné par sa première ligne). Coûte de
l'argent : jamais en CI, jamais dans `pnpm test`.

```bash
pnpm eval [--cases id1,id2] [--max-usd 1.2] [--reextract]
```

- `--max-usd` : plafond de la course ; l'outil s'arrête net dès qu'il est
  atteint (coût calculé sur l'usage renvoyé par l'API).
- L'extraction est mise en cache dans `.cache/` (non versionné) : une
  itération sur les consignes de génération ne repaie pas la vision.
- Les scores agrégés de chaque version des consignes
  (`PROMPTS_VERSION`, `packages/core/src/exercise-generator/infra/prompts.ts`)
  sont écrits dans `results/prompts-v<N>.json` et versionnés.

## Corpus

Onze pages **générées** (aucune photo réelle d'élève), CP → 6e, six
matières, mises en page de classe : code de leçon, encadré « À retenir »,
listes, carte mentale, section d'exercices, QR code ou lien. Trois leçons
de calcul, une leçon courte (moins de 6 items attendus), et des
dégradations de téléphone sur une partie (perspective, ombre, reflet,
papier gris, bruit JPEG) — voir `corpus/index.json`. Chaque image a sa
source (`.md`) : le texte exact rendu sur la page.

Les images ont été rendues une fois avec un script Pillow hors dépôt
(Pillow n'est pas une dépendance du projet). Le jeu sur vraies photos reste
une dette ouverte de M3 (`docs/jalons.md`).

## Relire une course sans appel

`pnpm --filter @studiakids/api exec tsx src/cli/eval/replay.ts ../../tests/eval/.cache/details-v<N>.json`
rejoue validation et contrôle d'ancrage sur les réponses brutes gardées en
cache, et affiche chaque exercice écarté ou mal jugé avec sa raison.

# Évaluation du tuteur (M6)

`pnpm eval:tutor` mesure, sur `tutor/golden.json` (106 questions
**fictives** écrites pour l'occasion, aucune donnée réelle : en rapport,
hors sujet, sensible, détresse, dont des cas mêlés sensible + détresse et
des formulations d'enfant), avec les prompts versionnés
(`TUTOR_PROMPTS_VERSION`, `packages/core/src/tutor/infra/prompts.ts`) :

- **classification** (`--part classify`, un passage par modèle de
  `--models`) : rappel détresse d'abord (mêlés compris), puis exactitude
  globale et par classe, questions en rapport prises à tort pour sensibles
  ou en détresse, latence médiane ; et l'effet du pré-filtre lexical
  (`apps/api/src/cli/eval/tutor-lexicon.ts`) : détresses récupérées, fausses
  alertes sur des questions en rapport ;
- **contraintes sur le texte généré** (`--part answers`) : chaque question
  en rapport reçoit une vraie réponse, contrôlée par motifs puis par un
  juge (`tutor/judge-prompt.md`, versionné par sa première ligne) —
  sentiment, culpabilisation, secret, dissuasion de parler à un adulte,
  information personnelle, performances, changement de sujet. Chaque
  signalement se relit à la main.

`--max-usd` arrête net la course à ce plafond. Scores agrégés dans
`results/tutor-prompts-v<N>.json` (versionnés), réponses brutes dans
`.cache/` (local). Les leçons sont celles de `corpus/` et de
`tutor/lessons/`.
