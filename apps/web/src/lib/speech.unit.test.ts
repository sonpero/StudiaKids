// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSpeech } from "./speech.js";

class Utterance {
  lang = "";
  onend: (() => void) | null = null;
  constructor(public text: string) {}
}

function stubSynthesis() {
  const synthesis = { speak: vi.fn(), cancel: vi.fn() };
  vi.stubGlobal("speechSynthesis", synthesis);
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  return synthesis;
}

afterEach(() => vi.unstubAllGlobals());

// docs/modules/reader.md: the voice starts only on the child's tap, never
// by itself, and nothing about it is kept.
describe("useSpeech", () => {
  it("never speaks on its own; start speaks the text in French, stop cancels", () => {
    const synthesis = stubSynthesis();
    const { result } = renderHook(() => useSpeech());
    expect(synthesis.speak).not.toHaveBeenCalled();
    expect(result.current.speaking).toBe(false);

    act(() => result.current.start("Le verbe"));

    const utterance = synthesis.speak.mock.calls[0]?.[0] as Utterance;
    expect(utterance.text).toBe("Le verbe");
    expect(utterance.lang).toBe("fr-FR");
    expect(result.current.speaking).toBe(true);
    act(() => result.current.stop());
    expect(synthesis.cancel).toHaveBeenCalled();
    expect(result.current.speaking).toBe(false);
  });

  it("goes back to not speaking when the reading ends by itself", () => {
    const synthesis = stubSynthesis();
    const { result } = renderHook(() => useSpeech());
    act(() => result.current.start("Le verbe"));

    act(() => (synthesis.speak.mock.calls[0]?.[0] as Utterance).onend?.());

    expect(result.current.speaking).toBe(false);
  });

  it("stops the voice when the screen goes away", () => {
    const synthesis = stubSynthesis();
    const { result, unmount } = renderHook(() => useSpeech());
    act(() => result.current.start("Le verbe"));

    unmount();

    expect(synthesis.cancel).toHaveBeenCalled();
  });

  it("says when the browser has no speech synthesis, so the screen can hide the button", () => {
    vi.stubGlobal("speechSynthesis", undefined);
    const { result } = renderHook(() => useSpeech());

    expect(result.current.supported).toBe(false);
  });
});
