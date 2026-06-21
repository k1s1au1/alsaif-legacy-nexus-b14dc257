import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  Bell,
  MessageCircle,
  CalendarDays,
  UserPlus,
  Inbox,
  ListChecks,
  Trash2,
  RefreshCw,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

type NotifKind = "message" | "meeting" | "account_request" | "task";
type Notif = {
  id: string;
  kind: NotifKind;
  title: string;
  description: string;
  href: string;
  at: string;
  refId?: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} س`;
  const d = Math.floor(h / 24);
  return `منذ ${d} ي`;
}

function NotificationsPage() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ name: string; role: string; initial: string; avatarPath?: string | null }>({
    name: "",
    role: "عضو",
    initial: "؟",
  });
  const [filter, setFilter] = useState<"all" | NotifKind>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const uid = u.user.id;
    setUserId(uid);

    const { data: prof } = await supabase
      .from("profiles")
      .select("first_name,last_name,avatar_path")
      .eq("user_id", uid)
      .maybeSingle();
    if (prof) {
      const name = `${prof.first_name ?? ""} ${prof.last_name ?? ""}`.trim() || "عضو";
      setProfile({ name, role: "عضو", initial: name.charAt(0) || "؟", avatarPath: prof.avatar_path });
    }

    const dismissed: string[] = JSON.parse(localStorage.getItem("dismissed_notifs") || "[]");
    const out: Notif[] = [];

    // Messages
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id,last_read_at")
      .eq("user_id", uid);
    if (parts?.length) {
      const readMap = new Map(parts.map((p) => [p.conversation_id, new Date(p.last_read_at).getTime()]));
      const { data: msgs } = await supabase
        .from("messages")
        .select("id,conversation_id,body,created_at,sender_id")
        .in("conversation_id", [...readMap.keys()])
        .neq("sender_id", uid)
        .order("created_at", { ascending: false })
        .limit(50);
      const seen = new Set<string>();
      (msgs ?? []).forEach((m) => {
        const nid = `msg-${m.conversation_id}`;
        if (new Date(m.created_at).getTime() > (readMap.get(m.conversation_id) ?? 0) && !dismissed.includes(nid)) {
          if (!seen.has(m.conversation_id)) {
            seen.add(m.conversation_id);
            out.push({
              id: nid,
              kind: "message",
              title: "رسالة جديدة",
              description: m.body?.slice(0, 80) || "وصلتك رسالة جديدة",
              href: `/chat/${m.conversation_id}`,
              at: m.created_at,
              refId: m.conversation_id,
            });
          }
        }
      });
    }

    // Meetings
    const { data: meetings } = await supabase
      .from("meetings")
      .select("id,title,scheduled_at")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(10);
    (meetings ?? []).forEach((m) => {
      const nid = `meet-${m.id}`;
      if (!dismissed.includes(nid)) {
        out.push({
          id: nid,
          kind: "meeting",
          title: m.title,
          description: "موعد اجتماع عائلي مرتقب",
          href: "/meetings",
          at: m.scheduled_at,
          refId: m.id,
        });
      }
    });

    // Account requests (admin)
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const isPriv = (roles ?? []).some((r) => r.role === "admin" || r.role === "manager");
    if (isPriv) {
      const { data: reqs } = await supabase
        .from("account_requests")
        .select("id,first_name,created_at")
        .eq("status", "pending")
        .limit(20);
      (reqs ?? []).forEach((req) => {
        const nid = `req-${req.id}`;
        if (!dismissed.includes(nid)) {
          out.push({
            id: nid,
            kind: "account_request",
            title: "طلب انضمام جديد",
            description: `المتقدم: ${req.first_name}`,
            href: "/admin",
            at: req.created_at,
            refId: req.id,
          });
        }
      });
    }

    setItems(out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("notif-page")
      .on("postgres_changes", { event: "*", schema: "public" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const dismiss = async (n: Notif) => {
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    const d: string[] = JSON.parse(localStorage.getItem("dismissed_notifs") || "[]");
    if (!d.includes(n.id)) {
      d.push(n.id);
      localStorage.setItem("dismissed_notifs", JSON.stringify(d.slice(-100)));
    }
    if (n.kind === "message" && userId && n.refId) {
      await supabase
        .from("conversation_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("conversation_id", n.refId);
    }
  };

  const clearAll = () => {
    const ids = items.map((i) => i.id);
    const d: string[] = JSON.parse(localStorage.getItem("dismissed_notifs") || "[]");
    localStorage.setItem("dismissed_notifs", JSON.stringify([...new Set([...d, ...ids])].slice(-200)));
    setItems([]);
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.kind === filter);

  const tabs: { key: "all" | NotifKind; label: string; count: number }[] = [
    { key: "all", label: "الكل", count: items.length },
    { key: "message", label: "الرسائل", count: items.filter((i) => i.kind === "message").length },
    { key: "meeting", label: "الاجتماعات", count: items.filter((i) => i.kind === "meeting").length },
    { key: "account_request", label: "الطلبات", count: items.filter((i) => i.kind === "account_request").length },
  ];

  return (
    <AppShell title="مركز الإشعارات" user={profile}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6" dir="rtl">
        <div className="rounded-3xl bg-gradient-to-bl from-primary/10 via-card to-card border border-border p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                <Bell size={26} strokeWidth={1.8} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-foreground">مركز الإشعارات</h1>
                <p className="text-sm text-muted-foreground mt-1">جميع تنبيهاتك في مكان واحد</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} className="rounded-xl">
                <RefreshCw size={14} className="ml-1" /> تحديث
              </Button>
              {items.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearAll} className="rounded-xl text-rose-600 hover:text-rose-700">
                  <Trash2 size={14} className="ml-1" /> مسح الكل
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={cn(
                "px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap transition-all border",
                filter === t.key
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "mr-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-black",
                  filter === t.key ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                )}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="rounded-3xl bg-card border border-border overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <RefreshCw size={28} className="animate-spin opacity-50" />
              <p className="text-sm font-bold">جاري التحميل…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <div className="size-20 rounded-3xl bg-muted/40 flex items-center justify-center">
                <Inbox size={40} strokeWidth={1.2} />
              </div>
              <p className="text-base font-black">لا توجد تنبيهات</p>
              <p className="text-xs">ستظهر هنا الرسائل والاجتماعات والطلبات الجديدة</p>
            </div>
          ) : (
            filtered.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-4 px-5 py-4 hover:bg-primary/5 transition-colors border-b border-border/40 last:border-b-0 group"
              >
                <div
                  className={cn(
                    "size-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                    n.kind === "meeting" && "bg-amber-500/10 text-amber-600",
                    n.kind === "task" && "bg-rose-500/10 text-rose-600",
                    n.kind === "message" && "bg-blue-500/10 text-blue-600",
                    n.kind === "account_request" && "bg-primary/10 text-primary"
                  )}
                >
                  {n.kind === "meeting" ? (
                    <CalendarDays size={22} />
                  ) : n.kind === "message" ? (
                    <MessageCircle size={22} />
                  ) : n.kind === "task" ? (
                    <ListChecks size={22} />
                  ) : (
                    <UserPlus size={22} />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-foreground truncate">{n.title}</p>
                    <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap bg-muted/50 px-2 py-0.5 rounded-full">
                      {timeAgo(n.at)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{n.description}</p>
                  <div className="flex items-center gap-2 pt-2">
                    <Link
                      to={n.href}
                      onClick={() => dismiss(n)}
                      className="inline-flex items-center gap-1 text-xs font-black text-primary hover:underline"
                    >
                      فتح <ChevronLeft size={14} />
                    </Link>
                    <button
                      onClick={() => dismiss(n)}
                      className="text-xs font-bold text-muted-foreground hover:text-rose-600 transition-colors"
                    >
                      تجاهل
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
