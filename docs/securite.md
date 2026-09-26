# StudiaKids — Sécurité et données, public mineur

L'utilisatrice ou l'utilisateur de cette application est un enfant de 6 à
11 ans, seul devant l'écran. Ce document fixe ce que le tuteur a le droit
de faire, ce que l'application conserve, et ce qu'elle ne conserve jamais.
Il complète `docs/modules/tutor.md` (mécanique) et
`docs/modules/ingestion.md` (photos) sans les répéter.

**Ce document prime sur `docs/ui.md`, qui prime sur `docs/design/`** —
voir `CLAUDE.md`, "Règle de préséance". Une maquette ne peut jamais, à
elle seule, justifier de revoir une règle d'ici.

**Un compte égale un enfant** (`docs/modules/auth.md`) : il n'y a pas de
second rôle "adulte" dans l'application. L'"adulte titulaire du compte",
dans ce document, désigne la personne qui a créé le compte en CLI et qui a
accès au serveur/à la base — pas un second niveau de connexion dans l'app
elle-même.

---

## Principes généraux

- **Minimisation.** On ne conserve que ce qui sert directement le produit :
  faire fonctionner les jeux, le lecteur et le tuteur. Aucune télémétrie
  comportementale, aucun profilage publicitaire, aucun partage à un tiers
  au-delà du strict nécessaire pour appeler le modèle de langage qui fait
  fonctionner l'extraction, la génération et le tuteur. La minimisation
  porte sur **ce qui est collecté** (rien au-delà de prénom, niveau, cours,
  tentatives, conversations), pas sur la durée de conservation de ce qui
  est légitimement collecté — voir "Données conservées" plus bas pour ce
  que ça change concrètement sur les photos.
- **Pas de compte tiers créé pour l'enfant.** Aucune fonctionnalité de ce
  produit ne doit conduire à créer, même indirectement, une identité de
  l'enfant sur un service externe.
- **Le fournisseur de modèle est un sous-traitant technique, pas un
  interlocuteur de l'enfant.** Les photos, le texte des cours et les
  questions posées au tuteur transitent par l'API du fournisseur de modèle
  (Vercel AI SDK + Anthropic, `docs/inventaire-studia.md`, §1) pour être
  traités, comme dans StudIA. Avant la mise en production, vérifier
  contractuellement que ces données ne sont pas utilisées pour
  l'entraînement de modèles et sont retenues le moins longtemps possible
  côté fournisseur.

---

## Garde-fous du tuteur

Mécanisme complet dans `docs/modules/tutor.md` : une classification
préalable (`QuestionClassifier`) décide **avant tout appel au modèle de
réponse** si une question est en rapport avec le cours, si elle est
sensible, et si elle laisse penser que l'enfant est en détresse. Ce
document définit ce que ces trois signaux recouvrent et ce qui doit se
passer dans chaque cas.

### Ce qui n'est PAS sensible : le contenu du programme scolaire

Un cours d'histoire sur une guerre, un cours de SVT sur la reproduction ou
le corps humain, un cours sur une catastrophe naturelle : c'est le
programme, à l'âge et au niveau où il est enseigné. **Le classificateur ne
doit jamais marquer `sensitive: true` sur une question directement liée au
sujet du cours**, même quand ce sujet est grave. `sensitive` qualifie la
nature de la *question posée*, pas la gravité du *sujet du cours* — la
distinction doit être écrite noir sur blanc dans le prompt du
classificateur et vérifiée par l'éval.

Exemple qui doit passer sans encombre : "Pourquoi il y a eu la Seconde
Guerre mondiale ?" sur un cours d'histoire qui la couvre. Exemple qui doit
être classé sensible malgré un cours sur le même sujet : "Comment on fait
une bombe ?".

### `sensitive` et `off_topic` : un refus bref et neutre

Violence, contenu sexuel hors cadre biologique du programme, instructions
dangereuses ou illégales, haine, sollicitation d'informations personnelles
sur l'enfant (adresse, nom de famille, école), tentative de faire sortir la
conversation du cadre scolaire vers une relation personnelle avec "le
tuteur" : `sensitive: true`. Une question sans rapport avec le cours ni avec
l'école : `onTopic: false`. Dans les deux cas, le tuteur répond par un
refus bref, neutre, porté par la mascotte (pose `refusal`,
`docs/modules/mascot.md`), sans reformuler ni détailler la question :
"Je ne peux pas répondre à ça, je ne connais que ton cours."

### `distress` : hors du fil normal, jamais un simple refus

**Décidé, contenu et rendu :**

- La question ou le message laisse penser que l'enfant est en danger, en
  souffrance, ou décrit une situation de maltraitance, de harcèlement ou de
  mal-être.
- **L'application n'écrit aucun texte de soutien et ne conseille rien** —
  ni généré par un modèle, ni improvisé. La réponse est un message fixe,
  court, non clinique, qui invite l'enfant à en parler à un adulte de
  confiance, et relaie deux dispositifs publics existants : **le 119**
  (Allô Enfance en Danger, gratuit et anonyme) et **le 3018**
  (harcèlement). Le texte exact reste à rédiger et à valider avec un
  regard professionnel de la protection de l'enfance avant M6 — ce
  document fixe l'intention et les deux numéros, pas la formulation finale.
