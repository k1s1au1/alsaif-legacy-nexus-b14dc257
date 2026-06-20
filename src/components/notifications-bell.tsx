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
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inChat = pathname.startsWith("/chat");

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const userId = u.user.id;

    const out: Notif[] = [];

    // 1) Meetings (Unread/Upcoming)
    const { data: meetings } = await supabase.from("meetings")
      .select("id,title,scheduled_at")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(10);

    (meetings ?? []).forEach(m => {
        out.push({
          id: `meet-${m.id}`,
          kind: "meeting",
          title: m.title,
          description: "اجتماع عائلي مجدول",
          href: "/meetings",
          at: m.scheduled_at
        });
    });

    // 2) Tasks (Assigned to me)
    const { data: myTasks } = await supabase.from("tasks")
      .select("id,title,created_at")
      .eq("assignee_id", userId)
      .neq("status", "done")
      .limit(5);

    (myTasks ?? []).forEach(t => {
      out.push({
        id: `task-${t.id}`,
        kind: "task",
        title: "مهمة جديدة",
        description: t.title,
        href: "/tasks",
        at: t.created_at
      });
    });

    // 3) Admin/Manager: Pending Requests
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isPriv = (roles ?? []).some(r => r.role === "admin" || r.role === "manager");

    if (isPriv) {
      const { data: reqs } = await supabase.from("account_requests")
        .select("id,first_name,created_at")
        .eq("status", "pending")
        .limit(5);
      (reqs ?? []).forEach(req => {
        out.push({
          id: `req-${req.id}`,
          kind: "account_request",
          title: "طلب انضمام",
          description: `من: ${req.first_name}`,
          href: "/admin",
          at: req.created_at
        });
      });
    }

    const sorted = out.sort((a,b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    setItems(sorted);
    setCount(sorted.length);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [load]);

  const visibleItems = inChat ? items.filter(n => n.kind !== "message") : items;
  const displayCount = visibleItems.length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative size-12 flex items-center justify-center rounded-2xl hover:bg-primary/5 transition-all outline-none group active:scale-95">
          <Bell className={cn("size-6 transition-all", open ? "text-primary scale-110" : "text-muted-foreground group-hover:text-primary")} strokeWidth={1.8} />

          {displayCount > 0 && (
            <div className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-black border-2 border-background shadow-lg animate-in zoom-in duration-300">
               {displayCount > 99 ? "99+" : displayCount}
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
          {displayCount > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-red-600/10 text-red-600 text-[10px] font-black uppercase tracking-widest">
               {displayCount} جديد
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
                onClick={() => setOpen(false)}
                className="flex items-start gap-4 px-6 py-5 hover:bg-primary/5 transition-all border-b border-border/40 last:border-b-0 group"
              >
                <div className={cn(
                  "size-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-all group-hover:scale-110 group-hover:rotate-6",
                  n.kind === "meeting" ? "bg-amber-500/10 text-amber-600" :
                  n.kind === "task" ? "bg-rose-500/10 text-rose-600" :
                  "bg-primary/10 text-primary"
                )}>
                  {n.kind === "meeting" ? <CalendarDays size={20} /> :
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
          to="/majlis"
          onClick={() => setOpen(false)}
          className="flex items-center justify-center gap-2 py-5 bg-primary/5 hover:bg-primary/10 transition-colors text-[13px] font-black text-primary"
        >
          فتح مركز الإشعارات <ChevronLeft size={16} />
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
