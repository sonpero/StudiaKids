# Module `auth`

## Responsabilité

Qui se connecte. **Un compte égale un enfant** : identifiant/mot de passe,
créé en CLI, jamais par auto-inscription, portant directement le prénom et
le niveau (CP à 6e) de l'enfant. Pas de notion de profil séparée du
compte : un second enfant dans le même foyer a un second compte, créé par
le même script CLI. Toute la donnée applicative (cours, tentatives,
étoiles, conversations) est scopée par `userId` — règle n°1 de `CLAUDE.md`.

**Décision actée, révision de la version précédente de ce document** : une
première version de cette spec introduisait un niveau `Profil` séparé du
`Compte`, pour permettre plusieurs enfants sous un même compte. Ce n'est
plus le modèle retenu — un compte est un enfant, point.

Adapté de `docs/modules/identity.md` de StudIA : le mécanisme (hash,
session versionnée, rate limiting, default-deny) est repris à l'identique.
La différence porte sur la durée de vie de la session (voir ci-dessous) et
sur le fait que `Account` porte directement `firstName`/`grade`, absents de
StudIA.

Vocabulaire : voir `docs/glossaire.md` pour la correspondance complète
entre les termes de cette spec (compte, prénom, niveau...) et les
identifiants anglais du code ci-dessous.

## Domaine

```ts
type Grade = "CP" | "CE1" | "CE2" | "CM1" | "CM2" | "6e";
// Codes du système scolaire français, non traduits — exception assumée à
// la convention "code en anglais", voir docs/glossaire.md.

type Account = {
  id: string;
  username: string;
  firstName: string;    // 1 à 30 caractères
  grade: Grade;
  createdAt: string;
};

type SessionPayload = { userId: string; sessionVersion: number };

type LoginError =
  | { kind: "invalid-credentials" }
  | { kind: "rate-limited"; retryAfterSeconds: number };

type CreateAccountError = { kind: "username-taken" };
type ResetPasswordError = { kind: "unknown-account" };
```

**`sessionVersion`**, repris tel quel de StudIA : stocké sur la ligne
compte, embarqué dans le cookie. Un reset de mot de passe (CLI) l'incrémente,
ce qui invalide toutes les sessions existantes de ce compte — le seul moyen
de révoquer un token sans état côté serveur.

### Session longue durée, glissante

**L'enfant se connecte lui-même, sans reconnexion à chaque ouverture.**
Contrairement à StudIA (TTL fixe de 30 jours), la session ici est
**glissante** : chaque appel authentifié réussi prolonge son expiration de
`SESSION_DURATION_DAYS` (365 jours par défaut — décision de départ, simple,
révisable après les premiers usages réels : l'enjeu est qu'un enfant actif
au moins une fois de temps en temps ne voie jamais sa session expirer en
pratique). Concrètement, `resolveSession` ré-émet un cookie avec une
nouvelle date d'expiration à chaque requête, pas seulement à la connexion.

**Pourquoi glissant et pas seulement long** : un TTL fixe, même très long,
finit par expirer un jour où l'enfant ouvre l'app seul, sans personne pour
retaper un mot de passe qu'il ne connaît pas forcément par cœur. Une
session glissante ne coupe jamais tant que l'app est ouverte de temps en
temps — ce qui reporte le seul vrai moyen de mettre fin à une session sur
`sessionVersion` (reset du mot de passe en CLI), jamais sur l'expiration
naturelle.

## Ports

```ts
interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

interface SessionCodec {
  sign(payload: SessionPayload, now: Date): string;
  read(token: string, now: Date): SessionPayload | null;   // null si signature invalide ou expirée
}

interface AccountRepository {
  findByUsername(username: string): Promise<(Account & { passwordHash: string; sessionVersion: number }) | null>;
  findById(id: string): Promise<(Account & { sessionVersion: number }) | null>;
  // L'id est généré en application/ (règle CLAUDE.md : IDs générés en couche
  // application, jamais par la base ni décidés dans infra/) et toujours
  // fourni ici — insertAccount n'écrit jamais par-dessus une ligne existante.
  insertAccount(id: string, username: string, hash: string, firstName: string, grade: Grade, now: Date): Promise<void>;
  // Incrémente sessionVersion, invalidant toute session existante du compte.
  updatePasswordHash(username: string, hash: string, now: Date): Promise<void>;
  deleteAccount(id: string): Promise<void>;
}
```

argon2id dans l'adaptateur.

## Cas d'usage

- `authenticate(username, password, ip, now)` → `Result<{ token }, LoginError>`
- `resolveSession(token, now)` → `Result<{ account: Account; token: string }, "unauthenticated">`
  — rejette si le `sessionVersion` du token diffère de celui stocké ; sur
  succès, le `token` renvoyé est ré-émis avec une expiration glissée (voir
  ci-dessus), à réécrire dans le cookie par l'appelant
- `createAccount(username, password, firstName, grade, now)` →
  `Result<{ id: string }, CreateAccountError>` — CLI uniquement, jamais
  atteignable en HTTP ; génère l'id en application/ ; échoue sans rien
  écrire si le compte existe déjà
