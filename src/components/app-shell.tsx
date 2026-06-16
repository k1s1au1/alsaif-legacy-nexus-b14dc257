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
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [navBadges, setNavBadges] = useState<Record<string, number>>({});
  const [isAdminManager, setIsAdminManager] = useState({ isAdmin: false, isManager: false, userId: "" });
  const [myAvatarPath, setMyAvatarPath] = useState<string | null>(user.avatarPath ?? null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const queryClient = useQueryClient();

  usePresenceHeartbeat();

  const loadUnreadNotifications = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setUnreadNotifications(0);
      return;
    }

    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id,last_read_at")
      .eq("user_id", u.user.id);

    if (!parts?.length) {
      setUnreadNotifications(0);
      return;
    }

    const readByConversation = new Map(
      parts.map((p) => [p.conversation_id, new Date(p.last_read_at).getTime()]),
    );

    const { data: messages } = await supabase
      .from("messages")
      .select("conversation_id,created_at,sender_id")
      .in("conversation_id", [...readByConversation.keys()])
      .neq("sender_id", u.user.id)
      .order("created_at", { ascending: false })
      .limit(1000);

    const unread = (messages ?? []).filter((message) => {
      const lastReadAt = readByConversation.get(message.conversation_id) ?? 0;
      return new Date(message.created_at).getTime() > lastReadAt;
    }).length;

    setUnreadNotifications(unread);
  }, []);

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
        } catch {
          // ignore badge errors
        }
      }),
    );
    setNavBadges(next);
  }, []);

  useEffect(() => {
    loadUnreadNotifications();
    loadBadges();

    // Load my own avatar path (if not provided) and subscribe to profile changes
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setMyUserId(u.user.id);
      if (user.avatarPath === undefined) {
        const { data: p } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", u.user.id)
          .maybeSingle();
        setMyAvatarPath(p?.avatar_url ?? null);
      }
    })();

    const channel = supabase
      .channel("app-shell-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        loadUnreadNotifications();
        loadBadges();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_participants" },
        () => {
          loadUnreadNotifications();
          loadBadges();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        async (payload) => {
          const oldRow = payload.old as { avatar_url?: string | null } | null;
          const newRow = payload.new as { id?: string; avatar_url?: string | null } | null;
          // Invalidate any cached signed URL for both old and new paths so all
          // visible <UserAvatar> instances refetch with the latest image.
          if (oldRow?.avatar_url && oldRow.avatar_url !== newRow?.avatar_url) {
            invalidateAvatar(oldRow.avatar_url);
          }
          if (newRow?.avatar_url) invalidateAvatar(newRow.avatar_url);
          // Update own avatar in the header
          const { data: u } = await supabase.auth.getUser();
          if (u.user && newRow?.id === u.user.id) {
            setMyAvatarPath(newRow.avatar_url ?? null);
          }
        },
      )
      .subscribe();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadUnreadNotifications();
        loadBadges();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadUnreadNotifications, loadBadges, user.avatarPath]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("تم تسجيل الخروج");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Right Navigation Rail (RTL) */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 bg-card/60 border-l border-border backdrop-blur-xl z-50 flex flex-col transition-all duration-300",
          sidebarOpen ? "w-20 lg:w-64" : "w-0 overflow-hidden border-l-0",
        )}
      >
        <div className="h-20 flex items-center justify-center lg:justify-start lg:px-8 border-b border-border">
          <span className="hidden lg:block text-xl font-medium tracking-wide text-gold-primary">
            السيف
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.filter((item) => !item.adminOnly || isAdminManager.isAdmin || isAdminManager.isManager).map(({ to, label, icon: Icon }) => {
            const active = path === to || path.startsWith(to + "/");
            const badgeCount = navBadges[to] ?? 0;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center justify-center lg:justify-start lg:px-4 py-3 rounded-xl text-sm transition-colors relative ${
                  active
                    ? "bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20"
                    : "text-ivory/55 hover:text-gold-primary hover:bg-secondary/40"
                }`}
              >
                <div className="relative">
                  <Icon className="size-4 shrink-0" strokeWidth={1.5} />
                  {badgeCount > 0 && (
                    <span className="absolute -top-1.5 -left-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-gold-primary text-navy-base text-[8px] font-bold grid place-items-center leading-none">
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </div>
                <span className="hidden lg:block mr-3 font-medium">{label}</span>
                {badgeCount > 0 && (
                  <span className="hidden lg:flex mr-auto min-w-[18px] h-[18px] px-1 rounded-full bg-gold-primary/20 text-gold-primary text-[10px] font-semibold items-center justify-center">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center lg:justify-start lg:px-3 py-2 text-xs text-muted-foreground hover:text-gold-primary transition-colors rounded-lg"
          >
            <LogOut className="size-4" strokeWidth={1.5} />
            <span className="hidden lg:block mr-3">تسجيل الخروج</span>
          </button>
        </div>
      </aside>


      {/* Main */}
      <main
        className={cn(
          "relative min-h-screen pb-16 transition-all duration-300",
          sidebarOpen ? "mr-20 lg:mr-64" : "mr-0",
        )}
      >
        {/* Subtle moving palm pattern background */}
        <div aria-hidden className="palm-bg pointer-events-none absolute inset-0 -z-0 overflow-hidden">
          <div className="palm-bg-layer" />
        </div>
        <header className="h-20 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40 px-6 lg:px-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? "إخفاء القائمة" : "إظهار القائمة"}
              className="size-10 grid place-items-center rounded-lg bg-gold-primary/10 ring-1 ring-gold-primary/30 text-gold-primary hover:bg-gold-primary/20 transition-colors"
            >
              <Menu className="size-5" strokeWidth={1.5} />
            </button>
            <h1 className="text-lg font-medium tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-6">
            <NotificationsBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-3 pr-6 border-r border-border hover:opacity-80 transition outline-none"
                  aria-label="الملف الشخصي"
                >
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-medium text-ivory">{user.name}</p>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                      {user.role}
                    </p>
                  </div>
                  <div className="size-10 rounded-full bg-gold-primary/20 ring-1 ring-gold-primary/30 grid place-items-center text-gold-primary font-semibold">
                    <UserAvatar
                      path={myAvatarPath}
                      name={user.name}
                      initial={user.initial}
                      className="size-full rounded-full"
                      fallbackClassName="grid place-items-center size-full"
                      userId={myUserId}
                    />
                  </div>
                  <ChevronDown className="hidden sm:block size-4 text-muted-foreground" strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="min-w-[12rem]">
                <DropdownMenuLabel className="font-normal px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.role}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link to="/profile" className="w-full">
                  <DropdownMenuItem className="cursor-pointer gap-2 px-3 py-2">
                    <User className="size-4" strokeWidth={1.5} />
                    <span>ملفي الشخصي</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={signOut}
                  className="cursor-pointer gap-2 px-3 py-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="size-4" strokeWidth={1.5} />
                  <span>تسجيل الخروج</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="p-6 lg:p-10 max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
