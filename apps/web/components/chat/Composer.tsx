"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FileUIPart } from "ai";
import type {
  ImageGenerationOptions,
  ChatReasoningLevel,
  ModelReasoningControls,
} from "@overtchat/shared";
import { formatQuotedMessage } from "@overtchat/shared";
import {
  AlertCircle,
  AudioLines,
  ArrowUp,
  Check,
  Cpu,
  Shrink,
  Ghost,
  ImageIcon,
  Globe,
  LayoutDashboard,
  Loader2,
  Library,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  Reply,
  Search,
  Settings2,
  Square,
  X,
} from "lucide-react";
import { Menu } from "@base-ui/react/menu";
import { Button } from "@/components/ui/button";
import { ModelPicker } from "@/components/ModelPicker";
import { LibraryPicker } from "@/components/library/LibraryPicker";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ComposerConnector } from "./chat-connectors";
import {
  ATTACH_ACCEPT,
  formatSize,
  getDataTransferFiles,
} from "@/lib/chat/attachments";
import { useComposerDraft } from "@/lib/chat/use-composer-draft";
import { motionClasses } from "@/lib/motion";
import { useDictation } from "@/lib/useDictation";
import {
  filterSlashCommandModels,
  filterSlashCommands,
  isSlashCommandAvailable,
  parseSlashCommandQuery,
  replaceSlashCommandSpan,
  resolveSlashCommand,
  type SlashCommand,
} from "@/lib/chat/slash-commands";
import type { PublicModelConfig } from "@/lib/model-config/schema";
import { DictateButton, DictateError } from "./DictateButton";
import { ImageOptions } from "./ImageOptions";
import { CategoryIcon } from "./attachment-icons";
import {
  SlashCommandMenu,
  toSlashCommandModelRows,
  toSlashCommandRows,
  type SlashCommandRow,
} from "./SlashCommandMenu";
import { FileMentionMenu } from "./FileMentionMenu";
import { filterFileMentions, parseFileMention } from "@/lib/chat/file-mentions";
import type { ProjectFileItem } from "@/lib/project-files";
import {
  type ChatAttachment,
  useChatAttachments,
} from "./useChatAttachments";
import { MessageQueue, type MessageQueueProps } from "./MessageQueue";
import { serverUrl } from "@/lib/api-url";

export interface ComposerHandle {
  addFiles: (files: readonly File[]) => void;
  addReference: (file: FileUIPart) => void;
  /** Stages a passage that the next message replies to. */
  addQuote: (text: string) => void;
  focus: (options?: FocusOptions) => void;
}

/**
 * Commands the composer owns itself (attach, dictate) are appended by the
 * composer; everything that mutates chat-level state is declared by `ChatArea`.
 */
export interface ComposerCommandActions {
  compact?: { onCompact: () => void; unavailableReason?: string };
  /** Runs `/temporary`; omitted once the chat has messages. */
  temporary?: { active: boolean; onToggle: () => void };
  onNewChat: () => void;
  onSearchChats: () => void;
  onOpenSettings: () => void;
  onSelectModel: (modelId: string) => void;
}

const NO_CONNECTORS: readonly ComposerConnector[] = [];
const NO_PROJECT_FILES: readonly ProjectFileItem[] = [];

