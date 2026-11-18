"use client";
import {
  IMAGE_SIZES,
  IMAGE_SIZE_LABELS,
  IMAGE_QUALITIES,
  type ImageGenerationOptions,
} from "@overtchat/shared";
import { X } from "lucide-react";

export function ImageOptions({
  value,
  model,
  supportsQuality = true,
  configuredSize,
  onChange,
  onClose,
}: {
  value: ImageGenerationOptions;
  model?: string | null;
  supportsQuality?: boolean;
  configuredSize?: string;
  onChange: (value: ImageGenerationOptions) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/60 px-3 py-2 text-xs">
      <span className="font-medium">
        生成图像{model ? ` · ${model}` : ""}
      </span>
      {configuredSize ? (
        <span>
          尺寸：{configuredSize === "auto" ? "后端默认" : configuredSize}
        </span>
      ) : (
        <label className="flex items-center gap-1">
          尺寸
          <select
            aria-label="图像尺寸"
            className="rounded border bg-background p-1"
            value={value.size}
            onChange={(event) =>
              onChange({
                ...value,
                size: event.target.value as ImageGenerationOptions["size"],
              })
            }
          >
            {IMAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {IMAGE_SIZE_LABELS[size]}
              </option>
            ))}
          </select>
        </label>
      )}
      {supportsQuality && (
        <label className="flex items-center gap-1">
          质量
          <select
            aria-label="图像质量"
            className="rounded border bg-background p-1"
            value={value.quality}
            onChange={(event) =>
              onChange({
                ...value,
                quality: event.target
                  .value as ImageGenerationOptions["quality"],
              })
            }
          >
            {IMAGE_QUALITIES.map((quality) => (
              <option key={quality} value={quality}>
                {quality}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="移除图像请求"
        className="ml-auto rounded p-1 hover:bg-accent"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
