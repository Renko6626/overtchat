"use client";

import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Menu } from "@base-ui/react/menu";
import {
  Activity,
  Check,
  CheckCheck,
  ChevronRight,
  ListFilter,
  GripVertical,
  FolderPlus,
  History,
  Library,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  RefreshCw,
  Search,
  SquarePen,
} from "lucide-react";
import type {
  AgentConnectionListItem,
  AgentProviderId,
} from "@overtchat/agent-bridge";
import { agentProviderMetadata } from "@overtchat/agent-bridge";
import { SidebarChatList, SidebarItem } from "@/components/SidebarChatList";
import {
  SidebarProjects,
  CreateProjectDialog,
} from "@/components/SidebarProjects";
import { SidebarAgentWorkspaces } from "@/components/SidebarAgentWorkspaces";
import { SidebarAgentStatusList } from "@/components/SidebarAgentStatusList";
import {
  useAgentSidebarGrouping,
  type AgentSidebarGrouping,
} from "@/components/agents/useAgentSidebarGrouping";
import {
  SidebarModeToggle,
  useSidebarMode,
} from "@/components/SidebarModeToggle";
import {
  agentAttentionCounts,
  agentAttentionSections,
} from "@/lib/agents/attention";
import { groupAgentWorkspaces } from "@/lib/agents/workspaces";
import { useSetAgentSessionRead } from "@/lib/queries/agentSessionRead";
import { useSidebar } from "@/components/sidebar-context";
import { useActiveChatIds, useChats } from "@/lib/queries/chats";
import { usePublicCapabilities } from "@/lib/queries/capabilities";
import { useProjects } from "@/lib/queries/projects";
import {
  useAgentConnections,
  useRefreshAllAgentWorkspaces,
} from "@/lib/queries/agentConnections";
import { LinkPendingIndicator } from "@/components/ui/link-pending-indicator";
import { toast } from "@/components/ui/toast";
import { motionClasses } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function SidebarClient({ isAdmin }: { isAdmin: boolean }) {
  const { closeMobile, closeSidebar, openPalette, pinFocusRef } = useSidebar();
  const [creatingProject, setCreatingProject] = useState(false);
  const router = useRouter();
  const pathname = useLocation({ select: (location) => location.pathname });

  const { data: capabilities } = usePublicCapabilities();
  const pinningSupported = capabilities?.capabilities.chatPinning === true;
  const { data: chats = [] } = useChats();
  const { data: activeChatIds = [] } = useActiveChatIds();
  const { data: projects = [] } = useProjects();
  const activeChats = useMemo(() => new Set(activeChatIds), [activeChatIds]);

  // Run after React commits the refetched lists, when the destination row exists.
  useLayoutEffect(() => {
    const request = pinFocusRef.current;
    if (!request) return;
    const chat = chats.find((item) => item.id === request.id);
    if (chat ? chat.pinned !== request.pinned : request.pinned) return;
    pinFocusRef.current = null;
    if (!request.fromMenu && request.row.isConnected) return;
    const focused = document.activeElement;
    if (
      focused !== document.body && focused !== request.focusedElement &&
      !request.row.contains(focused)
    ) return;
    const target = request.sidebar.querySelector<HTMLAnchorElement>(
      `[data-chat-id="${CSS.escape(request.id)}"] a`,
    );
    (target ?? request.sidebar.querySelector<HTMLButtonElement>(
      'button[aria-label="搜索对话"]',
    ))?.focus();
  }, [chats, pinFocusRef]);

  const projectOptions = useMemo(
    () => projects.map((p) => ({ id: p.id, name: p.name })),
    [projects],
  );

  const unprojected = useMemo(
    () =>
      chats
        .filter((c) => c.projectId == null && !c.pinned)
        .map((c) => ({
          id: c.id,
          title: c.title,
          pinned: c.pinned,
          kind: c.kind,
          updatedAt: c.updatedAt,
        })),
    [chats],
  );

  const projectsWithChats = useMemo(() => {
    const byProject = new Map<
      string,
      { id: string; title: string | null; kind: "text" | "voice"; pinned?: boolean }[]
    >();
    for (const c of chats) {
      if (!c.projectId) continue;
      const list = byProject.get(c.projectId) ?? [];
      list.push({ id: c.id, title: c.title, kind: c.kind, pinned: c.pinned });
      byProject.set(c.projectId, list);
    }
    return projectOptions.map((p) => ({
      ...p,
      chats: byProject.get(p.id) ?? [],
    }));
  }, [chats, projectOptions]);

  const chatSidebar = (
    <>
      <nav className="flex flex-col gap-0.5 py-1">
        <Link
          to="/"
          onClick={(e) => {
            closeMobile();
            if (pathname === "/") {
              // Reloading `/` starts a new draft and keeps its project.
              e.preventDefault();
              void router.invalidate();
            }
          }}
          className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm motion-colors hover:bg-sidebar-accent"
        >
          <Pencil className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1">新对话</span>
          <Shortcut keys={["Ctrl", "Shift", "O"]} />
          <LinkPendingIndicator to="/" />
        </Link>
        <button
          type="button"
          aria-label="搜索对话"
          onClick={() => {
            closeMobile();
            openPalette();
          }}
          className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm motion-colors hover:bg-sidebar-accent"
        >
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left">搜索对话</span>
          <Shortcut keys={["Ctrl", "K"]} />
        </button>
        <Link
          to="/library"
          onClick={closeMobile}
          aria-current={pathname === "/library" ? "page" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm motion-colors hover:bg-sidebar-accent",
            pathname === "/library" && "bg-sidebar-accent",
          )}
        >
          <Library className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1">文件库</span>
          <LinkPendingIndicator to="/library" />
        </Link>
        <Link
          to="/activity"
          onClick={closeMobile}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm motion-colors hover:bg-sidebar-accent",
            pathname.startsWith("/activity") && "bg-sidebar-accent",
          )}
        >
          <Activity className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1">活动</span>
          <LinkPendingIndicator to="/activity" />
        </Link>
      </nav>

      {chats.some((chat) => chat.pinned) && (
        <section aria-label="置顶对话">
          <SectionLabel>置顶</SectionLabel>
          <ul className="flex flex-col gap-0.5">
            {chats.filter((chat) => chat.pinned).map((chat) => (
              <SidebarItem
                key={chat.id}
                chat={chat}
                projects={projectOptions}
                currentProjectId={chat.projectId}
                generating={activeChats.has(chat.id)}
                pinningSupported={pinningSupported}
              />
            ))}
          </ul>
        </section>
      )}

      <SectionLabel>项目</SectionLabel>
      <SidebarProjects
        projects={projectsWithChats}
        activeChatIds={activeChats}
        pinningSupported={pinningSupported}
      />
      <button
        type="button"
        onClick={() => setCreatingProject(true)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground motion-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        <FolderPlus className="size-4 shrink-0" />
        <span>新建项目</span>
      </button>


      <SidebarChatList
        chats={unprojected}
        emptyMessage={chats.length > 0 ? "暂无最近对话" : "暂无对话"}
        projects={projectOptions}
        activeChatIds={activeChats}
        pinningSupported={pinningSupported}
      />
    </>
  );

  return (
    <>
      <div data-titlebar data-titlebar-inset className="flex h-12 shrink-0 items-center justify-between px-3">
        <span className="font-brand text-sm font-semibold tracking-tight">overtchat</span>
        <button
          type="button"
          onClick={closeSidebar}
          aria-label="收起侧边栏"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground max-md:p-2.5"
        >
          <PanelLeft className="size-4" />
        </button>
      </div>

      {isAdmin ? (
        <AdminSidebarBody chat={chatSidebar} />
      ) : (
        <div className="flex-1 overflow-y-auto px-2 pb-2">{chatSidebar}</div>
      )}

      <CreateProjectDialog
        open={creatingProject}
        onClose={() => setCreatingProject(false)}
      />
    </>
  );
}

