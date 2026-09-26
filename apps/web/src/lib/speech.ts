import { useCallback, useEffect, useState } from "react";

const synthesis = (): SpeechSynthesis | undefined => (typeof globalThis.speechSynthesis === "object" && globalThis.speechSynthesis ? globalThis.speechSynthesis : undefined);

// docs/modules/reader.md: the voice starts only on the child's tap
// (browsers refuse speak() without a gesture anyway), stops on « Stop »,
// and is a screen state only, forgotten on leaving.
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const supported = synthesis() !== undefined;

  const stop = useCallback(() => {
    synthesis()?.cancel();
    setSpeaking(false);
  }, []);

  const start = useCallback((text: string) => {
    const voice = synthesis();
    if (!voice) return;
    voice.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.onend = () => setSpeaking(false);
    voice.speak(utterance);
    setSpeaking(true);
  }, []);

  useEffect(() => () => synthesis()?.cancel(), []);

  return { supported, speaking, start, stop };
}
