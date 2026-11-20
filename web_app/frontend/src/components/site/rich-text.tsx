import { parseRichText } from "@/lib/rich-text";

/** Staff text as paragraphs, headings and lists; every character is rendered as text. */
export default function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-4 text-lg font-medium leading-loose">
      {parseRichText(text).map((block, index) => {
        if (block.type === "heading")
          return (
            <h2 key={index} className="pt-3 font-heading text-3xl leading-snug">
              {block.text}
            </h2>
          );
        if (block.type === "list")
          return (
            <ul key={index} className="list-disc space-y-1 ps-6 marker:text-press">
              {block.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          );
        return (
          <p key={index} className="whitespace-pre-line">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
