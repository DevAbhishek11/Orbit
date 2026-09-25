import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchApi } from "../api/endpoints";
import { useAuth } from "../state/auth";
import { Badge, Spinner } from "./ui";

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
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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
      className="modal-backdrop"
      style={{ alignItems: "flex-start", paddingTop: 80 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal"
        role="dialog"
        style={{
          width: 580,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
        }}
      >
        {}
        <div
          className="row"
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            gap: 12,
            background: "var(--surface)",
          }}
        >
          <span style={{ fontSize: 18, opacity: 0.6 }}>🔍</span>
          <input
            className="input grow"
            style={{
              border: "none",
              boxShadow: "none",
              background: "transparent",
              fontSize: 16,
              padding: 0,
            }}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards, docs, channels, messages..."
          />
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {}
        <div
          style={{ overflowY: "auto", padding: "12px 16px", maxHeight: 420 }}
        >
          {searchQuery.isLoading && (
            <div
              className="row"
              style={{ gap: 8, padding: "16px 0", justifyContent: "center" }}
            >
              <Spinner />
              <span className="faint">Searching workspace…</span>
            </div>
          )}

          {}
          {results && (
            <div className="stack" style={{ gap: 16 }}>
              {results.cards.length > 0 && (
                <div>
                  <div
                    className="faint"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    Cards ({results.cards.length})
                  </div>
                  {results.cards.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="btn btn--ghost btn--block row row--between"
                      style={{
                        textAlign: "left",
                        padding: "6px 8px",
                        borderRadius: 6,
                      }}
                      onClick={() => handleSelect(`/boards/${c.boardId}`)}
                    >
                      <span>▦ {c.title}</span>
                      <Badge tone={c.completedAt ? "success" : "default"}>
                        {c.completedAt ? "completed" : c.priority}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}

              {results.pages.length > 0 && (
                <div>
                  <div
                    className="faint"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    Docs ({results.pages.length})
                  </div>
                  {results.pages.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="btn btn--ghost btn--block row"
                      style={{
                        textAlign: "left",
                        padding: "6px 8px",
                        borderRadius: 6,
                        gap: 8,
                      }}
                      onClick={() => handleSelect(`/docs/${p.id}`)}
                    >
                      <span>{p.icon || "📄"}</span>
                      <span>{p.title || "Untitled"}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.channels.length > 0 && (
                <div>
                  <div
                    className="faint"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    Channels ({results.channels.length})
                  </div>
                  {results.channels.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      className="btn btn--ghost btn--block row"
                      style={{
                        textAlign: "left",
                        padding: "6px 8px",
                        borderRadius: 6,
                        gap: 8,
                      }}
                      onClick={() => handleSelect(`/chat/${ch.id}`)}
                    >
                      <span># {ch.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.messages.length > 0 && (
                <div>
                  <div
                    className="faint"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    Messages ({results.messages.length})
                  </div>
                  {results.messages.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="btn btn--ghost btn--block row"
                      style={{
                        textAlign: "left",
                        padding: "6px 8px",
                        borderRadius: 6,
                        gap: 8,
                      }}
                      onClick={() => handleSelect(`/chat/${m.channelId}`)}
                    >
                      <span className="faint">💬</span>
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.body}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.data && searchQuery.data.totalResults === 0 && (
                <div
                  className="faint"
                  style={{ textAlign: "center", padding: "24px 0" }}
                >
                  No results found for &ldquo;{debouncedQuery}&rdquo;
                </div>
              )}
            </div>
          )}

          {}
          {!debouncedQuery && suggestions && (
            <div className="stack" style={{ gap: 12 }}>
              <span
                className="faint"
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Quick Jump
              </span>
              {suggestions.boards.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="btn btn--ghost btn--block row"
                  style={{
                    textAlign: "left",
                    padding: "6px 8px",
                    borderRadius: 6,
                    gap: 8,
                  }}
                  onClick={() => handleSelect(`/boards/${b.id}`)}
                >
                  <span>▦</span>
                  <span>{b.title}</span>
                </button>
              ))}
              {suggestions.pages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="btn btn--ghost btn--block row"
                  style={{
                    textAlign: "left",
                    padding: "6px 8px",
                    borderRadius: 6,
                    gap: 8,
                  }}
                  onClick={() => handleSelect(`/docs/${p.id}`)}
                >
                  <span>{p.icon || "📄"}</span>
                  <span>{p.title}</span>
                </button>
              ))}
              {suggestions.channels.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="btn btn--ghost btn--block row"
                  style={{
                    textAlign: "left",
                    padding: "6px 8px",
                    borderRadius: 6,
                    gap: 8,
                  }}
                  onClick={() => handleSelect(`/chat/${c.id}`)}
                >
                  <span>#</span>
                  <span>{c.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {}
        <div
          className="row row--between"
          style={{
            padding: "8px 16px",
            borderTop: "1px solid var(--border)",
            background: "var(--surface-muted)",
            fontSize: 11.5,
          }}
        >
          <span className="faint">Type to search</span>
          <span className="faint">ESC to close</span>
        </div>
      </div>
    </div>
  );
}
