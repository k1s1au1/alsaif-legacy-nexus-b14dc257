import { useCallback, useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, MessageCircle, CalendarDays, UserPlus, Inbox, ListChecks, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotifKind = "message" | "meeting" | "account_request" | "task";
type Notif = {
  id: string;
  kind: NotifKind;
  title: string;
  description: string;
  href: string;
  at: string;
  refId?: string; // Original ID from DB
};

function timeAgo(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "الآن";
    if (m < 60) return `${m}د`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}س`;
    const d = Math.floor(h / 24);
    return `${d}ي`;
  } catch {
    return "";
  }
}

export function NotificationsBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inChat = pathname.startsWith("/chat");

  const load = useCallback(async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return;
      const uid = u.user.id;
      setUserId(uid);

      const out: Notif[] = [];

      // Safe localStorage access
      let dismissed = [];
      try {
        const raw = localStorage.getItem("dismissed_notifs");
        dismissed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(dismissed)) dismissed = [];
      } catch { dismissed = []; }

      // 1) Unread messages
      const { data: parts } = await supabase.from("conversation_participants").select("conversation_id,last_read_at").eq("user_id", uid);
      if (parts?.length) {
        const readMap = new Map(parts.map(p => [p.conversation_id, p.last_read_at ? new Date(p.last_read_at).getTime() : 0]));
        const { data: msgs } = await supabase.from("messages").select("id,conversation_id,body,created_at,sender_id").in("conversation_id", [...readMap.keys()]).neq("sender_id", uid).order("created_at", { ascending: false }).limit(50);

        const unreadConvs = new Set<string>();
        (msgs ?? []).forEach(m => {
          const notifId = `msg-${m.conversation_id}`;
          if (new Date(m.created_at).getTime() > (readMap.get(m.conversation_id) ?? 0) && !dismissed.includes(notifId)) {
            if (!unreadConvs.has(m.conversation_id)) {
               unreadConvs.add(m.conversation_id);
               out.push({
                 id: notifId,
                 kind: "message",
                 title: "رسالة جديدة",
                 description: m.body?.slice(0, 40) || "وصلتك رسالة جديدة",
                 href: `/chat/${m.conversation_id}`,
                 at: m.created_at,
                 refId: m.conversation_id
               });
            }
          }
        });
      }

      // 2) Upcoming Meetings
      const { data: meetings } = await supabase.from("meetings").select("id,title,scheduled_at").gte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(5);
      (meetings ?? []).forEach(m => {
          const notifId = `meet-${m.id}`;
          if (!dismissed.includes(notifId)) {
            out.push({ id: notifId, kind: "meeting", title: m.title, description: "موعد اجتماع عائلي مرتقب", href: "/meetings", at: m.scheduled_at, refId: m.id });
          }
      });

      // 3) Admin Requests
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const isPriv = (roles ?? []).some(r => r.role === "admin" || r.role === "manager");
      if (isPriv) {
        const { data: reqs } = await supabase.from("account_requests").select("id,first_name,created_at").eq("status", "pending").limit(5);
        (reqs ?? []).forEach(req => {
          const notifId = `req-${req.id}`;
          if (!dismissed.includes(notifId)) {
            out.push({ id: notifId, kind: "account_request", title: "طلب انضمام جديد", description: `المتقدم: ${req.first_name}`, href: "/admin", at: req.created_at, refId: req.id });
          }
        });
      }

      setItems(out.sort((a,b) => new Date(b.at).getTime() - new Date(a.at).getTime()));
    } catch (e) {
      console.error("Notifications load error", e);
    }
  }, []);

  const handleNotifClick = async (notif: Notif) => {
    try {
      setOpen(false);
      setItems(prev => prev.filter(item => item.id !== notif.id));

      let dismissed = [];
      try {
        const raw = localStorage.getItem("dismissed_notifs");
        dismissed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(dismissed)) dismissed = [];
      } catch { dismissed = []; }

      if (!dismissed.includes(notif.id)) {
        dismissed.push(notif.id);
        localStorage.setItem("dismissed_notifs", JSON.stringify(dismissed.slice(-50)));
      }

      if (notif.kind === "message" && userId && notif.refId) {
        await supabase.from("conversation_participants")
          .update({ last_read_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("conversation_id", notif.refId);
      }
    } catch {}
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    const channelId = `notifications-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(channelId).on("postgres_changes", { event: "*", schema: "public" }, () => load()).subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const visibleItems = inChat ? items.filter(n => n.kind !== "message") : items;
  const count = visibleItems.length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative size-12 flex items-center justify-center rounded-2xl hover:bg-primary/5 transition-all outline-none group active:scale-95">
          <Bell className={cn("size-6 transition-all", open ? "text-primary scale-110" : "text-muted-foreground group-hover:text-primary")} strokeWidth={1.8} />
          {count > 0 && (
            <div className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-black border-2 border-background shadow-lg animate-in zoom-in duration-300">
               {count > 99 ? "99+" : count}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={12} className="w-[340px] p-0 rounded-[28px] border-border bg-card/95 backdrop-blur-2xl shadow-[0_30px_60px_rgba(0,0,0,0.3)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-3">
             <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Bell size={18} />
             </div>
             <span className="text-base font-black text-primary">التنبيهات</span>
          </div>
          {count > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-red-600/10 text-red-600 text-[10px] font-black uppercase tracking-widest">
               {count} جديد
            </span>
          )}
        </div>

        <DropdownMenuSeparator className="m-0 bg-border/40" />

        <div className="max-h-[400px] overflow-y-auto no-scrollbar">
          {visibleItems.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-30">
              <Inbox size={48} strokeWidth={1} />
              <p className="text-sm font-black">لا توجد تنبيهات جديدة حالياً</p>
            </div>
          ) : (
            visibleItems.map((n) => (
              <Link
                key={n.id}
                to={n.href}
                onClick={() => handleNotifClick(n)}
                className="flex items-start gap-4 px-6 py-5 hover:bg-primary/5 transition-all border-b border-border/40 last:border-b-0 group"
              >
                <div className={cn(
                  "size-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-all group-hover:scale-110 group-hover:rotate-6",
                  n.kind === "meeting" ? "bg-amber-500/10 text-amber-600" :
                  n.kind === "task" ? "bg-rose-500/10 text-rose-600" :
                  n.kind === "message" ? "bg-blue-500/10 text-blue-600" :
                  "bg-primary/10 text-primary"
                )}>
                  {n.kind === "meeting" ? <CalendarDays size={20} /> :
                   n.kind === "message" ? <MessageCircle size={20} /> :
                   n.kind === "task" ? <ListChecks size={20} /> : <UserPlus size={20} />}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-black text-foreground truncate group-hover:text-primary transition-colors">{n.title}</p>
                    <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap bg-muted/50 px-2 py-0.5 rounded-full">{timeAgo(n.at)}</span>
                  </div>
                  <p className="text-[12px] font-medium text-muted-foreground line-clamp-2 leading-relaxed">{n.description}</p>
                </div>
              </Link>
            ))
          )}
        </div>

        <DropdownMenuSeparator className="m-0 bg-border/40" />

        <Link
          to="/notifications"
          onClick={() => setOpen(false)}
          className="flex items-center justify-center gap-2 py-5 bg-primary/5 hover:bg-primary/10 transition-colors text-[13px] font-black text-primary"
        >
          فتح مركز الإشعارات <ChevronLeft size={16} />
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
