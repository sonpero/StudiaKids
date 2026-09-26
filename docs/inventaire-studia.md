# Inventaire du dépôt StudIA

Lu à `../StudIA` (commit courant : `CLAUDE.md` daté du 13/09, milestone M10 en
cours). StudIA est une app de révision spacée (flashcards/QCM/FSRS) pour un
public adulte/ado autonome. StudiaKids vise un enfant de CP à la 6e qui ne
sait pas forcément lire de longues consignes, ne gère pas d'échéances, et n'a
pas de notion de "répétition espacée" — le produit est différent, mais
l'infrastructure technique de StudIA est directement pertinente : même stack,
même déploiement, mêmes patterns d'extraction par modèle vision et
d'appels LLM structurés.

Chaque brique ci-dessous est classée **recopiable tel quel**, **à adapter**,
ou **à écarter**.

---

## 1. Stack exacte

| Couche | Choix StudIA | Verdict |
|---|---|---|
| Runtime | Node 22 (`.node-version` = `22`, `engines.node: ">=22 <23"`) | **recopiable** |
| Gestionnaire de paquets | pnpm 9.15.9, monorepo `pnpm-workspace.yaml` | **recopiable** |
| API | Fastify 5 + TypeScript strict, `fastify-type-provider-zod` 4 | **recopiable** |
| Front | React 19 + Vite 6 + Tailwind 4 (`@tailwindcss/vite`) + shadcn/ui + TanStack Query 5 | **recopiable** |
| DB | SQLite via `better-sqlite3` 11 + Drizzle ORM 0.38, FTS5 | **recopiable** |
| Auth | argon2 (`argon2` npm) + cookie de session signé, comptes créés en CLI | **recopiable tel quel** (le mécanisme ; le modèle de données change, voir §4) |
| Fichiers | Volume Railway monté sur `DATA_DIR` | **à adapter** (chemin lu depuis `RAILWAY_VOLUME_MOUNT_PATH`, sous-dossiers `db/`/`photos/`, voir §5) |
| Jobs | Table `jobs` + worker Node qui poll (pas de Redis/BullMQ) | **recopiable** |
| LLM | Vercel AI SDK (`ai` 4.x) + `@ai-sdk/anthropic`, `generateObject`/`streamText`, modèle par défaut `claude-sonnet-4-5` | **recopiable** |
| Extraction | `officeparser` (pdf/docx/pptx) + modèle vision pour les photos | **à adapter** — StudiaKids n'a besoin que du chemin "photo" (l'enfant ne dépose pas de PDF), le reste d'officeparser est à écarter |
| Répétition espacée | `ts-fsrs` | **à écarter** — voir §4, pas de FSRS dans StudiaKids |
| Tests | Vitest (unit/integration/contract) + Playwright (e2e) | **recopiable** |
| Déploiement | Un seul service Railway, Dockerfile multi-stage, `railway.toml` | **recopiable tel quel** |

Aucune proposition de changement de framework : le nouveau projet reprend
Fastify + React + Vite + Tailwind + SQLite/Drizzle + Vercel AI SDK + Railway
à l'identique, comme demandé.

Pas de PWA (pas de manifest, pas de service worker) ni de wrapper natif
(Capacitor/Expo) dans StudIA : "web, mobile et tablette" y est obtenu par une
web app responsive classique, servie sur une seule origine, avec capture
photo via `<input type="file" accept="image/*" capture>` dans le navigateur
mobile (voir `e2e/todo-photo.spec.ts`). **À adapter/confirmer** : c'est le
point ouvert n°1 en fin de document.

---

## 2. Arborescence et conventions de code

```
apps/
  api/          Fastify, sert /api/* et le SPA buildé
  web/          SPA React (Vite)
  worker/       même image Docker, autre point d'entrée, draine la table jobs
packages/
  contracts/    schémas Zod partagés api/web/worker (frozen)
  core/         logique métier, un dossier par module
```

Chaque module de `packages/core/src/<module>/` a trois couches strictement
séparées et vérifiées par `dependency-cruiser` en CI :