interface ComposerProps {
  chatQueue: MessageQueueProps;
  configured: boolean;
  streaming: boolean;
  searchAvailable: boolean;
  searchUnavailableReason: string;
  searchRequested: boolean;
  openuiAvailable: boolean;
  openuiUnavailableReason: string;
  openuiRequested: boolean;
  /** The accounts the user has connected, as this chat can use them. */
  connectors?: readonly ComposerConnector[];
  onToggleConnector?: (id: ComposerConnector["id"]) => void;
  imageAvailable?: boolean;
  imageModel?: string | null;
  imageSupportsQuality?: boolean;
  imageConfiguredSize?: string;
  imageOptions?: ImageGenerationOptions;
  onImageOptions?: (options: ImageGenerationOptions | undefined) => void;
  dropActive: boolean;
  models: PublicModelConfig[] | null;
  selectedModelId: string;
  reasoningControls?: ModelReasoningControls;
  reasoningLevel: ChatReasoningLevel;
  voiceInstalled: boolean;
  voiceEligible: boolean;
  voiceAvailable: boolean;
  voiceActive: boolean;
  voiceUnavailableReason: string;
  attachmentsEnabled: boolean;
  /** The chat's project files, offered by `#` in the draft. */
  projectFiles?: readonly ProjectFileItem[];
  textInputDisabled: boolean;
  commandActions: ComposerCommandActions;
  onSelectReasoningLevel: (level: ChatReasoningLevel) => void;
  onToggleSearch: () => void;
  onToggleOpenUI: () => void;
  /** Return false when the submission was not accepted; retain the draft. */
  onSubmit: (input: string, attachments: FileUIPart[]) => void | boolean;
  onStop: () => void;
  onStartVoice: () => void;
  onEndVoice: () => void;
  /** Stops text-to-speech before dictation so playback is not transcribed. */
  onBeforeDictate?: () => void;
  isAdmin: boolean;
  draftUserId?: string;
  draftScope: string | null;
  draftEnabled: boolean;
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer({
  chatQueue,
  configured,
  streaming,
  searchAvailable,
  searchUnavailableReason,
  searchRequested,
  openuiAvailable,
  openuiUnavailableReason,
  openuiRequested,
  connectors = NO_CONNECTORS,
  onToggleConnector,
  imageAvailable, imageModel, imageSupportsQuality, imageConfiguredSize, imageOptions, onImageOptions,
  dropActive,
  models,
  selectedModelId,
  reasoningControls,
  reasoningLevel,
  voiceInstalled,
  voiceEligible,
  voiceAvailable,
  voiceActive,
  voiceUnavailableReason,
  attachmentsEnabled,
  projectFiles = NO_PROJECT_FILES,
  textInputDisabled,
  commandActions,
  onSelectReasoningLevel,
  onToggleSearch,
  onToggleOpenUI,
  onSubmit,
  onStop,
  onStartVoice,
  onEndVoice,
  onBeforeDictate,
  isAdmin,
  draftUserId,
  draftScope,
  draftEnabled,
}, ref) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleDraftRestore = useCallback(() => {
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) el.setSelectionRange(el.value.length, el.value.length);
    });
  }, []);
  const {
    value: input,
    setValue: setInput,
    clear: clearDraft,
  } = useComposerDraft({
    userId: draftUserId,
    scope: draftScope,
    enabled: draftEnabled,
    onRestore: handleDraftRestore,
  });
  const {
    attachments,
    uploading,
    readyParts,
    addFiles,
    removeAttachment,
    clearAttachments,
    addReadyParts,
  } = useChatAttachments();
  const [quotes, setQuotes] = useState<{ id: number; text: string }[]>([]);
  const nextQuoteIdRef = useRef(0);

  useImperativeHandle(
    ref,
    () => ({
      addFiles(files) {
        addFiles(files);
        setTimeout(
          () => textareaRef.current?.focus({ preventScroll: true }),
          0,
        );
      },
      addReference(file) {
        addReadyParts([file]);
        textareaRef.current?.focus({ preventScroll: true });
      },
      addQuote(text) {
        const id = nextQuoteIdRef.current;
        nextQuoteIdRef.current += 1;
        setQuotes((current) => [...current, { id, text }]);
        textareaRef.current?.focus({ preventScroll: true });
      },
      focus(options) {
        textareaRef.current?.focus(options);
      },
    }),
    [addFiles, addReadyParts],
  );

  const dictation = useDictation((text) => {
    setInput((prev) => {
      const trimmed = prev.trimEnd();
      if (!trimmed) return text;
      return `${trimmed} ${text}`;
    });
    setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 0);
  });

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  function startDictation() {
    if (dictation.status !== "idle") return;
    onBeforeDictate?.();
    void dictation.start();
  }

  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // The inline command form reads the word ending at the caret, so the caret
  // is mirrored into state from every change and selection move.
  const [caret, setCaret] = useState(0);
  // Set by `replaceDraft` and applied once the controlled value has rendered.
  const pendingCaretRef = useRef<number | null>(null);
  useEffect(() => {
    const next = pendingCaretRef.current;
    if (next === null) return;
    pendingCaretRef.current = null;
    textareaRef.current?.setSelectionRange(next, next);
    setCaret(next);
  }, [input]);
  const listboxId = useId();
  const optionIdPrefix = useId();

  const commands = useMemo<SlashCommand[]>(() => {
    const list: SlashCommand[] = [
      {
        name: "search",
        title: "联网搜索",
        description: "为这条消息联网搜索",
        group: "actions",
        icon: Globe,
        keywords: ["web", "browse"],
        toggle: {
          active: searchRequested,
          unavailableReason: searchAvailable
            ? undefined
            : searchUnavailableReason,
        },
        run: onToggleSearch,
      },
      {
        name: "openui",
        title: "交互式界面",
        description: "为这条消息渲染 OpenUI 交互式界面",
        group: "actions",
        icon: LayoutDashboard,
        keywords: ["ui", "chart", "dashboard", "form", "table", "interactive"],
        toggle: {
          active: openuiRequested,
          unavailableReason: openuiAvailable
            ? undefined
            : openuiUnavailableReason,
        },
        run: onToggleOpenUI,
      },
      ...connectors.map((connector) => ({
        name: connector.name,
        title: connector.title,
        description: connector.description,
        group: "actions" as const,
        icon: connector.icon,
        keywords: connector.keywords,
        toggle: {
          active: connector.active,
          unavailableReason: connector.lockedReason,
        },
        run: () => onToggleConnector?.(connector.id),
      })),
      {
        name: "attach",
        title: "添加图片和文件",
        description: "从本机上传",
        group: "actions",
        icon: Paperclip,
        keywords: ["file", "upload", "image", "photo", "pdf"],
        action: "attach",
      },
      {
        name: "dictate",
        title: "语音输入",
        description: "录制并转写语音",
        group: "actions",
        icon: Mic,
        keywords: ["voice", "speak", "microphone", "transcribe"],
        action: "dictate",
      },
    ];

    if (commandActions.temporary) {
      list.push({
        name: "temporary",
        title: "临时对话",
        description: "对话不会保存到历史记录",
        group: "actions",
        icon: Ghost,
        keywords: ["incognito", "private", "unsaved"],
        toggle: { active: commandActions.temporary.active },
        run: commandActions.temporary.onToggle,
      });
    }

    if (commandActions.compact) {
      list.push({
        name: "compact",
        title: "压缩对话",
        description: "立即总结较早的上下文",
        group: "actions",
        icon: Shrink,
        keywords: ["summarize", "context"],
        toggle: { active: false, unavailableReason: commandActions.compact.unavailableReason },
        run: commandActions.compact.onCompact,
      });
    }

    list.push(
      {
        name: "model",
        title: "切换模型",
        description: "选择由哪个模型回答",
        group: "actions",
        icon: Cpu,
        keywords: ["models", "switch"],
        submenu: "model",
      },
      {
        name: "new",
        title: "新对话",
        description: "开始一段新对话",
        group: "navigate",
        icon: Pencil,
        shortcut: ["Ctrl", "Shift", "O"],
        run: commandActions.onNewChat,
      },
      {
        name: "chats",
        title: "搜索对话",
        description: "查找之前的对话",
        group: "navigate",
        icon: Search,
        keywords: ["history", "find"],
        shortcut: ["Ctrl", "K"],
        run: commandActions.onSearchChats,
      },
      {
        name: "settings",
        title: "设置",
        description: "模型、工具和偏好设置",
        group: "navigate",
        icon: Settings2,
        keywords: ["preferences", "config"],
        run: commandActions.onOpenSettings,
      },
    );

    return list;
  }, [
    commandActions,
    searchAvailable,
    searchRequested,
    searchUnavailableReason,
    onToggleSearch,
    openuiAvailable,
    openuiRequested,
    openuiUnavailableReason,
    onToggleOpenUI,
    connectors,
    onToggleConnector,
  ]);

  const argumentNames = useMemo(
    () => commands.filter((command) => command.submenu).map((c) => c.name),
    [commands],
  );
  const query = parseSlashCommandQuery(input, { caret, argumentNames });
  const exactCommand = query
    ? (commands.find((command) => command.name === query.name) ?? null)
    : null;
  // `/model foo` filters the model list; any other command with an argument is
  // a finished invocation, so the menu closes.
  const submenu = query?.hasArgument ? exactCommand?.submenu ?? null : null;

  const commandQuery = query && !submenu ? query.name : null;
  const filteredCommands = useMemo(
    () =>
      commandQuery === null ? [] : filterSlashCommands(commands, commandQuery),
    [commands, commandQuery],
  );
  const submenuModels = useMemo(
    () =>
      submenu === "model"
        ? filterSlashCommandModels(models ?? [], query?.argument ?? "")
        : null,
    [models, query?.argument, submenu],
  );

  const rows = submenuModels
    ? toSlashCommandModelRows(submenuModels)
    : toSlashCommandRows(filteredCommands);
  // An inline token with no match is most likely a path or a fraction, so the
  // menu stays closed instead of announcing "no commands match".
  const menuOpen =
    query !== null &&
    input !== dismissedQuery &&
    (submenu !== null || !query.hasArgument) &&
    (!query.inline || rows.length > 0);
  // A `#` word at the caret offers the project's files not yet attached. A
  // token with no match stays closed, like a slash token: "#5" is prose.
  const mention =
    query === null && attachmentsEnabled && projectFiles.length > 0
      ? parseFileMention(input, caret)
      : null;
  const mentionRows = useMemo(() => {
    if (!mention) return [];
    const attached = new Set(readyParts.map((part) => part.url));
    return filterFileMentions(projectFiles, mention.query).filter(
      (file) => !attached.has(file.url),
    );
  }, [mention, projectFiles, readyParts]);
  const mentionOpen =
    mention !== null && input !== dismissedQuery && mentionRows.length > 0;
  // Filtering shrinks the list under the cursor, so clamp on read rather than
  // syncing an effect against the row count.
  const activeRow = Math.min(
    activeIndex,
    Math.max(0, (mentionOpen ? mentionRows.length : rows.length) - 1),
  );

  function closeMenu() {
    setDismissedQuery(input);
    setActiveIndex(0);
  }

  function replaceDraft(next: string, nextCaret = next.length) {
    pendingCaretRef.current = nextCaret;
    setInput(next);
    setDismissedQuery(null);
    setActiveIndex(0);
    textareaRef.current?.focus({ preventScroll: true });
  }

  /** Swaps the invocation span for `text`, leaving the rest of the draft. */
  function replaceInvocation(text: string) {
    if (!query) return;
    const next = replaceSlashCommandSpan(input, query, text);
    replaceDraft(next.value, next.caret);
  }

  function runCommand(command: SlashCommand) {
    if (!isSlashCommandAvailable(command)) return;
    if (command.submenu) {
      replaceInvocation(`/${command.name} `);
      return;
    }
    // Drop the invocation before running, keeping whatever else was typed:
    // "/search what's new" leaves the question, "find me /search" leaves the
    // sentence. Navigation then unmounts the composer with the draft saved.
    replaceInvocation(query?.argument ?? "");
    if (command.action === "attach") fileInputRef.current?.click();
    else if (command.action === "dictate") startDictation();
    else command.run?.();
  }

  /** Attaches the file and drops the `#` token, keeping the rest of the draft. */
  function attachMention(file: ProjectFileItem) {
    if (!mention) return;
    const next = replaceSlashCommandSpan(input, mention, "");
    replaceDraft(next.value, next.caret);
    addReadyParts(
      [{ type: "file", url: file.url, filename: file.filename, mediaType: file.mediaType }],
      new Map([[file.url, file]]),
    );
  }

  function handleMentionKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ): boolean {
    if (!mentionOpen) return false;
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      return true;
    }
    if ((e.key === "Enter" && !e.shiftKey) || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      attachMention(mentionRows[activeRow]);
      return true;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((activeRow + delta + mentionRows.length) % mentionRows.length);
      return true;
    }
    return false;
  }

  function selectRow(row: SlashCommandRow) {
    if (row.kind === "model") {
      replaceInvocation("");
      commandActions.onSelectModel(row.model.id);
      return;
    }
    runCommand(row.command);
  }

  /** Returns true when the menu consumed the key. */
  function handleMenuKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ): boolean {
    if (!query) return false;

    if (e.key === "Escape" && menuOpen) {
      e.preventDefault();
      // Back out of the submenu one level before closing the menu.
      if (submenu) replaceInvocation(`/${query.name}`);
      else closeMenu();
      return true;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      if (menuOpen && rows.length > 0) {
        e.preventDefault();
        selectRow(rows[activeRow]);
        return true;
      }
      // With the menu closed, a draft that is only a fully typed command still
      // runs on Enter instead of sending "/temporary" as a message. An inline
      // token whose menu was dismissed is prose and sends as typed.
      if (!submenu && !query.inline) {
        const command = resolveSlashCommand(commands, query);
        if (command && isSlashCommandAvailable(command) && !command.submenu) {
          e.preventDefault();
          runCommand(command);
          return true;
        }
      }
      return false;
    }

    if (!menuOpen || rows.length === 0) return false;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((activeRow + delta + rows.length) % rows.length);
      return true;
    }

    if (e.key === "Tab" && !e.shiftKey && !submenu) {
      e.preventDefault();
      const command = filteredCommands[activeRow];
      if (command) {
        replaceInvocation(`/${command.name}${command.submenu ? " " : ""}`);
      }
      return true;
    }

    return false;
  }

  function submit() {
    const text = input.trim();
    if (uploading || textInputDisabled) return;
    if (streaming && text.toLowerCase() === "/compact" && !readyParts.length) return;
    // Staged quotes alone do not send: they wait for something said about them.
    if (!text && readyParts.length === 0) return;
    if (!configured) return;
    // A typed command runs as itself and leaves the quotes staged.
    const command =
      text.toLowerCase() === "/compact" && readyParts.length === 0;
    const message = command
      ? text
      : formatQuotedMessage(
          quotes.map((quote) => quote.text),
          text,
        );
    if (onSubmit(message, readyParts) === false) return;
    if (!command) setQuotes([]);
    clearDraft();
    setDismissedQuery(null);
    setActiveIndex(0);
    clearAttachments();
  }

  function handleFiles(files: FileList | null) {
    if (!attachmentsEnabled || !files || files.length === 0) return;
    addFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return;
    if (handleMentionKeyDown(e)) return;
    if (handleMenuKeyDown(e)) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (!attachmentsEnabled) return;
    const files = getDataTransferFiles(e.clipboardData);
    if (files.length === 0) return;
    e.preventDefault();
    addFiles(files);
  }

  return (
    <>
      <DictateError
        error={dictation.error}
        isAdmin={isAdmin}
        onDismiss={dictation.clearError}
        onRecordAgain={() => {
          onBeforeDictate?.();
          void dictation.start();
        }}
      />
      <MessageQueue {...chatQueue} />
      <div className="relative">
        {mentionOpen && (
          <FileMentionMenu
            id={listboxId}
            optionIdPrefix={optionIdPrefix}
            files={mentionRows}
            activeIndex={activeRow}
            onActiveIndexChange={setActiveIndex}
            onSelect={attachMention}
          />
        )}
        {menuOpen && query && (
          <SlashCommandMenu
            id={listboxId}
            optionIdPrefix={optionIdPrefix}
            commands={filteredCommands}
            models={submenuModels}
            selectedModelId={selectedModelId}
            activeIndex={activeRow}
            query={query.name}
            onActiveIndexChange={setActiveIndex}
            onSelect={selectRow}
          />
        )}
        <div
          className={cn(
            "flex flex-col gap-2 rounded-3xl border bg-background px-3.5 pt-3.5 pb-2.5 shadow-sm motion-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring",
            dropActive && "border-ring bg-accent/20 ring-2 ring-ring/30",
          )}
        >
          {imageOptions && onImageOptions && <ImageOptions value={imageOptions} model={imageModel} supportsQuality={imageSupportsQuality} configuredSize={imageConfiguredSize} onChange={onImageOptions} onClose={() => onImageOptions(undefined)} />}
          {quotes.length > 0 && (
            <ul
              aria-label="引用的文字"
              className="flex max-h-40 flex-col gap-1.5 overflow-y-auto"
            >
              {quotes.map((quote) => (
                <li
                  key={quote.id}
                  className="flex items-center gap-2 rounded-xl bg-muted py-1.5 pr-1.5 pl-3 text-sm text-muted-foreground"
                >
                  <Reply className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    “{quote.text}”
                  </span>
                  <button
                    type="button"
                    aria-label="移除引用"
                    title="移除引用"
                    className="shrink-0 rounded-md p-1 motion-colors hover:bg-accent hover:text-foreground"
                    onClick={() => {
                      setQuotes((current) =>
                        current.filter((item) => item.id !== quote.id),
                      );
                      textareaRef.current?.focus({ preventScroll: true });
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1 pt-1">
              {attachments.map((att) => (
                <AttachmentChip
                  key={att.id}
                  attachment={att}
                  onRemove={() => removeAttachment(att.id)}
                />
              ))}
            </div>
          )}
          <Textarea
            ref={textareaRef}
            rows={1}
            placeholder={
              textInputDisabled
                ? "恢复语音后继续"
                : configured
                  ? quotes.length > 0
                    ? "回复…"
                    : projectFiles.length > 0
                      ? "输入消息…，/ 查看命令，# 引用项目文件"
                      : "输入消息…，或按 / 查看命令"
                  : models === null || models.length > 0
                    ? "正在加载模型…"
                    : "尚未配置模型"
            }
            className="max-h-48 min-h-10 resize-none border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0 md:text-sm dark:bg-transparent"
            value={input}
            disabled={textInputDisabled}
            onChange={(e) => {
              setInput(e.target.value);
              setCaret(e.target.selectionStart);
              setActiveIndex(0);
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            // The textarea stays focused and owns the keyboard; the menu below is
            // the listbox it controls.
            role="combobox"
            aria-expanded={menuOpen || mentionOpen}
            aria-controls={menuOpen || mentionOpen ? listboxId : undefined}
            aria-activedescendant={
              mentionOpen || (menuOpen && rows.length > 0)
                ? `${optionIdPrefix}-${activeRow}`
                : undefined
            }
            aria-autocomplete="list"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept={ATTACH_ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => void handleFiles(e.target.files)}
              />
              <Menu.Root>
                <Menu.Trigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-full"
                      aria-label="添加到消息"
                      disabled={!attachmentsEnabled && !searchAvailable && !openuiAvailable}
                    />
                  }
                >
                  <Plus />
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner side="top" align="start" sideOffset={8}>
                    <Menu.Popup
                      className={cn(
                        "z-50 w-72 rounded-xl border bg-popover p-1.5 text-sm text-popover-foreground shadow-md outline-none",
                        motionClasses.popup,
                      )}
                    >
                      <Menu.Item
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading || !attachmentsEnabled}
                        className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 outline-none motion-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                      >
                        <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">
                            添加图片和文件
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            从本机上传
                          </span>
                        </span>
                      </Menu.Item>
                      <Menu.Item
                        onClick={() => setLibraryOpen(true)}
                        disabled={!attachmentsEnabled}
                        className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 outline-none motion-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                      >
                        <Library className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">从文件库添加</span>
                          <span className="block text-xs text-muted-foreground">复用对话中的文件</span>
                        </span>
                      </Menu.Item>
                      {imageAvailable && <Menu.Item
                        disabled={!attachmentsEnabled}
                        onClick={() => onImageOptions?.(imageOptions ? undefined : { size: "auto", quality: "auto" })}
                        className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent"
                      >
                        <ImageIcon className="size-4 text-muted-foreground" />
                        <span><span className="block font-medium">生成图片</span><span className="block text-xs text-muted-foreground">{imageModel}</span></span>
                      </Menu.Item>}
                      <Menu.CheckboxItem
                        checked={searchRequested}
                        onCheckedChange={onToggleSearch}
                        closeOnClick
                        disabled={!searchAvailable}
                        className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 outline-none motion-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                      >
                        <Globe className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">联网搜索</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {searchAvailable
                              ? "始终为这条消息联网搜索"
                              : searchUnavailableReason}
                          </span>
                        </span>
                        <span className="flex size-4 shrink-0 items-center justify-center">
                          {searchRequested ? <Check className="size-3.5" /> : null}
                        </span>
                      </Menu.CheckboxItem>
                      <Menu.CheckboxItem
                        checked={openuiRequested}
                        onCheckedChange={onToggleOpenUI}
                        closeOnClick
                        disabled={!openuiAvailable}
                        className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 outline-none motion-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                      >
                        <LayoutDashboard className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">交互式界面</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {openuiAvailable
                              ? "渲染 OpenUI 交互式组件"
                              : openuiUnavailableReason}
                          </span>
                        </span>
                        <span className="flex size-4 shrink-0 items-center justify-center">
                          {openuiRequested ? <Check className="size-3.5" /> : null}
                        </span>
                      </Menu.CheckboxItem>
                      {connectors.map((connector) => (
                        <Menu.CheckboxItem
                          key={connector.id}
                          checked={connector.active}
                          onCheckedChange={() =>
                            onToggleConnector?.(connector.id)
                          }
                          closeOnClick
                          disabled={Boolean(connector.lockedReason)}
                          className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 outline-none motion-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                        >
                          <connector.icon className="size-4" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">
                              {connector.title}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {connector.lockedReason ?? connector.description}
                            </span>
                          </span>
                          <span className="flex size-4 shrink-0 items-center justify-center">
                            {connector.active ? (
                              <Check className="size-3.5" />
                            ) : null}
                          </span>
                        </Menu.CheckboxItem>
                      ))}
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
              {searchRequested && (
                <button
                  type="button"
                  onClick={onToggleSearch}
                  className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-accent px-2.5 text-xs font-medium text-accent-foreground outline-none motion-colors hover:bg-accent/80 focus-visible:ring-3 focus-visible:ring-ring/50 max-md:size-10 max-md:justify-center max-md:px-0"
                  aria-label="从这条消息中移除联网搜索"
                >
                  <Globe className="size-3.5" />
                  <span className="max-md:hidden">联网搜索</span>
                  <X className="size-3 max-md:hidden" />
                </button>
              )}
              {openuiRequested && (
                <button
                  type="button"
                  onClick={onToggleOpenUI}
                  className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-accent px-2.5 text-xs font-medium text-accent-foreground outline-none motion-colors hover:bg-accent/80 focus-visible:ring-3 focus-visible:ring-ring/50 max-md:size-10 max-md:justify-center max-md:px-0"
                  aria-label="从这条消息中移除交互式界面"
                >
                  <LayoutDashboard className="size-3.5" />
                  <span className="max-md:hidden">交互式界面</span>
                  <X className="size-3 max-md:hidden" />
                </button>
              )}
              {connectors.map((connector) =>
                !connector.active || connector.ambient ? null : connector.lockedReason ? (
                  <span
                    key={connector.id}
                    title={`${connector.title} 已在此对话中开启`}
                    className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-accent px-2.5 text-xs font-medium text-accent-foreground max-md:size-10 max-md:justify-center max-md:px-0"
                  >
                    <connector.icon className="size-3.5" />
                    <span className="max-md:hidden">{connector.title}</span>
                  </span>
                ) : (
                  <button
                    key={connector.id}
                    type="button"
                    onClick={() => onToggleConnector?.(connector.id)}
                    className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-accent px-2.5 text-xs font-medium text-accent-foreground outline-none motion-colors hover:bg-accent/80 focus-visible:ring-3 focus-visible:ring-ring/50 max-md:size-10 max-md:justify-center max-md:px-0"
                    aria-label={`从此对话移除 ${connector.title}`}
                  >
                    <connector.icon className="size-3.5" />
                    <span className="max-md:hidden">{connector.title}</span>
                    <X className="size-3 max-md:hidden" />
                  </button>
                ),
              )}
              <ModelPicker
                models={models}
                selectedId={selectedModelId}
                onSelect={commandActions.onSelectModel}
                reasoningControls={reasoningControls}
                reasoningLevel={reasoningLevel}
                onSelectReasoningLevel={onSelectReasoningLevel}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <DictateButton
                dictation={dictation}
                disabled={voiceActive}
                onBeforeStart={onBeforeDictate}
              />
              {streaming && (
                <Button
                  size="icon-sm"
                  variant="secondary"
                  className="shrink-0 rounded-full"
                  onClick={onStop}
                  aria-label="停止生成"
                >
                  <Square className="size-3 fill-current" />
                </Button>
              )}
              {voiceActive && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  className="shrink-0 rounded-full"
                  onClick={onEndVoice}
                  disabled={textInputDisabled}
                  aria-label="结束语音会话"
                >
                  <X />
                </Button>
              )}
              {!voiceActive && !streaming && voiceInstalled &&
                voiceEligible &&
                !input.trim() &&
                readyParts.length === 0 ? (
                <Button
                  type="button"
                  variant="default"
                  size="icon-sm"
                  className="shrink-0 rounded-full"
                  onClick={onStartVoice}
                  disabled={!voiceAvailable}
                  aria-label="开始语音对话"
                  title={
                    voiceAvailable ? "语音对话" : voiceUnavailableReason
                  }
                >
                  <AudioLines />
                </Button>
              ) : (
                <Button
                  size="icon-sm"
                  className="shrink-0 rounded-full"
                  disabled={
                    textInputDisabled || uploading ||
                    (!input.trim() &&
                      readyParts.length === 0)
                  }
                  onClick={submit}
                  aria-label={streaming ? "排队发送消息" : "发送消息"}
                  title={streaming ? "当前回复结束后发送" : "发送消息"}
                >
                  {uploading ? <Loader2 className={motionClasses.spinner} /> : <ArrowUp />}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      {libraryOpen && attachmentsEnabled && (
        <LibraryPicker
          attachedUrls={new Set(readyParts.map((part) => part.url))}
          onClose={() => {
            setLibraryOpen(false);
            textareaRef.current?.focus({ preventScroll: true });
          }}
          onAdd={(items) => addReadyParts(
            items.map((item) => ({
              type: "file" as const,
              url: item.url,
              filename: item.filename,
              mediaType: item.mediaType,
            })),
            new Map(items.map((item) => [item.url, item])),
          )}
        />
      )}
    </>
  );
});

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: ChatAttachment;
  onRemove: () => void;
}) {
  const { status, meta, part } = attachment;
  const label = attachment.filename;
  const isImage =
    meta?.category === "image" ||
    Boolean(attachment.previewUrl) ||
    attachment.mediaType.startsWith("image/");
  const removeButton = (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`移除 ${label}`}
      className="absolute top-0.5 right-0.5 rounded-full bg-foreground/70 p-0.5 text-background shadow-sm motion-colors hover:bg-foreground max-md:p-1"
    >
      <X className="size-3" />
    </button>
  );

  // Images render as a thumbnail while uploading/ready. On failure we fall back
  // to the row chip below so the actual error reason has room to show.
  if (isImage && status !== "error") {
    const src = attachment.previewUrl ?? (part?.url && serverUrl(part.url));
    return (
      <div className="group/chip relative h-16 w-16 overflow-hidden rounded-lg border bg-muted">
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={label} className="size-full object-cover" />
        )}
        {status === "uploading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <Loader2 className={`size-4 text-foreground ${motionClasses.spinner}`} />
          </div>
        )}
        {removeButton}
      </div>
    );
  }

  const sub =
    status === "error"
      ? (attachment.error ?? "上传失败")
      : [
          meta?.pageCount ? `${meta.pageCount} 页` : null,
          meta?.size != null ? formatSize(meta.size) : null,
          meta?.truncated ? "已截断" : null,
        ]
          .filter(Boolean)
          .join(" · ");
  return (
    <div
      className={cn(
        "group/chip relative flex items-center gap-2 rounded-lg border bg-muted/40 py-2 pr-8 pl-2 max-w-[18rem]",
        status === "error" && "border-destructive/40 bg-destructive/5",
      )}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
        {status === "uploading" ? (
          <Loader2 className={`size-4 ${motionClasses.spinner}`} />
        ) : status === "error" ? (
          <AlertCircle className="size-4 text-destructive" />
        ) : (
          <CategoryIcon category={meta?.category} className="size-4" />
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium">{label}</div>
        {sub && (
          <div
            className={cn(
              "truncate text-[11px] text-muted-foreground",
              status === "error" && "text-destructive",
            )}
            title={status === "error" ? sub : undefined}
          >
            {sub}
          </div>
        )}
      </div>
      {removeButton}
    </div>
  );
}
