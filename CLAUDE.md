# StudiaKids

Application d'aide aux devoirs, du CP à la 6e, toutes matières. L'enfant
photographie lui-même une page de cours, sans intervention d'un adulte ;
l'application en tire des jeux (QCM, appariement, texte à trous, calcul
flash, etc.), une mascotte l'accompagne et célèbre ses réussites, il gagne des
étoiles. Un tuteur répond aux questions sur le cours.

Déploiement privé : comptes créés en CLI, un compte par enfant, pas
d'inscription publique, pas de notion de profil séparée du compte.

Ce fichier définit les règles de travail. `docs/jalons.md` définit le
périmètre courant. `docs/modules/*.md` définissent chaque module. En cas de
contradiction entre un module et ce fichier, ce fichier gagne — et vous devez
signaler la contradiction plutôt que trancher seul.

---

## Règle de préséance

En cas de conflit entre documents : **`docs/securite.md` prime sur
`docs/ui.md`, qui prime sur `docs/design/`.** `docs/design/` est une
exploration visuelle (maquettes, palette, référence de mascotte), pas une
spécification produit ou sécurité — une maquette ne peut jamais, à elle
seule, justifier de revoir une règle de sécurité ou une règle produit
déjà actée.

**Si une maquette ou un nouvel élément de `docs/design/` semble contredire
une règle de `docs/securite.md` ou de `docs/ui.md` : signalez le conflit
explicitement et attendez une décision humaine. Ne tranchez jamais ça
vous-même**, même quand la conciliation semble raisonnable sur le
moment — c'est arrivé une fois pendant le cadrage initial de ce projet
(une maquette montrait la mascotte comme avatar de chat à côté des
réponses du tuteur) : l'erreur n'était pas le résultat auquel la
réconciliation a abouti (arbitré depuis, l'avatar est resté — voir
`docs/securite.md`, "Contraintes sur le texte généré"), mais le fait de
l'avoir tranché seul plutôt que de signaler le conflit et d'attendre. Ne
laissez pas ça se reproduire. Ceci ne s'applique qu'aux **règles**
(sécurité, produit) : une divergence purement visuelle (une couleur, une
pose, un libellé) entre ce que ce dépôt documente et une nouvelle maquette
peut être réconciliée directement, dans le sens de la maquette la plus
récente.

---

## Convention de langue

**La prose reste en français** : ce fichier, `docs/jalons.md`, les specs de
modules (`docs/modules/*.md`), leurs critères d'acceptation, et tout texte
visible par l'enfant dans l'application.

**Le code passe en anglais** : identifiants (types, fonctions, variables),
noms de fichiers de code, noms de module (`packages/core/src/<module>/`),
noms de table et de colonne SQL, noms de branche, messages de commit, noms
de test. Sans exception et sans mélange : un module ne peut pas être nommé
en français avec une interface nommée en anglais, ni l'inverse.

**Correspondance validée et appliquée aux documents de cadrage** : les
modules qui portaient un nom français (`generateur-exercices`,
`moteur-jeu`, `mascotte`, `progression`, `tuteur`, `lecteur`) sont devenus
respectivement `exercise-generator`, `game-engine`, `mascot`, `progress`,
`tutor`, `reader` ; leurs fichiers de specs et le schéma de données de
`docs/donnees.md` ont été renommés et mis à jour en conséquence. Le pont
complet entre le vocabulaire de prose (français) et les identifiants de
code (anglais) vit dans `docs/glossaire.md` — toute création de nouveau
terme de domaine y passe avant d'être utilisée dans une spec ou du code.

