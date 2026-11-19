/**
 * Models often emit LaTeX with the `\(...\)` and `\[...\]` delimiters that
 * KaTeX supports but remark-math does not. Rewrite those into the `$...$` and
 * `$$...$$` forms the renderer understands, leaving code untouched.
 */

const MASK = "\u0000";

function isEscaped(text: string, index: number): boolean {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i -= 1) slashes += 1;
  return slashes % 2 === 1;
}

/** Mask fenced code blocks and inline code spans so they stay verbatim. */
function maskCode(markdown: string): { masked: string; blocks: string[] } {
  const blocks: string[] = [];
  let masked = "";
  let i = 0;

  const pushBlock = (value: string) => {
    blocks.push(value);
    masked += `${MASK}${blocks.length - 1}${MASK}`;
  };

  while (i < markdown.length) {
    const atLineStart = i === 0 || markdown[i - 1] === "\n";
    if (atLineStart) {
      const opening = /^ {0,3}(`{3,}|~{3,})/.exec(markdown.slice(i));
      if (opening) {
        const marker = opening[1];
        const lineEnd = markdown.indexOf("\n", i);
        const bodyStart = lineEnd === -1 ? markdown.length : lineEnd + 1;
        const closing = new RegExp(
          `^ {0,3}${marker[0]}{${marker.length},}\\s*$`,
          "m",
        ).exec(markdown.slice(bodyStart));
        const end = closing
          ? bodyStart + closing.index + closing[0].length
          : markdown.length;
        pushBlock(markdown.slice(i, end));
        i = end;
        continue;
      }
    }

    if (markdown[i] === "`") {
      let run = 1;
      while (markdown[i + run] === "`") run += 1;
      const fence = "`".repeat(run);
      const close = markdown.indexOf(fence, i + run);
      if (close !== -1) {
        const end = close + run;
        pushBlock(markdown.slice(i, end));
        i = end;
        continue;
      }
    }

    masked += markdown[i];
    i += 1;
  }

  return { masked, blocks };
}

function findClosing(
  text: string,
  from: number,
  delimiter: ")" | "]",
): number {
  for (let i = from; i < text.length - 1; i += 1) {
    if (
      text[i] === "\\" &&
      text[i + 1] === delimiter &&
      !isEscaped(text, i)
    ) {
      return i;
    }
  }
  return -1;
}

function convertDelimiters(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const next = text[i + 1];
    if (
      text[i] === "\\" &&
      (next === "(" || next === "[") &&
      !isEscaped(text, i)
    ) {
      const close = findClosing(text, i + 2, next === "(" ? ")" : "]");
      if (close !== -1) {
        const body = text.slice(i + 2, close);
        // A bare `$` inside the body would terminate the replacement early.
        if (body.trim() && !/(^|[^\\])\$/.test(body)) {
          out += next === "(" ? `$${body}$` : `$$${body}$$`;
          i = close + 1;
          continue;
        }
      }
    }
    out += text[i];
  }
  return out;
}

export function normalizeLatexDelimiters(markdown: string): string {
  if (!markdown.includes("\\(") && !markdown.includes("\\[")) {
    return markdown;
  }
  const { masked, blocks } = maskCode(markdown);
  const converted = convertDelimiters(masked);
  return converted.replace(
    new RegExp(`${MASK}(\\d+)${MASK}`, "g"),
    (_, index: string) => blocks[Number(index)] ?? "",
  );
}
