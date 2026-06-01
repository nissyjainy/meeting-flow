import { Link, useRouteContext } from "@tanstack/react-router";
import { Bell, Loader2, Moon, Sparkles, Sun, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/app-store";
import { useNotifications } from "@/hooks/use-notifications";
import { useMeetingUploadTrigger } from "@/providers/meeting-upload-provider";

function initials(name: string | null, email: string) {
  if (name) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function Topbar() {
  const { theme, toggleTheme, toggleCopilot } = useAppStore();
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const { openUploadDialog, isProcessing } = useMeetingUploadTrigger();
  const { user } = useRouteContext({ from: "__root__" });

  return (
    <header className="sticky top-0 z-30 flex h-16 min-w-0 w-full items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:gap-3 md:px-6">
      <div className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight sm:text-base">
        Northstar
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden gap-2 md:inline-flex"
          onClick={() => openUploadDialog()}
          disabled={isProcessing}
          title={isProcessing ? "Upload in progress…" : "Upload a meeting recording"}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="h-4 w-4" aria-hidden />
          )}
          {isProcessing ? "Uploading…" : "Upload"}
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleCopilot} title="AI Copilot">
          <Sparkles className="h-4 w-4 text-primary" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative shrink-0">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                  {unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
            <DropdownMenuLabel className="flex items-center justify-between gap-2">
              <span>Notifications</span>
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-normal text-primary hover:underline"
              >
                Mark all read
              </button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <DropdownMenuItem disabled className="justify-center text-xs text-muted-foreground">
                  No activity yet
                </DropdownMenuItem>
              ) : (
                notifications.slice(0, 5).map((n) => (
                  <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-2.5">
                    <div className="flex w-full min-w-0 items-center gap-2">
                      {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      <span className="min-w-0 truncate text-sm font-medium">{n.title}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{n.time}</span>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{n.description}</p>
                  </DropdownMenuItem>
                ))
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/notifications" className="justify-center text-sm text-primary">
                View all
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex shrink-0 items-center gap-2 rounded-full p-0.5 transition hover:bg-muted"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gradient-primary text-xs text-primary-foreground">
                  {user ? initials(user.fullName, user.email) : "?"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-w-[calc(100vw-2rem)]">
            <DropdownMenuLabel>
              <div className="truncate text-sm font-medium">{user?.fullName ?? "Account"}</div>
              <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/team">Team</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/logout">Sign out</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
