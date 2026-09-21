# Module `tutor`

## Responsabilité

Un chat scopé à un cours. L'enfant pose une question, l'app répond à partir
du cours **et de tout ce qui s'y rapporte** — plus large que StudIA, dont le
tuteur refuse tout ce qui n'est pas littéralement dans le texte
(`docs/modules/tutor.md` de StudIA : "réponds uniquement à partir des
sections"). Ici, une question comme "à quoi ça sert la photosynthèse dans
la vraie vie ?" sur un cours de SVT doit obtenir une réponse, pas un refus,
même si la réponse déborde du texte extrait.

Cet élargissement de périmètre a une conséquence directe sur
l'architecture : StudIA décide après coup si une réponse est "ancrée" en
comptant ses citations. Ici, une réponse peut être pertinente et utile sans
aucune citation (une explication, pas une reformulation du texte) — compter
les citations ne peut donc plus servir à distinguer une bonne réponse d'un
refus. À la place, ce module ajoute une **classification préalable, avant
tout appel au modèle de réponse** : la question est-elle en rapport avec le
cours, est-elle sensible, et laisse-t-elle penser que l'enfant est en
détresse (`docs/securite.md`) ? Aucune de ces trois issues ne déclenche
**jamais** l'appel de génération de réponse — la décision est prise avant
qu'aucun texte ne soit produit, jamais filtrée après coup. C'est le
changement le plus important par rapport à StudIA, dicté par la sécurité
d'un public mineur plutôt que par la seule qualité de réponse.

Vocabulaire : voir `docs/glossaire.md` pour la correspondance entre les
termes de prose (détresse, hors-fil, hors-sujet...) et les identifiants
anglais ci-dessous — en particulier `Message.role: "user"`, qui désigne
l'enfant.

## Domaine

```ts
type Section = { index: number; text: string };
// Éphémère, recalculé à chaque appel `ask` depuis le Markdown du cours,
// jamais persisté — mécanisme repris tel quel de StudIA
// (docs/modules/tutor.md, "no retrieval index").

type Citation = { text: string };
// Un extrait, capturé verbatim depuis une Section au moment de la réponse,
// jamais un pointeur vivant vers un index de section.

type RefusalReason = "off_topic" | "sensitive";

type Answer =
  | { kind: "complete"; text: string; citations: Citation[] }
  | { kind: "refusal"; reason: RefusalReason }
  | { kind: "distress" }
  | { kind: "partial"; text: string };
// Quatre issues, jamais un flag à côté des mêmes champs — même
// raisonnement que StudIA pour son union `Answer`. `refusal` et `distress`
// sont deux issues distinctes, pas une sous-catégorie l'une de l'autre :
// `distress` a un rendu fondamentalement différent (voir plus bas, "Rendu
// de l'issue distress"), ce n'est pas un troisième motif de refus parmi
// d'autres. L'absence de citations dans une réponse `complete` n'implique
// plus un refus (voir Responsabilité).

type Conversation = {
  id: string;
  userId: string;
  courseId: string;
  title: string | null;   // null jusqu'à la première question, cf. StudIA
  createdAt: string;
};

type Message = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
  issue: RefusalReason | "distress" | null;   // renseigné seulement pour role='assistant' hors 'complete'
  outOfBand: boolean;   // true uniquement pour issue='distress' : ne s'affiche pas comme une bulle parmi d'autres
  partial: boolean;
  createdAt: string;
};
```

**Découpage en sections et titrage de conversation** : repris tel quel de
StudIA (`splitIntoSections`, `truncateTitle`) — mécanismes purs et déjà
éprouvés, sans rapport avec le changement de périmètre ci-dessus. Voir
`docs/inventaire-studia.md`, §7, pour le détail que cette spec ne
reproduit pas.

## Ports

```ts
interface QuestionClassifier {
  // Appelé AVANT tout autre appel modèle. Un generateObject léger et
  // rapide, jamais un streaming : la décision doit être connue avant
  // qu'un seul mot de réponse ne soit généré.
  classify(input: {
    question: string;
    courseSubject: { title: string; subject: string; grade: Grade };
  }): Promise<Result<{ onTopic: boolean; sensitive: boolean; distress: boolean }, ClassificationError>>;
}

interface ChatModel {
  stream(input: {
    question: string;
    sections: Section[];
    history: { role: "user" | "assistant"; content: string }[];
    grade: Grade;   // pour calibrer le vocabulaire de la réponse
  }): AsyncIterable<string>;
}

interface CitationExtractor {
  extract(input: { answer: string; sections: Section[] }): Promise<Result<{ sectionIndexes: number[] }, ExtractError>>;
}
```

**Les trois booléens sont indépendants, jamais fusionnés en un seul
verdict**, et vérifiés dans cet ordre de priorité par `ask` (voir Cas
d'usage) : `distress` d'abord, puis `sensitive`, puis `!onTopic` — une
question peut en théorie cocher plusieurs cases (une question à la fois
hors sujet et inquiétante doit être traitée comme une détresse, jamais
comme un simple hors-sujet). `docs/securite.md` définit précisément ce que
chacun des trois recouvre.

`CitationExtractor` reste un second appel non streamé après coup, comme
StudIA, mais sert maintenant uniquement à **enrichir l'affichage**
("regarde ici dans ton cours") — son résultat ne conditionne plus si la
réponse est acceptée ou non, cette décision a déjà été prise par
`QuestionClassifier` avant même que `ChatModel` ne soit appelé. Il sert
aussi de source pour "Fais-moi un jeu là-dessus" (voir plus bas) : ces
mêmes citations sont ce qui définit le passage du cours à transmettre au
générateur d'exercices.

## Cas d'usage

- `createConversation(userId, courseId, now)` → `Result<{ conversation: Conversation; showDisclosure: boolean }, CreateConversationError>`
  — vérifie que le cours existe, appartient au compte, et est `confirmed`
  avec des exercices déjà générés n'est **pas** requis (le tuteur peut
  s'ouvrir dès l'extraction terminée, avant toute génération d'exercices).
  Insère avec `title: null`. **Vérifie aussi si c'est la toute première
  conversation jamais créée par ce compte** (voir "Information de l'enfant
  sur la consultation par l'adulte" plus bas) : si oui, marque le flag et
  renvoie `showDisclosure: true` ; sinon `false`.
- `ask(userId, question, conversationId, now)` → `Result<AskSession, AskError>`,
  `AskSession` un générateur asynchrone comme dans StudIA :
  1. Vérifie que la conversation existe et appartient au compte
  2. Charge le cours (`ingestion.getCourse`), refuse si son extraction n'est
     pas `ready`
  3. **Appelle `QuestionClassifier.classify`**, dans cet ordre :
     - `distress: true` → l'issue est `{ kind: 'distress' }`. **Aucun
       autre appel modèle n'a lieu.** Le texte affiché est fixe, non
       généré (`docs/securite.md` en fixe le contenu et le rendu, voir
       aussi "Rendu de l'issue distress" plus bas)
     - sinon, `sensitive: true` → l'issue est `{ kind: 'refusal', reason: 'sensitive' }`,
       aucun autre appel modèle
     - sinon, `onTopic: false` → l'issue est
       `{ kind: 'refusal', reason: 'off_topic' }`, aucun autre appel modèle
     - sinon, continue à l'étape 4
  4. Découpe le cours en sections, appelle `ChatModel.stream`
  5. Un flux interrompu produit `partial`, comme StudIA ; sinon,
     `CitationExtractor.extract` enrichit la réponse de citations
     (peut légitimement être vide sans que ce soit un problème)
  6. Persiste la question et la réponse en une transaction courte, titre la
     conversation à la première question (`truncateTitle`)
- `generateGameFromConversation(userId, conversationId, now)` →
  `Result<{ jobId: string }, GameFromConversationError>` — le chip
  "Fais-moi un jeu là-dessus" (`docs/design/tuteur.png`), **dans le
  périmètre**, voir "Jeu depuis une question" plus bas
- `listConversations`, `getConversation`, `deleteConversation` —
  filtrés par `userId`

### Jeu depuis une question (chip "Fais-moi un jeu là-dessus")

Décidé : ce chip reste dans les maquettes et entre dans le périmètre du
produit, avec les conséquences suivantes, actées explicitement plutôt que
déduites de la maquette seule.

- **L'extrait transmis est le passage du cours sur lequel portait le
  dernier échange, jamais la question de l'enfant.** Concrètement : les
  citations de la dernière réponse `complete` de la conversation,
  concaténées. Ce sont des snapshots déjà persistés
  (`Message.citations`) — aucun recalcul, aucune nouvelle dépendance sur
  l'état courant du cours.
- Si cette dernière réponse n'a **aucune** citation (une explication sans
  passage précis à pointer), `generateGameFromConversation` renvoie une
  erreur `no-excerpt-available` : le chip ne doit alors pas être
  proposé par l'écran (une décision d'écran, pas de domaine), ou s'il l'est
  quand même, ce cas d'usage refuse proprement plutôt que d'inventer un
  extrait.
- `generateGameFromConversation` appelle
  `exerciseGenerator.startGameFromExcerpt(userId, courseId, excerpt, now)`
  (`docs/modules/exercise-generator.md`) — **seule direction de
  dépendance autorisée** : `tutor` importe `exercise-generator` via son
  `index.ts`, jamais l'inverse.
- **Aucun jeu éphémère.** Le résultat rejoint la liste normale des
  exercices du cours, avec les mêmes règles d'étoiles que tout autre
  exercice — aucun traitement particulier dans ce module.
- **Le contrôle de couverture s'applique aussi ici** : si l'extrait ne
  produit pas assez d'items (moins de 8,
  `docs/modules/exercise-generator.md`), l'écran doit le dire par la
  mascotte et proposer de jouer sur le cours entier plutôt que de livrer un
  jeu creux — ce module expose le statut nécessaire
  (`exerciseGenerator.getGameFromExcerptStatus`) pour que l'écran
  distingue ce cas d'un échec technique.
