# Module `jobs` — noyau partagé, FROZEN

Copié de StudIA (`docs/modules/jobs.md` de StudIA, `docs/inventaire-studia.md`,
§8) à l'ouverture de M2, traduit, avec **une seule divergence validée** :
`ON DELETE CASCADE` sur `jobs.user_id` (voir Persistance). Le code
(`packages/core/src/jobs/`) est la copie de celui de StudIA, aux noms
d'exemples près.

## Responsabilité

Une file de tâches de fond durable, portée par la table `jobs`, et la boucle
du worker qui la draine. N'appartient à aucun module métier ; utilisée par
`ingestion` (job `extract-course`), `exercise-generator` (`split-items`,
`generate-item-exercises`, `game-from-excerpt`) et, via ce dernier, `tutor`.

**Ce module est frozen.** Le modifier, c'est modifier le contrat dont tous
les autres modules dépendent. Proposez le changement à l'humain ; ne
l'éditez pas de vous-même (`CLAUDE.md`, "Travailler avec l'humain").

Vocabulaire : voir `docs/glossaire.md`, section "Tâches de fond".

## Domaine

```ts
type JobStatus = 'pending' | 'running' | 'done' | 'failed';

type Job = {
  id: string;
  userId: string;
  type: string;            // ex. 'extract-course'
  payload: unknown;        // validé par le schéma Zod du handler
  status: JobStatus;
  attempts: number;        // nombre d'échecs enregistrés, jamais incrémenté à la prise
  maxAttempts: number;     // 3 par défaut
  lastError: string | null;
  runAfter: string;        // ISO, porte le backoff
  createdAt: string;
  updatedAt: string;
};
```

**Machine à états.** Les seules transitions légales :

```
pending  -> running
running  -> done
running  -> pending   (retry, attempts < maxAttempts, runAfter repoussé)
running  -> failed    (attempts >= maxAttempts)
running  -> pending   (récupération au démarrage, attempts inchangé)
```

Toute autre transition est un bug. C'est une fonction pure, testée de façon
exhaustive.

**Backoff.** `runAfter = now + 2^attempts * 30s`, plafonné à 15 minutes.
Fonction pure de `(attempts, now)`.

## Ports

```ts
interface JobHandler<T> {
  type: string;
  payloadSchema: ZodSchema<T>;
  handle(payload: T, ctx: JobContext): Promise<Result<void, JobError>>;
}

type JobContext = { jobId: string; userId: string; attempt: number; now: Date };

interface JobQueue {
  enqueue(userId: string, type: string, payload: unknown, now: Date): Promise<string>;
  claimNext(now: Date): Promise<Job | null>;
  complete(jobId: string, now: Date): Promise<void>;
  fail(jobId: string, error: string, now: Date, options?: { terminal?: boolean }): Promise<void>;
  recoverStale(now: Date): Promise<number>;
  listJobs(userId: string, type: string, createdAfter?: string): Promise<Pick<Job, 'id' | 'status' | 'payload' | 'lastError'>[]>;
}
```

**Option `terminal` de `fail()`.** Normalement, `fail()` incrémente
`attempts` et le compare à `maxAttempts` : sous la limite, le job repasse
`running -> pending` avec un `runAfter` repoussé ; à la limite ou au-delà,
`running -> failed`. `terminal: true` saute cette comparaison et passe
directement `running -> failed`, quel que soit `attempts`. Elle n'existe
que pour un seul appelant : le worker qui reçoit un job dont le `type` n'a
aucun handler enregistré. C'est un problème de configuration du worker, pas
un échec transitoire — le retenter ne ferait que répéter le même résultat
après de vrais délais de backoff.

`listJobs` est le côté lecture : les modules propriétaires s'en servent
pour exposer un état dérivé du job, filtré sur leur propre clé de payload
(ex. `ingestion` lit le dernier `extract-course` d'un cours pour dériver
`failed`, `docs/modules/ingestion.md`). Lecture seule, trié du plus récent
au plus ancien, jamais un substitut à l'état qu'un module stocke lui-même.

Les handlers s'enregistrent au démarrage du worker. Un job dont le `type`
n'a aucun handler échoue immédiatement avec une erreur claire, plutôt que
de boucler.

## Cas d'usage

- `enqueueJob` — écrit une ligne `pending`. Aucun appelant n'écrit
  directement dans la table.
- `runWorkerLoop` — sonde, prend, distribue, enregistre le résultat.
  Intervalle 1 s, ralenti à 5 s quand la file est vide.
- `recoverStaleJobs` — **exécuté une fois au démarrage du worker**, repasse
  toute ligne `running` en `pending`. Un redeploy Railway en plein job
  l'orphelinerait sinon.

## Persistance

```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','running','done','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  run_after TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_jobs_claim ON jobs(status, run_after);
CREATE INDEX idx_jobs_user ON jobs(user_id, type, created_at DESC);
```

**Divergence avec StudIA, validée** : `ON DELETE CASCADE` sur `user_id`.
Sans elle, `pnpm accounts:delete` échouerait sur la contrainte de clé
étrangère dès qu'un job existe pour le compte (`docs/securite.md`,
"Suppression et droit à l'oubli").

`REFERENCES` et l'ordre `DESC` de `idx_jobs_user` sont ajoutés à la main
dans la migration générée : `jobs/` ne peut importer aucun module métier
(règle `frozen-kernels` de `dependency-cruiser`), pas même le schéma
d'`auth`, et cette version de drizzle-orm n'exprime pas le sens d'une
colonne d'index sur SQLite (`CLAUDE.md`, "Spécificités SQLite").

`claimNext` est une seule transaction : choisir la plus ancienne ligne
`pending` éligible et la passer en `running`. SQLite sérialise les
écritures, c'est donc sûr sans verrou supplémentaire, mais la prise ne doit
attendre rien d'autre que l'appel à la base.

## API

Aucune. Le statut d'un job est exposé par le module propriétaire
(`GET /api/courses/:id` renvoie le statut d'extraction), jamais par une
route générique sur les jobs.

## Hors périmètre

Tâches planifiées et cron. Priorités. Fan-out et dépendances entre jobs. À
n'ajouter que lorsqu'un jalon l'exige.

## Tests clés

- Chaque transition légale, et le rejet de chaque transition illégale
- Le calendrier de backoff est exact pour `attempts` de 0 à 5
- `recoverStale` repasse les lignes `running` et laisse `done` et `failed`
  intactes
- **Tuer le worker en plein handler, le redémarrer : le job tourne à
  nouveau et exactement un jeu de lignes existe.** C'est la raison pour
  laquelle les handlers doivent être idempotents.
- Un job de type non enregistré appelle `fail()` avec `{ terminal: true }`
  exactement une fois, et passe directement à `failed` quel que soit
  `attempts`
- Supprimer un compte supprime ses jobs, et seulement les siens (la
  divergence ci-dessus)

## Questions ouvertes

Aucune. Demandez avant de changer quoi que ce soit ici.
