// Scores of one evaluation run (docs/modules/exercise-generator.md,
// "Évaluation"): anchoring first, then answer leaks, chatty blanks,
// variety, validity and coverage.

export type ExerciseRecord = {
  type: string;
  shapeOk: boolean; // parseExercise accepted it
  mechanical: string | null; // anchoringProblem, when the shape was fine
  judge: { anchored: boolean; chatty: boolean } | null; // null: not judged
};

export type CaseRun = {
  id: string;
  calc: boolean;
  short: boolean;
  outcome: "items_ready" | "insufficient_coverage";
  itemCount: number;
  exercises: ExerciseRecord[];
  costUsd: number;
};

export type CaseScore = {
  id: string;
  coverageOk: boolean;
  exercises: number;
  shapeValid: number;
  anchored: number;
  anchoring: number;
  validity: number;
  trueFalse: number;
  trueFalseLeaked: number;
  trueFalseLeaks: number;
  cloze: number;
  clozeChatty: number;
  chattyCloze: number;
  types: number;
  mcqShare: number;
  mentalMath: boolean | null;
  costUsd: number;
};

const rate = (part: number, whole: number) => (whole === 0 ? 0 : part / whole);
const isLeak = (record: ExerciseRecord) => record.type === "true_false" && (record.mechanical ?? "").includes("donne sa réponse");

export function scoreCase(run: CaseRun): CaseScore {
  const shapeValid = run.exercises.filter((e) => e.shapeOk);
  const anchored = shapeValid.filter((e) => e.mechanical === null && (e.judge === null || e.judge.anchored));
  const trueFalse = shapeValid.filter((e) => e.type === "true_false");
  const cloze = shapeValid.filter((e) => e.type === "cloze");
  const clozeChatty = cloze.filter((e) => e.judge?.chatty === true);
  const types = new Set(shapeValid.map((e) => e.type));
  return {
    id: run.id,
    coverageOk: run.short ? run.outcome === "insufficient_coverage" : run.outcome === "items_ready",
    exercises: run.exercises.length,
    shapeValid: shapeValid.length,
    anchored: anchored.length,
    anchoring: rate(anchored.length, shapeValid.length),
    validity: rate(shapeValid.filter((e) => e.mechanical === null).length, run.exercises.length),
    trueFalse: trueFalse.length,
    trueFalseLeaked: trueFalse.filter(isLeak).length,
    trueFalseLeaks: rate(trueFalse.filter(isLeak).length, trueFalse.length),
    cloze: cloze.length,
    clozeChatty: clozeChatty.length,
    chattyCloze: rate(clozeChatty.length, cloze.length),
    types: types.size,
    mcqShare: rate(shapeValid.filter((e) => e.type === "mcq").length, shapeValid.length),
    mentalMath: run.calc ? types.has("mental_math") : null,
    costUsd: run.costUsd,
  };
}

// Rates pooled over all exercises, not averaged over cases.
export function aggregate(scores: CaseScore[]) {
  const sum = (pick: (score: CaseScore) => number) => scores.reduce((total, score) => total + pick(score), 0);
  const calc = scores.filter((score) => score.mentalMath !== null);
  return {
    cases: scores.length,
    exercises: sum((s) => s.exercises),
    anchoring: rate(sum((s) => s.anchored), sum((s) => s.shapeValid)),
    validity: rate(sum((s) => s.validity * s.exercises), sum((s) => s.exercises)),
    trueFalseLeaks: rate(sum((s) => s.trueFalseLeaked), sum((s) => s.trueFalse)),
    chattyCloze: rate(sum((s) => s.clozeChatty), sum((s) => s.cloze)),
    meanTypes: rate(sum((s) => s.types), scores.length),
    mcqShare: rate(sum((s) => s.mcqShare * s.shapeValid), sum((s) => s.shapeValid)),
    calcLessonsWithMentalMath: `${String(calc.filter((s) => s.mentalMath === true).length)}/${String(calc.length)}`,
    coverageMistakes: scores.filter((s) => !s.coverageOk).length,
    costUsd: sum((s) => s.costUsd),
  };
}

// claude-sonnet-5 (Anthropic pricing, checked at M3's opening).
export function costUsd(tokens: { input: number; output: number }): number {
  return (tokens.input * 2 + tokens.output * 10) / 1_000_000;
}
