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
  Bell,
  Sparkles,
  Home,
  MessageCircle,
  Trophy,
  MoreHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { UserAvatar } from "@/components/user-avatar";
import { NotificationsBell } from "@/components/notifications-bell";
import { usePresenceHeartbeat } from "@/lib/presence";
import { toast } from "sonner";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
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

function BottomNavItem({ to, label, icon, active }: { to: string, label: string, icon: any, active: boolean }) {
  return (
    <Link to={to} className={cn(
      "flex flex-col items-center gap-1 transition-all duration-300",
      active ? "text-gold-primary" : "text-white/40"
    )}>
       {icon}
       <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </Link>
  );
}

function UserDropdown({ safeUser, myAvatarPath, myUserId, signOut }: any) {
  return (
    <DropdownMenu>
       <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 md:gap-3 p-1 pr-2.5 md:pr-4 rounded-full bg-primary/5 hover:bg-primary/10 transition-all outline-none border border-primary/5 group/profile">
             <div className="size-7 md:size-9 rounded-full ring-2 ring-primary/10 group-hover/profile:ring-primary transition-all bg-background p-0.5 relative">
                <UserAvatar
                  path={myAvatarPath}
                  name={safeUser.name}
                  initial={safeUser.initial}
                  className="size-full rounded-full"
                  userId={myUserId}
                  presenceDotClassName="absolute -bottom-0.5 -left-0.5 size-2.5 ring-2 ring-[var(--card)] shadow-lg"
                />
             </div>
             <span className="hidden sm:block text-[13px] md:text-[14px] font-black text-primary tracking-tight">{safeUser.name.split(' ')[0]}</span>
             <ChevronDown className="size-3.5 text-primary/30 group-hover/profile:text-primary transition-colors" />
          </button>
       </DropdownMenuTrigger>

       <DropdownMenuContent align="end" sideOffset={15} className="min-w-[240px] rounded-[24px] border-border bg-card/80 backdrop-blur-2xl p-2 text-right shadow-2xl">
          <DropdownMenuLabel className="px-5 py-5 border-b border-muted mb-2">
            <p className="text-[16px] font-black text-primary leading-tight">{safeUser.name}</p>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">{safeUser.role}</p>
          </DropdownMenuLabel>

          <Link to="/profile">
            <DropdownMenuItem className="rounded-xl px-5 py-4 flex flex-row-reverse justify-between gap-3 text-[14px] font-bold text-foreground focus:bg-primary focus:text-white cursor-pointer transition-all">
              <User size={18} />
              <span>ملفي الشخصي</span>
            </DropdownMenuItem>
          </Link>
          <Link to="/settings">
            <DropdownMenuItem className="rounded-xl px-5 py-4 flex flex-row-reverse justify-between gap-3 text-[14px] font-bold text-foreground focus:bg-primary focus:text-white cursor-pointer transition-all">
              <Settings size={18} />
              <span>الإعدادات</span>
            </DropdownMenuItem>
          </Link>

          <DropdownMenuSeparator className="bg-muted my-1" />

          <DropdownMenuItem
            onClick={signOut}
            className="rounded-xl px-5 py-4 flex flex-row-reverse justify-between gap-3 text-[14px] font-bold text-red-600 focus:bg-red-500 focus:text-white cursor-pointer transition-all"
          >
            <LogOut size={18} />
            <span>تسجيل الخروج</span>
          </DropdownMenuItem>
       </DropdownMenuContent>
    </DropdownMenu>
  );
}

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

  // Header Visibility Control
  const [headerVisible, setHeaderVisible] = useState(true);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? 0;
    const diff = latest - previous;

    // Hide on scroll down significantly
    if (diff > 10 && latest > 100) {
      setHeaderVisible(false);
    }
    // Show on scroll up significantly or when reaching the top
    else if (diff < -20 || latest < 50) {
      setHeaderVisible(true);
    }
  });

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
      {/* Global Animated Mesh Gradient Background */}
      <div className="mesh-gradient-container">
        <div className="mesh-blob-1" />
        <div className="mesh-blob-2" />
        {/* Subtle noise texture for grain effect */}
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/asfalt-dark.png")' }} />
      </div>

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
          className="fixed inset-y-0 right-0 w-3 z-[55]"
          onPointerDown={(e) => {
            if (e.pointerType === "mouse") return;
            setSidebarOpen(true);
          }}
        />
      )}

      <motion.aside
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 350 }}
        dragElastic={0.08}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.x > 120 || info.velocity.x > 500) {
            setSidebarOpen(false);
          }
        }}
        animate={{ x: sidebarOpen ? 0 : 350 }}
        transition={{ type: "spring", damping: 32, stiffness: 320, mass: 0.7 }}
        className={cn(
          "fixed inset-y-0 right-0 z-[100] flex flex-col bg-card border-l border-border shadow-2xl",
          "w-[85vw] max-w-[320px] rounded-l-[32px] touch-pan-y",
        )}
      >
        <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-14 bg-border/60 rounded-full" />

        <div className="px-6 pt-12 pb-8 flex flex-col items-center text-center gap-4 bg-muted/20 rounded-tl-[32px] border-b border-border relative overflow-hidden">
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

      <main className="relative min-h-screen pb-32 md:pb-20">
        {/* RESPONSIVE HEADER SYSTEM */}
        <motion.div
          initial={false}
          animate={{
            y: (typeof window !== 'undefined' && window.innerWidth < 768)
               ? (headerVisible ? 0 : -100)
               : 0,
            opacity: (typeof window !== 'undefined' && window.innerWidth < 768)
               ? (headerVisible ? 1 : 0)
               : 1
          }}
          transition={{ duration: 0.3 }}
          className={cn(
            "z-[80] transition-[padding] duration-500",
            "fixed top-4 inset-x-0 px-4", // Mobile: Floating
            "md:sticky md:top-0 md:inset-x-0 md:px-0" // Desktop: Fixed
          )}
        >
           <header className={cn(
             "mx-auto flex items-center justify-between transition-all duration-500 relative overflow-hidden",
             "h-14 bg-emerald-950/90 backdrop-blur-xl border border-white/10 rounded-full px-4 shadow-2xl", // Mobile Island Style (Darker like image)
             "md:h-20 md:max-w-none md:bg-background/80 md:rounded-none md:border-x-0 md:border-t-0 md:border-b md:border-white/5 md:px-8 lg:px-12"
           )}>

              <div className="flex items-center gap-2 md:gap-6">
                 {/* Mobile Logo Button */}
                 <div className="md:hidden size-9 rounded-full bg-gold-primary/10 border border-gold-primary/20 flex items-center justify-center p-1.5 shadow-inner">
                    {dynamicLogo ? <div className="size-full bg-contain bg-no-repeat bg-center" style={{ backgroundImage: `url(${dynamicLogo})` }} /> : <Sparkles className="size-4 text-gold-primary" />}
                 </div>

                 {/* Desktop Menu Button */}
                 <button onClick={() => setSidebarOpen(true)} className="hidden md:flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground hover:scale-105 transition-all shadow-lg active:scale-95">
                   <Menu className="size-6" />
                 </button>

                 <div className="hidden md:flex items-center gap-4 h-10 border-l border-primary/10 pl-6">
                    <h1 className="text-lg font-black tracking-tight text-primary uppercase">{title}</h1>
                 </div>
              </div>

              {/* Mobile Centered Title */}
              <div className="md:hidden absolute inset-0 flex items-center justify-center pointer-events-none">
                 <span className="text-sm font-black text-white tracking-wide">{title}</span>
              </div>

              <div className="flex items-center gap-2 md:gap-4 z-10">
                 <NotificationsBell />
                 <div className="hidden md:block">
                   <UserDropdown
                     safeUser={safeUser}
                     myAvatarPath={myAvatarPath}
                     myUserId={myUserId}
                     signOut={signOut}
                   />
                 </div>

                 {/* Mobile Menu Trigger */}
                 <button onClick={() => setSidebarOpen(true)} className="md:hidden size-9 rounded-full bg-white/10 flex items-center justify-center text-white">
                    <Menu size={18} />
                 </button>
              </div>
           </header>
        </motion.div>

        <div className="p-4 md:p-8 lg:p-12 pt-24 md:pt-6 max-w-7xl mx-auto">
          {children}
        </div>

        {/* MODERN MOBILE BOTTOM NAV (From the image) */}
        <div className="md:hidden fixed bottom-6 inset-x-6 z-[100]">
           <nav className="h-16 bg-[#051410] border border-white/10 rounded-full shadow-2xl flex items-center justify-around px-2 backdrop-blur-xl">
              <BottomNavItem to="/dashboard" label="الرئيسية" icon={<Home size={20} />} active={path === "/dashboard"} />
              <BottomNavItem to="/chat" label="المحادثة" icon={<MessageCircle size={20} />} active={path === "/chat"} />
              <div className="size-12 rounded-full bg-gold-primary shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center justify-center -mt-8 border-4 border-[#051410]">
                 <Sparkles className="text-emerald-950 size-6" />
              </div>
              <BottomNavItem to="/admin" label="الإدارة" icon={<Trophy size={20} />} active={path === "/admin"} />
              <button onClick={() => setSidebarOpen(true)} className="flex flex-col items-center gap-1 text-white/40">
                 <MoreHorizontal size={20} />
                 <span className="text-[9px] font-black uppercase">المزيد</span>
              </button>
           </nav>
        </div>
      </main>
n.div>

        {/* Content Area */}
        <div className="p-4 md:p-8 lg:p-12 pt-24 md:pt-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
