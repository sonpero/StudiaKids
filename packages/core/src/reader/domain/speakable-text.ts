// What the speech synthesis reads (docs/modules/reader.md): the lesson's
// words without their Markdown marks — a voice reading « dièse dièse » or
// a web address loses a six-year-old. One line per line of text.
export function speakableText(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => {
      const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
      let text = heading
        ? (heading[1] ?? "")
        : line
            .replace(/^\s*>\s?/, "")
            .replace(/^\s*[-*+]\s+/, "")
            .replace(/^\s*\d+[.)]\s+/, "");
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(text)) return "";
      text = text
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\b(?:https?:\/\/|www\.)\S+/g, "")
        .replace(/\*\*(.+?)\*\*|__(.+?)__/g, "$1$2")
        .replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])|(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)/g, "$1$2")
        .replace(/`([^`]*)`/g, "$1");
      return text.replace(/\s+/g, " ").trim();
    })
    .filter((line) => line !== "")
    .join("\n");
}
