import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./state/auth";
import { ToastProvider } from "./state/toast";
import { SocketProvider } from "./state/socket";
import { StatusPage } from "./routes/StatusPage";
import { AppShell } from "./routes/AppShell";
import { BoardsPage } from "./routes/BoardsPage";
import { BoardPage } from "./routes/BoardPage";
import { DocsPage } from "./routes/DocsPage";
import { ChatPage } from "./routes/ChatPage";
import { AnalyticsPage } from "./routes/AnalyticsPage";
import { FilesPage } from "./routes/FilesPage";
import { ComponentsGallery } from "./routes/ComponentsGallery";
import { InvitationsPage, MembersPage } from "./routes/MembersPage";
import { SettingsPage } from "./routes/SettingsPage";
import { WorkspacePage } from "./routes/WorkspacePage";
import {
  ForgotPasswordPage,
  InvitePage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from "./routes/AuthPages";
import { CenterState } from "./components/ui";
import { OfflineBanner } from "./components/OfflineBanner";
import { initOfflineSync } from "./lib/offline-sync";
import type { ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading")
    return <CenterState>Restoring your session…</CenterState>;
  if (status === "anonymous")
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <CenterState>Loading…</CenterState>;
  if (status === "authenticated") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ThemeEffect() {
  const { user } = useAuth();
  useEffect(() => {
    const preference = user?.preferences.theme ?? "system";
    const resolved =
      preference === "system"
        ? window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark"
        : preference;
    document.documentElement.dataset.theme = resolved;
  }, [user?.preferences.theme]);
  return null;
}

function OfflineInit() {
  useEffect(() => {
    initOfflineSync();
  }, []);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <SocketProvider>
            <ThemeEffect />
            <OfflineInit />
            <OfflineBanner />
            <Routes>
              {}
              <Route path="/status" element={<StatusPage />} />
              <Route
                path="/login"
                element={
                  <RedirectIfAuthed>
                    <LoginPage />
                  </RedirectIfAuthed>
                }
              />
              <Route
                path="/register"
                element={
                  <RedirectIfAuthed>
                    <RegisterPage />
                  </RedirectIfAuthed>
                }
              />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/invites/:token" element={<InvitePage />} />
              <Route path="/accept-invite" element={<InvitePage />} />

              {}
              <Route
                element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route path="/" element={<BoardsPage />} />
                <Route path="/boards/:boardId" element={<BoardPage />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route path="/docs/:pageId" element={<DocsPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/chat/:channelId" element={<ChatPage />} />
                <Route path="/files" element={<FilesPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/members" element={<MembersPage />} />
                <Route path="/invitations" element={<InvitationsPage />} />
                <Route path="/workspace" element={<WorkspacePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/dev/components" element={<ComponentsGallery />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SocketProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