**Trois exceptions assumées à cette règle**, documentées en détail dans
`docs/glossaire.md` : les codes de niveau scolaire (`CP`, `CE1`, `CE2`,
`CM1`, `CM2`, `6e`) ne sont pas traduits ; la couleur d'un cours
(`color`) utilise l'orthographe américaine plutôt que celle de StudIA
(`colour`), parce que le code manipule des propriétés CSS/DOM qui
s'écrivent `color` ; et les **tokens de design** gardent le nom français
de la palette de `docs/design/tokens.md` (`--color-mandarine`,
`--color-succes`, `--matiere-francais`...), y compris quand un
identifiant de code les référence par leur nom (`matiere-maths` dans
`courses.color`) — en place depuis M0, écrite à l'ouverture de M2.

**`grade` est réservé au niveau scolaire.** Aucun score, pourcentage ou
note ne s'appelle jamais `grade` dans ce projet — la progression de
l'enfant se compte en étoiles, jamais en note (voir `docs/glossaire.md`).

Avant d'écrire la moindre ligne de code applicatif, vérifiez que
`docs/glossaire.md` couvre le terme dont vous avez besoin — ne partez
jamais du nom français d'une spec pour nommer un fichier ou un type en
code sans passer par cette correspondance.

---

## Jalon courant

**M2 — Ingestion : photographier un cours — est ouvert** (voir
`docs/jalons.md`). M0 et M1 sont acceptés. Modules touchés :
`ingestion` (spec `docs/modules/ingestion.md`), `mascot` (`present()`),
et les noyaux `jobs` (créé dans ce jalon, copie de StudIA validée — spec
`docs/modules/jobs.md`) et `shared` (fabrique de client modèle, validée).
Hors de ces deux ajouts validés, `jobs/` et `shared/` restent frozen.

Une fois un nouveau jalon ouvert, mettez à jour cette section dans le même
commit.

---

## Provenance de la stack

StudiaKids reprend la stack et l'architecture de StudIA (`../StudIA`) à
l'identique — voir `docs/inventaire-studia.md` pour le détail de ce qui est
recopié tel quel, adapté, ou écarté. **N'introduisez aucun changement de
framework ou de bibliothèque structurante** (base de données, ORM, serveur
HTTP, bundler, SDK LLM) sans validation explicite : ce choix a déjà été fait.

---

## Stack

| Couche | Choix |
|---|---|
| API | Fastify 5 + TypeScript (Node 22), `fastify-type-provider-zod` |
| Front | React 19 + Vite + Tailwind 4 + shadcn/ui + TanStack Query |
| DB | SQLite (`better-sqlite3`) + Drizzle ORM, FTS5 si besoin de recherche |
| Auth | argon2 + cookie de session signé, comptes seedés en CLI |
| Fichiers | Volume Railway, chemin lu depuis `RAILWAY_VOLUME_MOUNT_PATH` (repli `./data` en local) |
| Jobs | table `jobs` + worker Node qui poll (pas de Redis/BullMQ) |
| LLM | Vercel AI SDK (`generateObject`/`streamText`) + `@ai-sdk/anthropic`, schémas Zod |
| Extraction | modèle vision uniquement — pas d'OCR local, pas de PDF/Word/PowerPoint (l'enfant ne dépose que des photos) |
| Voix | Web Speech API, **synthèse vocale uniquement** (lecture à voix haute, côté navigateur, aucune dépendance serveur) — pas de reconnaissance vocale, voir `docs/modules/tutor.md` |
| Manifeste | Web App Manifest + icônes, pour un lancement plein écran depuis l'écran d'accueil ; **pas de service worker, pas de mode hors ligne** |
| Tests | Vitest (unit/integration/contract) + Playwright (e2e) |
| Déploiement | Un seul service Railway, Dockerfile multi-stage |

**Version de Node : la CI fait foi.** CI et production tournent en Node 22
(`engines`, `.node-version`, Dockerfile) ; le poste de développement local
peut tourner en Node 24. Pour que ce décalage ne laisse passer aucune API
propre à Node 24, `@types/node` est figé sur la version majeure 22
(`pnpm.overrides` à la racine, vérifié par
`packages/core/src/toolchain.unit.test.ts`) : c'est le typecheck, pas le
runtime local, qui dit quelles API existent. Un comportement qui ne se
reproduit qu'en local ne prouve rien tant que la CI ne l'a pas confirmé.

