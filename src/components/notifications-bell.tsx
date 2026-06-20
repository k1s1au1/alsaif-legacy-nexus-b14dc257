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
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `${m}د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}س`;
  const d = Math.floor(h / 24);
  return `${d}ي`;
}

export function NotificationsBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inChat = pathname.startsWith("/chat");

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const userId = u.user.id;

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const r = (roles ?? []).map((x) => x.role);
    const isPriv = r.includes("admin") || r.includes("manager");

    const out: Notif[] = [];

    // 1) Unread messages logic (simplified for UI demonstration)
    const { data: parts } = await supabase.from("conversation_participants").select("conversation_id,last_read_at").eq("user_id", userId);
    if (parts?.length) {
      const { data: msgs } = await supabase.from("messages").select("id,conversation_id,body,created_at,sender_id").order("created_at", { ascending: false }).limit(50);
      // Grouping logic...
      (msgs ?? []).forEach(m => {
          // Simplified: just add recent messages not from self
          if (m.sender_id !== userId) {
             // Logic to check last_read_at could go here
          }
      });
    }

    // 2) Meetings
    const { data: meetings } = await supabase.from("meetings").select("id,title,scheduled_at").gte("scheduled_at", new Date().toISOString()).limit(5);
    (meetings ?? []).forEach(m => {
        out.push({
          id: `meet-${m.id}`,
          kind: "meeting",
          title: m.title,
          description: "اجتماع عائلي مرتقب",
          href: "/meetings",
          at: m.scheduled_at,
        });
    });

    // 3) Admin Requests
    if (isPriv) {
      const { data: reqs } = await supabase.from("account_requests").select("id,first_name,created_at").eq("status", "pending").limit(5);
      (reqs ?? []).forEach(req => {
        out.push({ id: `req-${req.id}`, kind: "account_request", title: "طلب انضمام جديد", description: req.first_name || "عضو جديد", href: "/admin", at: req.created_at });
      });
    }

    setItems(out.sort((a,b) => new Date(b.at).getTime() - new Date(a.at).getTime()));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const visibleItems = inChat ? items.filter(n => n.kind !== "message") : items;
  const count = visibleItems.length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative size-11 flex items-center justify-center rounded-xl hover:bg-primary/5 transition-all outline-none group">
          <Bell className={cn("size-6 transition-transform", open ? "text-primary scale-110" : "text-muted-foreground group-hover:text-primary")} strokeWidth={1.5} />
          {count > 0 && (
            <span className="absolute top-2 right-2 size-5 flex items-center justify-center rounded-full bg-saudi-red text-white text-[10px] font-black border-2 border-background animate-in zoom-in duration-300">
              {count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={12} className="w-[320px] p-0 rounded-3xl border-border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <DropdownMenuLabel className="px-5 py-5 flex items-center justify-between bg-primary/5">
          <span className="text-base font-black text-primary">الإشعارات</span>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{count} تنبيه</span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="m-0 bg-border/40" />

        <div className="max-h-[380px] overflow-y-auto no-scrollbar">
          {visibleItems.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 opacity-30">
              <Inbox size={40} strokeWidth={1} />
              <p className="text-sm font-bold">لا توجد تنبيهات جديدة</p>
            </div>
          ) : (
            visibleItems.map((n) => (
              <Link
                key={n.id}
                to={n.href}
                onClick={() => setOpen(false)}
                className="flex items-start gap-4 px-5 py-5 hover:bg-primary/5 transition-colors border-b border-border/40 last:border-b-0 group"
              >
                <div className={cn(
                  "size-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110",
                  n.kind === "meeting" ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"
                )}>
                  {n.kind === "meeting" ? <CalendarDays size={18} /> : n.kind === "task" ? <ListChecks size={18} /> : <UserPlus size={18} />}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-black text-foreground truncate">{n.title}</p>
                    <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">{timeAgo(n.at)}</span>
                  </div>
                  <p className="text-[12px] font-medium text-muted-foreground truncate">{n.description}</p>
                </div>
              </Link>
            ))
          )}
        </div>

        <DropdownMenuSeparator className="m-0 bg-border/40" />

        <Link
          to="/majlis"
          onClick={() => setOpen(false)}
          className="flex items-center justify-center gap-2 py-4 bg-primary/5 hover:bg-primary/10 transition-colors text-[13px] font-black text-primary"
        >
          مركز التنبيهات <ChevronLeft size={16} />
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
