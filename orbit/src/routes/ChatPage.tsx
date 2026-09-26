import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { boardsApi, chatApi } from "../api/endpoints";
import { request } from "../api/client";
import type { Channel, Message } from "../api/types";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";
import { useSocket } from "../state/socket";
import {
  Avatar,
  Badge,
  CenterState,
  EmptyState,
  Field,
  Modal,
  Spinner,
} from "../components/ui";

const EMOJI_OPTIONS = ["👍", "❤️", "🚀", "👀", "🎉", "🔥"];

export function ChatPage() {
  const { workspaceId, user, role } = useAuth();
  const { channelId } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

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
      if (payload.message) {
        queryClient.setQueryData<{ messages: Message[] }>(
          ["messages", channelId],
          (prev) => {
            const msgs = prev?.messages ?? [];

            if (msgs.some((m) => m.id === payload.message.id))
              return prev as never;
            return { messages: [...msgs, payload.message] } as never;
          },
        );
        void queryClient.invalidateQueries({
          queryKey: ["channels", workspaceId],
        });
      }
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

    const onReaction = () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    };

    socket.on("message:new", onMessageNew);
    socket.on("typing:start", onTypingStart);
    socket.on("typing:stop", onTypingStop);
    socket.on("reaction:updated", onReaction);
    socket.on("message:updated", onReaction);
    socket.on("message:deleted", onReaction);

    return () => {
      socket.off("message:new", onMessageNew);
      socket.off("typing:start", onTypingStart);
      socket.off("typing:stop", onTypingStop);
      socket.off("reaction:updated", onReaction);
      socket.off("message:updated", onReaction);
      socket.off("message:deleted", onReaction);
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
      queryClient.setQueryData<Message[]>(["messages", channelId], (prev) => [
        ...(prev ?? []),
        res.message,
      ]);
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
      const res = await request<{ id: string; title: string }>(
        "/cards/from-message",
        {
          method: "POST",
          body: { messageId, boardId: firstBoard.id },
        },
      );
      return res;
    },
    onSuccess: () => {
      toast.success("Card created from message");
    },
    onError: (err: Error) => toast.error("Could not create card", err.message),
  });

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || sendMutation.isPending) return;
    sendMutation.mutate(messageText.trim());
  };

  return (
    <div
      className="chat-layout"
      style={{ display: "flex", height: "calc(100vh - 56px)" }}
    >
      {}
      <aside
        className="chat-sidebar"
        style={{
          width: 260,
          borderRight: "1px solid var(--border)",
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          background: "var(--surface-muted, var(--surface))",
          overflowY: "auto",
        }}
      >
        <div className="row row--between" style={{ marginBottom: 12 }}>
          <strong
            style={{
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Channels
          </strong>
          {!readOnly && (
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              title="New Channel"
              onClick={() => setCreateChannelOpen(true)}
            >
              +
            </button>
          )}
        </div>

        {channelsQuery.isLoading && <Spinner />}

        <nav className="stack" style={{ gap: 2 }}>
          {channels.map((c: Channel) => {
            const isSelected = c.id === channelId;
            return (
              <button
                key={c.id}
                type="button"
                className="btn btn--ghost row row--between"
                style={{
                  textAlign: "left",
                  padding: "6px 10px",
                  borderRadius: 6,
                  fontWeight: c.unread ? 700 : isSelected ? 600 : 400,
                  background: isSelected
                    ? "var(--accent-subtle)"
                    : "transparent",
                }}
                onClick={() => navigate(`/chat/${c.id}`)}
              >
                <span
                  className="row"
                  style={{
                    gap: 6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  <span className="faint">
                    {c.type === "dm" ? "👤" : c.type === "private" ? "🔒" : "#"}
                  </span>
                  <span>{c.name}</span>
                </span>
                {c.unread && <Badge tone="accent">new</Badge>}
              </button>
            );
          })}
          {channels.length === 0 && !channelsQuery.isLoading && (
            <p className="faint" style={{ fontSize: 12.5, margin: "12px 0" }}>
              No channels yet.
            </p>
          )}
        </nav>
      </aside>

      {}
      <main
        className="chat-main grow"
        style={{ display: "flex", flexDirection: "column" }}
      >
        {}
        {activeChannel && (
          <header
            className="row row--between"
            style={{
              padding: "12px 24px",
              borderBottom: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            <div>
              <div className="row" style={{ gap: 8 }}>
                <strong>
                  {activeChannel.type === "dm"
                    ? "👤"
                    : activeChannel.type === "private"
                      ? "🔒"
                      : "#"}{" "}
                  {activeChannel.name}
                </strong>
                <Badge tone="default">{activeChannel.type}</Badge>
              </div>
              {activeChannel.topic && (
                <div className="faint" style={{ fontSize: 12 }}>
                  {activeChannel.topic}
                </div>
              )}
            </div>
          </header>
        )}

        {}
        <div
          className="grow"
          style={{ overflowY: "auto", padding: "16px 24px" }}
        >
          {messagesQuery.isLoading && (
            <CenterState>
              <Spinner large />
              <div>Loading messages…</div>
            </CenterState>
          )}

          {!channelId && channels.length === 0 && (
            <EmptyState
              icon="💬"
              title="Team Chat"
              hint="Realtime channels, direct messages, and threaded conversations."
              action={
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setCreateChannelOpen(true)}
                >
                  + Create Channel
                </button>
              }
            />
          )}

          <div className="stack" style={{ gap: 16 }}>
            {messages.map((m: Message) => (
              <div
                key={m.id || m._id}
                className="message-row row"
                style={{ gap: 12, alignItems: "flex-start" }}
              >
                <Avatar name={m.authorId} />
                <div className="grow">
                  <div className="row" style={{ gap: 8, marginBottom: 2 }}>
                    <strong style={{ fontSize: 13 }}>{m.authorId}</strong>
                    <span className="faint" style={{ fontSize: 11.5 }}>
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {m.editedAt && (
                      <span className="faint" style={{ fontSize: 10 }}>
                        (edited)
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.5,
                    }}
                  >
                    {m.body}
                  </div>

                  {}
                  <div
                    className="row row--wrap"
                    style={{ gap: 4, marginTop: 6 }}
                  >
                    {(m.reactions ?? []).map((rx) => {
                      const hasReacted = user
                        ? rx.userIds.includes(user.id)
                        : false;
                      return (
                        <button
                          key={rx.emoji}
                          type="button"
                          className={`btn btn--sm ${hasReacted ? "btn--primary" : "btn--ghost"}`}
                          style={{ padding: "2px 6px", fontSize: 12 }}
                          onClick={() =>
                            reactionMutation.mutate({
                              messageId: m.id || m._id!,
                              emoji: rx.emoji,
                            })
                          }
                        >
                          {rx.emoji} {rx.userIds.length}
                        </button>
                      );
                    })}

                    {}
                    {!readOnly && (
                      <div className="row" style={{ gap: 2, opacity: 0.6 }}>
                        {EMOJI_OPTIONS.slice(0, 3).map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="btn btn--ghost btn--icon"
                            style={{ width: 22, height: 22, fontSize: 11 }}
                            onClick={() =>
                              reactionMutation.mutate({
                                messageId: m.id || m._id!,
                                emoji,
                              })
                            }
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {}
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      style={{ fontSize: 12, marginLeft: 8 }}
                      onClick={() => setActiveThreadMessage(m)}
                    >
                      💬{" "}
                      {m.replyCount > 0
                        ? `${m.replyCount} replies`
                        : "Reply in thread"}
                    </button>

                    {}
                    {!readOnly && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        style={{ fontSize: 12, marginLeft: 4 }}
                        disabled={cardFromMessageMutation.isPending}
                        onClick={() =>
                          cardFromMessageMutation.mutate({
                            messageId: m.id || m._id!,
                          })
                        }
                        title="Create Kanban card from this message"
                      >
                        ▦ Create card
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {typingUsers.length > 0 && (
              <div
                className="faint"
                style={{ fontSize: 12, fontStyle: "italic", marginTop: 12 }}
              >
                {typingUsers.join(", ")}{" "}
                {typingUsers.length === 1 ? "is" : "are"} typing…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {}
        {channelId && !readOnly && (
          <form
            onSubmit={handleSend}
            style={{
              padding: "12px 24px",
              borderTop: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input grow"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={`Message #${activeChannel?.name ?? "channel"} (Enter to send)`}
                autoFocus
              />
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!messageText.trim() || sendMutation.isPending}
              >
                {sendMutation.isPending ? <Spinner /> : "Send"}
              </button>
            </div>
          </form>
        )}
      </main>

      {}
      {activeThreadMessage && (
        <ThreadPanel
          channelId={channelId!}
          message={activeThreadMessage}
          onClose={() => setActiveThreadMessage(null)}
        />
      )}

      {}
      {createChannelOpen && (
        <Modal
          title="Create Channel"
          onClose={() => setCreateChannelOpen(false)}
          wide={false}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newChannelName.trim()) {
                createChannelMutation.mutate({
                  name: newChannelName.trim(),
                  topic: newChannelTopic.trim(),
                  type: newChannelType,
                });
              }
            }}
            className="stack"
            style={{ gap: 12 }}
          >
            <Field label="Channel Name">
              <input
                className="input"
                autoFocus
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="e.g. general, announcements, or project-x"
              />
            </Field>
            <Field label="Topic">
              <input
                className="input"
                value={newChannelTopic}
                onChange={(e) => setNewChannelTopic(e.target.value)}
                placeholder="What is this channel about?"
              />
            </Field>
            <Field label="Channel Type">
              <select
                className="select"
                value={newChannelType}
                onChange={(e) =>
                  setNewChannelType(
                    e.target.value as "public" | "private" | "dm",
                  )
                }
              >
                <option value="public">Public (anyone in workspace)</option>
                <option value="private">Private (invite-only)</option>
                <option value="dm">Direct Message</option>
              </select>
            </Field>
            <div className="row row--end" style={{ gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setCreateChannelOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={
                  !newChannelName.trim() || createChannelMutation.isPending
                }
              >
                {createChannelMutation.isPending ? (
                  <Spinner />
                ) : (
                  "Create Channel"
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
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
    <aside
      className="thread-panel"
      style={{
        width: 320,
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
      }}
    >
      <div
        className="row row--between"
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <strong>Thread</strong>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="grow" style={{ overflowY: "auto", padding: "16px" }}>
        {}
        <div
          className="panel"
          style={{ padding: "10px 12px", marginBottom: 16 }}
        >
          <strong style={{ fontSize: 13 }}>{message.authorId}</strong>
          <div style={{ fontSize: 13.5, marginTop: 4 }}>{message.body}</div>
        </div>

        {}
        <div className="stack" style={{ gap: 12 }}>
          {replies.map((reply: Message) => (
            <div
              key={reply.id || reply._id}
              className="row"
              style={{ gap: 8, alignItems: "flex-start" }}
            >
              <Avatar name={reply.authorId} size="sm" />
              <div>
                <div className="row" style={{ gap: 6 }}>
                  <strong style={{ fontSize: 12 }}>{reply.authorId}</strong>
                  <span className="faint" style={{ fontSize: 10 }}>
                    {new Date(reply.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div style={{ fontSize: 13, marginTop: 2 }}>{reply.body}</div>
              </div>
            </div>
          ))}
          {replies.length === 0 && !threadQuery.isLoading && (
            <p className="faint" style={{ fontSize: 12.5 }}>
              No replies yet. Start the conversation.
            </p>
          )}
        </div>
      </div>

      {}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (replyText.trim()) replyMutation.mutate(replyText.trim());
        }}
        style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}
      >
        <div className="row" style={{ gap: 6 }}>
          <input
            className="input grow"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Reply in thread..."
          />
          <button
            type="submit"
            className="btn btn--primary btn--sm"
            disabled={!replyText.trim() || replyMutation.isPending}
          >
            Reply
          </button>
        </div>
      </form>
    </aside>
  );
}