N'ajoutez pas de dépendance sans une justification d'une ligne dans la
description de la PR. Préférez la bibliothèque standard ou une dépendance
déjà présente.

---

## Arborescence

```
apps/
  api/          Fastify, sert /api/* et le SPA buildé
  web/          SPA React (Vite)
  worker/       même image, autre point d'entrée : draine la table jobs
packages/
  contracts/    schémas Zod partagés par api, web et worker
  core/         modules métier (voir ci-dessous)
```

### Modules métier

Chaque module vit dans `packages/core/src/<module>/` avec trois couches :

```
domain/        fonctions et types purs. ZÉRO I/O. ZÉRO import depuis infra/
application/   cas d'usage, orchestrent domain + ports
infra/         adaptateurs (repositories SQLite, clients LLM, filesystem)
index.ts       SEULE surface publique du module
```

Modules : `auth`, `ingestion`, `exercise-generator`, `game-engine`,
`mascot`, `progress`, `tutor`, `reader`, plus un noyau partagé
`jobs` (queue et worker) et `shared` (`Result`, `Clock`, `IdGenerator`,
la fabrique de client modèle).

**Chaque module a une spec contraignante dans `docs/modules/`.** Lisez la
vôtre avant d'écrire du code. Elle définit les types de domaine, les ports,
les cas d'usage, les tables, les routes, et les tests qui doivent exister. En
cas de contradiction avec ce fichier, ce fichier gagne — signalez la
contradiction plutôt que de trancher seul.

**Les imports inter-modules passent uniquement par `index.ts`.** Ne jamais
aller chercher dans les internes d'un autre module. Vérifié par
`dependency-cruiser` en CI : une violation fait échouer le build. Si vous
avez besoin de quelque chose qui n'est pas exporté, arrêtez-vous et demandez
plutôt que de l'exporter vous-même.

---

## Règles non négociables

### 1. Chaque ligne est scopée par `userId`

**Un compte égale un enfant.** Pas de notion de profil séparée du compte :
un second enfant dans le même foyer a un second compte, créé par le même
script CLI (`docs/modules/auth.md`). Il n'y a pas de contenu partagé et pas
de rôle parent/enseignant qui verrait plusieurs enfants à la fois dans
l'usage courant de l'app. Chaque méthode de repository prend un `userId`
et filtre dessus. Une méthode de repository sans `userId` dans sa signature
est un bug.

### 2. Aucun appel LLM à l'intérieur d'une transaction SQLite

SQLite a un seul writer. Un appel de génération prend plusieurs secondes et
bloquerait toute autre écriture. Motif : lire ce qu'il faut, fermer la
transaction, appeler le modèle, puis ouvrir une courte transaction d'écriture.

### 3. Chaque appel LLM passe par un port

Les ports sont définis dans `packages/core/src/<module>/domain/ports.ts` avec
un schéma Zod pour l'entrée et la sortie. Deux adaptateurs existent pour
chacun : le vrai, et un adaptateur fixture utilisé dans les tests. Aucun test
ne touche le réseau. Jamais.

### 4. Zod est la seule source de schéma

Le même schéma valide le contrat HTTP et la sortie LLM. `generateObject` ne
transmet PAS `.min()`, `.max()` ni `.format()` au modèle : mettez ce que le
modèle doit savoir dans `.describe()`. Schémas plats et peu profonds ; les
unions discriminées dégradent la fiabilité — un schéma par type de jeu, un
appel par type.

En cas d'échec de validation, un seul retry avec l'erreur renvoyée au modèle,
puis échec du job avec `last_error` renseigné.

### 5. Les exercices sont générés une fois, jamais à la volée

