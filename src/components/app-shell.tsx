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
  MoreHorizontal,
  Ticket,
  CalendarDays,
  ListChecks,
  Trees,
  Wallet,
  History,
  Archive,
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

function BottomNavItem({ to, label, icon, active, onClick }: { to: string, label: string, icon: any, active?: boolean, onClick?: () => void }) {
  const content = (
    <>
       {icon}
       <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={cn("flex flex-col items-center gap-1 transition-all duration-300", active ? "text-gold-primary" : "text-white/40")}>
        {content}
      </button>
    );
  }

  return (
    <Link to={to} className={cn(
      "flex flex-col items-center gap-1 transition-all duration-300",
      active ? "text-gold-primary" : "text-white/40"
    )}>
       {content}
    </Link>
  );
}

function QuickActionItem({ to, label, icon, color, onClick }: any) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex flex-col items-center gap-3 group animate-fade-up"
    >
       <div className={cn(
         "size-16 rounded-[24px] flex items-center justify-center text-white shadow-xl transition-all duration-500 group-hover:scale-110",
         color
       )}>
          {icon}
       </div>
       <span className="text-xs font-black text-white/70 group-hover:text-gold-primary transition-colors text-center leading-tight">{label}</span>
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
            className="rounded-xl px-5 py-4 flex flex-row-reverse justify-between gap-3 text-[14px] font-bold text-red-600 focus:bg-red-50 focus:text-white cursor-pointer transition-all"
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
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Header Visibility Control
  const [headerVisible, setHeaderVisible] = useState(true);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? 0;
    const diff = latest - previous;
    if (diff > 10 && latest > 100) setHeaderVisible(false);
    else if (diff < -20 || latest < 50) setHeaderVisible(true);
  });

  const queryClient = useQueryClient();
  const dynamicLogo = useSiteLogo();
  useFcm();

  useEffect(() => {
    if (sidebarOpen || showQuickActions) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = "unset"; };
    }
  }, [sidebarOpen, showQuickActions]);

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
      <div className="mesh-gradient-container">
        <div className="mesh-blob-1" />
        <div className="mesh-blob-2" />
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/asfalt-dark.png")' }} />
      </div>

      <DynamicIsland />

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ x: sidebarOpen ? 0 : 350 }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        className={cn(
          "fixed inset-y-0 right-0 z-[120] flex flex-col bg-card border-l border-border shadow-2xl",
          "w-[85vw] max-w-[320px] rounded-l-[32px] touch-pan-y",
        )}
      >
        <div className="px-6 pt-12 pb-8 flex flex-col items-center text-center gap-4 bg-muted/20 rounded-tl-[32px] border-b border-border relative">
          <div className="size-24 rounded-full ring-4 ring-background shadow-md bg-background p-1 relative">
            <UserAvatar path={myAvatarPath} name={safeUser.name} initial={safeUser.initial} className="size-full rounded-full" userId={myUserId} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-primary tracking-tight">{safeUser.name}</h3>
            <p className="text-[12px] text-muted-foreground font-bold uppercase tracking-[0.1em] mt-1">{safeUser.role}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="absolute top-4 left-4 p-2 text-primary"><X size={24} /></button>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto no-scrollbar">
          {navItems.filter(item => !item.adminOnly || isAdmin).map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} onClick={() => setSidebarOpen(false)} className={cn("flex flex-row-reverse items-center px-5 py-4 rounded-2xl text-[16px] font-bold gap-4", path === to ? "bg-primary text-white" : "text-foreground hover:bg-muted")}>
              <Icon size={20} />
              <span className="mr-auto">{label}</span>
            </Link>
          ))}
        </nav>
      </motion.aside>

      <main className="relative min-h-screen pb-32 md:pb-20">
        <motion.div
          animate={{ y: (typeof window !== 'undefined' && window.innerWidth < 768) ? (headerVisible ? 0 : -100) : 0 }}
          className={cn("z-[80] fixed top-4 inset-x-0 px-4 md:sticky md:top-0 md:inset-x-0 md:px-0")}
        >
           <header className={cn("mx-auto flex items-center justify-between h-14 bg-emerald-950/90 backdrop-blur-xl border border-white/10 rounded-full px-4 shadow-2xl md:h-20 md:bg-background/80 md:rounded-none md:px-8 lg:px-12")}>
              <div className="flex items-center gap-2 md:gap-6">
                 <div className="size-9 rounded-full bg-gold-primary/10 border border-gold-primary/20 flex items-center justify-center p-1.5">
                    {dynamicLogo ? <div className="size-full bg-contain bg-no-repeat bg-center" style={{ backgroundImage: `url(${dynamicLogo})` }} /> : <Sparkles className="size-4 text-gold-primary" />}
                 </div>
                 <h1 className="md:block hidden text-lg font-black text-primary uppercase">{title}</h1>
              </div>
              <div className="md:hidden absolute inset-0 flex items-center justify-center pointer-events-none">
                 <span className="text-sm font-black text-white">{title}</span>
              </div>
              <div className="flex items-center gap-2 z-10">
                 <NotificationsBell />
                 <div className="hidden md:block">
                   <UserDropdown safeUser={safeUser} myAvatarPath={myAvatarPath} myUserId={myUserId} signOut={signOut} />
                 </div>
                 <button onClick={() => setSidebarOpen(true)} className="md:hidden size-9 rounded-full bg-white/10 flex items-center justify-center text-white"><Menu size={18} /></button>
              </div>
           </header>
        </motion.div>

        <div className="p-4 md:p-8 lg:p-12 pt-24 md:pt-6 max-w-7xl mx-auto">
          {children}
        </div>

        {/* MODERN MOBILE BOTTOM NAV */}
        <div className="md:hidden fixed bottom-6 inset-x-6 z-[100]">
           <nav className="h-16 bg-[#051410] border border-white/10 rounded-full shadow-2xl flex items-center justify-around px-2 backdrop-blur-xl">
              <BottomNavItem to="/dashboard" label="الرئيسية" icon={<Home size={20} />} active={path === "/dashboard"} />
              <BottomNavItem to="/settings" label="الأعدادات" icon={<Settings size={20} />} active={path === "/settings"} />
              <div className="size-14 rounded-full bg-white shadow-2xl flex items-center justify-center -mt-10 border-[6px] border-[#051410] p-2 relative group active:scale-95 transition-all">
                 <div className="absolute inset-0 bg-gold-primary/10 rounded-full blur-lg animate-pulse" />
                 {dynamicLogo ? (
                   <div className="size-full bg-contain bg-no-repeat bg-center relative z-10" style={{ backgroundImage: `url(${dynamicLogo})` }} />
                 ) : (
                   <Sparkles className="text-gold-primary size-6 relative z-10" />
                 )}
              </div>
              <BottomNavItem to="/admin" label="الإدارة" icon={<Trophy size={20} />} active={path === "/admin"} />
              <BottomNavItem to="#" label="المزيد" icon={<MoreHorizontal size={20} />} onClick={() => setShowQuickActions(true)} />
           </nav>
        </div>

        {/* QUICK ACTIONS OVERLAY */}
        <AnimatePresence>
          {showQuickActions && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-[#051410]/95 backdrop-blur-2xl"
              dir="rtl"
            >
               <button onClick={() => setShowQuickActions(false)} className="absolute top-10 left-10 size-12 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all">
                  <X size={24} />
               </button>

               <div className="w-full max-w-lg space-y-12">
                  <div className="text-center space-y-2">
                     <h3 className="text-3xl font-black text-white">الوصول السريع</h3>
                     <p className="text-gold-primary/60 font-bold uppercase tracking-widest text-[10px]">بوابة مجلس السيف الرقمية</p>
                  </div>

                  <div className="grid grid-cols-3 gap-y-10 gap-x-6">
                     <QuickActionItem to="/chat" label="محادثة" icon={<MessageCircle size={28} />} color="bg-[#065F46]" onClick={() => setShowQuickActions(false)} />
                     <QuickActionItem to="/trips" label="ترفيه" icon={<Ticket size={28} />} color="bg-[#D4AF37]" onClick={() => setShowQuickActions(false)} />
                     <QuickActionItem to="/meetings" label="اجتماعات" icon={<CalendarDays size={28} />} color="bg-[#1B3022]" onClick={() => setShowQuickActions(false)} />
                     <QuickActionItem to="/tasks" label="مهام" icon={<ListChecks size={28} />} color="bg-[#947D4C]" onClick={() => setShowQuickActions(false)} />
                     <QuickActionItem to="/majlis" label="الأخبار" icon={<Newspaper size={28} />} color="bg-[#064E3B]" onClick={() => setShowQuickActions(false)} />
                     <QuickActionItem to="/community" label="ركن الأعضاء" icon={<Users size={28} />} color="bg-[#3D8557]" onClick={() => setShowQuickActions(false)} />
                     <QuickActionItem to="/archive" label="الألبوم" icon={<Archive size={28} />} color="bg-[#C5A87C]" onClick={() => setShowQuickActions(false)} />
                     <QuickActionItem to="/heritage" label="الإرث" icon={<History size={28} />} color="bg-[#8E7745]" onClick={() => setShowQuickActions(false)} />
                     <QuickActionItem to="/family-tree" label="شجرة العائلة" icon={<Trees size={28} />} color="bg-[#153221]" onClick={() => setShowQuickActions(false)} />
                     <QuickActionItem to="/finance" label="الصندوق" icon={<Wallet size={28} />} color="bg-[#BF953F]" onClick={() => setShowQuickActions(false)} />
                     <QuickActionItem to="/profile" label="ملفي" icon={<User size={28} />} color="bg-[#043A2B]" onClick={() => setShowQuickActions(false)} />
                     <QuickActionItem to="/settings" label="الأعدادات" icon={<Settings size={28} />} color="bg-primary" onClick={() => setShowQuickActions(false)} />
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
