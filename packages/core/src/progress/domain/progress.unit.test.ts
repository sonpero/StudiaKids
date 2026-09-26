import { describe, expect, it } from "vitest";
import { calendarDay, deriveProgress, PROGRESS_TIME_ZONE, STREAK_BONUS_THRESHOLD, summarizeSince, type AttemptEvent } from "./progress.js";

// docs/modules/progress.md (rewritten at M5's opening): stars, streak and
// bonus are a pure function of the attempts; the time zone is the only
// outside parameter.
const PARIS = PROGRESS_TIME_ZONE;
const right = (exerciseId: string, at: string, units = 1): AttemptEvent[] => Array.from({ length: units }, () => ({ exerciseId, attemptedAt: at, correct: true, starEligible: true }));
const wrong = (exerciseId: string, at: string): AttemptEvent[] => [{ exerciseId, attemptedAt: at, correct: false, starEligible: true }];
const helped = (exerciseId: string, at: string, correct = true): AttemptEvent[] => [{ exerciseId, attemptedAt: at, correct, starEligible: false }];
const at = (minute: number) => `2026-01-15T10:${String(minute).padStart(2, "0")}:00.000Z`;
const total = (events: AttemptEvent[]) => deriveProgress(events, PARIS).total;
const starsOf = (events: AttemptEvent[]) => deriveProgress(events, PARIS).submissions.map((s) => s.stars);

describe("calendarDay", () => {
  it("is the day in Paris, not in UTC", () => {
    expect(calendarDay("2026-01-15T22:59:00.000Z", PARIS)).toBe("2026-01-15");
    expect(calendarDay("2026-01-15T23:00:00.000Z", PARIS)).toBe("2026-01-16");
    expect(calendarDay("2026-07-01T21:59:00.000Z", PARIS)).toBe("2026-07-01");
    expect(calendarDay("2026-07-01T22:00:00.000Z", PARIS)).toBe("2026-07-02");
    expect(calendarDay("2026-01-15T23:00:00.000Z", "UTC")).toBe("2026-01-15");
  });
});

describe("stars on replay: one at the first success, then at most one more per exercise and Paris day", () => {
  it("the first eligible success earns a star; the same exercise again that day, none; the next day, one", () => {
    expect(starsOf([...right("e1", at(0)), ...right("e1", at(5)), ...right("e1", "2026-01-16T10:00:00.000Z")])).toEqual([1, 0, 1]);
  });

  it("each exercise has its own daily star", () => {
    expect(starsOf([...right("e1", at(0)), ...right("e2", at(1)), ...right("e1", at(2)), ...right("e2", at(3))])).toEqual([1, 1, 0, 0]);
  });

  it("winter: 23:59 and 00:00 in Paris are two days, even on the same UTC day", () => {
    expect(starsOf([...right("e1", "2026-01-15T22:59:00.000Z"), ...right("e1", "2026-01-15T23:00:00.000Z")])).toEqual([1, 1]);
    expect(starsOf([...right("e1", "2026-01-15T23:00:00.000Z"), ...right("e1", "2026-01-16T22:59:00.000Z")])).toEqual([1, 0]);
  });

  it("summer: 23:59 and 00:00 in Paris are two days; one Paris day over two UTC days is one", () => {
    expect(starsOf([...right("e1", "2026-07-01T21:59:00.000Z"), ...right("e1", "2026-07-01T22:00:00.000Z")])).toEqual([1, 1]);
    expect(starsOf([...right("e1", "2026-07-01T22:30:00.000Z"), ...right("e1", "2026-07-02T10:00:00.000Z")])).toEqual([1, 0]);
  });

  it("the spring night the clocks go forward (29 March 2026)", () => {
    expect(starsOf([...right("e1", "2026-03-28T22:59:00.000Z"), ...right("e1", "2026-03-28T23:00:00.000Z")])).toEqual([1, 1]);
    expect(starsOf([...right("e2", "2026-03-28T23:00:00.000Z"), ...right("e2", "2026-03-29T21:59:00.000Z"), ...right("e2", "2026-03-29T22:00:00.000Z")])).toEqual([1, 0, 1]);
  });

  it("the autumn night the clocks go back (25 October 2026)", () => {
    expect(starsOf([...right("e1", "2026-10-24T21:59:00.000Z"), ...right("e1", "2026-10-24T22:00:00.000Z")])).toEqual([1, 1]);
    expect(starsOf([...right("e2", "2026-10-24T22:00:00.000Z"), ...right("e2", "2026-10-25T22:59:00.000Z"), ...right("e2", "2026-10-25T23:00:00.000Z")])).toEqual([1, 0, 1]);
  });
});