Un exercice est écrit en base au moment de la génération. Jouer un jeu ne
déclenche jamais d'appel LLM. Régénérer remplace explicitement les exercices
existants d'un item (jamais silencieusement pendant une partie).

### 6. Le comparateur de réponse n'est jamais une égalité globale

Chaque type de jeu a sa propre logique de comparaison en `domain/`
(`game-engine`), jamais un `JSON.stringify(donné) === JSON.stringify(attendu)`.
Voir `docs/modules/game-engine.md`.

### 7. Aucune perte, jamais de compte à rebours anxiogène

Aucune étoile n'est retirée en cas d'échec. Aucun écran n'affiche de
décompte, de barre "temps restant" menaçante, ni de comparaison entre
enfants. Le produit propose, l'enfant décide de continuer ou non — voir
`docs/ui.md`.

---

## TDD

Ce projet est test-first. Pour chaque changement :

1. Écrivez le test qui échoue. **Lancez-le. Confirmez qu'il échoue pour la
   bonne raison.**
2. Écrivez le minimum de code pour le faire passer.
3. Refactorez avec le test au vert.

N'écrivez pas de code d'implémentation avant qu'un test qui échoue n'existe.

**Ne modifiez et ne supprimez jamais un test existant pour faire passer un
build.** Si un test semble faux, arrêtez-vous et expliquez pourquoi dans
votre message.

Chaque correction de bug commence par un test de non-régression qui reproduit
le bug.

### Couches de test

| Couche | Outil | Portée |
|---|---|---|
| Unit | Vitest | `domain/` uniquement. Aucun mock, aucun I/O. Rapide. |
| Intégration | Vitest | Vraie SQLite dans un fichier temporaire, vraies migrations. |
| Contrat LLM | Vitest + fixtures | Réponses enregistrées rejouées. Valide le schéma et la gestion d'une sortie dégradée. |
| Acceptation | Playwright | Un scénario par parcours utilisateur, écrit avant le code du parcours. |
| Éval LLM | Vitest, suite séparée | Jeu d'or, lancé manuellement, coûte de l'argent. Jamais en CI. |

`pnpm test` lance unit + intégration + contrat. Il ne doit jamais faire
d'appel réseau ; un setup global fait échouer `fetch` pour qu'un adaptateur
fixture mal câblé échoue bruyamment plutôt que d'appeler silencieusement un
vrai modèle.

Fichiers de fixtures LLM : enregistrez la réponse **brute**, jamais l'objet
déjà validé — sinon le test ne couvre ni la validation Zod, ni le chemin de
retry.

### Régime de mutation testing

Test-first est obligatoire partout, sans exception. Le mutation testing —
prouver qu'une propriété casse seule sous une mutation ciblée, pas seulement
qu'un test heureux qui passe existe — n'est requis que là où un défaut
passerait inaperçu à la fois en revue et à l'usage normal :

- fonctions pures de `domain/`, en particulier le comparateur de réponse par
  type et le contrôle de couverture (`game-engine`, `exercise-generator`)
- migrations et tout ce qui touche l'état persisté
- règles `dependency-cruiser`, dont la non-vacuité est vérifiée par une
  violation délibérée puis un revert
- invariants inter-modules (ex. : une tentative ne peut jamais faire gagner
  d'étoile à un exercice qui n'appartient pas au compte courant)

Partout ailleurs — composants React, routes (la couverture d'intégration
suffit), adaptateurs sans logique propre — le test-first s'applique toujours,
mais **n'ajoutez pas de mutation testing sauf si on vous le demande
explicitement.**

Ceci n'assouplit pas les critères d'acceptation d'un jalon : chaque case
d'acceptation garde son propre test nommé, quel que soit le régime.

---

## Conventions

- TypeScript `strict: true`. Pas de `any`, pas de `@ts-ignore`. Si vous êtes
  bloqué sur un type, dites-le plutôt que de contourner le système de types.
