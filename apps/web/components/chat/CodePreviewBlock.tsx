"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Code, Copy, Download, Expand, Loader2, Play, X } from "lucide-react";
import { writeText } from "clipboard-polyfill";
import { CodeBlock, type CustomRendererProps } from "streamdown";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  htmlPreviewDocument,
  MAX_PREVIEW_LENGTH,
  svgPreviewSource,
} from "@/lib/chat/code-preview";
import { DiagramViewport } from "./DiagramViewport";

type SvgImage = { url: string; width: number; height: number; source: string };

export function CodePreviewBlock({
  code,
  language,
  isIncomplete,
}: CustomRendererProps) {
  const isSvg = language === "svg";
  const label = isSvg ? "SVG" : "HTML";
  const tooLarge = code.length > MAX_PREVIEW_LENGTH;
  const [image, setImage] = useState<SvgImage | null>(null);
  const [failure, setFailure] = useState<{
    source: string;
    message: string;
  } | null>(null);
  const [showSource, setShowSource] = useState(false);
  // Capture a completed document on click; streaming never runs HTML scripts.
  const [document, setDocument] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Keep the last good image while the next chunk is parsed and decoded.
  const readyImage =
    image && code.startsWith(image.source.trimEnd()) ? image : null;
  const error = tooLarge
    ? "此代码块过大，无法预览。你仍可以复制或下载其源码。"
    : failure?.source === code
      ? failure.message
      : null;
  const canPreview = !error && (isSvg ? !!readyImage : !isIncomplete);

  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );

  useEffect(() => {
    if (!isSvg || tooLarge) return;
    let cancelled = false;
    let published = false;
    let url: string | undefined;
    const loader = new Image();
    async function loadImage() {
      url = URL.createObjectURL(
        new Blob([svgPreviewSource(code, isIncomplete)], {
          type: "image/svg+xml",
        }),
      );
      loader.src = url;
      await loader.decode();
      if (cancelled) return;
      if (!loader.naturalWidth || !loader.naturalHeight) {
        throw new Error("此 SVG 没有可用的尺寸。");
      }
      published = true;
      setImage({
        url,
        width: loader.naturalWidth,
        height: loader.naturalHeight,
        source: code,
      });
      setFailure(null);
    }
    const frame = requestAnimationFrame(() => {
      void loadImage().catch((reason: unknown) => {
        if (!cancelled && !isIncomplete) {
          setFailure({
            source: code,
            message:
              reason instanceof Error
                ? reason.message
                : "无法预览此 SVG。",
          });
        }
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (url && !published) URL.revokeObjectURL(url);
    };
  }, [code, isSvg, isIncomplete, tooLarge]);

  function download() {
    const url = URL.createObjectURL(
      new Blob([code], { type: isSvg ? "image/svg+xml" : "text/html" }),
    );
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `preview.${isSvg ? "svg" : "html"}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Dialog.Root
      open={fullscreen}
      onOpenChange={(open) => {
        setFullscreen(open);
        if (!open) setDocument(null);
      }}
    >
      <div
        className="my-4 w-full min-w-0 overflow-hidden rounded-xl border text-foreground"
        data-code-preview={language}
      >
        <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-2 py-1.5">
          <span className="pl-1 text-xs text-muted-foreground">{label}</span>
          <div className="flex items-center gap-0.5">
            {isSvg && (isIncomplete || !readyImage) && !error && (
              <Loader2
                className="mr-2 size-3.5 animate-spin motion-reduce:animate-none"
                aria-label="正在渲染 SVG"
              />
            )}
            {isSvg && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={showSource ? "显示 SVG" : "显示源码"}
                title={showSource ? "显示 SVG" : "显示源码"}
                aria-pressed={showSource}
                onClick={() => setShowSource(!showSource)}
              >
                <Code />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`复制 ${label} 源码`}
              title={`复制 ${label} 源码`}
              onClick={() => {
                void writeText(code)
                  .then(() => toast.success(`${label} 源码已复制`))
                  .catch(() => toast.error("无法复制源码"));
              }}
            >
              <Copy />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`下载 ${label}`}
              title={`下载 ${label}`}
              onClick={download}
            >
              <Download />
            </Button>
            <Dialog.Trigger
              render={
                <Button
                  ref={triggerRef}
                  variant="ghost"
                  size={isSvg ? "icon-sm" : "sm"}
                  aria-label={isSvg ? "全屏查看 SVG" : "预览 HTML"}
                  title={isSvg ? "全屏查看 SVG" : "预览 HTML"}
                  disabled={!canPreview}
                  onClick={() => {
                    if (!isSvg) setDocument(htmlPreviewDocument(code));
                  }}
                />
              }
            >
              {isSvg ? (
                <Expand />
              ) : (
                <>
                  <Play />
                  预览
                </>
              )}
            </Dialog.Trigger>
          </div>
        </div>
        {error && (
          <p className="p-3 text-sm text-destructive" role="status">
            {error}
          </p>
        )}
        {(!isSvg || showSource || !readyImage || error) && (
          <div className="max-h-96 overflow-auto [&_[data-streamdown=code-block-header]]:hidden">
            <CodeBlock
              code={code}
              language={language}
              isIncomplete={isIncomplete}
              className="my-0 rounded-none border-0"
            />
          </div>
        )}
        {isSvg && readyImage && !error && (
          <div hidden={showSource}>
            <DiagramViewport image={readyImage} alt="生成的 SVG" />
          </div>
        )}
      </div>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Popup
          finalFocus={triggerRef}
          className="fixed inset-3 z-50 flex flex-col overflow-hidden rounded-xl border bg-background text-foreground shadow-xl outline-none sm:inset-6"
        >
          <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
            <Dialog.Title className="text-sm font-medium">
              {label} 预览
            </Dialog.Title>
            <Dialog.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="关闭预览"
                  title="关闭预览"
                />
              }
            >
              <X />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            {isSvg
              ? "拖动平移，滚动或双指缩放。"
              : "生成 HTML 页面的交互式预览。"}
          </Dialog.Description>
          {isSvg
            ? readyImage && (
                <DiagramViewport
                  image={readyImage}
                  alt="生成的 SVG"
                  fullscreen
                />
              )
            : document &&
              fullscreen && (
                <iframe
                  title="HTML 预览"
                  sandbox="allow-scripts"
                  referrerPolicy="no-referrer"
                  srcDoc={document}
                  className="min-h-0 w-full flex-1 border-0 bg-white"
                />
              )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
