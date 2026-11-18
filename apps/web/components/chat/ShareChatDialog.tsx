import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog } from "@base-ui/react/dialog";
import { Share2, X } from "lucide-react";
import { writeText } from "clipboard-polyfill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  chatShareQuery,
  sharePreviewQuery,
  shareUrl,
  useChangeChatShare,
} from "@/lib/queries/shares";
import { SharedTranscript } from "./SharedTranscript";

export function ShareChatButton({
  chatId,
  disabled,
}: {
  chatId: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="分享对话"
        title="分享对话"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Share2 />
      </Button>
      {open && (
        <ShareChatDialog chatId={chatId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

export function ShareChatDialog({
  chatId,
  onClose,
}: {
  chatId: string;
  onClose: () => void;
}) {
  const current = useQuery(chatShareQuery(chatId));
  const preview = useQuery(sharePreviewQuery(chatId));
  const change = useChangeChatShare();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const share = current.data?.share;
  const url = share ? shareUrl(share) : "";
  const error = change.error || current.error;

  async function copy() {
    try {
      await writeText(url);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError("复制失败。请选中链接后手动复制。");
    }
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[60] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-card p-6 text-card-foreground shadow-lg outline-none">
          <div className="flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">
              分享对话
            </Dialog.Title>
            <Dialog.Close
              render={
                <Button variant="ghost" size="icon-sm" aria-label="关闭" />
              }
            >
              <X />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            任何获得链接的人都可以阅读此对话，包括其附件、思考过程和工具结果。新消息和编辑在你更新链接前保持私密。删除此对话会同时移除其链接。
          </Dialog.Description>
          {share && (
            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                <Input
                  aria-label="分享的对话链接"
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                />
                <Button onClick={() => void copy()}>
                  {copied ? "已复制" : "复制链接"}
                </Button>
              </div>
              <a
                className="text-sm underline"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                查看分享的对话
              </a>
            </div>
          )}
          <details className="mt-4 min-h-0 overflow-auto rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              预览当前对话
            </summary>
            <div className="mt-4">
              {preview.isPending ? (
                <p role="status">正在加载预览…</p>
              ) : preview.error ? (
                <p role="alert">{preview.error.message}</p>
              ) : (
                preview.data && (
                  <SharedTranscript messages={preview.data.messages} />
                )
              )}
            </div>
          </details>
          {(error || copyError) && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error?.message || copyError}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {share && (
              <Button
                variant="outline"
                disabled={change.isPending}
                onClick={() => {
                  setCopied(false);
                  change.mutate({ chatId, method: "DELETE" });
                }}
              >
                取消分享
              </Button>
            )}
            <Button
              disabled={
                change.isPending ||
                current.isPending ||
                !!current.error ||
                !preview.data ||
                !!preview.error
              }
              onClick={() => {
                setCopied(false);
                change.mutate({ chatId, method: share ? "PUT" : "POST" });
              }}
            >
              {change.isPending
                ? "保存中…"
                : share
                  ? "更新链接"
                  : "创建链接"}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
