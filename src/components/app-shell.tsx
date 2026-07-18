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
  Clock,
  Home,
  MessageCircle,
  ShieldCheck,
  MoreHorizontal,
  Ticket,
  CalendarDays,
  ListChecks,
  Trees,
  Wallet,
  History,
  Archive,
  ChevronLeft,
  Lock,
  LayoutGrid,
  Radio,
  AlertOctagon,
  Footprints,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { UserAvatar } from "@/components/user-avatar";
import { NotificationsBell } from "@/components/notifications-bell";
import { usePresenceHeartbeat, useOnlineCount, useOnlineUsers, usePresenceFor, type PresenceState } from "@/lib/presence";
import { toast } from "sonner";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { useFcm } from "@/hooks/use-fcm";
import { useAppPermissions } from "@/hooks/use-app-permissions";
import { DynamicIsland } from "@/components/dynamic-island";
import { LiveClock } from "@/components/dashboard/live-clock";
import { BiometricGate } from "@/components/biometric-gate";
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

function BottomNavItem({
  to,
  label,
  icon,
  active,
  onClick,
}: {
  to: string;
  label: string;
  icon: any;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      {icon}
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "flex flex-col items-center gap-1 transition-all duration-300",
          active ? "text-gold-primary" : "text-white/40",
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-300",
        active ? "text-gold-primary" : "text-white/40",
      )}
    >
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
      <div
        className={cn(
          "size-16 rounded-[24px] flex items-center justify-center text-white shadow-xl transition-all duration-500 group-hover:scale-110",
          color,
        )}
      >
        {icon}
      </div>
      <span className="text-xs font-black text-white/70 group-hover:text-gold-primary transition-colors text-center leading-tight">
        {label}
      </span>
    </Link>
  );
}

function ConnectionStatus({ state, dark = false }: { state: PresenceState; dark?: boolean }) {
  const status =
    state === "online"
      ? { label: "نشط الآن", color: "text-emerald-500", glow: "bg-emerald-400/30" }
      : state === "idle"
        ? { label: "وضع هادئ", color: "text-amber-500", glow: "bg-amber-400/25" }
        : { label: "غير نشط", color: "text-slate-400", glow: "bg-slate-400/20" };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[10px] font-black tracking-wide",
        dark ? "border-white/10 bg-white/10 text-white/85" : "border-primary/10 bg-primary/5 text-primary",
      )}
    >
      <span className="relative flex size-4 items-center justify-center">
        {state === "online" && <span className={cn("absolute inset-0 rounded-full animate-ping", status.glow)} />}
        <Radio size={13} className={cn("relative", status.color)} strokeWidth={2.5} />
      </span>
      <span>{status.label}</span>
    </div>
  );
}

