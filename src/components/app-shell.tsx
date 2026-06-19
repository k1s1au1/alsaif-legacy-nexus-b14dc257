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
  X,
  Bell,
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
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [navBadges, setNavBadges] = useState<Record<string, number>>({});
  const [isAdminManager, setIsAdminManager] = useState({ isAdmin: false, isManager: false, userId: "" });
  const [myAvatarPath, setMyAvatarPath] = useState<string | null>(user.avatarPath ?? null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const queryClient = useQueryClient();

  // Lock body scroll when overlay sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = "unset"; };
    }
  }, [sidebarOpen]);

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
    <div className="min-h-screen bg-background text-foreground selection:bg-gold-primary/20">
      {/* Backdrop overlay */}
      <div
        onClick={() => setSidebarOpen(false)}
        className={cn(
          "fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-500",
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      />

      {/* Modern iOS-style Navigation Drawer (RTL) */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-[70] flex flex-col bg-card/90 backdrop-blur-2xl border-l border-border/40 shadow-premium transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1)",
          "w-[85vw] max-w-[340px] rounded-l-[40px]",
          sidebarOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* User Profile Area in Sidebar */}
        <div className="px-6 pt-12 pb-8 flex flex-col items-center text-center gap-4">
          <div className="relative">
            <div className="size-20 rounded-[28px] bg-gradient-to-br from-gold-primary/20 to-gold-primary/5 ring-1 ring-gold-primary/20 p-1">
              <UserAvatar
                path={myAvatarPath}
                name={user.name}
                initial={user.initial}
                className="size-full rounded-[24px]"
                userId={myUserId}
              />
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute -top-2 -left-2 size-8 rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/20 flex items-center justify-center text-ivory/60 hover:text-ivory transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div>
            <h3 className="text-lg font-bold text-ivory tracking-tight">{user.name}</h3>
            <p className="text-[11px] text-muted-foreground uppercase tracking-[0.1em] mt-0.5">{user.role}</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto no-scrollbar">
          <div className="h-px bg-border/40 mx-4 mb-4" />
          {navItems.filter((item) => !item.adminOnly || isAdminManager.isAdmin || isAdminManager.isManager).map(({ to, label, icon: Icon }) => {
            const active = path === to || path.startsWith(to + "/");
            const badgeCount = navBadges[to] ?? 0;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex flex-row-reverse items-center px-4 py-3.5 rounded-2xl text-[15px] font-medium transition-all duration-300 gap-4",
                  active
                    ? "bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20 shadow-sm"
                    : "text-ivory/60 hover:text-gold-primary hover:bg-gold-primary/5"
                )}
              >
                <Icon className={cn("size-5 shrink-0", active ? "text-gold-primary" : "text-muted-foreground")} strokeWidth={active ? 2 : 1.5} />
                <span className="mr-auto">{label}</span>
                {badgeCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-gold-primary text-white text-[10px] font-bold">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-border/40">
          <button
            onClick={signOut}
            className="w-full flex flex-row-reverse items-center justify-between px-5 py-4 rounded-2xl bg-destructive/5 text-destructive hover:bg-destructive/10 transition-colors group"
          >
            <LogOut className="size-5" />
            <span className="text-[15px] font-bold">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="relative min-h-screen pb-20">

        {/* Sticky Premium Header */}
        <header
          className="h-20 sticky top-0 z-[50] px-6 lg:px-10 flex items-center justify-between bg-background/70 backdrop-blur-2xl border-b border-border/40 transition-colors duration-500"
        >
          <div className="flex items-center gap-5">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="القائمة"
              className="size-11 grid place-items-center rounded-2xl bg-gold-primary/5 ring-1 ring-gold-primary/10 text-gold-primary hover:bg-gold-primary/10 transition-all active:scale-95"
            >
              <Menu className="size-5" />
            </button>
            <div>
              <h1 className="text-[17px] font-bold tracking-tight text-ivory">{title}</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest hidden sm:block">Alsaif Family Hub</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <NotificationsBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 pl-1 pr-1 py-1 rounded-2xl hover:bg-gold-primary/5 transition-all outline-none group">
                  <div className="size-10 rounded-[14px] bg-gradient-to-br from-gold-primary/10 to-transparent p-0.5 ring-1 ring-gold-primary/10 overflow-hidden">
                    <UserAvatar
                      path={myAvatarPath}
                      name={user.name}
                      initial={user.initial}
                      className="size-full rounded-[12px]"
                      userId={myUserId}
                    />
                  </div>
                  <ChevronDown className="size-4 text-muted-foreground group-hover:text-gold-primary transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={12} className="min-w-[200px] rounded-2xl border-border/40 bg-card/95 backdrop-blur-xl p-2 text-right">
                <DropdownMenuLabel className="px-3 py-3">
                  <p className="text-sm font-bold text-ivory">{user.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase mt-0.5">{user.role}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/40" />
                <Link to="/profile">
                  <DropdownMenuItem className="rounded-xl px-3 py-2.5 flex flex-row-reverse justify-between gap-3 text-[14px] focus:bg-gold-primary/10 focus:text-gold-primary cursor-pointer">
                    <User size={18} />
                    <span>ملفي الشخصي</span>
                  </DropdownMenuItem>
                </Link>
                <Link to="/settings">
                  <DropdownMenuItem className="rounded-xl px-3 py-2.5 flex flex-row-reverse justify-between gap-3 text-[14px] focus:bg-gold-primary/10 focus:text-gold-primary cursor-pointer">
                    <Settings size={18} />
                    <span>الإعدادات</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator className="bg-border/40" />
                <DropdownMenuItem
                  onClick={signOut}
                  className="rounded-xl px-3 py-2.5 flex flex-row-reverse justify-between gap-3 text-[14px] text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                >
                  <LogOut size={18} />
                  <span>تسجيل الخروج</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content View Area */}
        <div className="relative z-10 p-6 lg:p-10 max-w-7xl mx-auto animate-fade-up">
          {children}
        </div>
      </main>
    </div>
  );
}