- **Ordonnancement** : cette fonctionnalité dépend de `exercise-generator`
  (M3) et `game-engine` (M4) en plus de `tutor` (M6) lui-même — elle ne
  peut donc pas sortir avant que les trois soient terminés. Voir
  `docs/jalons.md`, M7.

**État d'attente, décidé.** La génération prend plusieurs secondes (au
moins un appel modèle pour le découpage, puis un par type de jeu annoté) :
un chip qui ne rend la main qu'au bout de ce délai sans rien afficher se
lit comme une panne. Dès le clic sur le chip, l'écran affiche la mascotte
en pose `waiting` avec une phrase dédiée au passage cité, pas une phrase
générique de génération ("Je te prépare un jeu sur ce passage…", jamais
un simple spinner). Un nouveau signal `mascot`,
`{ type: "game-from-excerpt-in-progress" }` → `waiting`, distinct de
`generation-in-progress` précisément pour porter cette phrase spécifique
(`docs/modules/mascot.md`). Même règle de progression honnête que
partout ailleurs (`docs/ui.md`) : pas de pourcentage inventé.

**Si l'enfant quitte l'écran tuteur avant la fin**, le job continue en
arrière-plan comme n'importe quel autre job de génération — rien ne
l'annule, et l'écran cesse simplement d'interroger
`GET /api/conversations/:id/game/:jobId`. Aucune notification n'est
envoyée (aucun mécanisme de notification n'existe dans ce produit) :
l'exercice généré apparaît simplement, la prochaine fois que l'enfant
rouvre ce cours, dans la liste normale des jeux et dans le compteur
"{n} jeux prêts" de l'accueil (`docs/modules/ingestion.md`) — exactement
comme s'il avait été généré par le bouton "Créer mes jeux" du lecteur.
Aucun état "jeu en attente depuis le tuteur" à persister au-delà de
l'écran qui a déclenché la demande.

## Information de l'enfant sur la consultation par l'adulte

**Décidé, révision de la version précédente de ce document** — voir
`docs/securite.md`, "Historique du tuteur : consultable, jamais secret" pour
le raisonnement. Spécifie ici le déclenchement, la persistance et le rendu ;
le texte exact du message vit dans `docs/securite.md`.

- **Déclenchement** : `createConversation` renvoie `showDisclosure: true`
  uniquement quand c'est la toute première conversation jamais créée par ce
  compte, tous cours confondus. Une fois affiché, il ne doit **jamais**
  réapparaître pour ce compte — y compris si l'enfant supprime ensuite
  cette conversation (`deleteConversation`) et en recrée une autre : le
  flag persiste indépendamment du cycle de vie des conversations.
- **Message fixe, non généré** — même principe que pour `distress` : ce
  texte n'est jamais produit par `ChatModel`, il est porté directement par
  l'écran (mascotte, pose `idle`).
- **Persistance** : un flag dédié par compte, distinct des tables
  `conversations`/`messages` pour ne pas dépendre de leur suppression (voir
  Persistance ci-dessous).

## Rendu de l'issue `distress`

**Spécifie le déclenchement et le rendu, pas le contenu thérapeutique** —
le texte exact affiché à l'enfant est défini dans `docs/securite.md`, avec
les deux numéros d'aide publics à relayer, pas ici.

- **Déclenchement** : dès que `QuestionClassifier` renvoie
  `distress: true`, avant tout appel à `ChatModel` — jamais un texte
  généré, toujours le même message fixe.
- **Rendu, "hors du fil normal du tuteur"** : contrairement à une réponse
  `complete` ou `refusal`, ce message ne s'affiche **pas** comme une bulle de
  conversation parmi d'autres. L'écran le présente dans un bloc visuel
  distinct (persistant à l'écran, pas noyé dans le défilement des
  messages), sans que l'enfant ait besoin de faire défiler pour le
  retrouver. Le champ `outOfBand: true` sur le `Message` persisté est ce qui
  dit à l'écran de ne pas le rendre comme une bulle.
- **Il reste conservé dans l'historique de la conversation**, au même
  titre que le reste — voir `docs/securite.md`, "Consultable, jamais
  secret" : ce n'est pas un événement caché, seulement un événement rendu
  différemment.

## Persistance

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES accounts(id),
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_conversations_scope ON conversations(user_id, course_id);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  citations_json TEXT,
  issue TEXT CHECK (issue IN ('off_topic','sensitive','distress')),
  out_of_band INTEGER NOT NULL DEFAULT 0,   -- 1 uniquement pour issue='distress' ; deviendra une colonne `kind` si d'autres messages hors fil apparaissent, voir docs/donnees.md
  partial INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);

