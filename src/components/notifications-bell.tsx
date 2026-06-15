import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, MessageCircle, CalendarDays, UserPlus, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotifKind = "message" | "meeting" | "account_request";
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
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  const d = Math.floor(h / 24);
  return `قبل ${d} ي`;
}

function timeUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `بعد ${Math.max(1, m)} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `بعد ${h} س`;
  const d = Math.floor(h / 24);
  return `بعد ${d} ي`;
}

export function NotificationsBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setItems([]);
      setCount(0);
      return;
    }
    const userId = u.user.id;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const r = (roles ?? []).map((x) => x.role);
    const isPriv = r.includes("admin") || r.includes("manager");

    const out: Notif[] = [];

    // 1) Unread messages grouped by conversation
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
        .limit(200);
      type MsgRow = {
        id: string;
        conversation_id: string;
        body: string | null;
        created_at: string;
        sender_id: string;
      };
      const unread = ((msgs ?? []) as MsgRow[]).filter(
        (m) => new Date(m.created_at).getTime() > (readMap.get(m.conversation_id) ?? 0),
      );
      const byConv = new Map<string, { count: number; last: MsgRow }>();
      for (const m of unread) {
        const cur = byConv.get(m.conversation_id);
        if (!cur) byConv.set(m.conversation_id, { count: 1, last: m });
        else cur.count++;
      }
      if (byConv.size) {
        const convIds = [...byConv.keys()];
        const { data: convs } = await supabase
          .from("conversations")
          .select("id,title,kind")
          .in("id", convIds);
        const senderIds = [...new Set(unread.map((m) => m.sender_id))];
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,full_name,arabic_name")
          .in("id", senderIds);
        const profMap = new Map(
          (profs ?? []).map((p) => [p.id, p.arabic_name || p.full_name || "عضو"]),
        );
        const convMap = new Map((convs ?? []).map((c) => [c.id, c]));
        for (const [convId, info] of byConv) {
          const c = convMap.get(convId);
          const senderName = profMap.get(info.last.sender_id) ?? "";
          const title =
            c?.kind === "group"
              ? c?.title || "محادثة جماعية"
              : senderName || "رسالة جديدة";
          const preview = (info.last.body ?? "").slice(0, 60) || "📎 مرفق";
          out.push({
            id: `msg-${convId}`,
            kind: "message",
            title: info.count > 1 ? `${title} (${info.count})` : title,
            description: preview,
            href: `/chat/${convId}`,
            at: info.last.created_at,
          });
        }
      }
    }

    // 2) Upcoming meetings user hasn't attended (registered)
    const now = new Date().toISOString();
    const { data: meetings } = await supabase
      .from("meetings")
      .select("id,title,scheduled_at,status")
      .gte("scheduled_at", now)
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true })
      .limit(20);
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
          description: `اجتماع قادم — ${timeUntil(m.scheduled_at)}`,
          href: "/meetings",
          at: m.scheduled_at,
        });
      }
    }

    // 3) Pending account requests (admin/manager only)
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

    out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    setItems(out);
    setCount(out.length);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("notif-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_attendees" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "account_requests" }, load)
      .subscribe();
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    const interval = setInterval(load, 60_000);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(interval);
    };
  }, [load]);

  const iconFor = (k: NotifKind) =>
    k === "message" ? MessageCircle : k === "meeting" ? CalendarDays : UserPlus;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative p-2 text-muted-foreground hover:text-gold-primary transition outline-none"
          aria-label="الإشعارات"
        >
          <Bell className="size-5" strokeWidth={1.5} />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-gold-primary text-navy-base text-[9px] font-bold grid place-items-center leading-none">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[22rem] max-h-[28rem] overflow-y-auto p-0"
      >
        <DropdownMenuLabel className="px-4 py-3 flex items-center justify-between sticky top-0 bg-popover z-10 border-b border-border">
          <span className="text-sm font-medium">الإشعارات</span>
          {count > 0 && (
            <span className="text-[10px] text-gold-primary">{count} جديد</span>
          )}
        </DropdownMenuLabel>
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
            <Inbox className="size-8 opacity-40" strokeWidth={1.5} />
            لا توجد إشعارات حالياً
          </div>
        ) : (
          <div className="py-1">
            {items.map((n) => {
              const Icon = iconFor(n.kind);
              return (
                <Link
                  key={n.id}
                  to={n.href}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/50 transition border-b border-border/40 last:border-b-0"
                >
                  <div
                    className={`size-9 rounded-full grid place-items-center shrink-0 ${
                      n.kind === "message"
                        ? "bg-gold-primary/10 text-gold-primary"
                        : n.kind === "meeting"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-sky-500/10 text-sky-400"
                    }`}
                  >
                    <Icon className="size-4" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ivory truncate">{n.title}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {n.kind === "meeting" ? "" : timeAgo(n.at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {n.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <DropdownMenuSeparator className="my-0" />
        <Link
          to="/chat"
          onClick={() => setOpen(false)}
          className="block px-4 py-2.5 text-center text-xs text-gold-primary hover:bg-secondary/40 transition"
        >
          عرض جميع المحادثات
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
