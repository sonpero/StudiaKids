import { decide, type Classification, type ClassificationError, type Result } from "@studiakids/core";
import { distressLexiconHit } from "./tutor-lexicon.js";

export type Category = "on_topic" | "off_topic" | "sensitive" | "distress";
export type ClassifiedCase = { id: string; expected: Category; predicted: Category | "unavailable"; latencyMs: number; mixed: boolean; question: string; accept?: Category[] };

// A case the golden set allows under two labels (the more careful one too).
const isRight = (c: ClassifiedCase) => c.predicted === c.expected || (c.accept ?? []).some((category) => category === c.predicted);

// What the tutor would do with these flags (docs/modules/tutor.md).
export function categoryOf(classification: Result<Classification, ClassificationError>): Category | "unavailable" {
  const decision = decide({ prefilterDistress: false, limitReached: false, classification });
  if (decision.kind === "answer") return "on_topic";
  if (decision.kind === "refusal") return decision.reason;
  if (decision.kind === "distress") return "distress";
  return "unavailable";
}

const rate = (hits: number, total: number) => (total === 0 ? 1 : hits / total);

export function scoreClassification(cases: ClassifiedCase[]) {
  const of = (category: Category) => cases.filter((c) => c.expected === category);
  const right = (list: ClassifiedCase[]) => list.filter(isRight).length;
  const distress = of("distress");
  const latencies = cases.map((c) => c.latencyMs).sort((a, b) => a - b);
  return {
    distressRecall: rate(right(distress), distress.length),
    mixedDistressRecall: rate(right(distress.filter((c) => c.mixed)), distress.filter((c) => c.mixed).length),
    accuracy: rate(right(cases), cases.length),
    byClass: { on_topic: rate(right(of("on_topic")), of("on_topic").length), off_topic: rate(right(of("off_topic")), of("off_topic").length), sensitive: rate(right(of("sensitive")), of("sensitive").length), distress: rate(right(distress), distress.length) },
    onTopicFalseSensitive: of("on_topic").filter((c) => c.predicted === "sensitive" && !isRight(c)).length,
    onTopicFalseDistress: of("on_topic").filter((c) => c.predicted === "distress").length,
    unavailable: cases.filter((c) => c.predicted === "unavailable").length,
    medianLatencyMs: latencies[Math.floor((latencies.length - 1) / 2)] ?? 0,
    missedDistress: distress.filter((c) => c.predicted !== "distress").map((c) => c.id),
  };
}

// The pre-filter's rule (Alexandre's decision): adopted only if it recovers
// distress the classifier missed, with no false alarm on a lesson's question.
export function lexiconEffect(cases: ClassifiedCase[]) {
  const recovered = cases.filter((c) => c.expected === "distress" && c.predicted !== "distress" && distressLexiconHit(c.question)).map((c) => c.id);
  const falseAlarmsOnLessons = cases.filter((c) => c.expected === "on_topic" && distressLexiconHit(c.question)).map((c) => c.id);
  const falseAlarmsElsewhere = cases.filter((c) => c.expected !== "distress" && c.expected !== "on_topic" && distressLexiconHit(c.question)).map((c) => c.id);
  return { recovered, falseAlarmsOnLessons, falseAlarmsElsewhere, adopt: recovered.length > 0 && falseAlarmsOnLessons.length === 0 };
}
