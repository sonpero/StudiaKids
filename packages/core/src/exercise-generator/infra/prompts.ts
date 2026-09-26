import type { GameType } from "../domain/game-types.js";

// Versioned: every evaluation score names the prompts it measured
// (tests/eval/, docs/modules/exercise-generator.md). Bump on any change.
export const PROMPTS_VERSION = "1";

export const ANCHORING_RULE =
  "Règle d'ancrage, avant toute autre : chaque exercice, réponse comprise, doit se vérifier dans le texte de la leçon. " +
  "N'ajoute aucun fait, aucun ordre, aucun exemple qui n'est pas dans la leçon.";

export function splitPrompt(grade: string, markdown: string): string {
  return (
    `Voici le texte d'une leçon d'un élève de ${grade}. Découpe-la en items : chaque item est une petite chose à apprendre ` +
    "(une définition, une règle, un exemple, un mot à savoir écrire). Le corps d'un item recopie la leçon, sans rien ajouter. " +
    "Pour chaque item, choisis 1 à 3 types de jeu, seulement ceux dont l'exercice pourra se vérifier dans le texte de la leçon : " +
    "mental_math seulement si la leçon fait elle-même un calcul avec son résultat ; reordering seulement si la leçon donne une suite dans un ordre précis ; " +
    "matching pour des paires que la leçon associe ; delayed_copy pour un mot ou une courte phrase de la leçon à savoir écrire ; " +
    "cloze pour une phrase de la leçon dont un mot important est à retrouver ; mcq et true_false pour une connaissance que la leçon énonce. " +
    "Entre 8 et 40 items quand la leçon le permet ; n'invente rien pour en avoir plus. Si la leçon a plusieurs titres #, c'est quand même une seule leçon.\n\n" +
    markdown
  );
}

const TYPE_RULES: Record<GameType, string> = {
  mcq: "une question, exactement 4 options différentes, la bonne réponse recopiée mot pour mot de la leçon et identique à l'une des options ; les 3 autres options sont plausibles mais fausses.",
  true_false:
    "une phrase affirmative courte, vraie ou fausse d'après la leçon ; la phrase ne dit jamais si elle est vraie ou fausse (jamais « vrai », « faux », « c'est vrai »).",
  cloze:
    "une phrase de la leçon où un ou deux mots importants sont remplacés par {{0}}, {{1}} ; les réponses sont les mots de la leçon ; jamais de trou sur un mot sans importance ; aucune phrase ajoutée autour.",
  matching: "3 à 6 paires que la leçon associe elle-même, chaque élément recopié de la leçon.",
  reordering: "3 à 6 éléments recopiés de la leçon, dans l'ordre où la leçon les donne, seulement si la leçon donne vraiment cet ordre.",
  delayed_copy: "un mot ou une phrase de 6 mots au plus, recopié tel quel de la leçon, qu'un enfant doit savoir écrire.",
  mental_math: "un calcul que la leçon fait elle-même, avec ses nombres, et son résultat numérique exact.",
};

export function generationPrompt(type: GameType, grade: string, markdown: string, items: { title: string; body: string }[]): string {
  const list = items.map((item, index) => `${String(index)}. ${item.title}\n${item.body}`).join("\n\n");
  return (
    `${ANCHORING_RULE}\n\n` +
    `Crée un exercice de type « ${type} » pour chaque item de la liste ci-dessous, tirée d'une leçon d'un élève de ${grade} : ${TYPE_RULES[type]} ` +
    "Écris en français, avec des phrases courtes et des mots d'enfant, sans bavardage. Chaque exercice indique le numéro de son item. " +
    "Si un item ne permet pas un exercice qui respecte la règle d'ancrage, ne crée pas d'exercice pour lui.\n\n" +
    `Leçon :\n${markdown}\n\nItems :\n${list}`
  );
}
