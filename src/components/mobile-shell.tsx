import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Home,
  Users,
  FileText,
  Grid3x3,
  Bell,
  Menu,
  MessageCircle,
  CalendarDays,
  UserPlus,
  ListChecks,
  Inbox,
  Wallet,
  Plane,
  Settings,
  LogOut,
  ShieldCheck,
  Megaphone,
} from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type User = { name: string; role: string; initial: string; avatarPath?: string | null };

const tabs = [
  { to: "/dashboard", label: "الرئيسية", icon: Home },
  { to: "/family-tree", label: "العائلة", icon: Users },
  { to: "/archive", label: "المستندات", icon: FileText },
  { to: "/profile", label: "المزيد", icon: Grid3x3 },
] as const;

const menuLinks = [
  { to: "/dashboard", label: "الرئيسية", icon: Home },
  { to: "/family-tree", label: "شجرة العائلة", icon: Users },
  { to: "/majlis", label: "المجلس والإعلانات", icon: Megaphone },
  { to: "/meetings", label: "الاجتماعات", icon: CalendarDays },
  { to: "/finance", label: "صندوق العائلة", icon: Wallet },
  { to: "/trips", label: "الرحلات", icon: Plane },
  { to: "/tasks", label: "المهام", icon: ListChecks },
  { to: "/archive", label: "المستندات", icon: FileText },
  { to: "/chat", label: "المحادثات", icon: MessageCircle },
  { to: "/profile", label: "الملف الشخصي", icon: Settings },
] as const;

type NotifKind = "message" | "meeting" | "account_request" | "task";
type Notif = {
  id: string;
  kind: NotifKind;
  title: string;
  description: string;
  href: string;
  at: string;
};

function timeAgoAr(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  const d = Math.floor(h / 24);
  return `قبل ${d} ي`;
}

function useNotifications() {
  const [items, setItems] = useState<Notif[]>([]);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setItems([]);
      return;
    }
    const userId = u.user.id;
    const out: Notif[] = [];

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const r = (roles ?? []).map((x) => x.role);
    const isPriv = r.includes("admin") || r.includes("manager");

    // unread messages
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id,last_read_at")
      .eq("user_id", userId);
    if (parts?.length) {
      const readMap = new Map(
        parts.map((p) => [p.conversation_id, new Date(p.last_read_at).getTime()]),
      );
      const { data: msgs } = await supabase
        .from("messages")
        .select("id,conversation_id,body,created_at,sender_id")
        .in("conversation_id", [...readMap.keys()])
        .neq("sender_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      const unread = (msgs ?? []).filter(
        (m) => new Date(m.created_at).getTime() > (readMap.get(m.conversation_id) ?? 0),
      );
      const byConv = new Map<string, { count: number; last: typeof unread[number] }>();
      for (const m of unread) {
        const cur = byConv.get(m.conversation_id);
        if (!cur) byConv.set(m.conversation_id, { count: 1, last: m });
        else cur.count++;
      }
      if (byConv.size) {
        const convIds = [...byConv.keys()];
        const [{ data: convs }, { data: profs }] = await Promise.all([
          supabase.from("conversations").select("id,title,kind").in("id", convIds),
          supabase
            .from("profiles")
            .select("id,full_name,arabic_name")
            .in("id", [...new Set(unread.map((m) => m.sender_id))]),
        ]);
        const convMap = new Map((convs ?? []).map((c) => [c.id, c]));
        const profMap = new Map(
          (profs ?? []).map((p) => [p.id, p.arabic_name || p.full_name || "عضو"]),
        );
        for (const [convId, info] of byConv) {
          const c = convMap.get(convId);
          const senderName = profMap.get(info.last.sender_id) ?? "";
          const title =
            c?.kind === "group" ? c?.title || "محادثة جماعية" : senderName || "رسالة جديدة";
          out.push({
            id: `msg-${convId}`,
            kind: "message",
            title: info.count > 1 ? `${title} (${info.count})` : title,
            description: (info.last.body ?? "").slice(0, 60) || "📎 مرفق",
            href: `/chat/${convId}`,
            at: info.last.created_at,
          });
        }
      }
    }

    // upcoming meetings not attended
    const now = new Date().toISOString();
    const { data: meetings } = await supabase
      .from("meetings")
      .select("id,title,scheduled_at,status")
      .gte("scheduled_at", now)
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true })
      .limit(10);
    if (meetings?.length) {
      const ids = meetings.map((m) => m.id);
      const { data: attended } = await supabase
        .from("meeting_attendees")
        .select("meeting_id")
        .eq("user_id", userId)
        .in("meeting_id", ids);
      const attendedSet = new Set((attended ?? []).map((a) => a.meeting_id));
      for (const m of meetings.filter((m) => !attendedSet.has(m.id))) {
        out.push({
          id: `meet-${m.id}`,
          kind: "meeting",
          title: m.title,
          description: "اجتماع قادم",
          href: "/meetings",
          at: m.scheduled_at,
        });
      }
    }

    // pending account requests for admins
    if (isPriv) {
      const { data: reqs } = await supabase
        .from("account_requests")
        .select("id,first_name,father_name,grandfather_name,created_at,status")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10);
      for (const req of reqs ?? []) {
        const name = [req.first_name, req.father_name, req.grandfather_name]
          .filter(Boolean)
          .join(" ");
        out.push({
          id: `req-${req.id}`,
          kind: "account_request",
          title: "طلب إنشاء حساب جديد",
          description: name,
          href: "/admin",
          at: req.created_at,
        });
      }
    }

    // tasks assigned to me
    const { data: myTasks } = await supabase
      .from("tasks")
      .select("id,title,status,created_at")
      .eq("assignee_id", userId)
      .neq("status", "done")
      .order("created_at", { ascending: false })
      .limit(10);
    for (const t of myTasks ?? []) {
      out.push({
        id: `task-${t.id}`,
        kind: "task",
        title: "مهمة موكلة إليك",
        description: t.title,
        href: "/tasks",
        at: t.created_at,
      });
    }

    out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    setItems(out);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("mobile-notif")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "account_requests" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, load)
      .subscribe();
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  return items;
}

