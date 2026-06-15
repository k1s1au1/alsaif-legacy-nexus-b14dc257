import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  MessageCircle,
  CalendarDays,
  Plane,
  Wallet,
  ListChecks,
  Sparkles,
  Megaphone,
  Archive,
  Shield,
  Bell,
  LogOut,
  User,
  Users,
  ChevronDown,
} from "lucide-react";
import { UserAvatar, invalidateAvatar } from "@/components/user-avatar";
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
  {
    to: "/chat",
    label: "المحادثات",
    icon: MessageCircle,
    badge: async ({ userId }) => {
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("conversation_id,last_read_at")
        .eq("user_id", userId);
      if (!parts?.length) return 0;
      const readMap = new Map(parts.map((p) => [p.conversation_id, new Date(p.last_read_at).getTime()]));
      const { data: msgs } = await supabase
        .from("messages")
        .select("conversation_id,created_at,sender_id")
        .in("conversation_id", [...readMap.keys()])
        .neq("sender_id", userId)
        .order("created_at", { ascending: false })
        .limit(500);
      return (msgs ?? []).filter((m) => new Date(m.created_at).getTime() > (readMap.get(m.conversation_id) ?? 0)).length;
    },
  },
  {
    to: "/meetings",
    label: "الاجتماعات",
    icon: CalendarDays,
    badge: async ({ userId }) => {
      const now = new Date().toISOString();
      const { data: meetings } = await supabase
        .from("meetings")
        .select("id")
        .gte("scheduled_at", now)
        .eq("status", "scheduled");
      if (!meetings?.length) return 0;
      const ids = meetings.map((m) => m.id);
      const { data: attended } = await supabase
        .from("meeting_attendees")
        .select("meeting_id")
        .eq("user_id", userId)
        .in("meeting_id", ids);
      const attendedSet = new Set((attended ?? []).map((a) => a.meeting_id));
      return ids.filter((id) => !attendedSet.has(id)).length;
    },
  },
  {
    to: "/trips",
    label: "الرحلات",
    icon: Plane,
    badge: async () => {
      const now = new Date().toISOString();
      const { count } = await supabase
        .from("trips")
        .select("*", { count: "exact", head: true })
        .or(`start_date.gte.${now},and(start_date.is.null,status.eq.upcoming)`);
      return count ?? 0;
    },
  },
  {
    to: "/finance",
    label: "الصندوق المالي",
    icon: Wallet,
    badge: async ({ isAdmin, isManager }) => {
      if (!isAdmin && !isManager) return 0;
      const { count } = await supabase
        .from("bank_transfers")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
  },
  { to: "/tasks", label: "المهام", icon: ListChecks },
  { to: "/events", label: "المناسبات", icon: Sparkles },
  { to: "/majlis", label: "المجلس", icon: Megaphone },
  { to: "/archive", label: "الأرشيف", icon: Archive },
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
  const queryClient = useQueryClient();

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
      <aside className="fixed inset-y-0 right-0 w-20 lg:w-64 bg-card/60 border-l border-border backdrop-blur-xl z-50 flex flex-col">
        <div className="h-20 flex items-center justify-center lg:justify-start lg:px-8 border-b border-border">
          <div className="size-10 bg-gold-primary/10 ring-1 ring-gold-primary/30 rounded-lg grid place-items-center">
            <span className="text-gold-primary text-xl font-semibold select-none">ص</span>
          </div>
          <span className="hidden lg:block mr-4 text-xl font-medium tracking-wide text-gold-primary">
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
      <main className="mr-20 lg:mr-64 min-h-screen pb-16">
        <header className="h-20 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40 px-6 lg:px-10 flex items-center justify-between">
          <h1 className="text-lg font-medium tracking-tight">{title}</h1>
          <div className="flex items-center gap-6">
            <button className="relative p-2 text-muted-foreground hover:text-gold-primary transition">
              <Bell className="size-5" strokeWidth={1.5} />
              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-gold-primary text-navy-base text-[9px] font-bold grid place-items-center leading-none">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </button>
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
                  <div className="size-10 rounded-full bg-gold-primary/20 ring-1 ring-gold-primary/30 grid place-items-center text-gold-primary font-semibold overflow-hidden">
                    <UserAvatar
                      path={myAvatarPath}
                      name={user.name}
                      initial={user.initial}
                      className="size-full"
                      fallbackClassName=""
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