/** Admins switch between chats and agents; agent state shows in both. */
function AdminSidebarBody({ chat }: { chat: React.ReactNode }) {
  const { data: capabilities } = usePublicCapabilities();
  const agentsEnabled = capabilities?.capabilities.agents === true;
  const mode = useSidebarMode();
  const { data: connections = [], isPending } = useAgentConnections();
  const agentCounts = useMemo(
    () => agentAttentionCounts(connections),
    [connections],
  );
  if (!agentsEnabled) {
    return <div className="flex-1 overflow-y-auto px-2 pb-2">{chat}</div>;
  }
  return (
    <>
      <SidebarModeToggle mode={mode} agentCounts={agentCounts} />
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {mode === "agents" ? (
          <AgentsSidebar connections={connections} isPending={isPending} />
        ) : (
          chat
        )}
      </div>
    </>
  );
}

function AgentsSidebar({
  connections,
  isPending,
}: {
  connections: AgentConnectionListItem[];
  isPending: boolean;
}) {
  const { closeMobile } = useSidebar();
  const pathname = useLocation({ select: (location) => location.pathname });
  return (
    <>
      <nav aria-label="智能体" className="flex flex-col gap-0.5 py-1">
        <Link
          to="/agents"
          onClick={closeMobile}
          className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm motion-colors hover:bg-sidebar-accent"
        >
          <SquarePen className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1">新建智能体</span>
          <LinkPendingIndicator to="/agents" />
        </Link>
        <Link
          to="/agents/history"
          onClick={closeMobile}
          aria-current={pathname === "/agents/history" ? "page" : undefined}
          className={cn(
            "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm motion-colors hover:bg-sidebar-accent",
            pathname === "/agents/history" && "bg-sidebar-accent",
          )}
        >
          <History className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1">历史记录</span>
          <LinkPendingIndicator to="/agents/history" />
        </Link>
      </nav>
      <AgentSessionList connections={connections} isPending={isPending} />
    </>
  );
}