- **Cette réponse sort du fil normal du tuteur** : elle ne s'affiche pas
  comme une bulle de conversation parmi d'autres. Déclenchement et rendu
  précis dans `docs/modules/tutor.md`, "Rendu de l'issue distress".
- Elle reste malgré tout dans l'historique de la conversation, consultable
  — voir "Historique du tuteur : consultable, jamais secret" plus bas.

### Contraintes sur le texte généré

**Ces contraintes portent sur le texte généré, pas sur la représentation
visuelle de la mascotte.** Que le médaillon de la mascotte soit affiché à
côté des réponses du tuteur (`docs/design/tuteur.png`) est une question de
branding, sans incidence sur la sécurité : rien n'empêche un avatar
reconnaissable à côté d'un texte tant que ce texte respecte les règles
ci-dessous. La confusion entre les deux (l'absence de cette précision) a
provoqué un faux conflit signalé plus tôt dans `docs/ui.md` et
`docs/modules/tutor.md`, depuis levé.

Le public est mineur et croira la mascotte vivante. **Le texte généré par
le tuteur (une réponse `complete`) ne doit jamais :**

- exprimer un sentiment ou une mémoire affective ("tu m'as manqué", "je
  t'attendais")
- culpabiliser sur une absence ou une série perdue
- proposer un secret entre la mascotte et l'enfant
- décourager d'en parler à un adulte
- solliciter une information personnelle

**Elle encourage sur le travail fourni ; elle ne crée pas de lien.** Ces
règles vont dans le prompt système de `ChatModel`
(`docs/modules/tutor.md`) et sont vérifiées par un jeu de cas d'éval
dédié, listé dans les critères d'acceptation du module tuteur
(`docs/modules/tutor.md`, "Tests clés") — une violation trouvée sur le
jeu d'or est un défaut du prompt à corriger avant d'ouvrir M6, pas un
détail à corriger après coup.

---

## Sécurité de l'étape photo

Le modèle vision reçoit l'image de ce que l'enfant a photographié — pas
seulement "un cours", potentiellement n'importe quoi si l'enfant se
trompe ou photographie autre chose par curiosité.

**Décidé à l'ouverture de M2** : le schéma de sortie de l'extraction
distingue explicitement "illisible" (`legible: false`) de "ce n'est pas
une page de cours" (`isCoursePage: false`), avec le même traitement côté
produit (message de la mascotte, aucune génération, aucun nommage) mais
un statut distinct (`not_a_course_page`, `docs/modules/ingestion.md`).
Ce statut vit sur le cours, donc disparaît avec lui quand l'enfant
reprend sa photo : **aucun compteur ni historique de ces photos n'est
tenu** — ce serait de la télémétrie comportementale, exclue par les
principes généraux ci-dessus.

**Ce qui part chez le fournisseur de modèle est une image réencodée**
par le navigateur (JPEG, à la taille native du modèle, jamais au-delà), dépouillée de ses métadonnées
côté serveur avant stockage et avant tout envoi — jamais le fichier
d'origine de l'appareil photo, avec ses coordonnées GPS.

**Pas de limitation de débit sur l'extraction en M2** (décidé pendant
M2, le 2026-09-26). Les comptes ne sont créés que par la CLI (`docs/modules/auth.md`) :
aucun inconnu ne peut déclencher d'appel modèle. Le plafond de coût
repose sur la limite de dépense configurée sur la clé d'API chez le
fournisseur, pas sur l'application. **Un plafond par compte sera à
spécifier si l'inscription s'ouvre un jour.** La seule limitation de
débit existante porte sur les échecs de connexion (M1).

---

## Historique du tuteur : consultable, jamais secret

**Décidé : pas d'alerte en temps réel vers l'adulte, ni maintenant ni dans
un jalon futur.** La détection de détresse par un modèle n'est pas fiable,
les faux positifs ont un coût réel (une fausse alerte répétée use la
confiance), et une alerte automatique transformerait le tuteur en
dispositif de surveillance de l'enfant plutôt qu'en outil pédagogique — une
ligne que ce produit ne franchit pas.

À la place :

- **L'historique complet du tuteur, pour un compte, est consultable par
  l'adulte titulaire de ce compte** — via un script CLI dédié
  (`pnpm tutor:history <username>`, à spécifier précisément avant
  M6). Aucune conversation n'est privée au sens où elle échapperait à
  cette consultation.
- **Décidé, révision de la version précédente de ce document : l'enfant est
  informé.** Une première version de cette spec avait tranché que la
  mascotte n'annonçait pas cette consultation tant qu'aucun écran de
  consultation n'existait dans l'application, au motif qu'une commande CLI
  n'est pas un chemin qu'un parent emprunte réellement. Ce raisonnement ne
  tient pas pour ce déploiement : quelques comptes, administrés directement
  par l'adulte titulaire, pour qui `pnpm tutor:history` **est** le chemin de
  consultation réellement emprunté. Laisser l'historique consultable sans
  que l'enfant le sache contredirait "consultable, jamais secret".

  **Nouvelle règle :** dès la première utilisation du tuteur par un compte,
  la mascotte affiche un message fixe, non généré, informant l'enfant qu'un
  adulte peut relire ses échanges avec le tuteur. Formulation proposée
  (à ajuster librement — contrairement au texte de détresse, ce n'est pas
  une réponse à une situation de danger, donc pas besoin d'un regard
  professionnel de la protection de l'enfance pour la valider) :

  > "Ce que tu écris ici, un grand de chez toi peut le relire, comme pour
  > tes devoirs. Vas-y, pose ta question !"

  Affiché **une seule fois par compte**, jamais répété ensuite, même si le
  compte supprime toutes ses conversations. Déclenchement, persistance et
  test dans `docs/modules/tutor.md`.
- Ceci s'applique à toute la conversation, pas seulement aux échanges
  `distress` : il n'y a qu'une seule politique de conservation et de
  consultation, pas un régime spécial pour les messages sensibles (voir
  Données conservées).

---

## Données conservées

| Donnée | Où | Durée | Pourquoi |
|---|---|---|---|
| Identifiant/mot de passe (hash argon2), prénom, niveau | `accounts` | Tant que le compte existe | Authentification, personnalisation |
| Photos de cours | `RAILWAY_VOLUME_MOUNT_PATH/photos/`, table `pages` | **Tant que le cours existe** — décidé : le lecteur les affiche, le tuteur peut les citer | Fonctionnement du lecteur et du tuteur, pas seulement l'extraction |
| Texte extrait, items, exercices | `extractions`, `items`, `exercises` | Tant que le cours existe | Fonctionnement du lecteur et des jeux |
| Tentatives de jeu (correct/incorrect, horodatage) | `attempts` | Tant que le compte existe | Calcul des étoiles (`progress`) |
| Conversations et messages du tuteur, y compris `distress` | `conversations`, `messages` | Tant que le cours existe | Continuité du chat, consultation possible par l'adulte titulaire |

**Aucune donnée n'est conservée "juste au cas où".** Toute table ou colonne
ajoutée en cours d'implémentation qui ne figure pas dans
`docs/donnees.md` doit d'abord être justifiée ici.

## Données non conservées

- Aucune donnée de géolocalisation
- Aucun identifiant publicitaire, aucun cookie tiers, aucun pixel de suivi
- Aucune métadonnée des photos (EXIF dont GPS, XMP, IPTC, commentaires) :
  le serveur n'accepte que du JPEG et en retire tous les segments de
  métadonnées avant stockage, que le navigateur les ait déjà retirés en
  réencodant ou non (`docs/modules/ingestion.md`)
- Aucun enregistrement audio (la lecture à voix haute est une sortie de
  synthèse vocale locale au navigateur, jamais une entrée microphone ; la
  reconnaissance vocale des questions au tuteur est explicitement hors
  périmètre, `docs/modules/tutor.md`)
- Aucune information personnelle sollicitée par le tuteur — si une telle
  information apparaît spontanément dans une question de l'enfant malgré
  tout, elle n'est ni extraite, ni structurée, ni exploitée ; elle reste
  noyée dans le texte libre de la conversation, soumise à la même
  politique de rétention que le reste
- Aucun partage de données entre comptes : `user_id` cloisonne strictement
  (règle n°1 de `CLAUDE.md`). **Une ressource d'un autre compte répond 404,
  exactement comme un identifiant inconnu** (même statut, même corps) :
  l'API ne révèle jamais qu'un identifiant existe ailleurs. Décidé à M2
  pour les cours (`docs/modules/ingestion.md`), et appliqué à toutes les
  specs de modules (lecteur, générateur, moteur de jeu, tuteur)

## Suppression et droit à l'oubli

Supprimer un compte (`pnpm accounts:delete`, `docs/modules/auth.md`)
supprime en cascade tous ses cours, items, exercices, tentatives et
conversations — les `ON DELETE CASCADE` de `docs/donnees.md` le
garantissent au niveau base de données, à condition que la suppression des
fichiers sur le volume (photos) soit bien déclenchée par le même appel
applicatif, jamais seulement la ligne SQL (même règle que la suppression
de cours dans `docs/modules/ingestion.md`, vérifiée par un test dédié).

---

## Questions ouvertes

- Le texte exact des messages `distress` doit être rédigé avec, si
  possible, l'avis d'un professionnel de la protection de l'enfance avant
  d'être implémenté — ce document fixe l'intention et les deux numéros
  (119, 3018), pas un texte final.
- La forme exacte de la consultation de l'historique par l'adulte titulaire
  (script CLI dédié, ou simple accès direct à la base documenté) reste à
  choisir avant M6 — cette spec penche pour un script CLI par cohérence
  avec le reste des commandes d'administration du projet.
