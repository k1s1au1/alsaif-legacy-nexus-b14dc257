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
  ChevronDown,
} from "lucide-react";
import { UserAvatar, invalidateAvatar } from "@/components/user-avatar";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/chat", label: "المحادثات", icon: MessageCircle },
  { to: "/meetings", label: "الاجتماعات", icon: CalendarDays },
  { to: "/trips", label: "الرحلات", icon: Plane },
  { to: "/finance", label: "الصندوق المالي", icon: Wallet },
  { to: "/tasks", label: "المهام", icon: ListChecks },
  { to: "/events", label: "المناسبات", icon: Sparkles },
  { to: "/majlis", label: "المجلس", icon: Megaphone },
  { to: "/archive", label: "الأرشيف", icon: Archive },
  { to: "/admin", label: "الإدارة", icon: Shield },
  { to: "/profile", label: "ملفي الشخصي", icon: User },
] as const;

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

  useEffect(() => {
    loadUnreadNotifications();

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
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () =>
        loadUnreadNotifications(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_participants" },
        () => loadUnreadNotifications(),
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
      if (document.visibilityState === "visible") loadUnreadNotifications();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadUnreadNotifications, user.avatarPath]);

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
            الصيف
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = path === to || path.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center justify-center lg:justify-start lg:px-4 py-3 rounded-xl text-sm transition-colors ${
                  active
                    ? "bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20"
                    : "text-ivory/55 hover:text-gold-primary hover:bg-secondary/40"
                }`}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.5} />
                <span className="hidden lg:block mr-3 font-medium">{label}</span>
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
            <Link
              to="/profile"
              className="flex items-center gap-3 pr-6 border-r border-border hover:opacity-80 transition"
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
            </Link>
          </div>
        </header>

        <div className="p-6 lg:p-10 max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
