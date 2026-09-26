# StudiaKids — Spécification UI

## À qui ça s'adresse

Un enfant du CP à la 6e, seul devant l'écran, sans adulte pour l'aider à
comprendre l'interface. Ça change tout par rapport à une app pour adulte :

- **Aucun texte que l'enfant ne peut pas lire seul ne doit bloquer un
  parcours.** Un CP ne lit pas un paragraphe de consigne — tout ce qui doit
  être compris s'appuie sur une icône, une couleur, une pose de la mascotte,
  ou trois mots au maximum.
- **Aucun formulaire, aucun champ libre, sauf quand le jeu lui-même l'exige**
  (la copie différée). Pas d'éditeur de texte, pas de configuration.
- **Jamais de jugement, jamais de perte, jamais d'urgence.** Un échec n'est
  jamais présenté comme une faute. Il n'y a pas de compte à rebours
  anxiogène, pas de "tu es en retard", pas de classement avec d'autres
  enfants.
- **Cibles tactiles larges** : l'app est pensée pour être touchée avec un
  doigt d'enfant, souvent sur une tablette partagée, pas cliquée avec une
  souris précise.

Cette page ne couvre pas d'écran "pour adulte" au-delà de la connexion
(`docs/modules/auth.md`), qui peut rester simple et sobre : c'est le seul
moment où un adulte est censé toucher l'appareil.

---

## Direction visuelle

Univers d'autocollants sur papier : contours francs, ombres dures décalées
(jamais de flou), grands rayons, aplats de couleur. Rien de glossy, rien de
dégradé.

**Une exploration visuelle concrète existe déjà dans `docs/design/`**
(maquettes `accueil.png`, `flash.png`, `saisie.png`, `bravo.png`,
`tuteur.png`, palette `tokens.md`, référence de mascotte
`mascotte-etats.html`) — apparue pendant la rédaction de ce document et
traitée ici comme **source de vérité pour les valeurs visuelles**, plus
précise que ce que ce document décrivait initialement. Les valeurs
ci-dessous sont reprises de `docs/design/tokens.md` telle quelle ; en cas
de nouvel écart constaté plus tard entre ce fichier et de nouvelles
maquettes, `docs/design/` gagne et ce document doit être corrigé pour
correspondre.

### Couleur

| Rôle | Token | Valeur | Usage |
|---|---|---|---|
| Fond | `--color-canvas` | `#FFF6E9` (crème) | fond général de toutes les pages |
| Texte, contours | `--color-ink` | `#2B2140` (encre) | tout le texte, tous les contours, toutes les ombres |
| Texte secondaire | `--color-ink-soft` | `#5A5270` (encre douce) | sous-titres, légendes — contraste vérifié correct sur crème |
| Accent 1 | `--color-mandarine` | `#FF7A4D` | action principale (ex. "Photographier un cours") |
| Accent 2 | `--color-turquoise` | `#21C1B4` | action secondaire, panneaux, barres de progression |
| Étoiles/mascotte | `--color-soleil` | `#FFC642` | étoiles, corps de la mascotte |
| Succès | `--color-succes` | `#3FC66B` | validations, lettres correctes en gros format |
| Flash | `--color-violet-nuit` | `#3A2B5C` | fond de l'écran de flash (copie différée) uniquement |
| Onglet actif | `--color-peche` | `#FFE3D6` | état actif de la barre d'onglets |
| Lettres correctes | `--color-vert-clair` | `#C9F2D6` | fond des lettres validées (ex. mot reconstitué après une copie différée réussie) |

Pastels réservés au codage des matières (pastilles/badges uniquement,
jamais une action ou un état) : `--matiere-maths #FFC2D4`,
`--matiere-francais #C9BBFF`, `--matiere-histoire #B8E9D0`, et, **provisoires
depuis l'ouverture de M2** (`docs/design/tokens.md`, à valider
visuellement) : `--matiere-geographie #BDE3FF`, `--matiere-sciences #E2F0A8`,
`--matiere-anglais #F2C4F0`, `--matiere-autre #D5DCE8`. Un pastel par
valeur de la liste fermée des matières (`docs/modules/ingestion.md`,
`Subject`), dérivé à l'extraction ; le cours stocke le **nom** du token,
jamais sa valeur, pour que "uniquement les tokens" tienne jusqu'en base.

