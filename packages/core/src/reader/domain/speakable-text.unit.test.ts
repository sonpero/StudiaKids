import { describe, expect, it } from "vitest";
import { speakableText } from "./speakable-text.js";

describe("speakableText", () => {
  it("drops heading marks, keeping the heading's words", () => {
    expect(speakableText("# Le verbe\n\n## 1. À quoi sert le verbe ?")).toBe("Le verbe\n1. À quoi sert le verbe ?");
  });

  it("drops list marks, dashes and numbers alike", () => {
    expect(speakableText("- chanter\n* finir\n+ prendre\n1. Hier\n2) Demain")).toBe("chanter\nfinir\nprendre\nHier\nDemain");
  });

  it("drops emphasis marks and inline code ticks", () => {
    expect(speakableText("Le **verbe** change, *toujours* et __vraiment__, `ici`.")).toBe("Le verbe change, toujours et vraiment, ici.");
  });

  it("reduces a link to its text", () => {
    expect(speakableText("Regarde [la vidéo](https://exemple.fr/v) en classe.")).toBe("Regarde la vidéo en classe.");
  });

  it("removes a bare web address", () => {
    expect(speakableText("Pour réviser : https://exemple.fr/cours?id=3\nwww.exemple.fr/revision")).toBe("Pour réviser :");
  });

  it("drops quote marks, rules and blank lines, and keeps one line per line of text", () => {
    expect(speakableText("> À retenir\n\n---\n\nLe verbe change.\n\n\nFin.")).toBe("À retenir\nLe verbe change.\nFin.");
  });

  it("keeps words that only look like marks: a minus in a calculation, a mid-word underscore", () => {
    expect(speakableText("10 - 3 = 7\nmot_clé")).toBe("10 - 3 = 7\nmot_clé");
  });

  it("reads an indented heading as a heading, number included", () => {
    expect(speakableText("  ## 2. L'infinitif")).toBe("2. L'infinitif");
  });

  it("keeps underscores inside a word, even two of them", () => {
    expect(speakableText("nom_de_fichier")).toBe("nom_de_fichier");
  });

  it("leaves no double space where an address was removed", () => {
    expect(speakableText("Va sur https://exemple.fr pour jouer.")).toBe("Va sur pour jouer.");
  });
});