function iconFor(k: NotifKind) {
  return k === "message"
    ? MessageCircle
    : k === "meeting"
      ? CalendarDays
      : k === "task"
        ? ListChecks
        : UserPlus;
}

export function MobileShell({
  children,
  title,
  user,
  showHeader = true,
}: {
  children: ReactNode;
  title: string;
  user?: User;
  showHeader?: boolean;
  unreadCount?: number;
}) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const notifs = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const count = notifs.length;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <div className="mx-auto w-full max-w-[420px] min-h-screen flex flex-col relative">
        {showHeader && (
          <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md px-5 pt-[max(env(safe-area-inset-top),12px)] pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {user && (
                  <button
                    onClick={() => navigate({ to: "/profile" })}
                    className="size-10 rounded-full overflow-hidden ring-1 ring-border bg-secondary"
                    aria-label="الملف الشخصي"
                  >
                    <UserAvatar
                      path={user.avatarPath ?? null}
                      name={user.name}
                      initial={user.initial}
                      className="size-full"
                      fallbackClassName="grid place-items-center size-full text-primary font-semibold"
                    />
                  </button>
                )}

                <Popover open={notifOpen} onOpenChange={setNotifOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className="relative size-10 grid place-items-center rounded-full hover:bg-secondary transition"
                      aria-label="الإشعارات"
                    >
                      <Bell className="size-5 text-foreground" strokeWidth={1.7} />
                      {count > 0 && (
                        <span className="absolute top-1.5 left-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--saudi-red)] text-white text-[9px] font-bold grid place-items-center leading-none ring-2 ring-background">
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    sideOffset={8}
                    className="w-[22rem] max-w-[calc(100vw-2rem)] p-0 rounded-2xl"
                    dir="rtl"
                  >
                    <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                      <span className="text-sm font-bold text-foreground">الإشعارات</span>
                      {count > 0 && (
                        <span className="text-[10px] font-semibold text-[var(--primary)]">
                          {count} جديد
                        </span>
                      )}
                    </div>
                    <div className="max-h-[26rem] overflow-y-auto">
                      {notifs.length === 0 ? (
                        <div className="px-4 py-10 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                          <Inbox className="size-8 opacity-40" strokeWidth={1.5} />
                          لا توجد إشعارات حالياً
                        </div>
                      ) : (
                        notifs.map((n) => {
                          const Icon = iconFor(n.kind);
                          return (
                            <Link
                              key={n.id}
                              to={n.href}
                              onClick={() => setNotifOpen(false)}
                              className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/60 transition border-b border-border/40 last:border-b-0"
                            >
                              <div
                                className={cn(
                                  "size-9 rounded-xl grid place-items-center shrink-0",
                                  n.kind === "message" && "bg-[var(--primary)]/10 text-[var(--primary)]",
                                  n.kind === "meeting" && "bg-[var(--primary)]/10 text-[var(--primary)]",
                                  n.kind === "task" && "bg-amber-500/10 text-amber-600",
                                  n.kind === "account_request" &&
                                    "bg-[var(--saudi-red)]/10 text-[var(--saudi-red)]",
                                )}
                              >
                                <Icon className="size-4" strokeWidth={1.8} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-foreground truncate">
                                    {n.title}
                                  </p>
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    {timeAgoAr(n.at)}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {n.description}
                                </p>
                              </div>
                            </Link>
                          );
                        })
                      )}
                    </div>
                    <Link
                      to="/chat"
                      onClick={() => setNotifOpen(false)}
                      className="block px-4 py-2.5 text-center text-xs font-semibold text-[var(--primary)] hover:bg-secondary/40 transition border-t border-border"
                    >
                      عرض جميع المحادثات
                    </Link>
                  </PopoverContent>
                </Popover>
              </div>

              <h1 className="text-base font-bold tracking-tight text-foreground">{title}</h1>

              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    className="size-10 grid place-items-center rounded-full hover:bg-secondary transition"
                    aria-label="القائمة"
                  >
                    <Menu className="size-5 text-foreground" strokeWidth={1.7} />
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  dir="rtl"
                  className="w-[300px] sm:w-[340px] p-0 flex flex-col"
                >
                  <SheetHeader className="px-5 pt-6 pb-4 border-b border-border text-right">
                    <SheetTitle className="text-base font-bold text-foreground">
                      {user?.name ?? "لوحة العائلة"}
                    </SheetTitle>
                    {user?.role && (
                      <p className="text-xs text-muted-foreground mt-1">{user.role}</p>
                    )}
                  </SheetHeader>
                  <nav className="flex-1 overflow-y-auto py-3">
                    {menuLinks.map(({ to, label, icon: Icon }) => {
                      const active = path === to || path.startsWith(to + "/");
                      return (
                        <Link
                          key={to}
                          to={to}
                          onClick={() => setMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-5 py-3 text-sm transition",
                            active
                              ? "bg-[var(--primary)]/10 text-[var(--primary)] font-semibold"
                              : "text-foreground hover:bg-secondary/60",
                          )}
                        >
                          <Icon className="size-5 shrink-0" strokeWidth={1.7} />
                          <span>{label}</span>
                        </Link>
                      );
                    })}
                    <Link
                      to="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-5 py-3 text-sm text-foreground hover:bg-secondary/60 transition"
                    >
                      <ShieldCheck className="size-5 shrink-0" strokeWidth={1.7} />
                      <span>الإدارة</span>
                    </Link>
                  </nav>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-5 py-4 text-sm text-[var(--saudi-red)] hover:bg-[var(--saudi-red)]/5 transition border-t border-border"
                  >
                    <LogOut className="size-5 shrink-0" strokeWidth={1.7} />
                    <span className="font-semibold">تسجيل الخروج</span>
                  </button>
                </SheetContent>
              </Sheet>
            </div>
          </header>
        )}

        <main className="flex-1 px-5 pb-32">{children}</main>

        <nav
          className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
        >
          <div className="mx-auto w-full max-w-[420px] px-4">
            <div
              className="pointer-events-auto bg-card rounded-[24px] flex items-center justify-around px-2 py-2"
              style={{
                boxShadow:
                  "0 8px 28px -8px rgba(0,0,0,0.12), 0 2px 8px -2px rgba(0,0,0,0.06)",
              }}
            >
              {tabs.map(({ to, label, icon: Icon }) => {
                const active = path === to || path.startsWith(to + "/");
                return (
                  <Link
                    key={to}
                    to={to}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl min-w-[64px] transition-all",
                      active ? "bg-[var(--primary)] text-white" : "text-[#666666]",
                    )}
                  >
                    <Icon className="size-5" strokeWidth={1.8} />
                    <span className="text-[11px] font-medium">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
