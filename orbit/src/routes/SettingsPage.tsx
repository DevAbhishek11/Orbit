import { useState, type FormEvent } from "react";
import { LogOut, MonitorSmartphone } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { authApi, usersApi } from "../api/endpoints";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  ErrorBox,
  Field,
  Input,
  PageHeader,
  Select,
} from "../components/ui";
import { useAuth } from "../state/auth";
import { useToast } from "../state/toast";

const TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
];

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5">
      <span className="text-[12.5px] font-semibold text-ink">{label}</span>
      <span className="relative inline-flex">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="h-5 w-9 rounded-full bg-line-strong/60 transition-colors peer-checked:bg-brand peer-disabled:opacity-50" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

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
    <div className="mx-auto w-full">
      <PageHeader
        title="My settings"
        subtitle="Profile, notifications and active sessions"
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-5 flex items-center gap-3.5">
            <Avatar name={user.name} url={user.avatarUrl} size="lg" />
            <div>
              <h2 className="text-[14.5px] font-bold text-ink">{user.name}</h2>
              <div className="text-[12px] text-faint">@{user.handle}</div>
              <div className="mt-1.5 flex items-center gap-2">
                {user.emailVerified ? (
                  <Badge tone="success">email verified</Badge>
                ) : (
                  <Badge tone="warning">email not verified</Badge>
                )}
                <span className="text-[11.5px] text-faint">
                  status: {user.status}
                </span>
              </div>
            </div>
          </div>

          {profile.isError ? (
            <ErrorBox message={(profile.error as ApiError).message} />
          ) : null}

          <form onSubmit={submitProfile} className="space-y-4">
            <Field label="Display name">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                required
              />
            </Field>
            <Field label="Timezone" hint="Used for due dates and quiet hours.">
              <Select
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              >
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Avatar URL" hint="Optional — any public image URL.">
              <Input
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                type="url"
                maxLength={2048}
                placeholder="https://…"
              />
            </Field>
            <Button type="submit" variant="primary" loading={profile.isPending}>
              Save profile
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Preferences" />
          <Field label="Theme">
            <Select
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
            </Select>
          </Field>
          <div className="mt-3 divide-y divide-line/70">
            <ToggleRow
              label="Email notifications"
              checked={user.preferences.emailNotifications}
              disabled={prefs.isPending}
              onChange={(next) =>
                prefs.mutate({ preferences: { emailNotifications: next } })
              }
            />
            <ToggleRow
              label="Push notifications"
              checked={user.preferences.pushNotifications}
              disabled={prefs.isPending}
              onChange={(next) =>
                prefs.mutate({ preferences: { pushNotifications: next } })
              }
            />
          </div>

          <h3 className="mb-2 mt-6 text-[13px] font-bold text-ink">
            Quiet hours
          </h3>
          <div className="flex items-center gap-2.5">
            <Input
              type="time"
              className="w-[130px]"
              value={user.preferences.quietHoursStart ?? ""}
              disabled={prefs.isPending}
              onChange={(event) =>
                prefs.mutate({
                  preferences: { quietHoursStart: event.target.value || null },
                })
              }
            />
            <span className="text-[12px] text-faint">to</span>
            <Input
              type="time"
              className="w-[130px]"
              value={user.preferences.quietHoursEnd ?? ""}
              disabled={prefs.isPending}
              onChange={(event) =>
                prefs.mutate({
                  preferences: { quietHoursEnd: event.target.value || null },
                })
              }
            />
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Active sessions"
          subtitle="Each row is one refresh-token family. Revoking it forces that device to sign in again."
          actions={
            <Button
              variant="danger"
              size="sm"
              icon={LogOut}
              onClick={() => setRevokeAll(true)}
            >
              Sign out everywhere
            </Button>
          }
        />
        <div className="space-y-2">
          {(sessionsQuery.data?.sessions ?? []).map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[12.5px] font-bold text-ink">
                  <MonitorSmartphone
                    size={13}
                    className="shrink-0 text-faint"
                    aria-hidden
                  />
                  <span className="truncate">{session.device}</span>
                  {session.current ? (
                    <Badge tone="brand">this device</Badge>
                  ) : null}
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-faint">
                  {session.ip ? `${session.ip} · ` : ""}
                  {session.userAgent ?? "unknown user agent"}
                </div>
                <div className="text-[11px] text-faint">
                  last used {new Date(session.lastUsedAt).toLocaleString()} ·
                  expires {new Date(session.expiresAt).toLocaleDateString()}
                </div>
              </div>
              {!session.current ? (
                <Button
                  size="xs"
                  loading={revoke.isPending}
                  onClick={() => revoke.mutate(session.id)}
                >
                  Revoke
                </Button>
              ) : null}
            </div>
          ))}
          {sessionsQuery.data && sessionsQuery.data.sessions.length === 0 ? (
            <p className="text-[12.5px] text-faint">
              No other active sessions.
            </p>
          ) : null}
        </div>
      </Card>

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
