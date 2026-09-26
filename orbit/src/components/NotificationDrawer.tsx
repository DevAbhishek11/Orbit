import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellOff, CheckCheck, X } from "lucide-react";
import { notificationsApi } from "../api/endpoints";
import type { NotificationItem } from "../api/types";
import { Badge, Button, CenterState, EmptyState } from "./ui";

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
      className="fixed inset-0 z-[80] flex justify-end bg-overlay animate-fade-in"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        role="dialog"
        aria-modal="true"
        className="flex h-full w-[360px] max-w-[90vw] flex-col border-l border-line bg-surface shadow-lg animate-slide-left"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3.5">
          <div className="flex items-center gap-2">
            <strong className="text-[13.5px] text-ink">Notifications</strong>
            {unreadCount > 0 ? (
              <Badge tone="brand">{unreadCount} new</Badge>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={15} />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {notificationsQuery.isLoading ? (
            <CenterState>Loading…</CenterState>
          ) : null}

          <div className="space-y-2">
            {notifications.map((item: NotificationItem) => (
              <div
                key={item.id || item._id}
                className={`rounded-lg border px-3 py-2.5 ${
                  item.readAt
                    ? "border-line bg-surface"
                    : "border-brand/30 bg-brand-soft/60"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <strong className="text-[12.5px] text-ink">
                    {item.title}
                  </strong>
                  <span className="shrink-0 text-[10.5px] text-faint">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {item.body ? (
                  <div className="text-[12px] leading-relaxed text-muted">
                    {item.body}
                  </div>
                ) : null}
              </div>
            ))}

            {notifications.length === 0 && !notificationsQuery.isLoading ? (
              <EmptyState
                icon={BellOff}
                title="All caught up"
                hint="You have no notifications right now."
              />
            ) : null}
          </div>
        </div>

        {unreadCount > 0 ? (
          <div className="shrink-0 border-t border-line p-3">
            <Button
              className="w-full"
              icon={CheckCheck}
              loading={markReadMutation.isPending}
              onClick={() => markReadMutation.mutate()}
            >
              Mark all as read
            </Button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
