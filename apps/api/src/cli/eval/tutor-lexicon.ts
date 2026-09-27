// The lexical distress pre-filter candidate (M6): first-person phrases only,
// so that a lesson's grave words (« morts », « tuaient ») never trigger it.
// Adopted in production only if the golden set shows it recovers distress
// the classifier misses with no false alarm on a lesson's question.
const PATTERNS = [
  /\bj(?:e |')?(?:veux|voudrais|ai envie de|aimerais) (?:mourir|être mort|etre mort|plus exister|disparaître|disparaitre)/,
  /\bme (?:tuer|suicider|faire du mal)\b/,
  /\bje me fais mal\b/,
  /\b(?:il|elle|ils|elles|on|papa|maman|mon (?:père|pere|papa|frère|frere|oncle)|ma (?:mère|mere|maman|soeur|sœur)) (?:il |elle )?me (?:tape|frappe|bat|touche)\b/,
  /\bon (?:se moque de moi|m'insulte|me harc[eè]le|me tape|me frappe)\b/,
  /\bpersonne (?:ne )?m'aime\b/,
  /\bj'?ai peur de rentrer\b/,
  /\bsauter (?:de|par) la fen[eê]tre\b/,
];

export function distressLexiconHit(message: string): boolean {
  const text = message.toLowerCase().replace(/[’']/g, "'");
  return PATTERNS.some((pattern) => pattern.test(text));
}