- Exports nommés uniquement, pas d'export par défaut.
- Erreurs : le code de domaine retourne un type `Result`, il ne lève jamais
  d'exception. Seule `infra/` lève. La couche API traduit les erreurs en
  codes HTTP à un seul endroit.
- Dates : chaînes ISO 8601 UTC en base. Toute logique temporelle prend un
  paramètre `now: Date` explicite, jamais `new Date()` en interne.
- IDs : UUID v7, générés en couche application, jamais par la base.
- Messages de commit et commentaires de code en anglais. Copie UI en
  français, tutoiement, adaptée à un enfant de 6 à 11 ans (phrases courtes,
  vocabulaire concret, jamais de jargon technique visible).
- Les commentaires expliquent le *pourquoi*, jamais le *quoi*. Supprimez un
  commentaire qui reformule le code.

### Spécificités Fastify

- Un plugin par fichier, dans `apps/api/src/plugins/`.
- La portée d'un décorateur suit l'encapsulation du plugin : un décorateur
  enregistré dans un plugin n'est PAS visible en dehors sans `fastify-plugin`.
  Source la plus fréquente de bug silencieux ici. Quand vous ajoutez un
  décorateur, indiquez explicitement dans votre message où il est visible.
- Schémas de route en Zod, via `fastify-type-provider-zod`. Jamais de JSON
  Schema écrit à la main.
- Toutes les routes API sont préfixées `/api/`. Le fallback SPA est
  enregistré en dernier.

### UI

`docs/ui.md` fait foi. Lisez-le avant de toucher à quoi que ce soit dans
`apps/web/`.

Règles les plus souvent enfreintes :

- **Uniquement les tokens.** Aucune couleur, espacement ou police hors de
  `tokens.css`.
- **Quatre états par écran.** Chargement, vide, erreur, prêt. Un écran qui en
  manque un est incomplet.
- **Rien ne bloque sur un job.** L'extraction et la génération prennent du
  temps ; l'enfant doit pouvoir naviguer ailleurs et revenir.
- **Jamais d'échec silencieux ni de jargon technique visible.** Toute erreur
  est portée par la mascotte, en langage d'enfant, avec une action possible.
- **Cibles tactiles 44px minimum**, partout.

