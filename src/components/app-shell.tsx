import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Shield,
  Menu,
  LogOut,
  User,
  Users,
  ChevronDown,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import { UserAvatar, invalidateAvatar } from "@/components/user-avatar";
import { NotificationsBell } from "@/components/notifications-bell";
import { usePresenceHeartbeat } from "@/lib/presence";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type BadgeFn = (ctx: { userId: string; isAdmin: boolean; isManager: boolean }) => Promise<number>;

const navItems: { to: string; label: string; icon: typeof LayoutDashboard; badge?: BadgeFn; adminOnly?: boolean }[] = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/admin", label: "الإدارة", icon: Shield, adminOnly: true },
  { to: "/members", label: "الأعضاء", icon: Users },
  { to: "/settings", label: "الإعدادات", icon: Settings },
  { to: "/profile", label: "ملفي الشخصي", icon: User },
];

export function AppShell({
  children,
  title,
  user,
}: {
  children: ReactNode;
  title: string;
  user: { name: string; role: string; initial: string; avatarPath?: string | null };
}) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [navBadges, setNavBadges] = useState<Record<string, number>>({});
  const [isAdminManager, setIsAdminManager] = useState({ isAdmin: false, isManager: false, userId: "" });
  const [myAvatarPath, setMyAvatarPath] = useState<string | null>(user.avatarPath ?? null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  usePresenceHeartbeat();

  const loadBadges = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const r = (roles ?? []).map((x) => x.role);
    const isAdmin = r.includes("admin");
    const isManager = r.includes("manager");
    setIsAdminManager({ isAdmin, isManager, userId: u.user.id });

    const next: Record<string, number> = {};
    await Promise.all(
      navItems.map(async (item) => {
        if (!item.badge) return;
        try {
          const count = await item.badge({ userId: u.user.id, isAdmin, isManager });
          if (count > 0) next[item.to] = count;
        } catch {}
      }),
    );
    setNavBadges(next);
  }, []);

  useEffect(() => {
    loadBadges();
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setMyUserId(u.user.id);
      if (user.avatarPath === undefined) {
        const { data: p } = await supabase.from("profiles").select("avatar_url").eq("id", u.user.id).maybeSingle();
        setMyAvatarPath(p?.avatar_url ?? null);
      }
    })();
  }, [loadBadges, user.avatarPath]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <header className="h-16 sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="size-8 overflow-hidden rounded-lg bg-navy-base p-1">
            <img src={alsaifMark.url} alt="" className="size-full object-contain" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <NotificationsBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 outline-none">
                <div className="size-8 rounded-full border border-border overflow-hidden bg-muted p-0.5">
                  <UserAvatar
                    path={myAvatarPath}
                    name={user.name}
                    initial={user.initial}
                    className="size-full rounded-full"
                    userId={myUserId}
                  />
                </div>
                <ChevronDown className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={12} className="min-w-[200px] text-right">
              <DropdownMenuLabel className="px-3 py-2">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{user.role}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link to="/profile">
                <DropdownMenuItem className="cursor-pointer gap-2 py-2 flex flex-row-reverse text-right">
                  <User className="size-4" />
                  <span>ملفي الشخصي</span>
                </DropdownMenuItem>
              </Link>
              <Link to="/settings">
                <DropdownMenuItem className="cursor-pointer gap-2 py-2 flex flex-row-reverse text-right">
                  <Settings className="size-4" />
                  <span>الإعدادات</span>
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="cursor-pointer gap-2 py-2 flex flex-row-reverse text-red-600 text-right">
                <LogOut className="size-4" />
                <span>تسجيل الخروج</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden md:flex w-64 flex-col border-l border-border h-[calc(100vh-64px)] sticky top-16 bg-card/50">
          <nav className="flex-1 p-4 space-y-1">
            {navItems
              .filter((item) => !item.adminOnly || isAdminManager.isAdmin || isAdminManager.isManager)
              .map(({ to, label, icon: Icon }) => {
                const active = path === to || path.startsWith(to + "/");
                const badgeCount = navBadges[to] ?? 0;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={cn(
                      "group flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn("size-4", active ? "text-primary-foreground" : "text-muted-foreground")} />
                      <span>{label}</span>
                    </div>
                    {badgeCount > 0 && (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                          active ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground",
                        )}
                      >
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto">{children}</main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-card/90 backdrop-blur-md px-2 py-3 md:hidden">
        {navItems
          .filter((item) => !item.adminOnly || isAdminManager.isAdmin || isAdminManager.isManager)
          .map(({ to, label, icon: Icon }) => {
            const active = path === to || path.startsWith(to + "/");
            const badgeCount = navBadges[to] ?? 0;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "relative flex flex-col items-center gap-1 transition-colors duration-200",
                  active ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <div className="relative">
                  <Icon className="size-5" />
                  {badgeCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 size-4 flex items-center justify-center rounded-full bg-saudi-red text-[8px] font-bold text-white ring-2 ring-card">
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium leading-none">{label}</span>
                {active && (
                  <span className="absolute -bottom-1 size-1 rounded-full bg-primary animate-in fade-in zoom-in duration-300" />
                )}
              </Link>
            );
          })}
        <button
          onClick={() => setNavBadges({})}
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <Menu className="size-5" />
          <span className="text-[10px] font-medium leading-none">المزيد</span>
        </button>
      </nav>
    </div>
  );
}