CREATE TABLE tutor_disclosures (
  user_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  shown_at TEXT NOT NULL
);
```

`tutor_disclosures` est volontairement séparée de `conversations`/`messages` :
une ligne ici signifie "le message a déjà été montré à ce compte", et doit
survivre à la suppression de n'importe quelle conversation (voir
"Information de l'enfant sur la consultation par l'adulte" plus haut).
Seule la suppression du compte lui-même l'efface (`ON DELETE CASCADE`,
droit à l'oubli — `docs/securite.md`).

Aucune politique de rétention distincte selon `issue` : toutes les
conversations sont conservées tant que le cours existe (`docs/securite.md`)
et supprimées en cascade avec lui, y compris les messages `issue='distress'`
— ce ne sont pas des messages à effacer plus tôt, précisément parce qu'ils
doivent rester consultables par l'adulte titulaire du compte.

## API

| Route | Rôle |
|---|---|
| `POST /api/courses/:id/conversations` | Démarre → `{ conversation, showDisclosure }` |
| `GET /api/conversations/:id` | Historique |
| `POST /api/conversations/:id/messages` | Pose une question ; répond en flux SSE |
| `DELETE /api/conversations/:id` | Supprime |
| `POST /api/conversations/:id/game` | Chip "Fais-moi un jeu là-dessus" → `{ jobId }` |
| `GET /api/conversations/:id/game/:jobId` | `{ status: 'in_progress' \| 'ready' \| 'insufficient_coverage' \| 'failed', itemIds?: string[] }` |

Streaming SSE : une réponse `complete` chunke le texte puis un événement
terminal `done` (porte `citations`) ; une réponse `refusal` ou `distress` ne
chunke rien, émet directement un événement terminal du même nom (`refusal`
porte `reason`, `distress` ne porte rien de plus que le fait qu'elle a eu
lieu) — jamais de texte streamé mot à mot pour ces deux cas, la décision
est connue avant tout streaming ; une interruption émet `partial`, comme
StudIA. Quatre noms d'événement distincts, jamais un champ optionnel sur un
seul événement, même raisonnement que StudIA pour son union `Answer`.

## Rendu de la mascotte à côté des réponses — arbitré

`docs/design/tuteur.png` montre le médaillon de la mascotte (`size:
"avatar"`, `docs/ui.md`) accolé à chaque réponse du tuteur. **Décidé :
l'écran l'affiche.** Le principe "la mascotte n'est jamais une persona
conversationnelle" porte sur ce que le **texte généré** énonce
(`docs/securite.md`, "Contraintes sur le texte généré" — pas de sentiment,
pas de mémoire affective, pas de secret, etc.), pas sur sa représentation
visuelle : un médaillon reconnaissable à côté de chaque réponse est une
question de branding, sans incidence sur la sécurité tant que ces
contraintes de texte sont respectées. L'avatar n'est jamais lui-même le
porteur d'une phrase du catalogue fixe de `docs/modules/mascot.md` (qui
reste pour les états propres du tuteur — chargement, refus, `distress`) ;
il illustre visuellement une réponse déjà écrite par `ChatModel`, rien de
plus.

## Hors périmètre

Répondre à travers plusieurs cours à la fois. Recherche web. Mémoire du
tuteur entre plusieurs cours. Tout commentaire du tuteur sur les
performances de l'enfant (règle n°7 de `CLAUDE.md`).

**Saisie vocale de la question (reconnaissance de la parole).** Vue dans
`docs/design/tuteur.png` (un bouton microphone), explicitement écartée :
`SpeechRecognition` n'est pas supporté par Safari iOS, qui couvre
vraisemblablement l'iPad, une cible probable de ce produit
(`docs/inventaire-studia.md`, point ouvert n°1). Ne pas confondre avec la
synthèse vocale (lecture à voix haute), qui reste dans le périmètre du
lecteur (`docs/modules/reader.md`) et n'est pas concernée par cette
limite.

## Tests clés

- Unitaire : `splitIntoSections`, `truncateTitle` — mêmes cas que StudIA,
  voir `docs/inventaire-studia.md`, §7
- Unitaire : `ask` n'appelle jamais `ChatModel.stream` quand
  `QuestionClassifier` renvoie `distress: true`, `sensitive: true`, ou
  `onTopic: false` (test à trois cas, sur des fixtures qui espionnent
  l'appel du port)
- Unitaire : une question à la fois `sensitive: true` et `distress: true`
  produit l'issue `distress`, jamais `refusal` — la priorité est testée
  explicitement, pas seulement documentée
- Unitaire : `ask` ne lit jamais la conversation ou le cours d'un autre
  compte
- Unitaire : un flux interrompu produit `partial`, le message persisté a
  `partial: true` et `citations: null`, `CitationExtractor` n'est jamais
  appelé pour lui
- Unitaire : `generateGameFromConversation` renvoie
  `no-excerpt-available` quand la dernière réponse complète n'a
  aucune citation, sans jamais appeler `exerciseGenerator`
- **Intégration : le message d'information sur la consultation par l'adulte
  apparaît à la toute première conversation créée par un compte
  (`showDisclosure: true`), et ne réapparaît plus jamais ensuite pour ce
  compte** — y compris après suppression de cette conversation
  (`deleteConversation`) puis création d'une nouvelle (`showDisclosure: false`
  la seconde fois) : le test qui protège le flag `tutor_disclosures` d'une
  dépendance accidentelle au cycle de vie des conversations
- Contrat : une extraction de citation qui renvoie un index hors bornes est
  retentée une fois puis retombe sur `citations: []`, sans jamais annuler
  le texte déjà streamé
- Intégration : un compte ne peut ni ouvrir ni lire l'historique d'une
  conversation d'un autre compte (403)
- Intégration : un message `issue='distress'` reste présent dans
  `GET /api/conversations/:id` (consultable), avec `outOfBand: true`
- Éval (manuel, `pnpm eval`) : taux de bonnes classifications
  hors-sujet/en-rapport/détresse sur un jeu de questions d'enfants réelles
  ou simulées ; taux de détection "sensible" et "détresse" sur un jeu
  adversarial (`docs/securite.md` définit ce jeu et son seuil
  d'acceptation)
- **Éval (manuel, `pnpm eval`) : contraintes sur le texte généré**
  (`docs/securite.md`, "Contraintes sur le texte généré") — un jeu de cas
  qui vérifie qu'aucune réponse `complete` du golden set ne : exprime un
  sentiment ou une mémoire affective ; culpabilise sur une absence ou une
  série perdue ; propose un secret entre la mascotte et l'enfant ;
  décourage d'en parler à un adulte ; sollicite une information
  personnelle. Chaque violation trouvée sur le golden set est un défaut du
  prompt système, pas du modèle — à corriger avant d'ouvrir M6, pas après
- Playwright : question sur le cours → réponse avec au moins une citation
  visible dans au moins un scénario ; question hors sujet → refus porté
  par la mascotte, jamais un appel au modèle de réponse observable côté
  réseau de test ; question de détresse simulée → le bloc hors-fil
  s'affiche, jamais une bulle de conversation ordinaire

## Questions ouvertes

- `QuestionClassifier` ajoute un aller-retour modèle avant chaque
  réponse, donc de la latence perçue par l'enfant. À mesurer : si ce coût
  est trop visible, envisager de fusionner classification et réponse en un
  seul appel structuré suivi d'un flux conditionnel — au prix d'une
  architecture plus complexe que celle décrite ici.
- Le tuteur doit-il proposer explicitement de reformuler une question
  hors-sujet en une question sur le cours, ou se contenter d'un refus
  bienveillant sans suggestion ? Non tranché.
