# StudiaKids — Jalons

Chaque jalon a une **démo** : quelque chose qu'un humain peut faire dans un
navigateur (ou un terminal) qui prouve que ça marche. Un jalon n'est pas fini
parce que le code existe. Il est fini quand la démo tourne et que tous les
critères d'acceptation sont cochés.

Légende : `[ ]` en attente · `[x]` accepté

**M0 et M1 sont acceptés. M2 est ouvert** (voir `CLAUDE.md`, section
"Jalon courant"). Ce document définit le périmètre prévu pour les jalons
suivants, pas un engagement figé : un jalon peut encore être ajusté avant
son ouverture si la relecture le justifie.

---

## M0 — Squelette (accepté)

Tout ce qui n'a rien à voir avec le produit, fait une fois et jamais
retouché.

**Périmètre**
- Monorepo pnpm : `apps/api`, `apps/web`, `apps/worker`, `packages/contracts`, `packages/core`
- TypeScript strict, ESLint, règles `dependency-cruiser` pour les frontières de module
- Vitest configuré, un test trivial passant par paquet
- Fastify avec `/api/health`, sert `apps/web/dist` en production
- Proxy de dev Vite `/api` vers Fastify
- Connexion SQLite avec les pragmas requis, Drizzle, migrations au démarrage
- Dockerfile, `railway.toml`, volume Railway (chemin lu depuis
  `RAILWAY_VOLUME_MOUNT_PATH`, sous-dossiers `db/`/`photos/` créés au
  démarrage)
- GitHub Actions : typecheck, lint, test à chaque push
- `tokens.css` : les couleurs de marque (crème, encre, mandarine,
  turquoise, et le reste de la palette de `docs/design/tokens.md`) posées
  comme tokens Tailwind, polices Baloo 2 et Lexend chargées et vérifiées
  par un test (voir `docs/ui.md`)
- Une page d'accueil placeholder affichant la mascotte en pose `idle`, pour
  prouver que web et API sont connectés sur la même origine
- Web App Manifest (nom, icônes, `display: standalone`, couleurs de thème)
  pour un lancement plein écran depuis l'écran d'accueil d'un téléphone ou
  d'une tablette — **pas de service worker, pas de mode hors ligne**

**Démo** — `GET /api/health` renvoie 200 sur l'URL Railway déployée, et
l'app React charge depuis la même origine avec la mascotte visible ;
ajoutée à l'écran d'accueil d'un téléphone, elle s'ouvre en plein écran
sans barre d'adresse.

