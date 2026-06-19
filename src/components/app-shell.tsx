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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = "unset"; };
    }
  }, [sidebarOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Safely check for native platform using global Capacitor object
    const win = window as any;
    if (win.Capacitor?.isNativePlatform()) {
      // Future-proof: use win.Capacitor.Plugins for native features
      console.log("App running in native mode");
    }
  }, []);

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
      {/* Backdrop overlay */}
      <div
        onClick={() => setSidebarOpen(false)}
        className={cn(
          "fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-500",
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      />

      {/* Modern High-Contrast Sidebar (RTL) */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-[70] flex flex-col bg-card border-l border-border shadow-[0_0_40px_rgba(0,0,0,0.15)] transition-transform duration-500",
          "w-[85vw] max-w-[320px] rounded-l-[32px]",
          sidebarOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="px-6 pt-14 pb-8 flex flex-col items-center text-center gap-4 bg-muted/30 rounded-tl-[32px] border-b border-border">
          <div className="relative">
            <div className="size-24 rounded-full ring-4 ring-card shadow-md overflow-hidden bg-card p-1">
              <UserAvatar
                path={myAvatarPath}
                name={user.name}
                initial={user.initial}
                className="size-full rounded-full"
                userId={myUserId}
              />
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute -top-4 -left-4 size-10 rounded-full bg-white shadow-lg ring-1 ring-black/5 flex items-center justify-center text-[#1B4332] hover:bg-[#F2F2F7] transition-all"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
          <div>
            <h3 className="text-xl font-bold text-primary tracking-tight">{user.name}</h3>
            <p className="text-[12px] text-gold-primary font-bold uppercase tracking-[0.1em] mt-1">{user.role}</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto no-scrollbar">
          {navItems.filter((item) => !item.adminOnly || isAdminManager.isAdmin || isAdminManager.isManager).map(({ to, label, icon: Icon }) => {
            const active = path === to || path.startsWith(to + "/");
            const badgeCount = navBadges[to] ?? 0;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex flex-row-reverse items-center px-5 py-4 rounded-2xl text-[16px] font-bold transition-all duration-200 gap-4",
                  active
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-primary"
                )}
              >
                <Icon className={cn("size-5 shrink-0", active ? "text-primary-foreground" : "text-gold-primary/70")} strokeWidth={active ? 2.5 : 2} />
                <span className="mr-auto">{label}</span>
                {badgeCount > 0 && (
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", active ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground")}>
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-border">
          <button
            onClick={signOut}
            className="w-full flex flex-row-reverse items-center justify-between px-6 py-4 rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all font-bold border border-destructive/20"
          >
            <LogOut className="size-5" />
            <span className="text-[16px]">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="relative min-h-screen pb-20">
        <header
          className="h-24 sticky top-0 z-[50] px-6 lg:px-12 flex items-center justify-between bg-card/80 backdrop-blur-2xl border-b border-border transition-all shadow-xl"
        >
          <div className="flex items-center gap-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="size-12 grid place-items-center rounded-2xl bg-primary text-primary-foreground hover:scale-110 hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-primary/20"
            >
              <Menu className="size-7" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-[22px] font-black tracking-tighter text-primary leading-tight">{title}</h1>
              <p className="text-[10px] font-bold text-gold-primary uppercase tracking-[0.2em] opacity-60">Alsaif Nexus</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <NotificationsBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 outline-none group">
                  <div className="size-10 rounded-full ring-2 ring-primary/10 overflow-hidden group-hover:ring-primary transition-all bg-card p-0.5">
                    <UserAvatar
                      path={myAvatarPath}
                      name={user.name}
                      initial={user.initial}
                      className="size-full rounded-full"
                      userId={myUserId}
                    />
                  </div>
                  <ChevronDown className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={12} className="min-w-[220px] rounded-2xl border-border bg-card p-2 text-right shadow-xl">
                <DropdownMenuLabel className="px-4 py-4 border-b border-muted/50 mb-1">
                  <p className="text-[15px] font-bold text-primary">{user.name}</p>
                  <p className="text-[10px] text-gold-primary uppercase font-bold tracking-widest">{user.role}</p>
                </DropdownMenuLabel>
                <Link to="/profile">
                  <DropdownMenuItem className="rounded-xl px-4 py-3 flex flex-row-reverse justify-between gap-3 text-[15px] font-bold text-muted-foreground focus:bg-muted focus:text-primary cursor-pointer">
                    <User size={18} />
                    <span>ملفي الشخصي</span>
                  </DropdownMenuItem>
                </Link>
                <Link to="/settings">
                  <DropdownMenuItem className="rounded-xl px-4 py-3 flex flex-row-reverse justify-between gap-3 text-[15px] font-bold text-muted-foreground focus:bg-muted focus:text-primary cursor-pointer">
                    <Settings size={18} />
                    <span>الإعدادات</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator className="bg-muted/50" />
                <DropdownMenuItem
                  onClick={signOut}
                  className="rounded-xl px-4 py-3 flex flex-row-reverse justify-between gap-3 text-[15px] font-bold text-destructive focus:bg-destructive/10 cursor-pointer"
                >
                  <LogOut size={18} />
                  <span>تسجيل الخروج</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="p-6 lg:p-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