L'app est incarnée par une mascotte, décrite intégralement dans `docs/ui.md`
(contrat d'API et liste des états) et détaillée dans
`docs/modules/mascot.md`. Poses en SVG plat dans
`apps/web/src/components/mascot/`.

### Spécificités SQLite

- `journal_mode = WAL`, `busy_timeout = 5000`, `synchronous = NORMAL`,
  `foreign_keys = ON`, réglés une fois à l'ouverture de connexion.
- Les migrations s'exécutent une fois au démarrage, jamais par requête.
- Les transactions d'écriture doivent être courtes. Jamais d'`await` sur
  autre chose qu'un appel base de données à l'intérieur d'une transaction.
- `better-sqlite3` est un module natif : le Dockerfile doit le compiler
  contre la même version de Node que celle qui l'exécute.
- `drizzle-kit` charge le schéma via un `require()` Node sans bundler et ne
  résout donc pas les imports relatifs NodeNext (`.js`) dès qu'un
  `.references()` traverse une frontière de module/package. Contournement :
  omettez `.references()` côté TypeScript, générez la migration, puis
  éditez le SQL généré pour ajouter `REFERENCES` à la main. Laissez un
  commentaire dans le schéma et dans la migration expliquant pourquoi.

### Spécificités worker

- Au démarrage, tout job resté `running` repasse à `pending`. Un redeploy
  Railway en plein job ne doit pas l'orpheliner.
- Les jobs sont idempotents : un job qui s'exécute deux fois ne doit jamais
  dupliquer de lignes.
- Backoff au retry, `attempts` plafonné, `last_error` toujours renseigné en
  cas d'échec.

---

## Fichiers

Chemin racine lu depuis `RAILWAY_VOLUME_MOUNT_PATH` (défini automatiquement
par Railway quand un volume est monté), avec repli sur `./data` en local —
jamais un chemin écrit en dur. Un seul volume, deux sous-dossiers créés au
démarrage s'ils n'existent pas :

```
RAILWAY_VOLUME_MOUNT_PATH/db/studiakids.db
RAILWAY_VOLUME_MOUNT_PATH/photos/{userId}/{courseId}/{pageIndex}.{ext}
RAILWAY_VOLUME_MOUNT_PATH/backups/studiakids-{date ISO}.db
```

Les fichiers uploadés ne sont jamais servis en statique. Toute lecture passe
par une route authentifiée qui vérifie que le cours appartient au compte
demandeur. Chaque page est hachée en SHA-256, unique par cours : la même
photo ne peut pas être ajoutée deux fois au même cours, mais peut
légitimement apparaître dans deux cours différents. **Les photos originales
sont conservées tant que le cours existe** (le lecteur les affiche, le
tuteur peut les citer) et supprimées uniquement en cascade avec le cours —
voir `docs/modules/ingestion.md` et `docs/securite.md`.

---

## Commandes

```bash
pnpm dev            # api + web + worker en mode watch
pnpm test           # unit + intégration + contrat, sans réseau
pnpm test:e2e       # Playwright, LLM_ADAPTER=fixture
pnpm eval           # évaluation LLM sur jeu d'or (coûte de l'argent, manuel)
pnpm fixtures:record <module> <case> [--photo f.jpg] [--force]   # enregistre une vraie réponse modèle (coûte de l'argent, manuel, voir docs/modules/ingestion.md)
pnpm typecheck      # tsc --noEmit sur tout le monorepo
pnpm lint           # eslint + dependency-cruiser
pnpm db:generate    # migration Drizzle depuis les changements de schéma
pnpm accounts:create <username> <firstName> <grade>  # CLI, crée un compte (mot de passe demandé en interactif) ; échoue si le compte existe déjà
pnpm accounts:reset-password <username>  # CLI, change le mot de passe d'un compte existant, invalide ses sessions
pnpm accounts:delete <username>          # CLI, supprime un compte et tout ce qui en dépend en cascade
pnpm tutor:history <username>       # CLI, exporte l'historique du tuteur d'un compte pour l'adulte titulaire (docs/securite.md)
```

Vite ne type-check pas. `pnpm typecheck` est ce qui détecte les erreurs de
type, et il tourne en CI.

---

## Définition de fini

Une tâche est finie quand tout ceci tient :

- [ ] Un test a été écrit en premier et observé en échec
- [ ] `pnpm test` vert
- [ ] `pnpm typecheck` vert
- [ ] `pnpm lint` vert, y compris les contrôles de frontière de module
- [ ] Aucun test existant n'a été modifié ou supprimé
- [ ] Aucune nouvelle dépendance sans justification écrite
- [ ] Les changements visibles par l'enfant ont un scénario Playwright

---

## Travailler avec l'humain

- `packages/core/src/jobs/` et `packages/core/src/shared/` sont frozen :
  demandez avant d'y toucher, dans un sens ou dans l'autre (créer ou
  modifier) — en changer un casse tout autre agent travaillant en parallèle.
- `packages/contracts/` est assoupli par rapport aux deux ci-dessus :
  créez ou modifiez-y un schéma sans demander tant qu'il découle
  directement d'une spec de `docs/modules/`. Demandez uniquement si le
  schéma n'est prévu par aucune spec, ou s'il change la forme d'un contrat
  déjà consommé par un client (web ou worker).
- Demandez avant de changer le schéma de base de données d'un module que
  vous ne possédez pas.
- Si une exigence est ambiguë, demandez. Ne devinez pas et ne construisez
  pas sur une hypothèse silencieuse.
- Rapportez ce que vous n'avez PAS fait aussi clairement que ce que vous
  avez fait.
