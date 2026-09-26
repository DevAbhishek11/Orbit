import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "../api/endpoints";
import type { NotificationItem } from "../api/types";
import { Badge, Spinner } from "./ui";

export function NotificationDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(),
    enabled: isOpen,
    refetchInterval: 15_000,
  });

  const markReadMutation = useMutation({
    mutationFn: () => notificationsApi.markRead({ all: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  if (!isOpen) return null;

  const notifications = notificationsQuery.data?.notifications ?? [];
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  return (
    <div
      className="modal-backdrop"
      style={{ justifyContent: "flex-end", padding: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        className="modal"
        role="dialog"
        style={{
          width: 360,
          height: "100vh",
          maxHeight: "100vh",
          borderRadius: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          padding: 0,
        }}
      >
        <div
          className="row row--between"
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="row" style={{ gap: 8 }}>
            <strong>Notifications</strong>
            {unreadCount > 0 && <Badge tone="accent">{unreadCount} new</Badge>}
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div
          className="grow"
          style={{ overflowY: "auto", padding: "12px 18px" }}
        >
          {notificationsQuery.isLoading && <Spinner />}

          <div className="stack" style={{ gap: 10 }}>
            {notifications.map((n: NotificationItem) => (
              <div
                key={n.id || n._id}
                className="panel"
                style={{
                  padding: "10px 12px",
                  background: n.readAt
                    ? "var(--surface)"
                    : "var(--accent-subtle)",
                }}
              >
                <div className="row row--between" style={{ marginBottom: 4 }}>
                  <strong style={{ fontSize: 13 }}>{n.title}</strong>
                  <span className="faint" style={{ fontSize: 10 }}>
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {n.body && (
                  <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                    {n.body}
                  </div>
                )}
              </div>
            ))}

            {notifications.length === 0 && !notificationsQuery.isLoading && (
              <div
                className="faint"
                style={{ textAlign: "center", padding: "36px 0", fontSize: 13 }}
              >
                You&apos;re all caught up! No notifications.
              </div>
            )}
          </div>
        </div>

        {unreadCount > 0 && (
          <div
            style={{
              padding: "12px 18px",
              borderTop: "1px solid var(--border)",
            }}
          >
            <button
              type="button"
              className="btn btn--block btn--sm"
              disabled={markReadMutation.isPending}
              onClick={() => markReadMutation.mutate()}
            >
              {markReadMutation.isPending ? <Spinner /> : "Mark all as read"}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
