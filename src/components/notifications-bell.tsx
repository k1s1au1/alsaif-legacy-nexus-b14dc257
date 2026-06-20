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

    const out: Notif[] = [];

    // Meetings
    const { data: meetings } = await supabase.from("meetings").select("id,title,scheduled_at").gte("scheduled_at", new Date().toISOString()).limit(5);
    (meetings ?? []).forEach(m => {
        out.push({ id: `meet-${m.id}`, kind: "meeting", title: m.title, description: "موعد اجتماع عائلي مرتقب", href: "/meetings", at: m.scheduled_at });
    });

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
        <button className="relative flex items-center justify-center bg-transparent border-none outline-none group">
          <Bell className={cn("size-6 transition-all", open ? "text-primary scale-110" : "text-muted-foreground group-hover:text-primary")} strokeWidth={1.5} />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 size-4 flex items-center justify-center rounded-full bg-saudi-red text-white text-[9px] font-black shadow-sm">
              {count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={12} className="w-[320px] p-0 rounded-3xl border-border bg-card/95 backdrop-blur-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between bg-primary/5">
          <span className="text-base font-black text-primary">التنبيهات</span>
          <span className="text-[10px] font-black uppercase opacity-40">{count} جديد</span>
        </div>
        <DropdownMenuSeparator className="m-0 bg-border/40" />
        <div className="max-h-[380px] overflow-y-auto no-scrollbar">
          {visibleItems.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 opacity-30">
              <Inbox size={40} strokeWidth={1} />
              <p className="text-sm font-bold">لا توجد تنبيهات</p>
            </div>
          ) : (
            visibleItems.map((n) => (
              <Link key={n.id} to={n.href} onClick={() => setOpen(false)} className="flex items-start gap-4 px-6 py-5 hover:bg-primary/5 transition-all border-b border-border/40 last:border-b-0">
                <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <CalendarDays size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-black text-foreground truncate">{n.title}</p>
                    <span className="text-[10px] font-bold text-muted-foreground">{timeAgo(n.at)}</span>
                  </div>
                  <p className="text-[12px] font-medium text-muted-foreground line-clamp-1">{n.description}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