**Règle de contraste, non négociable** : texte encre sur tout fond coloré,
jamais de blanc sur mandarine — reprise mot pour mot de
`docs/design/tokens.md`.

### Forme et profondeur

- Bordure **3px solid encre** sur toute forme interactive et toute carte
  (2px sous 24px de haut, pour les petits éléments).
- Rayons : 999px pour les pastilles, 30px pour les grandes cartes, 20px
  pour les cartes, 15px pour les boutons icône.
- Ombres dures décalées, jamais de flou ni de dégradé de couleur :
  `0 Npx 0 encre`, avec N = 3 (petit élément), 4 (moyen), 5 (action
  primaire), 6 (grande carte).
- Cibles tactiles : 44px minimum, 56px pour les boutons d'action
  principale.
- Un seul élément à accent visuel fort par écran ou par carte, comme dans
  StudIA (`Forbidden`) : la mandarine attire l'œil vers une seule action à
  la fois.

### Typographie

- **Baloo 2**, graisses 700 et 800, en display (titres, boutons, chiffres
  des étoiles) — une police ronde et amicale.
- **Lexend**, graisses 400/500/600, en texte courant (texte du cours dans
  le lecteur, bulles du tuteur) — conçue pour la lisibilité, pertinente
  pour un lecteur débutant.
- Échelle de taille : 40 / 27 / 20 / 18 / 16 / 14.5 / 13 / 12 (px), reprise
  de `docs/design/tokens.md` — pas d'autre taille hors de cette échelle.
  16px est le minimum pour tout texte de lecture suivie (le corps du texte
  du cours) ; les tailles sous 14px sont réservées aux libellés courts
  (légendes, badges), jamais à une phrase à lire.

### Icônes et mouvement

- Pas d'icône seule sans intitulé visible ou sans être systématiquement
  accompagnée par une pose de la mascotte au premier usage.