```
domain/        fonctions pures, aucun I/O, aucun import d'infra/ ou application/
application/   cas d'usage, orchestrent domain + ports
infra/         adaptateurs (SQLite, LLM, filesystem) — seule couche qui throw
index.ts       unique surface publique importable par un autre module
```

Règles transversales, toutes **recopiables tel quel** :

- `Result<T, E>` partout en domain/application, jamais d'exception hors `infra/`.
- Horloge injectée : `now: Date` explicite, jamais `new Date()` dans `domain/`.
- IDs UUID v7, générés en `application/` via un port `IdGenerator`, jamais par SQLite.
- **Chaque méthode de repository prend un `userId` et filtre dessus** — une méthode sans `userId` est un bug.
- Dates en ISO 8601 UTC en base ; conversion locale seulement côté web.
- Imports inter-modules uniquement via `index.ts` (`dependency-cruiser`, règle `no-deep-module-import`).
- `packages/contracts/`, `packages/core/src/jobs/` et `packages/core/src/shared/` sont **frozen** : à ne modifier qu'après validation explicite.
- TypeScript `strict: true`, pas de `any`, pas de `@ts-ignore`, exports nommés uniquement, pas d'export par défaut.
- Commentaires et messages de commit en anglais ; copie UI en français.
- LLM : un schéma Zod par forme de sortie, un appel par forme (jamais d'union discriminée dans un seul appel) ; contraintes dans `.describe()` (jamais `.min()`/`.max()`, non transmis au modèle par `generateObject`) ; `.refine()` porte les invariants métier ; en cas d'échec de validation, un seul retry avec l'erreur renvoyée au modèle, puis échec du job.
- Jamais d'appel LLM à l'intérieur d'une transaction SQLite (lecture → fermeture de la transaction → appel modèle → courte transaction d'écriture).
- SQLite : `journal_mode=WAL`, `busy_timeout=5000`, `synchronous=NORMAL`, `foreign_keys=ON` réglés une fois à l'ouverture ; migrations exécutées au démarrage, jamais par requête.

Un piège documenté et **à recopier tel quel** : `drizzle-kit` (chargement du
schéma par `require()` sans bundler) ne résout pas les imports relatifs
`.js` NodeNext dès qu'un `.references()` traverse une frontière de module/
package. Solution actuelle : omettre `.references()` côté TypeScript,
générer la migration, puis éditer le SQL généré pour ajouter `REFERENCES`
à la main, avec un commentaire dans les deux fichiers. Ce problème réapparaîtra
dans StudiaKids dès la première clé étrangère inter-module (ex. `exercises`
référençant `courses`).

**À écarter** : rien dans cette section — l'arborescence et les règles de
frontières sont indépendantes du produit et s'appliquent telles quelles.

---

## 3. Conventions de test

Directement **recopiables tel quel** (`docs/TESTING.md` de StudIA) :

- TDD strict : test qui échoue d'abord, jamais de test modifié ou supprimé pour faire passer un build.
- Suffixes de fichiers et ce qu'ils couvrent :

  | Suffixe | Couche | Dans `pnpm test` |
  |---|---|---|
  | `.unit.test.ts` | pur, sans I/O | oui |
  | `.int.test.ts` | vraie SQLite (fichier, jamais `:memory:`), vrai Fastify (`app.inject()`) | oui |
  | `.contract.test.ts` | réponses modèle enregistrées (fixtures) | oui |
  | `.spec.ts` | Playwright | non, `pnpm test:e2e` |
  | `.eval.test.ts` | jeu d'or, vrais appels API, coûte de l'argent | non, `pnpm eval` (manuel) |

- `tests/support/no-network.ts` remplace `fetch` global par une fonction qui
  throw pendant `pnpm test` : un adaptateur mal câblé qui appellerait le vrai
  modèle échoue bruyamment plutôt que de passer silencieusement puis coûter
  cher.
