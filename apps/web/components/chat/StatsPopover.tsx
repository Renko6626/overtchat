"use client";

import { Popover } from "@base-ui/react/popover";
import { Info } from "lucide-react";
import {
  formatDuration,
  formatInteger,
  formatTps,
  type MessageStats,
} from "@/lib/chat/stats";
import { ModelBrandIcon } from "@/components/ModelBrandIcon";
import { motionClasses } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface StatsRow {
  iconId?: MessageStats["providerIconId"];
  label: string;
  value: string;
}

export function StatsPopover({ stats }: { stats: MessageStats }) {
  const candidateRows: Array<StatsRow | null> = [
    stats.providerLabel !== undefined
      ? {
          iconId: stats.providerIconId,
          label: "提供商",
          value: stats.providerLabel,
        }
      : null,
    stats.model !== undefined
      ? {
          iconId: stats.modelIconId ?? stats.providerIconId,
          label: "模型",
          value: stats.model,
        }
      : null,
    stats.contextTokens !== undefined
      ? { label: "上下文 Tokens", value: formatInteger(stats.contextTokens) }
      : null,
    stats.uncachedInputTokens !== undefined
      ? {
          label: "未缓存输入",
          value: formatInteger(stats.uncachedInputTokens),
        }
      : null,
    stats.cacheReadTokens !== undefined
      ? { label: "缓存读取", value: formatInteger(stats.cacheReadTokens) }
      : null,
    stats.cacheWriteTokens !== undefined
      ? { label: "缓存写入", value: formatInteger(stats.cacheWriteTokens) }
      : null,
    stats.responseTokens !== undefined
      ? { label: "输出 Tokens", value: formatInteger(stats.responseTokens) }
      : null,
    stats.totalTokens !== undefined
      ? { label: "总 Tokens", value: formatInteger(stats.totalTokens) }
      : null,
    stats.ttftMs !== undefined
      ? { label: "TTFT", value: formatDuration(stats.ttftMs) }
      : null,
    stats.tps !== undefined ? { label: "TPS", value: formatTps(stats.tps) } : null,
    stats.finishReason !== undefined
      ? { label: "结束原因", value: stats.finishReason }
      : null,
  ];
  const rows = candidateRows.filter((row): row is StatsRow => row !== null);

  if (!rows.length) return null;

  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        aria-label="消息统计"
        title="消息统计"
        className="rounded-md p-1.5 text-muted-foreground motion-colors hover:bg-accent hover:text-foreground max-md:p-2.5"
      >
        <Info className="size-3.5" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="start" sideOffset={6}>
          <Popover.Popup
            className={cn(
              "z-50 w-56 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-md outline-none",
              motionClasses.popup,
            )}
          >
            <div className="space-y-2">
              {rows.map(({ iconId, label, value }) => (
                <div key={label} className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="flex min-w-0 items-center gap-1.5 font-mono text-foreground">
                    <ModelBrandIcon iconId={iconId} className="size-3.5" />
                    <span className="truncate">{value}</span>
                  </span>
                </div>
              ))}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