- Animations ludiques autorisées et même souhaitées (la danse de la joie,
  le rebond d'une étoile gagnée) mais **`prefers-reduced-motion` respecté
  partout**, y compris pour la mascotte : une version statique de chaque
  animation doit exister.

---

## Layout et responsive

**Mobile et tablette d'abord.** Construire chaque écran à 375px de large en
premier, vérifier ensuite tablette puis desktop — l'inverse de la pratique
courante, parce que l'usage réel attendu est très majoritairement mobile ou
tablette, tenue à deux mains ou posée devant l'enfant.

Trois paliers, comme StudIA : `<768px` mobile, `768–1024px` tablette,
`>1024px` desktop. Chaque écran doit fonctionner à 375px de large.

**Quatre écrans, pas plus** : accueil, lecteur, jeux, tuteur. Ce nombre
réduit change la navigation par rapport à StudIA (sept destinations, sidebar
permanente) : ici, une **barre d'onglets en bas de l'écran**, avec icône et
libellé, visible à tous les paliers y compris desktop plutôt qu'une bascule
sidebar/barre — inutile d'ajouter une navigation différente pour desktop
quand quatre destinations tiennent confortablement dans une barre basse à
toutes les tailles. Barre fixe, jamais scrollée avec le contenu.

- **Cibles tactiles 44px minimum**, sans exception, y compris pour un
  bouton qui semble petit visuellement (l'aire cliquable dépasse alors le
  visuel, jamais l'inverse).
- Colonne unique à tous les paliers pour le contenu principal : pas de
  grille multi-colonnes dense, l'enfant doit toujours savoir où regarder.
- `env(safe-area-inset-bottom)` ajouté à la hauteur de la barre d'onglets,
  jamais fondu dedans, même mécanisme que StudIA.

### Manifeste web

L'app expose un Web App Manifest (nom, icônes à plusieurs résolutions,
`display: standalone`, couleur de thème reprise de `--color-mandarine`,
couleur de fond `--color-canvas`) pour qu'un raccourci ajouté à l'écran
d'accueil d'un téléphone ou d'une tablette lance l'app en plein écran, sans
barre d'adresse — décidé, voir `CLAUDE.md`. **Pas de service worker, pas de
mode hors ligne** : hors périmètre, explicitement, pas un oubli. L'app
reste une web app responsive classique, jamais un paquet natif.

### Navigation

Barre d'onglets, quatre destinations fixes, avec les libellés exacts vus
dans `docs/design/accueil.png` et `docs/design/tuteur.png` — **le libellé
affiché à l'enfant est un verbe, pas le nom du module technique** :

| Libellé affiché | Icône | Module technique | Contenu |
|---|---|---|---|
| **Accueil** | maison | — | la mascotte accueille, propose de photographier un cours ou d'en reprendre un |
| **Lire** | livre/tablette | `reader` | le texte du cours en cours, lecture à voix haute |
| **Jouer** | dé/manette | `game-engine` | les exercices générés pour le cours en cours |
| **Tuteur** | bulle de chat | `tutor` | le chat sur le cours en cours |

Ne pas renommer les modules `reader`/`game-engine` en "lire"/"jouer" dans le
code pour autant : ce sont des noms de module (`packages/core/src/...`),
distincts du libellé affiché sur le bouton de navigation — seul ce dernier
change.

Un cours "en cours" est celui que l'enfant vient d'ouvrir depuis l'accueil ;
Lecteur, Jeux et Tuteur restent scopés à ce cours tant qu'il n'en choisit pas
un autre depuis l'accueil. Pas de sélecteur de cours dans ces trois écrans :
revenir à l'accueil est le seul moyen d'en changer, pour ne jamais perdre
l'enfant dans une navigation à plusieurs niveaux.

### Photographier un cours (M2)

Décidé à l'ouverture de M2, pour ne pas laisser l'implémentation inventer
ce parcours :

- **Accueil** : "Salut {prénom} !", bouton principal (mandarine)
  "Photographier un cours", puis la liste des cours confirmés, titrée
  **"Mes cours"** (`docs/design/accueil.png`, décidé le 2026-09-26). Si
  le compte a un cours non confirmé (au plus un,
  `docs/modules/ingestion.md`), un bandeau au-dessus de la liste y ramène,
  avec une phrase selon son état ("Je regarde encore ta photo…", "Ta photo
  est prête !", "Oups, on reprend la photo ?" ; pour un échec technique,
  *à valider* : "Oh, quelque chose a coincé."). **Photos prises mais
  lecture jamais lancée** (l'enfant a quitté la capture avant « C'est
  tout ! », `extractionStarted: false` dans l'API) : *à valider* "Tu n'as
  pas fini tes photos. On continue ?", et le bandeau **ramène à la
  capture** de ce cours, ses pages déjà prises affichées — jamais à un
  écran d'attente où rien ne tourne. Prendre une nouvelle photo
  remplace ce cours en attente. **"Se déconnecter" reste sur l'accueil,
  discret** (petit bouton texte en bas, jamais à côté de l'action
  principale), bien que la maquette ne le montre pas.
- **Capture** : après chaque photo, les miniatures des pages déjà prises,
  et deux boutons — "Une autre page" (turquoise, secondaire) et "C'est
  tout !" (mandarine, principal). **"Une autre page" disparaît à la
  cinquième page** (plafond de 5). "C'est tout !" lance la lecture des
  photos. Chaque photo est **toujours réencodée par le navigateur**
  (canvas, JPEG qualité 0,85, à la taille renvoyée par `nativePhotoSize` de
  `packages/contracts`) avant envoi, jamais le fichier d'origine :
  c'est ce qui redresse la photo et retire ses métadonnées
  (`docs/modules/ingestion.md`).
- **Attente** : mascotte `waiting` + phrase courte, l'enfant peut revenir
  à l'accueil à tout moment (le bandeau le ramènera).
- **Photo inexploitable** : mascotte `sorry`, une phrase selon le cas
  (floue / pas une page de cours), un seul bouton "Je reprends la photo".
- **Échec technique** (`failed`, après épuisement des tentatives) :
  mascotte `glitch`, phrase du catalogue (`extraction-failed` :
  "Oh, quelque chose a coincé. On réessaie ?"), un bouton principal
  **"On réessaie"** qui relance la lecture (`POST .../retry`) et un bouton
  secondaire "Je reprends la photo" — *libellés des boutons à valider*.
- **Validation** : la photo, le titre et la matière proposés, le niveau du
  compte (jamais deviné), "Oui, c'est ça !" / "Je reprends la photo".
- **Cours remplacé entre-temps** (un écran redemande un cours non
  confirmé que le compte a remplacé par une nouvelle photo, l'API répond
  404) : **retour silencieux à l'accueil, sans message** (décidé le
  2026-09-26).
- **Refus d'une photo à l'envoi** (capture), phrases portées par la
  mascotte `sorry`, *toutes à valider* : trop lourde (`too_large`) "Cette
  photo est trop lourde. On en prend une autre ?" ; pas une photo
  utilisable (`unsupported`) "Je n'arrive pas à ouvrir cette photo. On en
  prend une autre ?" ; déjà prise (`duplicate`) "Tu as déjà pris cette
  page !" ; échec de l'envoi lui-même (réseau, erreur inattendue),
  mascotte `glitch` : "Oh, la photo n'est pas partie. On réessaie ?".
- **Autres textes introduits par l'implémentation (M2), *à valider*** :
  chargement de l'accueil, mascotte `waiting` : "Je cherche tes cours…" ;
  erreur de l'accueil, mascotte `glitch` : "Oh, quelque chose a coincé. On
  réessaie ?" avec un bouton "Réessaie" (celui de la vérification de
  session, M1) ; envoi d'une photo en cours, sur l'écran de capture :
  "J'envoie ta photo…" ; sur l'écran d'attente, le lien discret
  "Retour à l'accueil" ; titre de repli d'un cours dont ni le modèle ni la
  page ne donnent un titre utilisable : "Mon cours".