- Fixtures LLM : enregistrer la réponse **brute** (jamais l'objet déjà
  parsé), sous `tests/fixtures/<module>/<case>.json`, via
  `pnpm fixtures:record <module> <case>` (manuel, coûte de l'argent). Deux
  niveaux nécessaires : adaptateur-fixture (rapide, teste l'orchestration) et
  transport (MSW intercepte le HTTP, teste vraiment `generateObject` — schéma
  JSON, parsing, retry).
- Chaque route API testée au minimum sur : cas nominal, 401 non authentifié,
  **403 autre utilisateur** (deux comptes, le deuxième ne doit rien voir du
  premier), 400 validation invalide.
- Builders (`tests/support/builders.ts`) plutôt que des littéraux répétés :
  chaque builder retourne un objet valide par défaut, un test ne fixe que les
  champs qui l'intéressent.
- Quatre états UI obligatoires testés en Playwright par écran : chargement,
  vide, erreur, prêt.
- Mutation testing **seulement** sur : fonctions pures de domain critiques,
  migrations et tout ce qui touche l'état persisté, règles
  `dependency-cruiser`, invariants inter-modules. Pas ailleurs (composants
  React, routes avec couverture d'intégration suffisante, adaptateurs sans
  logique propre).
- CI (`\.github/workflows/ci.yml`) : `pnpm install --frozen-lockfile`, puis
  `typecheck`, `lint`, `test`. **Ne lance pas Playwright** — l'e2e reste
  manuel dans StudIA. Point ouvert n°2 en fin de document : StudiaKids doit
  décider si l'e2e entre en CI.
- `playwright.config.ts` : un seul worker (`workers: 1`) car les jobs
  d'extraction/génération passent par une queue SQLite à un seul processus
  worker ; build de production réel servi par l'API (pas le serveur de dev
  Vite) ; deux `webServer` (api+worker) avec `LLM_ADAPTER=fixture` ;
  authentification via `storageState` sauvegardé en `globalSetup`, sauf le
  test de login qui repart d'un état vierge. **Recopiable tel quel.**

**À écarter** : les scénarios eval spécifiques au contenu StudIA (le
mécanisme `pnpm eval` / golden set est à recopier, son contenu — photosynthèse,
révolution française, etc. — est propre à StudIA et sera remplacé par des
cours CP à 6e).

---

## 4. Schéma d'authentification

Module `identity` (`docs/modules/identity.md`) — **recopiable presque tel
quel** dans son mécanisme, avec une seule adaptation retenue : la durée de
session (voir plus bas). Le modèle de données `User`, lui, est repris
**sans changement structurel** — décidé : un compte StudiaKids égale un
enfant, exactement comme un `User` de StudIA égale une personne
(`docs/modules/auth.md`).

Mécanisme (recopiable) :
- Pas d'inscription publique, pas de reset de mot de passe self-service, pas
  de rôles. `pnpm users:create <username>` (CLI, jamais exposé en HTTP) hash
  le mot de passe avec argon2id et écrit/reset la ligne utilisateur.
- `sessionVersion` stocké sur la ligne utilisateur et embarqué dans le
  cookie signé : l'incrémenter invalide toutes les sessions existantes,
  seul moyen de révoquer un token sans état côté serveur.
- Rate limiting en mémoire (5 échecs / 15 min, par IP), acceptable pour un
  petit nombre de comptes, reset au redémarrage — assumé en commentaire
  plutôt que d'ajouter Redis.
- Vérification à temps constant même si le nom d'utilisateur n'existe pas
  (hash contre un hash factice) pour ne pas révéler par le timing quels
  identifiants existent.
- Cookie `httpOnly`, `sameSite=lax`, `secure` piloté par `COOKIE_SECURE`,
  TTL 30 jours. Démarrage en échec bruyant si `SESSION_SECRET` absent.
- **Default deny** : le décorateur Fastify `requireAuth` s'applique
  globalement, les routes publiques (`/api/auth/login`, `/api/auth/logout`,
  `/api/me`... et `/api/health`) l'enlèvent explicitement. Un test garantit
  qu'ajouter une route sans l'exempter échoue.
- Vérification d'`Origin` sur toute requête mutante en plus de `sameSite=lax`.

Décidé, tranchant le point ouvert que cette section soulevait initialement :
- **Un compte StudiaKids égale un enfant**, pas un foyer. `User` gagne
  `firstName` et `grade` directement (StudIA n'a ni l'un ni l'autre), mais
  reste par ailleurs le même objet qu'un `User` StudIA — pas de second
  niveau `Profile`. Un second enfant du même foyer a un second compte, créé
  par le même script CLI.
- Toute la donnée applicative (cours, tentatives, étoiles, conversations)
  est scopée par `userId`, exactement comme dans StudIA — colonne pour
  colonne, aucune colonne `profileId` supplémentaire nécessaire.
- **Seule vraie adaptation retenue : la durée de session.** StudIA utilise
  un TTL fixe de 30 jours ; StudiaKids a besoin d'une session glissante et
  longue (l'enfant se connecte lui-même, sans reconnexion à chaque
  ouverture, et sans mécanisme de reset self-service à activer en cas
  d'expiration) — voir `docs/modules/auth.md`.
- `sessionVersion`/rate limiting/cookie : recopiables sans changement au-delà
  de ce point.

**À écarter** : rien — juste le typage `User` à étendre.

---

## 5. Config de déploiement Railway

**Recopiable tel quel**, dossier pour dossier :

- `railway.toml` :
  ```toml
  [build]
  builder = "DOCKERFILE"
  dockerfilePath = "Dockerfile"
  [deploy]
  healthcheckPath = "/api/health"
  healthcheckTimeout = 100
  restartPolicyType = "ON_FAILURE"
  restartPolicyMaxRetries = 3
  ```
- `Dockerfile` multi-stage : image de base `node:22-bookworm-slim`, pnpm
  activé via corepack, toolchain de build natif (`python3 make g++`) pour
  `better-sqlite3` dans le stage `deps` uniquement, build du SPA dans le
  stage `build`, image `runtime` minimale qui lance
  `node scripts/docker-start.mjs`. **Un seul service Railway, un seul
  conteneur, un seul PID 1** : ce script démarre API et worker ensemble et
  relaie `SIGTERM` aux deux pour un arrêt propre au redeploy plutôt que
  d'orpheliner le worker.
- Toutes les images (base/deps/build/runtime) pinnent la **même** version de
  Node : `better-sqlite3` est un module natif compilé contre cette version
  précise.
- Fichiers applicatifs sur le volume Railway :
  ```
  DATA_DIR/studia.db
  DATA_DIR/uploads/{userId}/{documentId}/{pageIndex}.{ext}
  DATA_DIR/backups/studia-{ISO date}.db
  ```
  Les fichiers uploadés **ne sont jamais servis en statique** : toute lecture
  passe par une route authentifiée qui vérifie la propriété du document
  d'abord, avec `Content-Disposition: inline` et un `Content-Type` explicite
  (jamais le MIME uploadé recopié tel quel).
- Le worker, au démarrage, repasse tout job `running` orphelin en `pending`
  (`recoverStaleJobs`) : un redeploy Railway en plein job ne doit pas le
  perdre.

**À adapter** :
- Les chemins `uploads/{userId}/{documentId}/...` deviennent
  `photos/{userId}/{courseId}/...` — renommé (uploads → photos) et
  document → cours ; `userId` reste `userId` puisqu'un compte égale un
  enfant (voir §4). **Contrairement à StudIA**, les fichiers ne sont pas
  nettoyés une fois l'extraction faite : ils restent tant que le cours
  existe, parce que le lecteur les affiche et le tuteur peut les citer
  (`docs/securite.md`).
- **Chemin racine lu depuis `RAILWAY_VOLUME_MOUNT_PATH`** (positionné
  automatiquement par Railway quand un volume est monté), repli sur
  `./data` en local — décidé, StudiaKids n'utilise pas la variable
  `DATA_DIR` propre à StudIA (qu'il aurait fallu positionner à la main dans
  la config Railway). Deux sous-dossiers, `db/` et `photos/`, créés au
  démarrage s'ils n'existent pas (`docs/donnees.md`, `docs/jalons.md` M0).

**À écarter** : rien.

---

## 6. Prompts d'extraction de cours

Module `ingestion`, adaptateur `VisionExtractor`
(`packages/core/src/ingestion/infra/vision-extractor.ts`) — **recopiable
presque tel quel**, avec le point d'attention "photo inexploitable" déjà
demandé par le brief.

```ts
const visionOutputSchema = z.object({
  markdown: z.string().describe("The page's text transcribed as Markdown, preserving heading hierarchy (# / ##)."),
  legible: z.boolean().describe("False if the photo is too blurry, dark, or cropped to read reliably."),
  reason: z.string().optional().describe("When legible is false, a short reason to show the student, e.g. 'trop flou'."),
});

const PROMPT =
  "Transcris le texte de cette photo de page de cours en Markdown, en conservant la hiérarchie des titres. " +
  "Si la photo est trop floue, trop sombre ou coupée pour être lue de façon fiable, indique legible=false et donne une raison brève.";
```

Points clés, **recopiables tel quel** :
- `legible: false` n'est **pas** une erreur technique, c'est un résultat
  métier normal du schéma — exactement le mécanisme que le brief demande
  sous le nom "détection de photo inexploitable avant génération". Il
  suffit de brancher ce champ sur un message porté par la mascotte au lieu
  du message neutre actuel de StudIA.
- Un seul retry, avec l'erreur de validation renvoyée au modèle dans le
  prompt, puis échec du job (`fail()` du module `jobs`).
- L'extraction doit préserver la hiérarchie de titres (Markdown `#`/`##`) —
  c'est le signal que le découpage en notions utilise ensuite. Un extracteur
  qui renvoie du texte plat a échoué même s'il a renvoyé du texte.
- Photo multi-pages : plusieurs photos d'un même cours = un seul document
  logique avec plusieurs pages ordonnées, concaténées en un seul Markdown —
  **directement pertinent** puisqu'un enfant peut photographier plusieurs
  pages d'une leçon.

**À adapter** :
- Le prompt doit ajouter une contrainte de niveau scolaire si on veut que le
  modèle simplifie ou adapte son vocabulaire de transcription (probablement
  inutile : la transcription doit rester fidèle au texte du cours, donc
  **à ne pas adapter** en fait — laisser tel quel).
- Le seuil "moins de 8 items générés → on redemande une photo" (décision du
  brief) n'existe pas dans StudIA : c'est un contrôle de couverture à
  ajouter dans le module de génération d'exercices (voir
  `docs/modules/exercise-generator.md`), pas dans l'extraction elle-même.
- StudIA n'a pas de notion de "matière/niveau en trois mots" saisie par
  l'utilisateur après extraction : c'est un nouvel écran de validation à
  construire (voir `docs/ui.md`), mais le schéma de sortie vision peut être
  étendu avec des champs `subjectGuess`/`levelGuess` optionnels pour
  pré-remplir les trois mots plutôt que de les laisser vides.

**À écarter** : `OfficeParserExtractor` (pdf/docx/pptx) — StudiaKids n'a
qu'un seul type de source (photo prise par l'enfant), donc `SourceType`
peut être réduit à `'photo'` uniquement, ce qui simplifie aussi
`docs/modules/ingestion.md` par rapport à celui de StudIA.

Découpage en notions, module `content`
(`packages/core/src/content/infra/claude-notion-splitter.ts` et
`docs/modules/content.md`) — **à adapter fortement** : StudIA découpe en
"notions" génériques (5 à 60 par cours, un `Difficulty` `easy/medium/hard`).
StudiaKids a besoin, en plus, que **le modèle annote chaque notion avec les
types de jeu qui s'y appliquent** (QCM, appariement, etc. — décision déjà
prise du brief), ce qui n'existe pas dans StudIA. Le mécanisme de chunking
par titres de premier niveau, l'idempotence du job (suppression puis
réinsertion), et les bornes de validation (`.refine()` sur un tableau plat)
restent recopiables tel quel ; le schéma de sortie doit gagner un champ
`gameTypes: GameType[]` par notion.

