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
