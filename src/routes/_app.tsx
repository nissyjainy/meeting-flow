import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { normalizeAuthRedirectPath } from "@/lib/auth/redirect-path";
import { AppSidebar } from "@/components/app/Sidebar";
import { Topbar } from "@/components/app/Topbar";
import { CopilotPanel } from "@/components/app/CopilotPanel";
import { MeetingUploadProvider } from "@/providers/meeting-upload-provider";

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: { redirect: normalizeAuthRedirectPath(location.href) },
      });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <MeetingUploadProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="min-w-0 w-full flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
        <CopilotPanel />
      </div>
    </MeetingUploadProvider>
  );
}