/** The agent sessions, grouped by status or by workspace. */
function AgentSessionList({
  connections,
  isPending,
}: {
  connections: AgentConnectionListItem[];
  isPending: boolean;
}) {
  const [grouping, setGrouping] = useAgentSidebarGrouping();
  const refresh = useRefreshAllAgentWorkspaces();
  const [organizing, setOrganizing] = useState(false);
  const doneRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<HTMLButtonElement>(null);
  const previousOrganizing = useRef(organizing);
  useEffect(() => {
    if (previousOrganizing.current === organizing) return;
    previousOrganizing.current = organizing;
    (organizing ? doneRef : optionsRef).current?.focus();
  }, [organizing]);
  const { closeMobile, drawerRef } = useSidebar();
  const [providerFilter, setProviderFilter] = useState<AgentProviderId | null>(
    null,
  );
  const hasWorkspaces = connections.some(
    (connection) => connection.workspaces.length > 0,
  );
  const providers = useMemo(
    () =>
      [
        ...new Set(
          connections
            .filter((connection) => connection.workspaces.length > 0)
            .map((connection) => connection.provider),
        ),
      ].sort(),
    [connections],
  );
  const activeProviderFilter =
    providerFilter && providers.includes(providerFilter)
      ? providerFilter
      : null;
  const setRead = useSetAgentSessionRead();
  const readySessionIds = useMemo(
    () =>
      agentAttentionSections(
        groupAgentWorkspaces(connections),
        activeProviderFilter,
      ).ready.map(({ item }) => item.session.id),
    [connections, activeProviderFilter],
  );

  if (!hasWorkspaces) {
    return (
      <>
        <AgentListLabel>工作区</AgentListLabel>
        {isPending ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            正在加载工作区…
          </p>
        ) : (
          <>
            <p className="px-2 py-1 text-xs text-muted-foreground">
              连接文件夹即可开始智能体会话。
            </p>
            <Link
              to="/settings/connections"
              search={{ add: "1" }}
              onClick={closeMobile}
              className="flex min-h-8 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground motion-colors hover:bg-sidebar-accent hover:text-foreground max-md:min-h-11"
            >
              <FolderPlus aria-hidden="true" className="size-4 shrink-0" />
              <span>添加工作区</span>
            </Link>
          </>
        )}
      </>
    );
  }

  async function refreshSessions() {
    try {
      const result = await refresh.mutateAsync();
      const synced = result.created + result.refreshed;
      if (synced === 0) {
        toast.error({
          title: "无法刷新会话",
          description: result.failures[0]?.message,
        });
      } else if (result.failures.length > 0) {
        toast.warning({
          title: "会话已刷新，但出现错误",
          description: `已同步 ${synced} 个智能体工作区；${result.failures.length} 个失败。`,
        });
      } else {
        toast.success({
          title: "会话已刷新",
          description: `已同步 ${synced} 个智能体工作区。`,
        });
      }
    } catch (error) {
      toast.error({
        title: "无法刷新会话",
        description:
          error instanceof Error ? error.message : "刷新失败。",
      });
    }
  }

  return (
    <>
      <AgentListLabel
        action={
          organizing ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs normal-case tracking-normal"
              ref={doneRef}
              onClick={() => setOrganizing(false)}
            >
              完成
            </Button>
          ) : (
            <span className="flex items-center gap-0.5">
              <Menu.Root>
                <Menu.Trigger
                  ref={optionsRef}
                  aria-label={
                    activeProviderFilter
                      ? `智能体列表选项，已按 ${agentProviderMetadata(activeProviderFilter).label} 筛选`
                      : "智能体列表选项"
                  }
                  title={
                    activeProviderFilter
                      ? `列表选项 · 已按 ${agentProviderMetadata(activeProviderFilter).label} 筛选`
                      : "列表选项"
                  }
                  className={cn(
                    "relative flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground motion-colors hover:bg-sidebar-accent hover:text-foreground",
                    activeProviderFilter && "bg-sidebar-accent text-foreground",
                  )}
                >
                  <MoreHorizontal aria-hidden="true" className="size-3.5" />
                  {activeProviderFilter && (
                    <span
                      aria-hidden="true"
                      className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-primary"
                    />
                  )}
                </Menu.Trigger>
                <Menu.Portal container={drawerRef}>
                  <Menu.Positioner side="bottom" align="end" sideOffset={6}>
                    <Menu.Popup
                      className={cn(
                        "z-50 w-48 rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md outline-none",
                        motionClasses.popup,
                      )}
                    >
                      <Menu.RadioGroup
                        value={grouping}
                        onValueChange={(value) =>
                          setGrouping(value as AgentSidebarGrouping)
                        }
                      >
                        <Menu.GroupLabel className="px-2 pt-1 pb-0.5 text-xs text-muted-foreground">
                          分组方式
                        </Menu.GroupLabel>
                        <RadioMenuItem value="status" label="状态" />
                        <RadioMenuItem
                          value="workspace"
                          label="工作区"
                        />
                      </Menu.RadioGroup>
                      {providers.length > 1 && (
                        <Menu.SubmenuRoot>
                          <Menu.SubmenuTrigger className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 outline-none motion-colors data-[highlighted]:bg-accent data-[popup-open]:bg-accent">
                            <ListFilter className="size-3.5 text-muted-foreground" />
                            <span>按智能体筛选</span>
                            <ChevronRight className="ml-auto size-3.5 text-muted-foreground" />
                          </Menu.SubmenuTrigger>
                          <Menu.Portal container={drawerRef}>
                            <Menu.Positioner
                              side="right"
                              align="start"
                              sideOffset={6}
                            >
                              <Menu.Popup
                                className={cn(
                                  "z-50 w-48 rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md outline-none",
                                  motionClasses.popup,
                                )}
                              >
                                <Menu.RadioGroup
                                  value={activeProviderFilter ?? "all"}
                                  onValueChange={(value) =>
                                    setProviderFilter(
                                      value === "all"
                                        ? null
                                        : (value as AgentProviderId),
                                    )
                                  }
                                >
                                  <RadioMenuItem
                                    value="all"
                                    label="所有智能体"
                                  />
                                  {providers.map((provider) => (
                                    <RadioMenuItem
                                      key={provider}
                                      value={provider}
                                      label={
                                        agentProviderMetadata(provider).label
                                      }
                                    />
                                  ))}
                                </Menu.RadioGroup>
                              </Menu.Popup>
                            </Menu.Positioner>
                          </Menu.Portal>
                        </Menu.SubmenuRoot>
                      )}
                      <Menu.Separator className="mx-1 my-1 h-px bg-border" />
                      {readySessionIds.length > 0 && (
                        <Menu.Item
                          onClick={() => {
                            for (const sessionId of readySessionIds) {
                              setRead.mutate({ sessionId, read: true });
                            }
                          }}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 outline-none motion-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                        >
                          <CheckCheck className="size-3.5 text-muted-foreground" />
                          <span>全部标为已读</span>
                        </Menu.Item>
                      )}
                      {grouping === "workspace" && (
                        <Menu.Item
                          onClick={() => setOrganizing(true)}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 outline-none motion-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                        >
                          <GripVertical className="size-3.5 text-muted-foreground" />
                          <span>整理工作区</span>
                        </Menu.Item>
                      )}
                      <Menu.Item
                        render={
                          <Link
                            to="/settings/connections"
                            search={{ add: "1" }}
                            onClick={closeMobile}
                          />
                        }
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 outline-none motion-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                      >
                        <FolderPlus className="size-3.5 text-muted-foreground" />
                        <span>添加工作区…</span>
                      </Menu.Item>
                      <Menu.Item
                        disabled={refresh.isPending}
                        onClick={() => void refreshSessions()}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 outline-none motion-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                      >
                        <RefreshCw
                          className={cn(
                            "size-3.5 shrink-0 text-muted-foreground",
                            refresh.isPending &&
                              "animate-spin motion-reduce:animate-none",
                          )}
                        />
                        <span>刷新会话</span>
                      </Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </span>
          )
        }
      >
        {grouping === "workspace" ? "工作区" : "会话"}
      </AgentListLabel>
      {grouping === "workspace" ? (
        <SidebarAgentWorkspaces
          connections={connections}
          providerFilter={activeProviderFilter}
          organizing={organizing}
        />
      ) : (
        <SidebarAgentStatusList
          connections={connections}
          providerFilter={activeProviderFilter}
        />
      )}
    </>
  );
}

function RadioMenuItem({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <Menu.RadioItem
      value={value}
      closeOnClick
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 outline-none motion-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
    >
      <span>{label}</span>
      <span className="ml-auto flex size-4 items-center justify-center">
        <Menu.RadioItemIndicator>
          <Check className="size-3.5" />
        </Menu.RadioItemIndicator>
      </span>
    </Menu.RadioItem>
  );
}

function SectionLabel({
  children,
  badge,
  action,
}: {
  children: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mt-4 mb-1 flex min-h-6 items-center gap-2 px-2">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {children}
        </span>
        {badge}
      </div>
      {action}
    </div>
  );
}

function AgentListLabel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mt-3 mb-0.5 flex min-h-6 items-center gap-2 px-2">
      <h2 className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {children}
      </h2>
      {action}
    </div>
  );
}

function Shortcut({ keys }: { keys: string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground opacity-0 motion-opacity group-hover:opacity-100">
      {keys.map((k) => (
        <kbd
          key={k}
          className="rounded border border-sidebar-border bg-sidebar-accent/50 px-1 py-px font-sans leading-none"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