describe("what is a success", () => {
  it("an answer is its units: every unit right is a success, one wrong unit is a wrong answer", () => {
    const progress = deriveProgress([...right("e1", at(0), 4), ...right("e2", at(1), 3), ...wrong("e2", at(1))], PARIS);
    expect(progress.submissions.map((s) => [s.exerciseId, s.correct, s.stars])).toEqual([
      ["e1", true, 1],
      ["e2", false, 0],
    ]);
    expect(progress.total).toBe(1);
  });

  it("a wrong or helped unit spoils the answer wherever it comes among its units", () => {
    const wrongFirst = deriveProgress([...wrong("e1", at(0)), ...right("e1", at(0), 2)], PARIS);
    expect(wrongFirst.submissions.map((s) => s.correct)).toEqual([false]);
    const helpedFirst = deriveProgress([...helped("e1", at(0)), ...right("e1", at(0))], PARIS);
    expect(helpedFirst.submissions.map((s) => [s.eligible, s.stars])).toEqual([[false, 0]]);
  });

  it("a helped answer (after a reread) earns nothing, and neither extends nor breaks the streak", () => {
    const events = [...right("a", at(0)), ...right("b", at(1)), ...helped("c", at(2)), ...helped("d", at(3), false), ...right("e", at(4))];
    const progress = deriveProgress(events, PARIS);
    expect(progress.submissions.map((s) => s.stars)).toEqual([1, 1, 0, 0, 1]);
    expect(progress.currentStreak).toBe(3);
    expect(progress.total).toBe(3);
  });
});

describe("streak and bonus", () => {
  const exercises = (n: number, start = 0) => Array.from({ length: n }, (_, i) => right(`x${String(start + i)}`, at(start + i))).flat();

  it("a bonus star exactly at the 5th and the 10th right answer in a row, never before, never twice", () => {
    expect(STREAK_BONUS_THRESHOLD).toBe(5);
    const progress = deriveProgress(exercises(11), PARIS);
    expect(progress.submissions.map((s) => s.bonus)).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
    expect(progress.total).toBe(13);
    expect(progress.currentStreak).toBe(11);
  });

  it("a wrong answer resets the streak to zero without taking anything back", () => {
    const events = [...exercises(4), ...wrong("y", at(20)), ...exercises(4, 30)];
    const progress = deriveProgress(events, PARIS);
    expect(progress.submissions.map((s) => s.bonus)).not.toContain(1);
    expect(progress.total).toBe(8);
    expect(progress.currentStreak).toBe(4);
    expect(progress.bestStreak).toBe(4);
  });

  it("a right answer already rewarded today extends the streak, and can bring the bonus", () => {
    const events = [...right("e1", at(0)), ...right("e1", at(1)), ...right("e1", at(2)), ...right("e1", at(3)), ...right("e1", at(4))];
    const progress = deriveProgress(events, PARIS);
    expect(progress.submissions.map((s) => [s.stars, s.bonus])).toEqual([
      [1, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 1],
    ]);
    expect(progress.currentStreak).toBe(5);
    expect(progress.total).toBe(2);
  });

  it("the best streak remembers the longest run", () => {
    const progress = deriveProgress([...exercises(3), ...wrong("y", at(20)), ...exercises(2, 30)], PARIS);
    expect([progress.currentStreak, progress.bestStreak]).toEqual([2, 3]);
  });
});