**Acceptation**
- [x] `pnpm dev` démarre api, web et worker ensemble — vérifié localement (santé API, proxy Vite, mascotte visible à l'écran)
- [x] `pnpm test`, `pnpm typecheck`, `pnpm lint` tous verts en local et en CI — verts en local et en CI (GitHub Actions, run sur `7699ab2`)
      — **corrigé a posteriori pendant M2 (`e13fb6e`)** : le garde-fou qui
      fait échouer `fetch` (`CLAUDE.md`, TDD) était déclaré à la racine de
      `vitest.config.ts` et n'était hérité par aucun projet de test ; "sans
      réseau" n'était donc pas garanti lors de l'acceptation. Aucun code de
      M0/M1 n'appelait le réseau, rien n'était à refaire. Le garde est
      désormais posé par projet, testé, et vide aussi `ANTHROPIC_API_KEY`
- [x] Un import profond délibéré entre deux modules fait échouer `pnpm lint` — vérifié manuellement (violation temporaire, échec confirmé, revert)
- [x] Une donnée et un fichier créés en production survivent à un redéploiement — vérifié via Docker (volume nommé monté sur `RAILWAY_VOLUME_MOUNT_PATH`, conteneur arrêté puis remplacé par un nouveau sur le même volume) : une ligne insérée en base et un fichier écrit dans `photos/` sont tous deux relus intacts après le "redeploy", `db/` et `photos/` créés automatiquement au démarrage. Persistance sur le volume Railway réel non testée (pas d'accès à un environnement Railway depuis ici), mais le mécanisme est identique
- [x] `better-sqlite3` charge dans l'image Docker — vérifié : build de l'image (compilation native réussie dans le stage `deps`) et exécution réelle (connexion, écriture, lecture) dans deux conteneurs successifs
- [x] Les couleurs de marque et les deux polices sont chargées et
      utilisables via les tokens, vérifié par un test
- [x] Le manifeste est valide (JSON vérifié, icônes réelles 192/512 + maskable + apple-touch-icon, toutes servies avec succès) et référence des icônes réelles à plusieurs résolutions

**Hors périmètre** — toute table métier, tout écran au-delà du placeholder,
authentification, service worker, mode hors ligne.

---

## M1 — Comptes (accepté)

**Un compte égale un enfant** (décidé) : pas de notion de profil séparée.
Un second enfant dans le même foyer a un second compte, créé par le même
script CLI.

**Périmètre**
- Table des comptes (identifiant/mot de passe argon2, prénom, niveau
  CP→6e, portés directement par le compte)
- `pnpm accounts:create <username> <firstName> <grade>` — CLI qui crée un
  compte (mot de passe demandé en interactif), échoue si le compte existe
  déjà
- `pnpm accounts:reset-password <username>` — CLI qui change le mot de
  passe d'un compte existant et invalide ses sessions
- `pnpm accounts:delete <username>` — CLI, suppression en cascade
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/me`
- Cookie de session signé, **glissant** (prolongé à chaque appel
  authentifié réussi, jamais un TTL fixe court), `sessionVersion` pour
  révocation, rate limiting des tentatives de connexion
- Écran de connexion (usage adulte au moment de la configuration initiale,
  l'enfant reste connecté ensuite sans avoir à se reconnecter)
- Décorateur `requireAuth` appliqué par défaut à toute route `/api/*`

**Démo** — Créer un compte depuis le terminal, se connecter depuis le
navigateur, arriver sur l'accueil, se déconnecter et être renvoyé à l'écran
de connexion. Fermer le navigateur et rouvrir l'app plus tard sans avoir à
se reconnecter.

**Acceptation**
- [x] Tests unitaires : hash et vérification du mot de passe, signature et
      expiration du token de session — `argon2-password-hasher.int.test.ts`
      (round-trip, argon2id, mauvais mot de passe), `hmac-session-codec.unit.test.ts`
      (aller-retour, signature/corps trafiqués, secret différent, ttl dépassé, token invalide)
- [x] Tests d'intégration : connexion réussie, mauvais mot de passe,
      identifiant inconnu, rate limit déclenché puis levé — `routes/auth.int.test.ts` ;
      la levée du rate limit après la fenêtre de 15 min est couverte au niveau
      unitaire pur dans `domain/rate-limit.unit.test.ts` ("slides the window")
- [x] `SESSION_SECRET` est lu depuis l'environnement, échec bruyant au
      démarrage s'il est absent — `app.auth.int.test.ts`, lu depuis
      `process.env.SESSION_SECRET` dans `server.ts`
- [x] Aucune route ne peut être ajoutée sans authentification par accident
      (default-deny, testé explicitement) — `app.auth.int.test.ts` (route
      `/api/*` ajoutée à l'app réelle sans l'exempter, 401 confirmé)
- [x] **Une session réutilisée régulièrement ne présente jamais
      d'expiration** ; une session non réutilisée pendant plus de
      `SESSION_DURATION_DAYS` finit par expirer (les deux testés avec une
      horloge injectée, `docs/modules/auth.md`) — `resolve-session.unit.test.ts`,
      horloge avancée par pas de 300 jours sur plusieurs années avec un appel
      entre chaque pas, puis sans appel intermédiaire au-delà du délai
- [x] Playwright : cycle complet connexion → accueil → déconnexion ; une
      route protégée redirige vers la connexion si déconnecté ; la session
      survit à la fermeture de l'onglet et à un rechargement — `e2e/login.spec.ts`
      (pas de routeur : "route protégée" vérifié comme "aucun contenu protégé
      n'apparaît jamais sans session valide", seul écran possible sans session
      étant l'écran de connexion)

**Hors périmètre** — inscription publique, réinitialisation de mot de passe
par l'utilisateur, tout rôle "parent" avec vue de supervision (non demandé),
édition du prénom/niveau depuis l'interface, toute notion de profil
multiple sous un même compte.

---

## M2 — Ingestion : photographier un cours (ouvert)

Ajusté à l'ouverture (relecture croisée des specs, décisions validées) :
photo "pas une page de cours" distinguée de la photo illisible, JPEG
uniquement réencodé par le navigateur et dépouillé de ses métadonnées au
stockage, plafond de 5 pages, un seul cours non confirmé à la fois,
suppression de compte qui efface aussi les photos. Détail dans
`docs/modules/ingestion.md`.

**Périmètre**
- Tables cours (`courses`), pages, extractions, jobs (noyau `jobs` copié
  de StudIA, `docs/modules/jobs.md`)
- Upload d'une à cinq photos formant un même cours, depuis mobile ou
  tablette (`<input type="file" accept="image/*" capture>`), chaque photo
  réencodée en JPEG par le navigateur avant envoi ; le serveur n'accepte
  que du JPEG (type réel vérifié sur les octets) et en retire toutes les
  métadonnées avant stockage (`docs/securite.md`)
- Extraction par modèle vision (`legible`/`isCoursePage`/`reason`/`markdown`
  à hiérarchie de titres préservée), aucun OCR local
- Détection de photo inexploitable — illisible **ou** pas une page de
  cours — **avant** toute génération d'exercices, message porté par la
  mascotte invitant à reprendre la photo
- Écran de capture : miniatures des pages déjà prises, boutons "Une autre
  page" (masqué à partir de 5 pages) et "C'est tout !"
- Écran de validation de l'extraction, adapté à un enfant : la photo,
  un titre et une matière proposés (trois mots au plus) et le niveau du
  compte (jamais deviné), deux boutons ("Oui, c'est ça !" / "Je reprends
  la photo"), aucun éditeur de texte
- Écran d'accueil : bouton "Photographier un cours", bandeau du cours non
  confirmé s'il en existe un (un seul à la fois), et liste "Reprendre un
  cours existant"
- `pnpm accounts:delete` supprime aussi les cours et les photos du compte
- `pnpm fixtures:record` (enregistrement manuel de réponses brutes du
  modèle, coûte de l'argent) ; les photos sources sont dépouillées de
  leurs métadonnées par l'outil avant d'être écrites dans le dépôt, et la
  clé d'API n'est lue que depuis l'environnement (`.env` ignoré par git)

**Démo** — Depuis l'accueil, l'enfant prend une photo. Une photo floue, ou
une photo qui n'est pas une page de cours, déclenche un message
d'encouragement de la mascotte à recommencer, sans lancer aucune
génération. Une photo lisible aboutit à l'écran de validation à deux
boutons, puis le cours apparaît dans la liste "Reprendre un cours
existant".

**Acceptation**
- [ ] Unitaire : la vérification de lisibilité est placée dans le pipeline
      avant toute étape de génération, jamais après
- [ ] Contrat : une fixture "floue" renvoie `legible: false` et une raison ;
      une fixture lisible renvoie un Markdown à hiérarchie de titres ; une
      fixture "pas un cours" renvoie `isCoursePage: false`
- [ ] Intégration : l'upload écrit le fichier et la ligne ; le worker
      traite le job ; le statut est visible via l'API
- [ ] Intégration : relancer le handler d'extraction deux fois laisse
      exactement une extraction
- [ ] Sécurité : un compte ne peut ni lire, ni uploader sur, ni supprimer le
      cours d'un autre compte : 404, testé, indiscernable d'un identifiant
      inconnu (`docs/securite.md`)
- [ ] Intégration : supprimer un cours supprime aussi ses fichiers photo sur
      le disque, pas seulement ses lignes en base (`docs/securite.md`)
- [ ] Sécurité : un fichier qui n'est pas réellement un JPEG est refusé
      quel que soit son type annoncé ; un JPEG stocké ne contient plus
      aucun segment de métadonnées (EXIF/GPS compris)
- [ ] Intégration : une sixième page est refusée ; créer un cours supprime
      le cours non confirmé précédent du compte, fichiers compris
- [ ] Intégration : `accounts:delete` sur un compte qui a un cours avec
      photo supprime ses lignes et son dossier de photos
- [ ] Playwright : parcours complet photo → validation → cours visible sur
      l'accueil ; parcours photo illisible → message de la mascotte →
      nouvelle tentative, sans cours créé entre-temps ; le bouton "Une
      autre page" disparaît à la cinquième page

**Dette assumée** — les poses `sorry` et `glitch` sont des **brouillons
provisoires** dérivés des tracés de `idle`, en attendant leur dessin
définitif dans `docs/design/` ; de même, les pastels de matière
géographie, sciences, anglais et autre sont provisoires
(`docs/design/tokens.md`), à valider visuellement.

**Hors périmètre** — découpage en items, génération d'exercices, lecture à
voix haute, tuteur, tout format autre que la photo (PDF, Word, PowerPoint),
nombre de jeux prêts sur les cartes de l'accueil (M3), barre d'onglets
(M3, quand un second écran existe), tout suivi ou compteur des photos
"pas une page de cours" au-delà de la vie du cours.

---

## M3 — Lecteur de cours et génération d'exercices

**Périmètre**
- Découpage du Markdown extrait en items, chaque item annoté par le modèle
  avec les types de jeu qui s'y appliquent (parmi les sept types définis
  dans `docs/modules/game-engine.md`)
- Génération d'exercices une fois par item et par type applicable, stockage
  permanent — jamais à la volée pendant qu'on joue
- Contrôle de couverture : si le cours produit moins de 8 items, le job
  échoue proprement et la mascotte invite à reprendre une photo (cours trop
  court ou extraction trop pauvre) plutôt que de générer des jeux sur une
  base insuffisante
- Écran lecteur : affichage continu du texte du cours, bouton de lecture à
  voix haute (Web Speech API), activé par défaut pour les niveaux CP et CE1
- Déclenchement manuel de la génération depuis le lecteur ou l'accueil,
  jamais automatique après l'extraction

**Démo** — Depuis l'accueil, ouvrir un cours dans le lecteur, lire le texte
(avec ou sans la voix), lancer la génération des exercices, voir sa
progression, revenir plus tard et constater qu'elle est terminée.

**Acceptation**
- [ ] Unitaire : l'annotation des types de jeu par item ne peut produire que
      des valeurs de l'énumération fermée des sept types
- [ ] Unitaire : le contrôle de couverture se déclenche exactement en
      dessous de 8 items, jamais à 8 ou au-dessus
- [ ] Contrat : une fixture produisant moins de 8 items échoue le job avec
      un message clair ; une fixture en produisant au moins 8 génère des
      exercices dans au moins deux types différents
- [ ] Intégration : la génération est isolée par item (un item en échec
      n'empêche pas les autres d'aboutir) ; une régénération remplace les
      exercices d'un item sans dupliquer les lignes
- [ ] Playwright : le lecteur affiche le texte du cours ; la lecture à voix
      haute démarre et s'arrête ; la génération se lance puis se termine ;
      le message "reprends une photo" apparaît sur un cours volontairement
      trop court

**Hors périmètre** — jouer effectivement aux jeux générés (`game-engine`,
M4), étoiles et progression (M5), tuteur (M6).

---

## M4 — Moteur de jeu

**Périmètre**
- Les sept types de jeu : copie différée, QCM, appariement, remise en
  ordre, texte à trous, vrai/faux, calcul flash
- Un comparateur de réponse par type en `domain/`, jamais une égalité
  globale entre la réponse donnée et la réponse attendue
- Écran jeux : sélection d'un exercice généré, déroulé, retour immédiat
  (correct/incorrect) porté par la mascotte
- Copie différée : durée d'affichage paramétrée par niveau, écran de flash
  en violet sombre isolant le mot, champ de saisie avec autocorrect,
  autocapitalize, autocomplete et spellcheck désactivés, une relecture du
  mot possible sans gain d'étoile
- Chaque réponse est stockée comme un événement de tentative (correct,
  type de jeu, horodatage), scopé au compte — la dérivation en étoiles
  visibles est hors périmètre de ce jalon (M5)

**Démo** — L'enfant choisit un cours, joue un QCM, obtient un retour
immédiat, enchaîne un vrai/faux et un appariement, puis fait une copie
différée complète : timer, écran de flash violet, saisie, relecture
optionnelle, validation.

**Acceptation**
- [ ] Unitaire : un test par type de jeu avec un cas correct et un cas
      incorrect ; au moins un test prouve qu'une différence non pertinente
      pour le type (ex. ordre des paires dans un appariement) n'affecte pas
      le résultat
- [ ] Unitaire : une relecture du mot en copie différée n'écrit jamais
      d'événement de réussite
- [ ] Intégration : chaque réponse écrit un événement de tentative scopé au
      compte courant ; aucune écriture ne modifie l'exercice original
- [ ] Playwright : un scénario par type de jeu (sept au total), plus un
      scénario dédié au parcours de copie différée complet
- [ ] Accessibilité : les champs de saisie de copie différée ont bien
      `autocorrect`, `autocapitalize`, `autocomplete` et `spellcheck`
      désactivés, vérifié sur l'attribut, pas seulement observé au clavier

**Hors périmètre** — étoiles et séries visibles à l'écran, danse de la joie
de la mascotte sur un écran dédié (une réaction immédiate suffit ici),
tuteur.

---

## M5 — Progression et mascotte festive

**Périmètre**
- Dérivation des étoiles depuis les événements de tentative stockés en M4 :
  une étoile par bonne réponse, bonus de série, aucune perte en cas d'échec
- Compteur d'étoiles visible sur l'écran d'accueil, mis à jour en direct
  pendant le jeu
- Danse de la joie de la mascotte sur une réussite marquante ou un bonus de
  série
- Écran récapitulatif de fin de session de jeu
- Reprise d'un cours existant proposée sur l'accueil, y compris après une
  reconnexion

**Démo** — L'enfant enchaîne plusieurs bonnes réponses, voit son compteur
d'étoiles augmenter en direct, atteint un bonus de série et voit la
mascotte danser ; il se trompe une fois et ne perd rien ; il revient plus
tard, l'accueil lui propose de reprendre son dernier cours.

**Acceptation**
- [ ] Unitaire : le calcul des étoiles et du bonus de série est une
      fonction pure des événements de tentative (mêmes événements en
      entrée, même total en sortie, testé explicitement)
- [ ] Unitaire : un échec ne fait jamais diminuer le total affiché
- [ ] Intégration : le compteur exposé par l'API correspond exactement à la
      somme dérivée des événements stockés — jamais un compteur mutable qui
      pourrait se désynchroniser
- [ ] Playwright : une série de bonnes réponses déclenche la danse de la
      joie ; après reconnexion, l'accueil propose la reprise du bon cours

**Hors périmètre** — tuteur, tout classement ou comparaison entre enfants
(explicitement absent du produit), notifications ou rappels.

---

## M6 — Tuteur

**Périmètre**
- Chat scopé à un cours : répond aux questions sur son contenu et à toute
  question en rapport
- Garde-fous adaptés à un public mineur (voir `docs/securite.md`) :
  classification préalable hors-sujet / sensible / détresse, avant tout
  appel au modèle de réponse
- Rendu spécial, hors du fil de conversation, pour l'issue détresse (deux
  numéros d'aide publics relayés — `docs/securite.md`)
- Contraintes sur le texte généré (pas de sentiment, pas de culpabilisation,
  pas de sollicitation d'information personnelle — `docs/securite.md`,
  "Contraintes sur le texte généré")
- `pnpm tutor:history <username>` — CLI de consultation pour
  l'adulte titulaire du compte (`docs/securite.md`) ; **la mascotte informe
  l'enfant de cette possibilité dès la première utilisation du tuteur**,
  message fixe affiché une seule fois par compte (décidé,
  `docs/securite.md`, `docs/modules/tutor.md`)
- Citations vers le texte source du cours
- Écran tuteur, accessible depuis le lecteur ou l'accueil

**Démo** — Depuis le lecteur, ouvrir le tuteur sur un cours pour la première
fois avec ce compte et voir le message de la mascotte informant qu'un adulte
peut relire les échanges (il ne réapparaît plus à l'ouverture suivante) ;
poser une question sur son contenu et obtenir une réponse ancrée dans le
texte ; poser une question hors sujet et obtenir un refus bienveillant porté
par la mascotte plutôt qu'une réponse de culture générale ; simuler une
question de détresse et voir le bloc hors-fil s'afficher avec le 119 et le
3018.

**Acceptation**
- [ ] Unitaire : le découpage en sections du cours est déterministe (mêmes
      entrées, mêmes sections)
- [ ] Unitaire : une question à la fois sensible et de détresse produit
      l'issue détresse, jamais un simple refus (priorité testée
      explicitement, `docs/modules/tutor.md`)
- [ ] Éval (manuel, `pnpm eval`) : taux de classification correcte
      hors-sujet/en-rapport/détresse sur un jeu d'or, avant tout réglage de
      prompt considéré comme acquis
- [ ] **Éval (manuel, `pnpm eval`) : aucune réponse du jeu d'or ne viole les
      contraintes sur le texte généré** (`docs/securite.md`) — sentiment,
      culpabilisation, secret, dissuasion de parler à un adulte,
      sollicitation d'information personnelle
- [ ] Intégration : un compte ne peut ni ouvrir, ni lire l'historique d'une
      conversation qui appartient à un autre compte (403, testé)
- [ ] `pnpm tutor:history <username>` exporte l'historique complet
      d'un compte, y compris les échanges `distress`
- [ ] Intégration : le message informant que l'historique est consultable
      par l'adulte s'affiche à la première conversation créée par un
      compte, et jamais ensuite pour ce compte — y compris après
      suppression de cette conversation (`docs/modules/tutor.md`)
- [ ] Playwright : une question sur le cours obtient une réponse avec au
      moins une citation visible, l'avatar de la mascotte affiché à côté
      (`docs/ui.md`) ; une question hors sujet obtient un refus porté par
      la mascotte ; une question de détresse simulée affiche le bloc
      hors-fil, jamais une bulle de conversation ordinaire

**Hors périmètre** — mémoire du tuteur entre plusieurs cours, saisie vocale
des questions (Safari iOS ne supporte pas `SpeechRecognition`,
`docs/modules/tutor.md`), tout commentaire du tuteur sur les performances
de l'enfant (contraire à la règle "aucune perte, jamais de jugement" de
`CLAUDE.md`), le chip "Fais-moi un jeu là-dessus" (M7), tout écran de
consultation de l'historique pour l'adulte au-delà de la commande CLI,
toute alerte automatique vers l'adulte (délibérément jamais, dans aucun
jalon — `docs/securite.md`).

---

## M7 — Jeu depuis une question au tuteur

Le chip "Fais-moi un jeu là-dessus" (`docs/design/tuteur.png`), décidé
comme dans le périmètre du produit. Dépend de `exercise-generator` (M3)
et `game-engine` (M4) en plus de `tutor` (M6) : ce jalon ne peut donc pas
s'ouvrir avant que les trois soient acceptés.

**Périmètre**
- `generateGameFromConversation` : transmet le passage cité par le dernier
  échange du tuteur (jamais la question de l'enfant) à
  `exercise-generator`
- Un seul job, `game-from-excerpt`, qui découpe l'extrait et génère les
  exercices en une fois — exception délibérée à la règle "un job par item"
  (`docs/modules/exercise-generator.md`)
- Le contrôle de couverture (8 items minimum) s'applique à l'identique ;
  en dessous, la mascotte le dit et propose de jouer sur le cours entier
- Les items et exercices créés rejoignent la liste normale du cours, mêmes
  règles d'étoiles que tout autre exercice
- Écran tuteur : le chip n'est proposé que si la dernière réponse complète
  a au moins une citation

**Démo** — Dans une conversation avec le tuteur, sur une réponse qui cite
le cours, appuyer sur "Fais-moi un jeu là-dessus" et être amené à jouer
l'exercice généré à partir de ce passage précis. Sur un passage trop court,
voir la mascotte proposer de jouer sur le cours entier à la place.

**Acceptation**
- [ ] Unitaire : `generateGameFromConversation` renvoie une erreur sans
      appeler `exercise-generator` quand la dernière réponse complète n'a
      aucune citation
- [ ] Intégration : les items créés par `game-from-excerpt` s'ajoutent à la
      suite des positions existantes du cours, sans jamais toucher aux
      items déjà présents
- [ ] Intégration : un extrait produisant moins de 8 items n'écrit aucun
      item et le statut renvoyé permet à l'écran de distinguer ce cas d'un
      échec technique
- [ ] Playwright : parcours complet chip → jeu généré → jeu joué avec gain
      d'étoile normal ; parcours extrait trop court → proposition de jouer
      sur le cours entier

**Hors périmètre** — tout jeu éphémère hors des tables normales du produit,
tout traitement différent des étoiles gagnées par ce chemin.
