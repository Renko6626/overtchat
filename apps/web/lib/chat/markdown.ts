import { code } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { cjk } from "@streamdown/cjk";
import { defaultRemarkPlugins } from "streamdown";
import { MermaidBlock } from "@/components/chat/MermaidBlock";
import { CodePreviewBlock } from "@/components/chat/CodePreviewBlock";

// Upstream defaults to block-only math; models routinely emit `$x$` too.
const math = createMathPlugin({ singleDollarTextMath: true });

export const STREAMDOWN_PLUGINS = {
  code,
  math,
  cjk,
  renderers: [{ language: "mermaid", component: MermaidBlock }],
};

// Generated pages belong in message bodies, not reasoning or tool details.
export const MESSAGE_MARKDOWN_PLUGINS = {
  ...STREAMDOWN_PLUGINS,
  renderers: [
    ...STREAMDOWN_PLUGINS.renderers,
    { language: ["svg", "html"], component: CodePreviewBlock },
  ],
};

export const STREAMDOWN_DEFAULT_REMARK_PLUGINS =
  Object.values(defaultRemarkPlugins);