- **Cartes de "Mes cours" en M2** : affichées comme des boutons mais sans
  action (`aria-disabled`) — il n'y a rien à ouvrir avant le lecteur (M3).

Pas de barre d'onglets en M2 : seul l'accueil existe. Pas de routeur non
plus (navigation par état d'écran, comme StudIA et M1).

### Lire un cours et créer ses jeux (M3)

Décidé à l'ouverture de M3, en l'absence de maquette du lecteur (textes
*à valider*) :

- **Carte de "Mes cours"** : un appui ouvre le lecteur ; la carte montre
  le nombre de jeux prêts ("12 jeux prêts", `docs/design/accueil.png`)
  quand il y en a.
- **Lecteur** : bouton **« Écouter »** en haut (devient **« Stop »**
  pendant la lecture) — la voix ne démarre **jamais d'office**, seulement
  au premier appui de l'enfant ; le texte du cours (18 px) ; les photos
  du cours en vignettes, agrandies d'un appui ; en bas, **« Créer mes
  jeux »** et un bouton **« Accueil »**. La barre d'onglets arrive avec
  l'écran « Jouer » (M4), le seul autre écran qui en aurait besoin.
- **Création des jeux** (`docs/modules/exercise-generator.md`), portée par
  la mascotte, phrases du catalogue :
  - en cours : `waiting`, « Je prépare tes jeux… », et l'avancement en
    types de jeu (« 2 sur 5 »), sans pourcentage inventé ;
  - prêts : `joy`, « Tes jeux sont prêts ! » ;
  - cours trop court : `sorry`, « Cette photo est un peu courte pour faire
    des jeux. On en prend une autre ? » ;
  - échec technique : `glitch`, phrase du catalogue, bouton « On
    réessaie ».
- L'enfant peut quitter le lecteur pendant la création : elle continue,
  et la carte de l'accueil montre les jeux prêts à son retour.

Textes ajoutés à l'implémentation, **validés le 2026-09-26** : « J'ouvre
ton cours… » (chargement du lecteur), « Fermer » (photo agrandie), « 2 sur
5 » (avancement), « Prendre une autre photo » (cours trop court), « 12 jeux
prêts » / « 1 jeu prêt » (carte). La pose `joy` est dessinée depuis M3,
recopiée de `docs/design/mascotte-etats.html`.

---

## Travail asynchrone

L'extraction d'une photo et la génération d'exercices prennent du temps.
Mêmes règles que StudIA, avec un langage adapté à l'enfant :

- **Rien ne bloque jamais l'interface sur un job.** L'enfant peut quitter
  l'écran et revenir.
- **Jamais un écran blanc avec une roue qui tourne, sans texte ni
  mascotte.** Toujours une pose de mascotte (`waiting`, cf. "La mascotte"
  ci-dessous) plus une phrase courte : "Je regarde ta photo…", "Je prépare
  tes jeux…".
- **Progression honnête** : pas de pourcentage inventé. Une animation qui
  suggère une activité en cours (la mascotte qui tourne une page) suffit.
- **Rien n'est optimiste sur du contenu généré.** Le titre/matière/niveau
  proposés à la validation, les jeux générés : jamais affichés comme
  acquis avant que le job ne soit réellement terminé.

Sondage de statut : TanStack Query avec `refetchInterval` tant que le
statut n'est pas terminal, ralenti après 30 secondes — mécanisme recopié de
StudIA tel quel.

**Relances** (décidé en M2, 2026-09-26) : **une seule relance** d'une
requête en échec, **aucune sur un 404** (un cours remplacé entre-temps est
une réponse, pas une panne) — l'écran d'erreur arrive après environ une
seconde, pas sept (`apps/web/src/lib/query-client.ts`).

---

## États requis

Chaque écran qui charge des données implémente quatre états. Un écran qui
en oublie un est incomplet, et son scénario Playwright doit couvrir les
quatre.

**Exception documentée (décidée le 2026-09-26) : le lecteur n'a pas
d'état vide**, parce que cet état est impossible par construction. Le
lecteur ne s'ouvre que sur un cours confirmé, et un cours n'est confirmable
que si sa lecture est `ready` avec un texte extrait ; sinon l'API répond
`409 not_ready`, et c'est l'état d'erreur qui s'affiche
(`docs/modules/reader.md`). Les trois autres états sont implémentés et
testés.

| État | Règle |
|---|---|
| Chargement | Mascotte + une phrase courte sur ce qui se passe. Jamais une roue centrée sans texte. |
| Vide | Mascotte + une invitation à agir, avec l'action directement accessible. Jamais "Aucun résultat". |
| Erreur | Ce qui s'est passé, en langage d'enfant, et quoi faire — jamais un code d'erreur brut, jamais un ton qui gronde. |
| Prêt | Le cas normal |

---

## La mascotte

La mascotte incarne l'application entière : elle accueille sur l'écran
d'accueil, réagit dans le lecteur et les jeux, et accompagne le tuteur.

**Liste fermée de sept poses, décidée** : `idle`, `watching`, `waiting`,
`joy`, `sorry`, `glitch`, `refusal`. Les quatre premières ont une
référence SVG existante à reprendre littéralement
(`docs/design/mascotte-etats.html` — un fruit rond jaune/mandarine, une
feuille verte, deux yeux, des joues roses). Les trois dernières sont
spécifiées sémantiquement ci-dessous ; `sorry` et `glitch` ont des
brouillons provisoires depuis M2 (décision validée, dette notée dans
`docs/jalons.md`), leur dessin définitif et celui de `refusal` restent à
ajouter dans `docs/design/`. Voir
`docs/glossaire.md` pour la correspondance avec les noms de pose utilisés
en prose ci-dessous (repos, observation, écoute...).

| Pose | Description | Référence |
|---|---|---|
| `idle` | Yeux ouverts, sourire calme, bras relâchés. Respiration légère en boucle. | Dessinée |
| `watching` | Pendant l'affichage d'un mot en dictée flash : yeux agrandis, bouche en "o", bras levé, corps penché — la mascotte regarde le mot avec l'enfant. | Dessinée |
| `waiting` | Pendant que l'enfant écrit ou réfléchit, ou que l'app prépare quelque chose : yeux fermés, sourire calme, bras relâchés. | Dessinée |
| `joy` | Bonne réponse ou réussite : bras levés, yeux fermés, bouche ouverte, pieds décollés, deux sauts. | Dessinée |
| `sorry` | Photo détectée inexploitable (illisible, ou pas une page de cours) avant génération — un "oups" doux, jamais une faute de l'enfant. | Brouillon provisoire (M2), dérivé des tracés d'`idle` ; dessin définitif attendu dans `docs/design/` (dette, `docs/jalons.md`) |
| `glitch` | Échec technique réel, après épuisement des tentatives — distincte de `sorry` : ceci est un vrai problème, pas un résultat métier normal. | Idem |
| `refusal` | Le tuteur ne peut pas répondre à une question hors cours. | À dessiner avant M6 |

**Règle de robustesse.** Un état de mascotte inconnu ou non reconnu par le
composant rend toujours `idle`, jamais un écran vide, jamais une erreur
visible — voir `docs/modules/mascot.md` pour la fonction de domaine qui
applique cette règle avant même d'atteindre le composant.

**Il n'y a pas de huitième pose "détresse".** Le rendu de cette issue du
tuteur est spécifié dans `docs/modules/tutor.md` ("Rendu de l'issue
distress") : ce n'est pas une pose de la mascotte parmi les sept, c'est un
bloc hors du fil normal de la conversation.

### L'avatar dans le chat du tuteur — arbitré

`docs/design/tuteur.png` montre le médaillon de la mascotte accolé à
chaque réponse du tuteur. **Décidé : l'avatar reste.** Une version
précédente de ce document avait signalé un conflit avec le principe "la
mascotte n'est jamais une persona conversationnelle" — le conflit était
apparent, pas réel : ce principe porte sur ce que le **texte généré**
énonce (`docs/securite.md`, "Contraintes sur le texte généré"), jamais sur
la représentation visuelle de la mascotte. Un médaillon reconnaissable à
côté de chaque réponse est une question de branding, sans incidence sur la
sécurité tant que le texte respecte les contraintes de
`docs/securite.md`. Voir `docs/modules/tutor.md` pour le contrat d'affichage.

### Règles

- **SVG plat, jamais de rendu 3D ni d'image importée.** Les tracés de
  `docs/design/mascotte-etats.html` ne doivent pas être redessinés pour les
  quatre poses qu'il couvre déjà.
- La mascotte est décorative au sens de l'accessibilité : `aria-hidden`, et
  l'état qu'elle illustre est toujours aussi écrit en texte visible à côté.
- **Une seule mascotte à l'écran maximum**, sauf l'avatar de chat du
  tuteur qui peut apparaître une fois par message (un médaillon répété,
  pas plusieurs mascottes simultanées au sens de cette règle).
- La mascotte ne commente jamais la performance de l'enfant de façon
  négative. Sur un échec de jeu, sa pose reste calme et encourageante,
  jamais triste ni déçue : il n'existe et il ne doit pas exister de pose
  "mascotte triste" — `sorry` et `glitch` qualifient un problème du
  système (une photo, une panne technique), jamais une faute de l'enfant.

### Contrat d'API du composant

```ts
type MascotPose = "idle" | "watching" | "waiting" | "joy" | "sorry" | "glitch" | "refusal";

interface MascotProps {
  pose: MascotPose;
  size?: "sm" | "md" | "lg" | "avatar";  // "avatar" : médaillon rond dans le chat du tuteur
}
```

Une pose par fichier (`Idle.tsx`, `Watching.tsx`, `Waiting.tsx`,
`Joy.tsx`, `Sorry.tsx`, `Glitch.tsx`, `Refusal.tsx`), SVG `viewBox` fixe,
`aria-hidden="true"`, `focusable="false"`, `data-testid="mascot"` — même
structure que StudIA pour `Fiche`. Le composant lui-même applique la règle
de robustesse ci-dessus : une valeur de `pose` non reconnue au runtime
(un état ajouté ailleurs sans mise à jour de ce composant) rend `Idle`,
jamais une exception ni un élément vide.

### Table de correspondance signal → pose

| Signal applicatif | Pose | Note |
|---|---|---|
| Accueil, avec ou sans cours | `idle` | La différence se fait par le texte de la bulle ("Aucun cours pour l'instant, on en photographie un ?"), pas par le dessin |
| Extraction d'une photo en cours | `waiting` | Réutilise l'attente calme |
| Génération d'exercices en cours, tuteur qui prépare sa réponse | `waiting` | Idem |
| Affichage du mot en dictée flash | `watching` | Déjà dessinée (`flash.png`) |
| Saisie de la réponse en dictée flash, ou toute saisie libre | `waiting` | Déjà dessinée (`saisie.png`) |
| Photo détectée illisible, ou pas une page de cours | `sorry` | Résultat métier normal, jamais une faute de l'enfant ; les deux cas se distinguent par la phrase, pas par le dessin |
| Échec technique réel | `glitch` | Distincte de `sorry` — un vrai problème, pas une photo floue |
| Bonne réponse à un jeu, série, fin de session | `joy` | Une seule pose de joie ; une réponse simple et un bonus de série se différencient par la phrase et l'intensité de l'animation, pas par un second dessin |
| Réponse incorrecte à un jeu | `waiting` | Décision délibérée de réutiliser une pose calme plutôt qu'une huitième pose ; jamais `sorry`/`glitch`, qui qualifient un problème du système, pas une réponse d'enfant |
| Refus du tuteur (question hors cours) | `refusal` | |

Voir `docs/modules/mascot.md` pour la table de décision complète
(source de vérité pour l'implémentation) — celle-ci n'en est qu'un miroir.

---

## Copie

Français, tutoiement, phrases courtes, vocabulaire concret. Jamais de
jargon technique visible ("extraction", "job", "génération" ne doivent
jamais apparaître à l'écran — utiliser "je regarde ta photo", "je prépare
tes jeux"). Jamais d'anglicisme d'interface ("Login", "Submit").

---

## Accessibilité

- Focus clavier visible partout (utile pour un usage tablette avec clavier
  externe ou pour un enfant en situation de handicap moteur) — jamais
  `outline: none` sans remplacement.
- Contraste AA sur tout le texte, y compris l'encre sur les aplats
  mandarine et turquoise (à vérifier explicitement, cf. Couleur ci-dessus).
- `prefers-reduced-motion` respecté, y compris pour la danse de la joie.
- Chaque champ a un vrai `<label>` — un placeholder n'en est pas un
  (pertinent essentiellement pour le champ de copie différée, seul champ de
  saisie libre de l'app).
- La mascotte est `aria-hidden` et n'est jamais l'unique porteuse d'un sens
  qui ne serait pas aussi écrit.

---

## Interdits

- Tout élément qui implique qu'un enfant est en retard, en échec, ou moins
  bon qu'un autre
- Toute perte d'étoile, tout compte à rebours anxiogène
- Modales pour autre chose qu'une confirmation courte
- Carrousels, infinite scroll
- Dégradés, ombres colorées, glassmorphism
- Plus d'un élément à accent visuel fort par écran ou par carte
- Boutons icône seule sans libellé accessible
- Toute couleur hors du jeu de tokens
- Un texte généré qui fait dire à la mascotte qu'elle pense, ressent, ou
  est une personne (`docs/securite.md`, "Contraintes sur le texte généré")
- Un écran qui dépend d'un texte que l'enfant du niveau le plus bas ciblé
  (CP) ne peut pas comprendre sans lecture

---

## Pour les agents

- shadcn/ui reste la base de composants, restylée via les tokens — jamais
  de fork d'un composant pour changer une couleur.
- Nouveaux composants partagés dans `apps/web/src/components/ui/`, poses de
  mascotte dans `apps/web/src/components/mascot/`. Annoncez l'un ou
  l'autre dans votre message : ce sont les points de collision entre agents
  parallèles.
- Si un écran a besoin d'un motif d'interaction non décrit ici, arrêtez-vous
  et demandez. N'inventez pas un modèle d'interaction en laissant l'humain
  le découvrir en revue.
- Avant d'ajouter une pose ou un écran, vérifiez qu'il ne viole pas la
  règle "aucune perte, jamais de jugement" de `CLAUDE.md`.