describe("celebrations", () => {
  it("a streak bonus is celebrated", () => {
    const progress = deriveProgress(Array.from({ length: 5 }, (_, i) => right(`x${String(i)}`, at(i))).flat(), PARIS);
    expect(progress.submissions.map((s) => s.celebrate)).toEqual([null, null, null, null, "streak-bonus"]);
  });

  it("the first success of an exercise first missed is a comeback; a second success is not", () => {
    const progress = deriveProgress([...wrong("e1", at(0)), ...wrong("e1", at(1)), ...right("e1", at(2)), ...wrong("e1", "2026-01-16T10:00:00.000Z"), ...right("e1", "2026-01-16T10:01:00.000Z")], PARIS);
    expect(progress.submissions.map((s) => s.celebrate)).toEqual([null, null, "comeback", null, null]);
  });

  it("a comeback that also brings the streak bonus is celebrated as the bonus", () => {
    const events = [...wrong("e5", at(0)), ...Array.from({ length: 4 }, (_, i) => right(`x${String(i)}`, at(1 + i))).flat(), ...right("e5", at(9))];
    expect(deriveProgress(events, PARIS).submissions.at(-1)?.celebrate).toBe("streak-bonus");
  });

  it("a first-time success is not a comeback, nor is a success after a helped miss only", () => {
    const progress = deriveProgress([...right("e1", at(0)), ...helped("e2", at(1), false), ...right("e2", at(2))], PARIS);
    expect(progress.submissions.map((s) => s.celebrate)).toEqual([null, null, null]);
  });
});

describe("a pure function of the attempts", () => {
  const history = [...wrong("e1", at(0)), ...right("e1", at(1), 3), ...helped("e2", at(2)), ...right("e2", at(3)), ...right("e3", "2026-01-16T09:00:00.000Z"), ...right("e1", "2026-01-16T09:01:00.000Z")];

  it("the same attempts give the same total and streak, in any order", () => {
    const first = deriveProgress(history, PARIS);
    expect(deriveProgress(history, PARIS)).toEqual(first);
    expect(deriveProgress([...history].reverse(), PARIS)).toEqual(first);
    expect(deriveProgress([history[3]!, ...history.slice(4), ...history.slice(0, 3)], PARIS)).toEqual(first);
  });

  it("a failure never lowers the total, whatever the history and wherever it lands", () => {
    const histories = [[], history, Array.from({ length: 7 }, (_, i) => right(`x${String(i)}`, at(i))).flat()];
    for (const past of histories) {
      for (const minute of [0, 30, 59]) {
        expect(total([...past, ...wrong("f", `2026-01-17T10:${String(minute).padStart(2, "0")}:00.000Z`)])).toBeGreaterThanOrEqual(total(past));
        expect(total([...past, ...wrong("e1", at(minute))])).toBeGreaterThanOrEqual(total(past));
      }
    }
  });

  it("the running total never goes down, answer after answer", () => {
    let running = 0;
    for (const submission of deriveProgress([...history, ...wrong("e3", "2026-01-17T10:00:00.000Z"), ...right("e4", "2026-01-17T10:01:00.000Z")], PARIS).submissions) {
      expect(submission.stars + submission.bonus).toBeGreaterThanOrEqual(0);
      running += submission.stars + submission.bonus;
    }
    expect(running).toBe(deriveProgress([...history, ...wrong("e3", "2026-01-17T10:00:00.000Z"), ...right("e4", "2026-01-17T10:01:00.000Z")], PARIS).total);
  });

  it("an empty history is zero everywhere", () => {
    expect(deriveProgress([], PARIS)).toEqual({ total: 0, currentStreak: 0, bestStreak: 0, submissions: [] });
  });
});

describe("summarizeSince (the session summary)", () => {
  it("counts the stars earned and the right answers since an instant, helped ones included, never the wrong ones", () => {
    const progress = deriveProgress([...right("e1", at(0)), ...right("e2", at(10)), ...wrong("e3", at(11)), ...helped("e4", at(12)), ...right("e1", at(13))], PARIS);

    expect(summarizeSince(progress, at(10))).toEqual({ starsSince: 1, successesSince: 3 });
    expect(summarizeSince(progress, "2026-01-20T00:00:00.000Z")).toEqual({ starsSince: 0, successesSince: 0 });
    const withBonus = deriveProgress(Array.from({ length: 5 }, (_, i) => right(`x${String(i)}`, at(i))).flat(), PARIS);
    expect(summarizeSince(withBonus, at(3))).toEqual({ starsSince: 3, successesSince: 2 });
  });
});