---

## 7. Prompts du tuteur

Module `tutor` (`docs/modules/tutor.md`,
`packages/core/src/tutor/infra/claude-chat-model.ts` et
`claude-citation-extractor.ts`) — **architecture recopiable tel quel**,
**prompt et garde-fous à adapter** pour un public mineur.

Architecture (recopiable) :
- **Pas d'index de recherche** : un cours de quelques dizaines de pages
  tient entier dans le contexte du modèle. La réponse est générée à partir
  du Markdown complet du cours, jamais d'un extrait choisi par une étape de
  recherche qui pourrait mal classer un passage.
- Découpage en sections ad hoc (`splitIntoSections`, pure, sur les
  paragraphes du Markdown), jamais persistées, recalculées à chaque appel —
  bon marché et jamais périmées.
- Réponse en streaming (`streamText`, SSE), citations extraites **après
  coup** par un second appel non streamé (`CitationExtractor`) qui renvoie
  les indices de sections utilisées, jamais des marqueurs de citation
  demandés au modèle et reparsés depuis le flux (source connue de bugs).
- `grounded = citations.length > 0` : dérivé du résultat de l'extraction de
  citations, jamais d'un parsing du texte de refus du modèle — un filet de
  sécurité qui fonctionne même si le modèle dérive vers ses connaissances
  générales sans le dire explicitement.
