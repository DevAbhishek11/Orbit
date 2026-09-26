import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { authApi, usersApi } from "../api/endpoints";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";
import {
  Avatar,
  Badge,
  ConfirmDialog,
  ErrorBox,
  Field,
  Spinner,
} from "../components/ui";

const TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
];

export function SettingsPage() {
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [revokeAll, setRevokeAll] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: () => authApi.sessions(),
  });

  const [name, setName] = useState(user?.name ?? "");
  const [timezone, setTimezone] = useState(user?.timezone ?? "UTC");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");

  const profile = useMutation({
    mutationFn: () =>
      usersApi.updateMe({
        name: name.trim(),
        timezone,
        avatarUrl: avatarUrl.trim() ? avatarUrl.trim() : null,
      }),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success("Profile saved");
    },
    onError: (err: ApiError) =>
      toast.error("Could not save profile", err.message),
  });

  const prefs = useMutation({
    mutationFn: (body: Parameters<typeof usersApi.updateMe>[0]) =>
      usersApi.updateMe(body),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success("Preferences saved");
    },
    onError: (err: ApiError) =>
      toast.error("Could not save preferences", err.message),
  });

  const revoke = useMutation({
    mutationFn: (familyId: string) => authApi.revokeSession(familyId),
    onSuccess: () => {
      toast.success("Session revoked");
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (err: ApiError) =>
      toast.error("Could not revoke session", err.message),
  });

  const logoutEverywhere = useMutation({
    mutationFn: () => authApi.logout(true),
    onSuccess: () => {
      toast.success("Signed out everywhere");
      window.location.href = "/login";
    },
    onError: (err: ApiError) =>
      toast.error("Could not sign out everywhere", err.message),
  });

  if (!user) return null;

  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    profile.mutate();
  };

  return (
    <div className="page">
      <div className="page__header">
        <div className="page__header-text">
          <h1>My settings</h1>
          <p className="page__subtitle">
            Profile, notifications and active sessions
          </p>
        </div>
      </div>

      <div className="grid grid--two">
        <section className="panel">
          <div className="row" style={{ gap: 14, marginBottom: 18 }}>
            <Avatar name={user.name} url={user.avatarUrl} size="lg" />
            <div>
              <h2>{user.name}</h2>
              <div className="faint" style={{ fontSize: 12.5 }}>
                @{user.handle}
              </div>
              <div style={{ marginTop: 4 }}>
                {user.emailVerified ? (
                  <Badge tone="success">email verified</Badge>
                ) : (
                  <Badge tone="warning">email not verified</Badge>
                )}
                <span className="faint" style={{ marginLeft: 8, fontSize: 12 }}>
                  account status: {user.status}
                </span>
              </div>
            </div>
          </div>

          {profile.isError ? (
            <ErrorBox message={(profile.error as ApiError).message} />
          ) : null}

          <form onSubmit={submitProfile}>
            <Field label="Display name">
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                required
              />
            </Field>
            <Field label="Timezone" hint="Used for due dates and quiet hours.">
              <select
                className="select"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              >
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Avatar URL" hint="Optional — any public image URL.">
              <input
                className="input"
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                type="url"
                maxLength={2048}
              />
            </Field>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={profile.isPending}
            >
              {profile.isPending ? <Spinner /> : null}
              Save profile
            </button>
          </form>
        </section>

        <section className="panel">
          <h2 style={{ marginBottom: 16 }}>Preferences</h2>
          <Field label="Theme">
            <select
              className="select"
              value={user.preferences.theme}
              disabled={prefs.isPending}
              onChange={(event) =>
                prefs.mutate({
                  preferences: {
                    theme: event.target.value as "light" | "dark" | "system",
                  },
                })
              }
            >
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </Field>
          <label className="checkbox" style={{ marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={user.preferences.emailNotifications}
              disabled={prefs.isPending}
              onChange={(event) =>
                prefs.mutate({
                  preferences: { emailNotifications: event.target.checked },
                })
              }
            />
            Email notifications
          </label>
          <label className="checkbox" style={{ marginBottom: 18 }}>
            <input
              type="checkbox"
              checked={user.preferences.pushNotifications}
              disabled={prefs.isPending}
              onChange={(event) =>
                prefs.mutate({
                  preferences: { pushNotifications: event.target.checked },
                })
              }
            />
            Push notifications
          </label>

          <h2 style={{ marginBottom: 12 }}>Quiet hours</h2>
          <div className="row">
            <input
              className="input"
              type="time"
              style={{ maxWidth: 130 }}
              value={user.preferences.quietHoursStart ?? ""}
              disabled={prefs.isPending}
              onChange={(event) =>
                prefs.mutate({
                  preferences: { quietHoursStart: event.target.value || null },
                })
              }
            />
            <span className="faint">to</span>
            <input
              className="input"
              type="time"
              style={{ maxWidth: 130 }}
              value={user.preferences.quietHoursEnd ?? ""}
              disabled={prefs.isPending}
              onChange={(event) =>
                prefs.mutate({
                  preferences: { quietHoursEnd: event.target.value || null },
                })
              }
            />
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="row row--between" style={{ marginBottom: 14 }}>
          <h2>Active sessions</h2>
          <button
            type="button"
            className="btn btn--danger btn--sm"
            onClick={() => setRevokeAll(true)}
          >
            Sign out everywhere
          </button>
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Each row is one refresh-token family. Revoking it forces that device
          to sign in again.
        </p>
        <div className="stack" style={{ gap: 8 }}>
          {(sessionsQuery.data?.sessions ?? []).map((session) => (
            <div
              key={session.id}
              className="row row--between"
              style={{
                padding: "10px 12px",
                background: "var(--surface)",
                borderRadius: 10,
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>
                  {session.device}
                  {session.current ? (
                    <Badge tone="accent">this device</Badge>
                  ) : null}
                </div>
                <div
                  className="faint"
                  style={{
                    fontSize: 12,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 460,
                  }}
                >
                  {session.ip ? `${session.ip} · ` : ""}
                  {session.userAgent ?? "unknown user agent"}
                </div>
                <div className="faint" style={{ fontSize: 11.5 }}>
                  last used {new Date(session.lastUsedAt).toLocaleString()} ·
                  expires {new Date(session.expiresAt).toLocaleDateString()}
                </div>
              </div>
              {!session.current ? (
                <button
                  type="button"
                  className="btn btn--sm"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(session.id)}
                >
                  Revoke
                </button>
              ) : null}
            </div>
          ))}
          {sessionsQuery.data && sessionsQuery.data.sessions.length === 0 ? (
            <p className="faint" style={{ margin: 0, fontSize: 13 }}>
              No other active sessions.
            </p>
          ) : null}
        </div>
      </section>

      {revokeAll ? (
        <ConfirmDialog
          title="Sign out everywhere?"
          body="Every refresh token for your account is revoked and your token version is bumped, so all access tokens stop working immediately."
          confirmLabel="Sign out everywhere"
          danger
          busy={logoutEverywhere.isPending}
          onConfirm={() => logoutEverywhere.mutate()}
          onClose={() => setRevokeAll(false)}
        />
      ) : null}
    </div>
  );
}
