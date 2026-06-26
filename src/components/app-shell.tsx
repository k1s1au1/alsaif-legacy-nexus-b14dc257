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
  Newspaper,
} from "lucide-react";
import { cn } from "@/lib/utils";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { UserAvatar } from "@/components/user-avatar";
import { NotificationsBell } from "@/components/notifications-bell";
import { usePresenceHeartbeat } from "@/lib/presence";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useFcm } from "@/hooks/use-fcm";
import { DynamicIsland } from "@/components/dynamic-island";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems: { to: string; label: string; icon: any; adminOnly?: boolean }[] = [
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [myAvatarPath, setMyAvatarPath] = useState<string | null>(user?.avatarPath ?? null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const queryClient = useQueryClient();
  const dynamicLogo = useSiteLogo();
  useFcm();

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = "unset"; };
    }
  }, [sidebarOpen]);

  usePresenceHeartbeat();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data?.user) return;
        const uid = data.user.id;
        setMyUserId(uid);

        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
        const r = (roles ?? []).map(x => x.role);
        setIsAdmin(r.includes("admin") || r.includes("manager") || r.includes("chairman"));

        const { data: p } = await supabase.from("profiles").select("avatar_url").eq("id", uid).maybeSingle();
        if (p?.avatar_url) setMyAvatarPath(p.avatar_url);
      } catch (e) {
        console.error("Shell initialization error", e);
      }
    })();
  }, []);

  async function signOut() {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      toast.success("تم تسجيل الخروج");
      navigate({ to: "/auth", replace: true });
    } catch {
      window.location.href = "/auth";
    }
  }

  const safeUser = user || { name: "عضو العائلة", role: "عضو", initial: "ع" };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500 overflow-x-hidden">
      <DynamicIsland />
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Edge trigger for swiping open — invisible but interactive */}
      {!sidebarOpen && (
        <div
          className="fixed inset-y-0 right-0 w-8 z-[55] lg:hidden"
          onPointerDown={() => setSidebarOpen(true)}
        />
      )}

      <motion.aside
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 350 }}
        dragElastic={0.05}
        onDragEnd={(_, info) => {
          // If swiped right (towards the edge) with enough velocity or distance
          if (info.offset.x > 50 || info.velocity.x > 300) {
            setSidebarOpen(false);
          }
        }}
        animate={{ x: sidebarOpen ? 0 : 350 }}
        transition={{ type: "spring", damping: 30, stiffness: 350, mass: 0.8 }}
        className={cn(
          "fixed inset-y-0 right-0 z-[70] flex flex-col bg-card border-l border-border shadow-2xl",
          "w-[85vw] max-w-[320px] rounded-l-[32px] touch-pan-y",
        )}
      >
        {/* Visual drag handle for mobile */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-border/40 rounded-full lg:hidden ml-1" />

        <div className="px-6 pt-12 pb-8 flex flex-col items-center text-center gap-4 bg-muted/20 rounded-tl-[32px] border-b border-border relative overflow-hidden">
          <div
            className="absolute top-4 right-4 size-8 z-10 logo-alsaif opacity-40 hover:opacity-100 transition-opacity"
            style={{ '--logo-url': `url(${dynamicLogo || alsaifMark.url})` } as any}
          />
          <div className="relative">
            <div className="size-24 rounded-full ring-4 ring-background shadow-md bg-background p-1 relative">
              <UserAvatar
                path={myAvatarPath}
                name={safeUser.name}
                initial={safeUser.initial}
                className="size-full rounded-full overflow-hidden"
                userId={myUserId}
                presenceDotClassName="absolute -bottom-1 -left-1 size-6 ring-4 ring-[var(--card)] shadow-xl"
              />
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute -top-4 -left-4 size-10 rounded-full bg-card shadow-lg ring-1 ring-black/5 flex items-center justify-center text-primary hover:bg-muted transition-all"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
          <div>
            <h3 className="text-xl font-bold text-primary tracking-tight">{safeUser.name}</h3>
            <p className="text-[12px] text-muted-foreground font-bold uppercase tracking-[0.1em] mt-1">{safeUser.role}</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto no-scrollbar">
          {navItems.filter(item => !item.adminOnly || isAdmin).map(({ to, label, icon: Icon }) => {
            const active = path === to || path.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex flex-row-reverse items-center px-5 py-4 rounded-2xl text-[16px] font-bold transition-all duration-200 gap-4",
                  active
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-foreground hover:bg-muted hover:text-primary"
                )}
              >
                <Icon className={cn("size-5 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground")} strokeWidth={active ? 2.5 : 2} />
                <span className="mr-auto">{label}</span>
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
      </motion.aside>

      <main className="relative min-h-screen pb-20">
        <header className="h-20 sticky top-0 z-[50] px-6 lg:px-10 flex items-center justify-between bg-card/80 backdrop-blur-md border-b border-border transition-all shadow-sm">
          <div className="flex items-center gap-5">
            <button
              onClick={() => setSidebarOpen(true)}
              className="size-11 grid place-items-center rounded-xl bg-primary text-primary-foreground hover:brightness-110 transition-all active:scale-95 shadow-md"
            >
              <Menu className="size-6" />
            </button>
            <h1 className="text-[19px] font-bold tracking-tight text-primary">{title}</h1>
          </div>

          <div className="flex items-center gap-4">
            <NotificationsBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 outline-none group">
                  <div className="size-10 rounded-full ring-2 ring-primary/10 group-hover:ring-primary transition-all bg-background p-0.5 relative">
                    <UserAvatar
                      path={myAvatarPath}
                      name={safeUser.name}
                      initial={safeUser.initial}
                      className="size-full rounded-full overflow-hidden"
                      userId={myUserId}
                      presenceDotClassName="absolute -bottom-1 -left-1 size-4 ring-2 ring-[var(--card)] shadow-lg"
                    />
                  </div>
                  <ChevronDown className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={12} className="min-w-[220px] rounded-2xl border-border bg-card p-2 text-right shadow-xl">
                <DropdownMenuLabel className="px-4 py-4 border-b border-muted mb-1">
                  <p className="text-[15px] font-bold text-primary">{safeUser.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{safeUser.role}</p>
                </DropdownMenuLabel>
                <Link to="/profile">
                  <DropdownMenuItem className="rounded-xl px-4 py-3 flex flex-row-reverse justify-between gap-3 text-[15px] font-bold text-foreground focus:bg-muted focus:text-primary cursor-pointer">
                    <User size={18} />
                    <span>ملفي الشخصي</span>
                  </DropdownMenuItem>
                </Link>
                <Link to="/settings">
                  <DropdownMenuItem className="rounded-xl px-4 py-3 flex flex-row-reverse justify-between gap-3 text-[15px] font-bold text-foreground focus:bg-muted focus:text-primary cursor-pointer">
                    <Settings size={18} />
                    <span>الإعدادات</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator className="bg-muted" />
                <DropdownMenuItem
                  onClick={signOut}
                  className="rounded-xl px-4 py-3 flex flex-row-reverse justify-between gap-3 text-[15px] font-bold text-red-600 focus:bg-red-50 cursor-pointer"
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
