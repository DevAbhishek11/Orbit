import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Hash, Kanban, MessageSquare, Search, X } from "lucide-react";
import { searchApi } from "../api/endpoints";
import { useAuth } from "../state/auth";
import { AppIcon, Badge, Kbd, Spinner } from "./ui";

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 mt-4 px-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-faint first:mt-0">
      {children}
    </div>
  );
}

function ResultButton({
  onClick,
  icon,
  children,
  trailing,
}: {
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-ink transition-colors hover:bg-sunken"
    >
      <span className="shrink-0 text-faint">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </button>
  );
}

export function CommandPalette({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { workspaceId } = useAuth();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const searchQuery = useQuery({
    queryKey: ["search", workspaceId, debouncedQuery],
    queryFn: () => searchApi.search(workspaceId as string, debouncedQuery),
    enabled: Boolean(workspaceId && debouncedQuery.length >= 2),
  });

  const suggestionsQuery = useQuery({
    queryKey: ["search-suggestions", workspaceId],
    queryFn: () => searchApi.suggestions(workspaceId as string),
    enabled: Boolean(workspaceId && !debouncedQuery),
  });

  if (!isOpen) return null;

  const results = searchQuery.data?.results;
  const suggestions = suggestionsQuery.data?.suggestions;

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-start justify-center bg-overlay p-4 pt-[10vh] animate-fade-in"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[76vh] w-full max-w-[600px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg animate-pop-in"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
          <Search size={16} className="shrink-0 text-faint" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cards, docs, channels, messages…"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none"
          />
          <button
            type="button"
            className="cursor-pointer rounded p-0.5 text-faint hover:text-ink"
            onClick={onClose}
            aria-label="Close search"
          >
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
          {searchQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2.5 py-8 text-[12.5px] text-faint">
              <Spinner /> Searching workspace…
            </div>
          ) : null}

          {results ? (
            <div>
              {results.cards.length > 0 ? (
                <div>
                  <GroupLabel>Cards ({results.cards.length})</GroupLabel>
                  {results.cards.map((card) => (
                    <ResultButton
                      key={card.id}
                      icon={<Kanban size={14} />}
                      onClick={() => handleSelect(`/boards/${card.boardId}`)}
                      trailing={
                        <Badge tone={card.completedAt ? "success" : "default"}>
                          {card.completedAt ? "completed" : card.priority}
                        </Badge>
                      }
                    >
                      {card.title}
                    </ResultButton>
                  ))}
                </div>
              ) : null}

              {results.pages.length > 0 ? (
                <div>
                  <GroupLabel>Docs ({results.pages.length})</GroupLabel>
                  {results.pages.map((page) => (
                    <ResultButton
                      key={page.id}
                      icon={<AppIcon name={page.icon} size={14} />}
                      onClick={() => handleSelect(`/docs/${page.id}`)}
                    >
                      {page.title || "Untitled"}
                    </ResultButton>
                  ))}
                </div>
              ) : null}

              {results.channels.length > 0 ? (
                <div>
                  <GroupLabel>Channels ({results.channels.length})</GroupLabel>
                  {results.channels.map((channel) => (
                    <ResultButton
                      key={channel.id}
                      icon={<Hash size={14} />}
                      onClick={() => handleSelect(`/chat/${channel.id}`)}
                    >
                      {channel.name}
                    </ResultButton>
                  ))}
                </div>
              ) : null}

              {results.messages.length > 0 ? (
                <div>
                  <GroupLabel>Messages ({results.messages.length})</GroupLabel>
                  {results.messages.map((message) => (
                    <ResultButton
                      key={message.id}
                      icon={<MessageSquare size={14} />}
                      onClick={() => handleSelect(`/chat/${message.channelId}`)}
                    >
                      {message.body}
                    </ResultButton>
                  ))}
                </div>
              ) : null}

              {searchQuery.data && searchQuery.data.totalResults === 0 ? (
                <div className="py-10 text-center text-[12.5px] text-faint">
                  No results found for “{debouncedQuery}”
                </div>
              ) : null}
            </div>
          ) : null}

          {!debouncedQuery && suggestions ? (
            <div>
              <GroupLabel>Quick Jump</GroupLabel>
              {suggestions.boards.map((board) => (
                <ResultButton
                  key={board.id}
                  icon={<Kanban size={14} />}
                  onClick={() => handleSelect(`/boards/${board.id}`)}
                >
                  {board.title}
                </ResultButton>
              ))}
              {suggestions.pages.map((page) => (
                <ResultButton
                  key={page.id}
                  icon={<AppIcon name={page.icon} size={14} />}
                  onClick={() => handleSelect(`/docs/${page.id}`)}
                >
                  {page.title}
                </ResultButton>
              ))}
              {suggestions.channels.map((channel) => (
                <ResultButton
                  key={channel.id}
                  icon={<Hash size={14} />}
                  onClick={() => handleSelect(`/chat/${channel.id}`)}
                >
                  {channel.title}
                </ResultButton>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-line bg-sunken/60 px-4 py-2 text-[11px] text-faint">
          <span>Type to search across the workspace</span>
          <span className="flex items-center gap-1">
            <Kbd>ESC</Kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}