- Un flux interrompu produit une réponse `partial`, jamais une réponse
  `complete` tronquée silencieusement : union discriminée `Answer`, jamais
  un simple flag `partial: boolean` à côté des mêmes champs.

Prompt système actuel de StudIA :
```ts
"Tu es le tuteur d'un cours, pour un élève. Réponds uniquement à partir des sections du cours ci-dessous. " +
"Si elles ne permettent pas de répondre à la question, dis-le clairement plutôt que d'utiliser tes connaissances " +
"générales : par exemple « Ce cours n'aborde pas ce sujet. » N'invente rien qui ne soit pas dans les sections " +
"fournies. Réponds en français, tutoiement, phrases courtes."
```

**À adapter** :
- Le brief autorise "toute question en rapport avec le cours", plus large
  que "uniquement les sections du cours" — la règle d'ancrage doit devenir
  quelque chose comme "réponds à partir du cours, et tu peux expliquer ou
  reformuler autour du même sujet, mais jamais changer de sujet ni traiter
  une question sans rapport avec le cours" ; le mécanisme de citation reste
  utile mais `grounded` doit être redéfini pour ce périmètre élargi.
- Garde-fous pour public mineur totalement absents de StudIA (pas de
  filtrage de contenu, pas de refus explicite de sujets hors-cadre, pas de
  ton adapté à l'âge) : à spécifier entièrement, voir `docs/securite.md`.
  StudIA n'a aucun mécanisme de modération ou de detection de sujets
  sensibles — rien à recopier ici, tout est à écrire.
- Le retour "grounded: false" de StudIA affiche un message neutre ; pour un
  enfant, ce refus doit être porté par la mascotte avec un ton encourageant,
  jamais un message d'erreur brut.

**À écarter** : le `CitationExtractor`'s eval spécifique
("mentionner le sujet du cours en passant ne veut pas dire y répondre") est
un exemple concret utile à retenir en tant que *méthode* (l'eval a fait
progresser le taux de refus correct de 7/10 à 10/10 après une seule
modification de prompt) mais son contenu golden-set est propre à StudIA.

---

## 8. Autres modules examinés (pour mémoire)

- **`jobs`** (frozen dans StudIA) : queue générique table `jobs` + worker
  qui poll, machine à états `pending→running→done/failed`, backoff
  exponentiel plafonné, idempotence obligatoire des handlers. **Recopiable
  tel quel**, module totalement agnostique du produit.
- **`generation`** (cartes StudIA) : un job par notion (pas un job par
  cours) pour isoler les échecs et permettre une progression `18/30` —
  **pattern à recopier tel quel** pour le générateur d'exercices
  StudiaKids. Diff-avant-écriture à la régénération pour préserver les ids
  (et donc l'historique de progression) — **à recopier tel quel**.
- **`review`** (FSRS, planification StudIA) : **à écarter en tant que
  module** — pas de répétition espacée dans StudiaKids. En revanche, le
  sous-pattern "comparateur de réponse par type, jamais une égalité globale"
  (StudIA : QCM comparé par correspondance exacte d'option en `domain/`,
  jamais par le modèle ; ouvert comparé/noté séparément) est **directement
  le pattern demandé par le brief** et doit être repris dans
  `game-engine.md`.
- **`progress`** (plan de révision vers une échéance) : **à écarter** —
  StudiaKids n'a pas d'échéance/deadline. Collision de nom assumée : le
  module StudiaKids `docs/modules/progress.md` (étoiles et séries) porte
  le même nom que ce module StudIA, sans rapport de contenu — voir
  `docs/glossaire.md`. Le sous-pattern "événements
  stockés en append-only, compteurs dérivés par une fonction pure" (le
  streak de `workspace`, calculé depuis `reviews.reviewed_at` plutôt que
  depuis un compteur mutable) est **à adapter** pour les étoiles : stocker
  chaque tentative comme événement, dériver les compteurs d'étoiles/séries
  à la lecture, jamais de compteur incrémenté directement en écriture.
- **`workspace`** (aujourd'hui, todos, pomodoro, agenda) : **à écarter** —
  aucun de ces concepts n'existe dans le brief (pas d'échéance, pas de
  todo-list, pas de pomodoro). Seul le sous-flux "photo → job d'extraction →
  proposition à confirmer par deux boutons" (todo-photo) est
  **directement le pattern demandé** pour l'écran de validation
  d'extraction de cours (voir §6 et `docs/ui.md`).

---

## Synthèse

| Brique | Verdict |
|---|---|
| Stack (Fastify/React/Vite/Tailwind/SQLite-Drizzle/Vercel AI SDK/Railway) | Recopiable tel quel |
| Arborescence monorepo + frontières domain/application/infra | Recopiable tel quel |
| Conventions de test (suffixes, fixtures, no-network, builders, e2e) | Recopiable tel quel |
| Mécanisme d'auth (argon2, session versionnée, CLI, default-deny) | Recopiable tel quel |
| Modèle de données auth (user unique) | Recopiable tel quel — un compte égale un enfant, `firstName`/`grade` ajoutés directement |
| Déploiement Railway/Docker | Recopiable tel quel |
| Extraction vision (schéma `legible`/`reason`) | Recopiable, prompt à enrichir |
| Extraction officeparser (pdf/docx/pptx) | À écarter |
| Découpage en notions (mécanisme) | À adapter (ajout annotation types de jeu) |
| Génération de cartes (un schéma/type, un job/notion) | Recopiable tel quel, à décliner sur 7 types de jeu |
| FSRS / répétition espacée | À écarter |
| Plan de révision par échéance | À écarter |
| Workspace (todos/pomodoro/agenda) | À écarter |
| Pattern "photo → job → validation à deux boutons" | Recopiable tel quel |
| Tuteur (architecture citations/streaming) | Recopiable tel quel |
| Tuteur (prompt, garde-fous mineur) | À adapter/à écrire entièrement |
| Mascotte (SVG plat, poses fixes, aria-hidden, jamais 1re personne) | Recopiable tel quel, poses à étendre |
| Tokens design (mécanisme `@theme` Tailwind 4) | Recopiable tel quel, palette à remplacer |

## Points ouverts issus de cet inventaire

1. **Décidé** : web responsive comme StudIA, pas de wrapper natif — avec un
   Web App Manifest et des icônes pour un lancement plein écran depuis
   l'écran d'accueil, mais explicitement pas de service worker ni de mode
   hors ligne (`CLAUDE.md`, `docs/ui.md`).
2. StudIA ne lance pas Playwright en CI (manuel uniquement). **Décidé
   (2026-09-26) : StudiaKids le lance en CI**, dans un job `e2e` séparé
   (`.github/workflows/ci.yml`), desktop et mobile émulé sur Chromium,
   sur les fixtures enregistrées (`LLM_ADAPTER=fixture`, aucun appel au
   modèle) ; le rapport d'un run en échec est gardé 7 jours.
3. **Décidé** : un compte CLI égale un enfant unique, aucune notion de
   profil séparée. `userId` suffit à scoper toute la donnée applicative,
   exactement comme `user_id` dans StudIA (`docs/modules/auth.md`).