- `resetPassword(username, password, now)` → `Result<void, ResetPasswordError>`
  — CLI uniquement ; incrémente `sessionVersion`, invalidant toutes les
  sessions existantes du compte ; échoue si le compte n'existe pas
- `deleteAccount(userId)` — CLI uniquement, supprime en cascade tout
  ce qui dépend du compte (cours, items, exercices, tentatives,
  conversations — voir `docs/securite.md`, "Suppression et droit à
  l'oubli"), y compris les fichiers sur le volume, jamais seulement les
  lignes en base. Le module `auth` ne connaît que la ligne `accounts` : la
  cascade sur les tables des autres modules (aucune n'existe encore à M1)
  sera branchée par chacun d'eux quand elle apparaîtra.

**Rate limiting**, repris tel quel de StudIA : fonction pure sur un journal
de tentatives.

```ts
function isRateLimited(attempts: Date[], now: Date): boolean;   // 5 en 15 minutes
```

État en mémoire dans `infra/`, clé par IP, reset au redémarrage.

**La vérification doit être à temps constant dans le cas d'un identifiant
inconnu** : comparer quand même contre un hash factice. Sinon le temps de
réponse révèle quels identifiants existent.

## Persistance

```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  session_version INTEGER NOT NULL DEFAULT 1,
  first_name TEXT NOT NULL,
  grade TEXT NOT NULL CHECK (grade IN ('CP','CE1','CE2','CM1','CM2','6e')),
  created_at TEXT NOT NULL
);
```

Aucune table `profiles`.

## API

| Route | Corps | Succès | Échec |
|---|---|---|---|
| `POST /api/auth/login` | `{ username, password }` | `204` + `Set-Cookie` | `401`, `429` |
| `POST /api/auth/logout` | — | `204` + cookie effacé | — |
| `GET /api/me` | — | `200 { id, firstName, grade }` | `401` |

Cookie : `httpOnly`, `sameSite=lax`, `path=/`, `secure` piloté par
`COOKIE_SECURE` pour que le développement local en http fonctionne. Échec
bruyant au démarrage si `SESSION_SECRET` est absent.

**Default deny.** Le décorateur Fastify `requireAuth` s'applique
globalement ; les routes ci-dessus l'enlèvent explicitement, plus
`/api/health`. Un test garantit qu'ajouter une route sans l'exempter
échoue. Aucun second décorateur de portée n'est nécessaire : un compte
authentifié EST le scope complet, il n'y a plus de sélection de profil à
faire par-dessus.

Vérification de l'en-tête `Origin` sur toute requête mutante, en plus de
`sameSite=lax`.

## Hors périmètre

Inscription publique. Réinitialisation de mot de passe par l'utilisateur
(seul l'adulte titulaire, via la CLI, peut réinitialiser). OAuth. Email.
Tout rôle "parent" avec vue de supervision depuis l'application — voir
`docs/securite.md` pour comment l'historique du tuteur reste consultable
sans un tel rôle. Édition du prénom ou du niveau depuis l'application (CLI
uniquement). Toute notion de profil multiple sous un même compte.

## Tests clés

- Hash et vérification, aller-retour ; rejet d'un mauvais mot de passe
- Signature et lecture du token ; token expiré ou trafiqué renvoie `null`
- Rate limit : 5 échecs bloquent, la fenêtre de 15 minutes glisse, un succès la vide
- `createAccount` échoue avec `username-taken` sans rien écrire si le
  compte existe déjà
- `resetPassword` invalide une session existante via `sessionVersion` ;
  échoue avec `unknown-account` si le compte n'existe pas
- Identifiant inconnu et mauvais mot de passe prennent un temps comparable
- **Une session valide, réutilisée régulièrement, ne présente jamais
  d'expiration** : un test avance une horloge injectée de plusieurs mois
  par petits pas, avec un appel authentifié entre chaque pas, et vérifie
  que la session reste valide tout du long
- **Une session non réutilisée pendant plus de `SESSION_DURATION_DAYS`
  finit par expirer** : le même test, sans appel intermédiaire, doit
  échouer après le délai
- Intégration : connexion pose le cookie, `/api/me` renvoie le compte,
  déconnexion efface tout
- Playwright : cycle complet connexion → accueil → déconnexion ; une route
  protégée redirige vers la connexion si déconnecté ; la session survit à
  la fermeture de l'onglet et à un rechargement de la page

## Questions ouvertes

- Tutoiement ou vouvoiement sur l'écran de connexion ? Le reste de l'app
  tutoie systématiquement l'enfant ; l'écran de connexion, en pratique
  souvent utilisé une seule fois avec l'aide d'un adulte au moment de la
  configuration initiale, pourrait rester neutre.
- `SESSION_DURATION_DAYS = 365` est une valeur de départ simple, à ajuster
  si l'usage réel montre qu'elle est trop courte (un enfant qui n'ouvre
  l'app que pendant les vacances scolaires, par exemple) ou inutilement
  longue.
