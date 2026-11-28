/**
 * Page text is plain text written by staff: a blank line starts a paragraph, "## " starts a heading and
 * "- " lines make a list. It is parsed into blocks and rendered as text, so nothing in it can become markup.
 */
export type Block = { type: "heading"; text: string } | { type: "paragraph"; text: string } | { type: "list"; items: string[] };

export function parseRichText(source: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of source.replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    let paragraph: string[] = [];
    let list: string[] = [];
    const flush = () => {
      if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join("\n") });
      if (list.length) blocks.push({ type: "list", items: list });
      paragraph = [];
      list = [];
    };
    for (const raw of chunk.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("## ")) {
        flush();
        blocks.push({ type: "heading", text: line.slice(3).trim() });
      } else if (line.startsWith("- ")) {
        if (paragraph.length) flush();
        list.push(line.slice(2).trim());
      } else {
        if (list.length) flush();
        paragraph.push(line);
      }
    }
    flush();
  }
  return blocks;
}