function UserDropdown({ safeUser, myAvatarPath, connectionState, signOut, logo }: any) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 md:gap-4 p-1 pr-2 md:pr-5 rounded-full bg-white/10 md:bg-primary/5 hover:bg-primary/10 transition-all outline-none border border-white/10 md:border-primary/5 group/profile max-w-[130px] md:max-w-none">
          <div
            className={cn(
              "size-7 md:size-10 rounded-full ring-2 transition-all bg-background p-0.5 relative overflow-hidden flex items-center justify-center shrink-0",
              connectionState === "online"
                ? "ring-emerald-400/80 shadow-[0_0_14px_rgba(52,211,153,0.35)]"
                : connectionState === "idle"
                  ? "ring-amber-400/70"
                  : "ring-primary/10 group-hover/profile:ring-primary",
            )}
          >
            <div className="size-full">
              <UserAvatar
                path={myAvatarPath}
                name={safeUser.name}
                initial={safeUser.initial}
                className="size-full rounded-full"
              />
            </div>
          </div>
          <span className="text-[10px] md:text-[15px] font-black text-white md:text-primary tracking-tight drop-shadow-sm truncate">
            {safeUser.name.split(" ")[0]}
          </span>
          <ChevronDown className="size-3 md:size-4 text-white/70 md:text-primary/30 group-hover/profile:text-white md:group-hover/profile:text-primary transition-colors shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={15}
        className="min-w-[240px] rounded-[24px] border-border bg-card/80 backdrop-blur-2xl p-2 text-right shadow-2xl"
      >
        <DropdownMenuLabel className="px-5 py-5 border-b border-muted mb-2">
          <p className="text-[16px] font-black text-primary leading-tight">{safeUser.name}</p>
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">
            {safeUser.role}
          </p>
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
  fullWidth = false,
}: {
  children: ReactNode;
  title: string;
  user: { name: string; role: string; initial: string; avatarPath?: string | null };
  fullWidth?: boolean;
}) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [isAdmin, setIsAdmin] = useState(false);
  const [bottomNavShortcut, setBottomNavShortcut] = useState<"admin" | "news" | null>(null);
  const [myAvatarPath, setMyAvatarPath] = useState<string | null>(user?.avatarPath ?? null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>(user?.name || "");
  const [myRole, setMyRole] = useState<string>(user?.role || "");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showMoreHub, setShowMoreHub] = useState(false);

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
  const onlineCount = useOnlineCount();
  const myPresenceState = usePresenceFor(myUserId);
  const onlineUserIds = useOnlineUsers();
  const [onlineProfiles, setOnlineUserProfiles] = useState<any[]>([]);
  useFcm();
  useAppPermissions();
  usePresenceHeartbeat();

  useEffect(() => {
    if (onlineUserIds.length > 0) {
      supabase
        .from("profiles")
        .select("id, arabic_name, full_name, avatar_url")
        .in("id", onlineUserIds)
        .then(({ data }) => {
          if (data) setOnlineUserProfiles(data);
        });
    } else {
      setOnlineUserProfiles([]);
    }
  }, [onlineUserIds]);

  useEffect(() => {
    if (sidebarOpen || showQuickActions || showMoreHub) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "unset";
      };
    }
  }, [sidebarOpen, showQuickActions, showMoreHub]);

  // Navigation Visibility Control
  const [headerCompact, setHeaderCompact] = useState(false);
  const [navVisible, setNavVisible] = useState(true);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? 0;
    const diff = latest - previous;

    // Header logic
    if (latest > 100) setHeaderCompact(true);
    else setHeaderCompact(false);

    // Bottom Nav logic
    if (diff > 15 && latest > 200) setNavVisible(false);
    else if (diff < -25 || latest < 50) setNavVisible(true);
  });

  useEffect(() => {
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) return;
        const uid = authData.user.id;
        setMyUserId(uid);

        const [{ data: rolesData }, { data: profileData }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", uid),
          supabase
            .from("profiles")
            .select("arabic_name, full_name, avatar_url")
            .eq("id", uid)
            .maybeSingle(),
        ]);

        const rs = (rolesData ?? []).map((x) => x.role);
        const hasManagementRank = rs.some((role) =>
          ["chairman", "admin", "manager"].includes(role),
        );
        setIsAdmin(hasManagementRank);
        // Resolve this once from the member's rank so the mobile shortcut never
        // flashes "الأخبار" before changing to "الإدارة".
        setBottomNavShortcut(hasManagementRank ? "admin" : "news");

        const name =
          profileData?.arabic_name ||
          profileData?.full_name ||
          authData.user.email?.split("@")[0] ||
          "عضو العائلة";
        setMyName(name);

        let roleLabelStr = "عضو";
        if (rs.includes("chairman")) roleLabelStr = "رئيس المجلس";
        else if (rs.includes("admin")) roleLabelStr = "مسؤول";
        else if (rs.includes("manager")) roleLabelStr = "مسؤول قسم";
        setMyRole(roleLabelStr);

        if (profileData?.avatar_url) setMyAvatarPath(profileData.avatar_url);
      } catch (e) {
        console.error("Shell initialization error", e);
        setBottomNavShortcut("news");
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

  const safeUser = {
    name: myName || "جاري التحميل...",
    role: myRole || "عضو",
    initial: (myName || "ع")[0].toUpperCase(),
    avatarPath: myAvatarPath,
  };

  return (
    <BiometricGate>
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500 overflow-x-hidden">
      <div className="mesh-gradient-container">
        <div className="mesh-blob-1" />
        <div className="mesh-blob-2" />
        <div
          className="absolute inset-0 opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage: 'url("https://www.transparenttextures.com/patterns/asfalt-dark.png")',
          }}
        />
      </div>

      <DynamicIsland />

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
          <div
            className={cn(
              "size-24 rounded-full ring-4 shadow-md bg-background p-1 relative transition-all duration-500",
              myPresenceState === "online"
                ? "ring-emerald-400/80 shadow-[0_0_24px_rgba(52,211,153,0.25)]"
                : myPresenceState === "idle"
                  ? "ring-amber-400/70"
                  : "ring-background",
            )}
          >
            <UserAvatar
              path={myAvatarPath}
              name={safeUser.name}
              initial={safeUser.initial}
              className="size-full rounded-full"
            />
          </div>
          <div className="text-center md:text-right flex-1 min-w-0">
            <h3 className="text-xl font-black text-primary tracking-tight truncate">{safeUser.name}</h3>
            <div className="mt-2">
              <ConnectionStatus state={myPresenceState} />
            </div>
            <p className="text-[11px] text-gold-primary font-black uppercase tracking-[0.2em] mt-1">
              {safeUser.role}
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-4 left-4 p-2 text-primary"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto no-scrollbar">
          {navItems
            .filter((item) => !item.adminOnly || isAdmin)
            .map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex flex-row-reverse items-center px-5 py-4 rounded-2xl text-[16px] font-bold gap-4",
                  path === to ? "bg-primary text-white" : "text-foreground hover:bg-muted",
                )}
              >
                <Icon size={20} />
                <span className="mr-auto">{label}</span>
              </Link>
            ))}
        </nav>
      </motion.aside>

      <main className="relative min-h-screen pb-32 md:pb-20">
        <motion.div
          initial={false}
          animate={{
            y: 0,
            scale:
              typeof window !== "undefined" && window.innerWidth < 768 && headerCompact ? 0.85 : 1,
          }}
          className={cn(
            "z-[80] fixed top-4 inset-x-0 px-4 md:sticky md:top-0 md:inset-x-0 md:px-0 flex justify-center",
          )}
        >
          <header
            onClick={() => headerCompact && setHeaderCompact(false)}
            className={cn(
              "flex items-center justify-between transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] relative overflow-hidden",
              headerCompact
                ? "h-11 bg-[var(--nav-bg)]/80 w-40 rounded-full px-6 border-white/20 shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
                : "h-14 bg-[var(--nav-bg)]/95 w-full rounded-full px-4 border border-white/10 shadow-2xl",
              "backdrop-blur-3xl border md:h-20 md:bg-background/80 md:rounded-none md:px-8 lg:px-12 md:w-full md:max-w-none md:border-none flex-row",
            )}
            dir="rtl"
          >
            {/* Identity Section (Mobile: Right/Start, Desktop: Left/End) */}
            <div
              className={cn(
                "relative z-10 flex items-center gap-2 md:gap-4 transition-opacity duration-300",
                headerCompact
                  ? "opacity-0 md:opacity-100 pointer-events-none md:pointer-events-auto"
                  : "opacity-100",
                "order-first md:order-last",
              )}
            >
              {/* Desktop specific: Clock -> Bell -> Profile */}
              <div className="hidden lg:flex items-center gap-3 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/5 mr-2">
                <Clock className="size-3.5 text-gold-primary" />
                <div className="flex items-baseline gap-2 text-[11px] font-black text-primary">
                  <LiveClock variant="time" />
                  <div className="w-px h-3 bg-primary/10" />
                  <LiveClock variant="date" />
                </div>
              </div>

              <div className="hidden md:block mr-2">
                <NotificationsBell />
              </div>

              <UserDropdown
                safeUser={safeUser}
                myAvatarPath={myAvatarPath}
                connectionState={myPresenceState}
                signOut={signOut}
                logo={dynamicLogo}
              />
            </div>

            {/* DYNAMIC ISLAND CENTER CONTENT - Hidden on Desktop */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none md:hidden">
              <AnimatePresence mode="wait">
                {headerCompact ? (
                  <motion.div
                    key="compact"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-2 text-[13px] font-black text-white tabular-nums tracking-widest drop-shadow-md"
                  >
                    <Clock className="size-3 text-gold-primary" />
                    <LiveClock variant="time" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="expanded"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex flex-col items-center gap-0.5 drop-shadow-lg"
                  >
                    <div className="text-[16px] font-black text-white tabular-nums leading-none tracking-tight">
                      <LiveClock variant="time" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-[9px] font-bold text-gold-primary uppercase tracking-[0.2em] leading-none opacity-90">
                        <LiveClock variant="date" />
                      </div>
                      <div className="h-2 w-px bg-white/20 md:hidden" />
                      <div className="flex md:hidden items-center gap-1.5 bg-primary/20 px-1.5 py-0.5 rounded-full border border-primary/30 shadow-sm">
                        <div className="size-1 rounded-full bg-primary animate-pulse" />
                        <span className="text-[7px] font-black text-primary uppercase tracking-tighter">
                          {onlineCount} متصل الآن
                        </span>
                      </div>
                    </div>

                    {/* Family Presence Radar - Floating Faces (Desktop only) */}
                    <div className="hidden md:flex -space-x-2 mt-2">
                      {onlineProfiles.slice(0, 5).map((p, i) => (
                        <motion.div
                          key={p.id}
                          initial={{ scale: 0, x: 10 }}
                          animate={{ scale: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="size-5 rounded-full border border-white/20 overflow-hidden bg-[var(--nav-bg)]"
                        >
                          <UserAvatar
                            path={p.avatar_url}
                            name={p.arabic_name || p.full_name}
                            className="size-full"
                          />
                        </motion.div>
                      ))}
                      {onlineCount > 5 && (
                        <div className="size-5 rounded-full bg-primary border border-white/20 flex items-center justify-center text-[7px] font-black text-white">
                          +{onlineCount - 5}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sidebar/Logo Section (Mobile: Left/End, Desktop: Right/Start) */}
            <div
              className={cn(
                "flex items-center gap-2 md:gap-4 z-10 transition-opacity duration-300",
                headerCompact
                  ? "opacity-0 md:opacity-100 pointer-events-none md:pointer-events-auto"
                  : "opacity-100",
                "order-last md:order-first",
              )}
            >
              {/* Desktop: Sidebar (Far Right) -> Logo -> Title */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSidebarOpen(true);
                }}
                className="hidden md:flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground hover:scale-105 transition-all shadow-lg active:scale-95 ml-2"
              >
                <Menu className="size-6" />
              </button>

              <div className="flex items-center gap-3 pr-2 md:pr-4 h-10">
                {/* Desktop Medallion Logo - Hidden on Mobile */}
                <div className="hidden md:flex size-10 rounded-full p-0.5 bg-gradient-to-br from-gold-primary via-gold-primary/20 to-gold-primary shadow-lg transition-transform duration-500 hover:scale-110">
                  <div className="size-full rounded-full bg-[#fdfcf7] p-1.5 flex items-center justify-center shadow-inner overflow-hidden border border-[var(--nav-bg)]/5">
                    {dynamicLogo ? (
                      <div
                        className="size-full bg-contain bg-no-repeat bg-center"
                        style={{ backgroundImage: `url(${dynamicLogo})` }}
                      />
                    ) : (
                      <Sparkles className="size-4 text-gold-primary animate-pulse" />
                    )}
                  </div>
                </div>

                <div className="hidden md:flex md:pr-4 md:border-r md:border-primary/10 items-center h-full">
                  <h1 className="md:text-lg font-black text-primary uppercase line-clamp-1">{title}</h1>
                </div>
              </div>

              {/* Mobile Notifications Bell (Left side) */}
              <div className="md:hidden">
                <NotificationsBell />
              </div>
            </div>
          </header>
        </motion.div>

        <div
          className={cn(
            "p-4 md:p-8 lg:p-12 pt-24 md:pt-6 mx-auto",
            fullWidth ? "max-w-none w-full" : "max-w-7xl",
          )}
        >
          {children}
        </div>

        {/* MODERN FLOATING MOBILE BOTTOM DOCK */}
        <AnimatePresence>
          {navVisible && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="md:hidden fixed bottom-8 inset-x-6 z-[100] flex justify-center"
            >
              <nav className="h-16 w-full max-w-sm bg-[var(--nav-bg)]/95 border border-white/10 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex items-center justify-around px-4 backdrop-blur-2xl relative overflow-hidden transition-all duration-500">
                {/* Subtle Sheen Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />

                <BottomNavItem
                  to="/dashboard"
                  label="الرئيسية"
                  icon={<Home size={20} />}
                  active={path === "/dashboard"}
                />
                <BottomNavItem
                  to="/settings"
                  label="الأعدادات"
                  icon={<Settings size={20} />}
                  active={path === "/settings"}
                />

                {/* PULSING CENTRAL LOGO */}
                <div className="relative flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full bg-gold-primary/50 blur-md"
                  />
                  <button
                    onClick={() => setShowQuickActions(true)}
                    className="size-12 rounded-full bg-white dark:bg-gold-primary shadow-lg flex items-center justify-center border-2 border-[var(--nav-bg)]/20 dark:border-black/20 p-2 relative z-10 active:scale-90 transition-transform"
                  >
                    <LayoutGrid className="text-primary dark:text-black size-6" strokeWidth={2.5} />
                  </button>
                </div>

                {bottomNavShortcut === "admin" ? (
                  <BottomNavItem
                    to="/admin"
                    label="الإدارة"
                    icon={<ShieldCheck size={20} />}
                    active={path === "/admin"}
                  />
                ) : bottomNavShortcut === "news" ? (
                  <BottomNavItem
                    to="/majlis"
                    label="الأخبار"
                    icon={<Newspaper size={20} />}
                    active={path === "/majlis"}
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="flex flex-col items-center gap-1 text-transparent"
                  >
                    <Newspaper size={20} />
                    <span className="text-[9px] font-black uppercase">الأخبار</span>
                  </div>
                )}

                <button
                  onClick={() => setShowMoreHub(true)}
                  className={cn(
                    "flex flex-col items-center gap-1 transition-all duration-300",
                    showMoreHub ? "text-gold-primary" : "text-white/40",
                  )}
                >
                  <MoreHorizontal size={20} />
                  <span className="text-[9px] font-black uppercase">المزيد</span>
                </button>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MOBILE MORE HUB OVERLAY (REPLACES SIDEBAR) */}
        <AnimatePresence>
          {showMoreHub && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[160] flex flex-col justify-end bg-black/40 md:backdrop-blur-sm"
              onClick={() => setShowMoreHub(false)}
            >
              <motion.div
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={0.1}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 80) setShowMoreHub(false);
                }}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
                className={cn(
                  "bg-[var(--nav-bg)]/30 backdrop-blur-2xl rounded-t-[40px] border-t border-white/10 p-8 pb-12 space-y-8 shadow-[0_-20px_80px_rgba(0,0,0,0.5)]",
                  "touch-none relative overflow-hidden will-change-transform",
                )}
                onClick={(e) => e.stopPropagation()}
                dir="rtl"
              >
                {/* Subtle Texture */}
                <div
                  className="absolute inset-0 opacity-[0.06] pointer-events-none mix-blend-multiply"
                  style={{
                    backgroundImage: `url("https://www.transparenttextures.com/patterns/pinstriped-suit.png")`,
                  }}
                />

                <div className="relative z-10 w-12 h-1.5 bg-[var(--nav-bg)]/20 rounded-full mx-auto mb-2 opacity-50" />

                {/* User Profile Section */}
                <div className="relative z-10 flex items-center gap-5 p-2">
                  <div
                    className={cn(
                      "size-16 rounded-full ring-4 p-0.5 bg-white/5 shadow-sm transition-all duration-500",
                      myPresenceState === "online"
                        ? "ring-emerald-400/80 shadow-[0_0_20px_rgba(52,211,153,0.28)]"
                        : myPresenceState === "idle"
                          ? "ring-amber-400/70"
                          : "ring-white/10",
                    )}
                  >
                    <UserAvatar
                      path={myAvatarPath}
                      name={safeUser.name}
                      initial={safeUser.initial}
                      className="size-full rounded-full"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-xl font-black text-white leading-tight">{safeUser.name}</h3>
                    <div className="mt-2">
                      <ConnectionStatus state={myPresenceState} dark />
                    </div>
                    <div className="inline-flex px-2.5 py-0.5 rounded-full bg-gold-primary/20 border border-gold-primary/20 text-gold-primary text-[9px] font-black uppercase tracking-widest">
                      {safeUser.role}
                    </div>
                  </div>
                </div>

                {/* Navigation Links Grid */}
                <div className="relative z-10 grid grid-cols-1 gap-2.5">
                  {navItems
                    .filter((item) => !item.adminOnly || isAdmin)
                    .map(({ to, label, icon: Icon }) => (
                      <Link
                        key={to}
                        to={to}
                        onClick={() => setShowMoreHub(false)}
                        className={cn(
                          "flex flex-row-reverse items-center justify-between p-4.5 rounded-[22px] font-black transition-all active:scale-[0.98]",
                          path === to
                            ? "bg-gold-primary text-primary shadow-lg"
                            : "bg-white/5 text-white/80 hover:bg-white/10 border border-white/5",
                        )}
                      >
                        <div className="flex items-center gap-4 flex-row-reverse">
                          <Icon size={20} strokeWidth={2.5} />
                          <span className="text-[15px] tracking-tight">{label}</span>
                        </div>
                        <ChevronLeft
                          size={18}
                          className={path === to ? "opacity-60" : "opacity-20"}
                        />
                      </Link>
                    ))}
                </div>

                {/* Bottom Actions */}
                <div className="relative z-10 pt-4 flex gap-3">
                  <button
                    onClick={signOut}
                    className="flex-1 flex items-center justify-center gap-2.5 py-4 rounded-[22px] bg-rose-500 text-white font-black text-xs shadow-lg active:scale-95 transition-all"
                  >
                    <LogOut size={18} />
                    <span>تسجيل الخروج</span>
                  </button>
                  <button
                    onClick={() => setShowMoreHub(false)}
                    className="flex-1 flex items-center justify-center py-4 rounded-[22px] bg-white/10 text-white font-black text-xs border border-white/10 active:scale-95 transition-all"
                  >
                    إغلاق
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QUICK ACTIONS HUB OVERLAY (MATCHES MORE HUB DESIGN) */}
        <AnimatePresence>
          {showQuickActions && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[160] flex flex-col justify-end bg-black/40 md:backdrop-blur-sm"
              onClick={() => setShowQuickActions(false)}
            >
              <motion.div
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={0.1}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 80) setShowQuickActions(false);
                }}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
                className={cn(
                  "bg-[var(--nav-bg)]/30 backdrop-blur-2xl rounded-t-[40px] border-t border-white/10 p-8 pb-12 space-y-8 shadow-[0_-20px_80px_rgba(0,0,0,0.6)]",
                  "touch-none relative overflow-hidden will-change-transform",
                )}
                onClick={(e) => e.stopPropagation()}
                dir="rtl"
              >
                {/* Subtle Texture Overlay */}
                <div
                  className="absolute inset-0 opacity-[0.06] pointer-events-none mix-blend-overlay"
                  style={{
                    backgroundImage: `url("https://www.transparenttextures.com/patterns/pinstriped-suit.png")`,
                  }}
                />

                <div className="relative z-10 w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2 opacity-50" />

                <div className="relative z-10 text-center space-y-1">
                  <h3 className="text-2xl font-black text-white">الوصول السريع</h3>
                  <p className="text-white/40 font-bold uppercase tracking-widest text-[9px]">
                    بوابة مجلس السيف الرقمية
                  </p>
                </div>

                <div className="relative z-10 grid grid-cols-3 gap-y-8 gap-x-4">
                  <QuickActionItem
                    to="/chat"
                    label="محادثة"
                    icon={<MessageCircle size={28} />}
                    color="bg-[#065F46]"
                    onClick={() => setShowQuickActions(false)}
                  />
                  <QuickActionItem
                    to="/trips"
                    label="ترفيه"
                    icon={<Ticket size={28} />}
                    color="bg-[#D4AF37]"
                    onClick={() => setShowQuickActions(false)}
                  />
                  <QuickActionItem
                    to="/meetings"
                    label="اجتماعات"
                    icon={<CalendarDays size={28} />}
                    color="bg-[#1B3022]"
                    onClick={() => setShowQuickActions(false)}
                  />
                  <QuickActionItem
                    to="/tasks"
                    label="مهام"
                    icon={<ListChecks size={28} />}
                    color="bg-[#947D4C]"
                    onClick={() => setShowQuickActions(false)}
                  />
                  <QuickActionItem
                    to="/majlis"
                    label="الأخبار"
                    icon={<Newspaper size={28} />}
                    color="bg-[#064E3B]"
                    onClick={() => setShowQuickActions(false)}
                  />
                  <QuickActionItem
                    to="/community"
                    label="ركن الأعضاء"
                    icon={<Users size={28} />}
                    color="bg-[#3D8557]"
                    onClick={() => setShowQuickActions(false)}
                  />
                  <QuickActionItem
                    to="/archive"
                    label="الألبوم"
                    icon={<Archive size={28} />}
                    color="bg-[#C5A87C]"
                    onClick={() => setShowQuickActions(false)}
                  />
                  <QuickActionItem
                    to="/heritage"
                    label="الإرث"
                    icon={<History size={28} />}
                    color="bg-[#8E7745]"
                    onClick={() => setShowQuickActions(false)}
                  />
                  <QuickActionItem
                    to="/family-tree"
                    label="شجرة العائلة"
                    icon={<Trees size={28} />}
                    color="bg-[#153221]"
                    onClick={() => setShowQuickActions(false)}
                  />
                  <QuickActionItem
                    to="/vault"
                    label="الخزنة"
                    icon={<Lock size={28} />}
                    color="bg-[#7c2d12]"
                    onClick={() => setShowQuickActions(false)}
                  />
                  <QuickActionItem
                    to="/finance"
                    label="الصندوق"
                    icon={<Wallet size={28} />}
                    color="bg-[#BF953F]"
                    onClick={() => setShowQuickActions(false)}
                  />
                  <QuickActionItem
                    to="/steps-challenge"
                    label="تحدي الخطوات"
                    icon={<Footprints size={28} />}
                    color="bg-[#10b981]"
                    onClick={() => setShowQuickActions(false)}
                  />
                  <QuickActionItem
                    to="/profile"
                    label="ملفي"
                    icon={<User size={28} />}
                    color="bg-[#043A2B]"
                    onClick={() => setShowQuickActions(false)}
                  />
                  <QuickActionItem
                    to="/settings"
                    label="الأعدادات"
                    icon={<Settings size={28} />}
                    color="bg-primary"
                    onClick={() => setShowQuickActions(false)}
                  />
                </div>

                <div className="relative z-10 pt-4">
                  <button
                    onClick={() => setShowQuickActions(false)}
                    className="w-full py-4 rounded-[22px] bg-white/5 text-white/60 font-black text-xs border border-white/10 active:scale-95 transition-all"
                  >
                    إغلاق
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
    </BiometricGate>
  );
}
