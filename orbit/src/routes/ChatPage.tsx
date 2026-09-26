import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Hash,
  Lock,
  MessageSquare,
  Plus,
  Send,
  SmilePlus,
  User,
  X,
  Kanban,
} from "lucide-react";
import { boardsApi, chatApi } from "../api/endpoints";
import { request } from "../api/client";
import type { Channel, Message } from "../api/types";
import {
  Avatar,
  Badge,
  Button,
  CenterState,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  SubSidebar,
  SubSidebarToggle,
} from "../components/ui";
import { useAuth } from "../state/auth";
import { useSocket } from "../state/socket";
import { useToast } from "../state/toast";

const EMOJI_OPTIONS = ["👍", "❤️", "🚀", "👀", "🎉", "🔥"];

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

function ChannelGlyph({ type, size = 14 }: { type: string; size?: number }) {
  if (type === "dm") return <User size={size} aria-hidden />;
  if (type === "private") return <Lock size={size} aria-hidden />;
  return <Hash size={size} aria-hidden />;
}

export function ChatPage() {
  const { workspaceId, user, role } = useAuth();
  const { channelId: rawChannelId } = useParams();
  const channelId = useMemo(
    () =>
      rawChannelId && OBJECT_ID.test(rawChannelId) ? rawChannelId : undefined,
    [rawChannelId],
  );
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const [channelListOpen, setChannelListOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelTopic, setNewChannelTopic] = useState("");
  const [newChannelType, setNewChannelType] = useState<
    "public" | "private" | "dm"
  >("public");

  const [messageText, setMessageText] = useState("");
  const [activeThreadMessage, setActiveThreadMessage] =
    useState<Message | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const readOnly = role === "viewer";
  const { socket, joinRoom, leaveRoom } = useSocket();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const channelsQuery = useQuery({
    queryKey: ["channels", workspaceId],
    queryFn: () => chatApi.listChannels(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

  const channels = useMemo(
    () => channelsQuery.data?.channels ?? [],
    [channelsQuery.data],
  );

  useEffect(() => {
    if (!channelId && channels.length > 0 && channels[0]?.id) {
      navigate(`/chat/${channels[0].id}`, { replace: true });
    }
  }, [channelId, channels, navigate]);

  const messagesQuery = useQuery({
    queryKey: ["messages", channelId],
    queryFn: () => chatApi.listMessages(channelId as string),
    enabled: Boolean(channelId),
    refetchInterval: 5000,
  });

  const messages = useMemo(
    () => messagesQuery.data?.messages ?? [],
    [messagesQuery.data],
  );
  const activeChannel = channels.find((c) => c.id === channelId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!socket || !channelId) return;
    const room = `channel:${channelId}`;
    void joinRoom(room).catch(() => undefined);

    const onMessageNew = (payload: { message: Message }) => {
      if (!payload.message) return;
      queryClient.setQueryData<{ messages: Message[] }>(
        ["messages", channelId],
        (prev) => {
          const list = prev?.messages ?? [];
          if (list.some((m) => m.id === payload.message.id)) return prev;
          return { messages: [...list, payload.message] };
        },
      );
      void queryClient.invalidateQueries({
        queryKey: ["channels", workspaceId],
      });
    };

    const onTypingStart = (data: { userId: string }) => {
      if (data.userId !== user?.id) {
        setTypingUsers((prev) =>
          prev.includes(data.userId) ? prev : [...prev, data.userId],
        );
      }
    };
    const onTypingStop = (data: { userId: string }) => {
      setTypingUsers((prev) => prev.filter((id) => id !== data.userId));
    };
    const onRefresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    };

    socket.on("message:new", onMessageNew);
    socket.on("typing:start", onTypingStart);
    socket.on("typing:stop", onTypingStop);
    socket.on("reaction:updated", onRefresh);
    socket.on("message:updated", onRefresh);
    socket.on("message:deleted", onRefresh);

    return () => {
      socket.off("message:new", onMessageNew);
      socket.off("typing:start", onTypingStart);
      socket.off("typing:stop", onTypingStop);
      socket.off("reaction:updated", onRefresh);
      socket.off("message:updated", onRefresh);
      socket.off("message:deleted", onRefresh);
      void leaveRoom(room).catch(() => undefined);
    };
  }, [
    socket,
    channelId,
    joinRoom,
    leaveRoom,
    queryClient,
    workspaceId,
    user?.id,
  ]);

  const createChannelMutation = useMutation({
    mutationFn: (data: {
      name: string;
      topic?: string;
      type: "public" | "private" | "dm";
    }) => chatApi.createChannel(workspaceId as string, data),
    onSuccess: (res) => {
      toast.success("Channel created");
      void queryClient.invalidateQueries({
        queryKey: ["channels", workspaceId],
      });
      setCreateChannelOpen(false);
      setNewChannelName("");
      setNewChannelTopic("");
      navigate(`/chat/${res.channel.id}`);
    },
    onError: (err: Error) =>
      toast.error("Could not create channel", err.message),
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      chatApi.sendMessage(channelId as string, { body }),
    onSuccess: (res) => {
      setMessageText("");
      queryClient.setQueryData<{ messages: Message[] }>(
        ["messages", channelId],
        (prev) => ({
          messages: [...(prev?.messages ?? []), res.message],
        }),
      );
      void queryClient.invalidateQueries({
        queryKey: ["channels", workspaceId],
      });
    },
    onError: (err: Error) => toast.error("Message failed to send", err.message),
  });

  const reactionMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      chatApi.toggleReaction(messageId, emoji),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
      if (activeThreadMessage) {
        void queryClient.invalidateQueries({
          queryKey: ["thread", activeThreadMessage.id],
        });
      }
    },
  });

  const cardFromMessageMutation = useMutation({
    mutationFn: async ({ messageId }: { messageId: string }) => {
      const boardsRes = await boardsApi.list(workspaceId as string);
      const firstBoard = boardsRes.boards[0];
      if (!firstBoard)
        throw new Error("No board available — create a board first");
      return request<{ id: string; title: string }>("/cards/from-message", {
        method: "POST",
        body: { messageId, boardId: firstBoard.id },
      });
    },
    onSuccess: () => toast.success("Card created from message"),
    onError: (err: Error) => toast.error("Could not create card", err.message),
  });

  const handleSend = (event: FormEvent) => {
    event.preventDefault();
    if (!messageText.trim() || sendMutation.isPending) return;
    sendMutation.mutate(messageText.trim());
  };

  return (
    <div className="flex h-[calc(90dvh-56px)] md:h-[calc(92.25dvh-56px)] min-h-0">
      <SubSidebar
        open={channelListOpen}
        onClose={() => setChannelListOpen(false)}
        width="w-[248px]"
      >
        <div className="mb-2 flex items-center justify-between px-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
            Channels
          </span>
          {!readOnly ? (
            <Button
              variant="ghost"
              size="icon-sm"
              title="New channel"
              onClick={() => setCreateChannelOpen(true)}
            >
              <Plus size={14} />
            </Button>
          ) : null}
        </div>

        {channelsQuery.isLoading ? (
          <CenterState>Loading channels…</CenterState>
        ) : null}

        <nav className="space-y-0.5">
          {channels.map((channel: Channel) => {
            const isSelected = channel.id === channelId;
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => {
                  navigate(`/chat/${channel.id}`);
                  setChannelListOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                  isSelected
                    ? "bg-brand-soft font-bold text-brand"
                    : channel.unread
                      ? "font-bold text-ink hover:bg-sunken"
                      : "font-medium text-muted hover:bg-sunken hover:text-ink"
                }`}
              >
                <span className={isSelected ? "text-brand" : "text-faint"}>
                  <ChannelGlyph type={channel.type} />
                </span>
                <span className="min-w-0 flex-1 truncate">{channel.name}</span>
                {channel.unread ? <Badge tone="brand">new</Badge> : null}
              </button>
            );
          })}
          {channels.length === 0 && !channelsQuery.isLoading ? (
            <p className="px-2 py-3 text-[12px] text-faint">No channels yet.</p>
          ) : null}
        </nav>
      </SubSidebar>

      <main className="flex min-w-0 flex-1 flex-col">
        {activeChannel ? (
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-3 py-3 sm:px-5">
            <SubSidebarToggle
              onClick={() => setChannelListOpen(true)}
              label="Show channels"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-brand">
                  <ChannelGlyph type={activeChannel.type} size={15} />
                </span>
                <strong className="truncate text-[13.5px] text-ink">
                  {activeChannel.name}
                </strong>
                <Badge>{activeChannel.type}</Badge>
              </div>
              {activeChannel.topic ? (
                <div className="mt-0.5 truncate text-[11.5px] text-faint">
                  {activeChannel.topic}
                </div>
              ) : null}
            </div>
          </header>
        ) : (
          <header className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-3 py-3 sm:px-5">
            <SubSidebarToggle
              onClick={() => setChannelListOpen(true)}
              label="Show channels"
            />
            <strong className="text-[13.5px] text-ink">Chat</strong>
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {messagesQuery.isLoading ? (
            <CenterState>Loading messages…</CenterState>
          ) : null}

          {!channelId && channels.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="Team Chat"
              hint="Realtime channels, direct messages, and threaded conversations."
              action={
                <Button
                  variant="primary"
                  icon={Plus}
                  onClick={() => setCreateChannelOpen(true)}
                >
                  Create Channel
                </Button>
              }
            />
          ) : null}

          <div className="space-y-4">
            {messages.map((message: Message) => (
              <div
                key={message.id || message._id}
                className="group flex items-start gap-3"
              >
                <Avatar name={message.authorId} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <strong className="text-[12.5px] text-ink">
                      {message.authorId}
                    </strong>
                    <span className="text-[11px] text-faint">
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {message.editedAt ? (
                      <span className="text-[10px] text-faint">(edited)</span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                    {message.body}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {(message.reactions ?? []).map((reaction) => {
                      const hasReacted = user
                        ? reaction.userIds.includes(user.id)
                        : false;
                      return (
                        <button
                          key={reaction.emoji}
                          type="button"
                          onClick={() =>
                            reactionMutation.mutate({
                              messageId: message.id || message._id!,
                              emoji: reaction.emoji,
                            })
                          }
                          className={`cursor-pointer rounded-full border px-2 py-0.5 text-[11.5px] font-semibold transition-colors ${
                            hasReacted
                              ? "border-brand/40 bg-brand-soft text-brand"
                              : "border-line bg-surface text-muted hover:border-line-strong"
                          }`}
                        >
                          {reaction.emoji} {reaction.userIds.length}
                        </button>
                      );
                    })}

                    {!readOnly ? (
                      <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        {EMOJI_OPTIONS.slice(0, 3).map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            title={`React ${emoji}`}
                            className="cursor-pointer rounded-md p-1 text-[12px] hover:bg-sunken"
                            onClick={() =>
                              reactionMutation.mutate({
                                messageId: message.id || message._id!,
                                emoji,
                              })
                            }
                          >
                            {emoji}
                          </button>
                        ))}
                      </span>
                    ) : null}

                    <button
                      type="button"
                      className="ml-1 cursor-pointer rounded-md px-2 py-0.5 text-[11.5px] font-semibold text-muted hover:bg-sunken hover:text-ink"
                      onClick={() => setActiveThreadMessage(message)}
                    >
                      <MessageSquare
                        size={11}
                        className="mr-1 inline"
                        aria-hidden
                      />
                      {message.replyCount > 0
                        ? `${message.replyCount} replies`
                        : "Reply in thread"}
                    </button>

                    {!readOnly ? (
                      <button
                        type="button"
                        title="Create Kanban card from this message"
                        disabled={cardFromMessageMutation.isPending}
                        className="cursor-pointer rounded-md px-2 py-0.5 text-[11.5px] font-semibold text-muted hover:bg-sunken hover:text-ink disabled:opacity-50"
                        onClick={() =>
                          cardFromMessageMutation.mutate({
                            messageId: message.id || message._id!,
                          })
                        }
                      >
                        <Kanban size={11} className="mr-1 inline" aria-hidden />
                        Create card
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            {typingUsers.length > 0 ? (
              <div className="text-[11.5px] italic text-faint">
                {typingUsers.join(", ")}{" "}
                {typingUsers.length === 1 ? "is" : "are"} typing…
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {channelId && !readOnly ? (
          <form
            onSubmit={handleSend}
            className="shrink-0 border-t border-line bg-surface px-5 py-3"
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder={`Message #${activeChannel?.name ?? "channel"} (Enter to send)`}
                  className="pr-10"
                />
                <span
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint"
                  title="Emoji reactions available on messages"
                >
                  <SmilePlus size={15} aria-hidden />
                </span>
              </div>
              <Button
                type="submit"
                variant="primary"
                icon={Send}
                disabled={!messageText.trim()}
                loading={sendMutation.isPending}
              >
                Send
              </Button>
            </div>
          </form>
        ) : null}
      </main>

      {activeThreadMessage ? (
        <ThreadPanel
          channelId={channelId!}
          message={activeThreadMessage}
          onClose={() => setActiveThreadMessage(null)}
        />
      ) : null}

      {createChannelOpen ? (
        <Modal
          title="Create Channel"
          onClose={() => setCreateChannelOpen(false)}
          size="sm"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => setCreateChannelOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                form="create-channel-form"
                disabled={!newChannelName.trim()}
                loading={createChannelMutation.isPending}
              >
                Create Channel
              </Button>
            </>
          }
        >
          <form
            id="create-channel-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (newChannelName.trim()) {
                createChannelMutation.mutate({
                  name: newChannelName.trim(),
                  topic: newChannelTopic.trim(),
                  type: newChannelType,
                });
              }
            }}
          >
            <Field label="Channel name">
              <Input
                autoFocus
                value={newChannelName}
                onChange={(event) => setNewChannelName(event.target.value)}
                placeholder="e.g. general, announcements, project-x"
              />
            </Field>
            <Field label="Topic">
              <Input
                value={newChannelTopic}
                onChange={(event) => setNewChannelTopic(event.target.value)}
                placeholder="What is this channel about?"
              />
            </Field>
            <Field label="Channel type">
              <Select
                value={newChannelType}
                onChange={(event) =>
                  setNewChannelType(
                    event.target.value as "public" | "private" | "dm",
                  )
                }
              >
                <option value="public">Public (anyone in workspace)</option>
                <option value="private">Private (invite-only)</option>
                <option value="dm">Direct Message</option>
              </Select>
            </Field>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function ThreadPanel({
  channelId,
  message,
  onClose,
}: {
  channelId: string;
  message: Message;
  onClose: () => void;
}) {
  const [replyText, setReplyText] = useState("");
  const queryClient = useQueryClient();
  const toast = useToast();

  const threadQuery = useQuery({
    queryKey: ["thread", message.id || message._id],
    queryFn: () => chatApi.thread(message.id || message._id!),
  });

  const replyMutation = useMutation({
    mutationFn: (body: string) =>
      chatApi.sendMessage(channelId, {
        body,
        parentId: message.id || message._id,
      }),
    onSuccess: () => {
      setReplyText("");
      void queryClient.invalidateQueries({
        queryKey: ["thread", message.id || message._id],
      });
      void queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    },
    onError: (err: Error) => toast.error("Reply failed", err.message),
  });

  const replies = threadQuery.data?.replies ?? [];

  return (
    <aside className="fixed inset-0 z-40 flex w-full shrink-0 flex-col border-l border-line bg-surface animate-slide-left md:static md:z-auto md:w-[320px]">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
        <strong className="text-[13px] text-ink">Thread</strong>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close thread"
        >
          <X size={14} />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-4 rounded-lg border border-line bg-sunken/60 px-3 py-2.5">
          <strong className="text-[12px] text-ink">{message.authorId}</strong>
          <div className="mt-1 text-[12.5px] text-muted">{message.body}</div>
        </div>

        <div className="space-y-3">
          {replies.map((reply: Message) => (
            <div
              key={reply.id || reply._id}
              className="flex items-start gap-2.5"
            >
              <Avatar name={reply.authorId} size="sm" />
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <strong className="text-[11.5px] text-ink">
                    {reply.authorId}
                  </strong>
                  <span className="text-[10px] text-faint">
                    {new Date(reply.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="mt-0.5 text-[12.5px] text-ink">
                  {reply.body}
                </div>
              </div>
            </div>
          ))}
          {replies.length === 0 && !threadQuery.isLoading ? (
            <p className="text-[12px] text-faint">
              No replies yet. Start the conversation.
            </p>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (replyText.trim()) replyMutation.mutate(replyText.trim());
        }}
        className="shrink-0 border-t border-line p-3"
      >
        <div className="flex items-center gap-2">
          <Input
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder="Reply in thread…"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!replyText.trim()}
            loading={replyMutation.isPending}
          >
            Reply
          </Button>
        </div>
      </form>
    </aside>
  );
}
