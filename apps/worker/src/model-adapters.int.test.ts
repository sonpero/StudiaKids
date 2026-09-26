import {
  ClaudeCourseNamer,
  ClaudeExerciseGenerator,
  ClaudeItemSplitter,
  ClaudePhotoExtractor,
  FixtureCourseNamer,
  FixtureExerciseGenerator,
  FixtureItemSplitter,
  FixturePhotoExtractor,
} from "@studiakids/core";
import { describe, expect, it } from "vitest";
import { selectModelAdapters } from "./model-adapters.js";

describe("selectModelAdapters", () => {
  it("LLM_ADAPTER=fixture: fixture adapters, no API key needed", () => {
    const adapters = selectModelAdapters({ LLM_ADAPTER: "fixture" });

    expect(adapters.extractor).toBeInstanceOf(FixturePhotoExtractor);
    expect(adapters.namer).toBeInstanceOf(FixtureCourseNamer);
  });

  it("otherwise: the real Claude adapters, built from ANTHROPIC_API_KEY", () => {
    const adapters = selectModelAdapters({ ANTHROPIC_API_KEY: "sk-test" });

    expect(adapters.extractor).toBeInstanceOf(ClaudePhotoExtractor);
    expect(adapters.namer).toBeInstanceOf(ClaudeCourseNamer);
  });

  // docker-start.mjs stops the whole container, API included, when the
  // worker exits: a missing key must not take the site down.
  it("without an API key it still starts, with the real adapters", () => {
    const adapters = selectModelAdapters({});

    expect(adapters.extractor).toBeInstanceOf(ClaudePhotoExtractor);
  });

  it("an unknown LLM_ADAPTER value is refused, never silently treated as real", () => {
    expect(() => selectModelAdapters({ LLM_ADAPTER: "fixtures", ANTHROPIC_API_KEY: "sk-test" })).toThrow(/LLM_ADAPTER/);
  });
});

// M3: the splitter and the generator switch with the same variable.
describe("selectModelAdapters, splitting and generation", () => {
  it("LLM_ADAPTER=fixture: the recorded split and generation answers", () => {
    const adapters = selectModelAdapters({ LLM_ADAPTER: "fixture" });

    expect(adapters.splitter).toBeInstanceOf(FixtureItemSplitter);
    expect(adapters.generator).toBeInstanceOf(FixtureExerciseGenerator);
  });

  it("otherwise: the real Claude adapters", () => {
    const adapters = selectModelAdapters({ ANTHROPIC_API_KEY: "sk-test" });

    expect(adapters.splitter).toBeInstanceOf(ClaudeItemSplitter);
    expect(adapters.generator).toBeInstanceOf(ClaudeExerciseGenerator);
  });
});
