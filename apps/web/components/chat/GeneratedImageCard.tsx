"use client";

import type { FileUIPart } from "ai";
import {
  IMAGE_SIZE_LABELS,
  isGeneratedImage,
  type ImageToolPart,
} from "@overtchat/shared";
import { Download, ImageIcon, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { serverUrl } from "@/lib/api-url";
import { isSharedGeneratedImage } from "@/lib/sharing";

export function GeneratedImageCard({
  part,
  streaming,
  onReference,
  readOnly = false,
}: {
  part: ImageToolPart;
  streaming: boolean;
  onReference?: (file: FileUIPart) => void;
  readOnly?: boolean;
}) {
  const pending =
    part.state === "input-streaming" || part.state === "input-available";
  const images = Array.isArray(part.output?.images)
    ? part.output.images.filter((image) => isGeneratedImage(image) || (readOnly && isSharedGeneratedImage(image)))
    : [];
  return (
    <div className="my-3 w-full max-w-lg space-y-3" data-image-generation="">
      <div
        className="flex items-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        {pending && streaming ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ImageIcon className="size-4" />
        )}
        {pending
          ? streaming
            ? part.type === "tool-edit_image"
              ? "正在编辑图像…"
              : "正在生成图像…"
            : "图像生成已停止"
          : part.state === "output-error"
            ? "图像生成失败"
            : "图像已生成"}
      </div>
      {part.state === "output-error" && (
        <p className="text-sm text-destructive">
          {part.errorText ?? "图像生成失败。"}
        </p>
      )}
      {images.map((image) => (
        <div
          key={image.id}
          className="overflow-hidden rounded-xl border bg-card"
        >
          <a
            href={serverUrl(image.url)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="查看生成的图像"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={serverUrl(image.url)}
              alt={part.output?.prompt ?? "生成的图像"}
              className="max-h-[32rem] w-full object-contain"
            />
          </a>
          <div className="flex flex-wrap items-center gap-2 p-2">
            <a
              href={serverUrl(image.url)}
              download={image.filename}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-accent"
            >
              <Download className="size-3.5" /> 下载
            </a>
            {onReference && (
              <Button
                size="sm"
                variant="ghost"
                disabled={streaming}
                onClick={() =>
                  onReference({
                    type: "file",
                    url: image.url,
                    mediaType: image.mediaType,
                    filename: image.filename,
                  })
                }
              >
                <Pencil className="size-3.5" /> 编辑 / 用作参考
              </Button>
            )}
          </div>
        </div>
      ))}
      {part.output && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {part.output.model} · 图像详情
          </summary>
          <p className="mt-2 whitespace-pre-wrap">{part.output.prompt}</p>
          <p className="mt-1">
            请求尺寸：{" "}
            {part.output.providerSize === "auto"
              ? "后端默认"
              : (part.output.providerSize ??
                IMAGE_SIZE_LABELS[part.output.size] ??
                "自动")}
            {part.output.providerSize === undefined && (
              <> · 质量：{part.output.quality}</>
            )}
          </p>
        </details>
      )}
    </div>
  );
}
