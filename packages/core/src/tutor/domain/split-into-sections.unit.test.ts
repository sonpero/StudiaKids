import { describe, expect, it } from "vitest";
import { sectionsOf, splitIntoParagraphs, splitIntoSections } from "./split-into-sections.js";

// Recopied from StudIA (docs/inventaire-studia.md, §7), with its tests.

describe("splitIntoParagraphs", () => {
  it("returns nothing for empty or blank markdown", () => {
    expect(splitIntoParagraphs("")).toEqual([]);
    expect(splitIntoParagraphs("   \n\n  ")).toEqual([]);
  });

  it("splits on blank lines and trims each paragraph", () => {
    expect(splitIntoParagraphs("# Titre\n\nCorps un.\n\nCorps deux.")).toEqual(["# Titre", "Corps un.", "Corps deux."]);
  });
});

describe("splitIntoSections", () => {
  it("returns nothing for empty markdown", () => {
    expect(splitIntoSections("")).toEqual([]);
  });

  it("keeps a paragraph as its own section when it already meets minSize", () => {
    const long = "Un paragraphe de cours suffisamment long pour ne jamais être fusionné avec un voisin, largement.";
    expect(splitIntoSections(long, 80)).toEqual([long]);
  });

  it("merges a heading-only fragment forward into the body paragraph that follows it", () => {
    const markdown = "## Définition\n\nLa photosynthèse est le processus biologique par lequel les plantes convertissent la lumière en énergie chimique.";
    const sections = splitIntoSections(markdown, 80);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toBe(
      "## Définition\n\nLa photosynthèse est le processus biologique par lequel les plantes convertissent la lumière en énergie chimique.",
    );
  });

  it("merges a chain of consecutive undersized fragments forward until one is long enough", () => {
    const markdown = "# A\n\n## B\n\nUn paragraphe de cours suffisamment long pour ne jamais être fusionné avec un voisin, largement.";
    const sections = splitIntoSections(markdown, 80);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toBe(markdown);
  });

  it("merges a trailing undersized fragment backward when it is last and alone", () => {
    const first = "Un premier paragraphe de cours suffisamment long pour ne jamais être fusionné, largement au-delà du seuil.";
    const second = "Un second paragraphe de cours suffisamment long pour ne jamais être fusionné, largement au-delà du seuil.";
    const tail = "Fin.";
    const sections = splitIntoSections(`${first}\n\n${second}\n\n${tail}`, 80);
    expect(sections).toEqual([first, `${second}\n\n${tail}`]);
  });

  it("falls back to a single section when every paragraph in the document is undersized", () => {
    expect(splitIntoSections("# A\n\n## B", 80)).toEqual(["# A\n\n## B"]);
  });

  it("a custom minSize changes where fragments merge", () => {
    const a = "Paragraphe de cent caractères environ, ni trop court ni trop long pour ce test précis ici.";
    const b = "Un second paragraphe, de longueur comparable au premier, pour vérifier le seuil personnalisé choisi.";
    expect(splitIntoSections(`${a}\n\n${b}`, 10)).toEqual([a, b]);
    expect(splitIntoSections(`${a}\n\n${b}`, 1000)).toEqual([`${a}\n\n${b}`]);
  });

  it("is deterministic: the same markdown always yields the same sections", () => {
    const markdown = "# Titre\n\n## Sous-titre\n\nUn paragraphe de cours suffisamment long pour ne jamais être fusionné avec un voisin, largement.\n\nCourt.";
    expect(splitIntoSections(markdown)).toEqual(splitIntoSections(markdown));
  });
});

// A StudiaKids lesson, the text recorded from the legible fixture page
// (a copy, not a file read: domain unit tests do no I/O).
const LE_VERBE = "Français – Leçon 3                    mardi 12 mars\n\n# Le verbe\n\n## 1. À quoi sert le verbe ?\n\nLe verbe indique ce que fait le sujet ou ce qu'il est.\n\nDans la phrase « Léa chante une chanson » :\n\n- chante est le verbe ;\n- Léa est le sujet.\n\n## 2. L'infinitif\n\nLe verbe a une forme qui ne change pas : l'infinitif.\n\nExemples de verbes à l'infinitif :\n\n- chanter\n- finir\n- prendre\n\n## 3. Le verbe change avec le temps\n\nHier, Léa chantait. Aujourd'hui, Léa chante.\n\nDemain, Léa chantera.\n\n## À retenir\n\nLe verbe change quand on change le temps de la phrase.\n";

describe("splitIntoSections on a real lesson", () => {
  it("keeps every word of the lesson, in order, and never a bare heading as a section", () => {
    const sections = splitIntoSections(LE_VERBE);
    expect(sections.join("\n\n")).toBe(splitIntoParagraphs(LE_VERBE).join("\n\n"));
    for (const section of sections) expect(section.length >= 80 || sections.length === 1 || section === sections.at(-1)).toBe(true);
    expect(sections.length).toBeGreaterThan(1);
  });

  it("is deterministic on it", () => {
    expect(splitIntoSections(LE_VERBE)).toEqual(splitIntoSections(`${LE_VERBE}`));
  });
});

// Gaps found by mutation testing on the recopied code (M6).
describe("splitIntoSections, edges", () => {
  it("a paragraph of exactly minSize characters is a section of its own", () => {
    const exactly = "a".repeat(80);
    const next = "b".repeat(90);
    expect(splitIntoSections(`${exactly}\n\n${next}`, 80)).toEqual([exactly, next]);
  });

  it("blank lines before the first paragraph leave no empty paragraph", () => {
    expect(splitIntoParagraphs("\n\n  \nCorps un.\n\nCorps deux.")).toEqual(["Corps un.", "Corps deux."]);
  });
});

describe("sectionsOf", () => {
  it("numbers the sections from 0, in the lesson's order", () => {
    const sections = sectionsOf(LE_VERBE);
    expect(sections.map((section) => section.index)).toEqual(sections.map((_, i) => i));
    expect(sections.map((section) => section.text)).toEqual(splitIntoSections(LE_VERBE));
  });
});
