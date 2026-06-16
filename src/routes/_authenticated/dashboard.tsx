import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  Megaphone,
  Clock,
  MapPin,
  ChevronLeft,
  Wallet,
  Users,
  CalendarDays,
  ListChecks,
  TrendingUp,
  MessageCircle,
  Plane,
  Sparkles,
  Plus,
} from "lucide-react";
import tripImage from "@/assets/trip-alula.jpg";
import { AnimatedCounter } from "@/components/dashboard/animated-counter";
import { FinanceChart } from "@/components/dashboard/finance-chart";
import { LiveClock } from "@/components/dashboard/live-clock";
import { ShortcutsGrid } from "@/components/dashboard/shortcuts-grid";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "لوحة التحكم — السيف" },
      { name: "description", content: "ملخص نشاط العائلة: الإعلانات، الاجتماعات، الرحلات والمهام." },
    ],
  }),
  component: Dashboard,
});

function roleLabel(role: string | null) {
  if (role === "admin") return "مسؤول النظام";
  if (role === "manager") return "مدير";
  return "عضو";
}

const AR_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

function relativeAr(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "الآن";
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
  if (diff < 86400 * 2) return "أمس";
  const d = new Date(iso);
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]}`;
}

function timeAr(iso: string) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const suffix = h >= 12 ? "مساءً" : "صباحًا";
  h = h % 12 || 12;
  return `${h.toString().padStart(2, "0")}:${m} ${suffix}`;
}

function formatTripRange(start: string | null, end: string | null) {
  if (!start) return "—";
  const s = new Date(start);
  if (!end) return `${s.getDate()} ${AR_MONTHS[s.getMonth()]}`;
  const e = new Date(end);
  if (s.getMonth() === e.getMonth())
    return `${s.getDate()} - ${e.getDate()} ${AR_MONTHS[s.getMonth()]}`;
  return `${s.getDate()} ${AR_MONTHS[s.getMonth()]} - ${e.getDate()} ${AR_MONTHS[e.getMonth()]}`;
}

function arabicGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "ليلة هانئة";
  if (h < 12) return "صباح الخير";
  if (h < 17) return "نهارك سعيد";
  if (h < 20) return "مساء الخير";
  return "مساء الورد";
}

function countdownAr(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  if (d > 0) return `بعد ${d} يوم${h ? ` و${h} ساعة` : ""}`;
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `بعد ${h} ساعة${m ? ` و${m} د` : ""}`;
  return `بعد ${m} دقيقة`;
}

type Meeting = { id: string; title: string; scheduled_at: string; location: string | null };
type RecentMsg = {
  id: string; body: string | null; created_at: string; sender_id: string;
  conversation_id: string; sender_name: string; conv_title: string | null; conv_kind: string;
};
type TripLite = {
  id: string; title: string; badge: string | null; location: string | null;
  description: string | null; image_url: string | null; start_date: string | null; end_date: string | null;
};
type PinnedAnnouncement = { id: string; title: string; body: string; created_at: string };
type FundTx = { type: string; amount: number | string; occurred_at: string; description?: string | null };
type ActivityItem = { id: string; icon: typeof Wallet; color: string; title: string; meta: string; iso: string };

function Dashboard() {
  const [profile, setProfile] = useState<{ name: string; role: string; initial: string }>({
    name: "عضو العائلة", role: "عضو", initial: "ص",
  });

  const [fundBalance, setFundBalance] = useState<number | null>(null);
  const [fundIncome, setFundIncome] = useState<number | null>(null);
  const [fundExpense, setFundExpense] = useState<number | null>(null);
  const [fundTxs, setFundTxs] = useState<FundTx[]>([]);

  const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [meetingsCount, setMeetingsCount] = useState<number | null>(null);

  const [recentMsgs, setRecentMsgs] = useState<RecentMsg[]>([]);
  const [featuredTrip, setFeaturedTrip] = useState<TripLite | null>(null);
  const [tripParticipants, setTripParticipants] = useState(0);
  const [tripsCount, setTripsCount] = useState<number | null>(null);

  const [pinned, setPinned] = useState<PinnedAnnouncement[]>([]);
  const [pinnedIdx, setPinnedIdx] = useState(0);

  const [tasks, setTasks] = useState<{ id: string; title: string; pct: number; status: string }[]>([]);
  const [tasksOpenCount, setTasksOpenCount] = useState<number | null>(null);

  const [membersCount, setMembersCount] = useState<number | null>(null);
  const [meetingNow, setMeetingNow] = useState(Date.now());

  // re-tick every 30s for the countdown
  useEffect(() => {
    const id = setInterval(() => setMeetingNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const loadProfile = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("arabic_name, full_name").eq("id", u.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id).order("role").limit(1).maybeSingle(),
    ]);
    const name =
      p?.arabic_name?.trim() || p?.full_name?.trim() ||
      u.user.email?.split("@")[0] || "عضو العائلة";
    setProfile({ name, role: roleLabel(r?.role ?? null), initial: (name[0] ?? "س").toUpperCase() });
  }, []);

  const loadFund = useCallback(async () => {
    const { data } = await supabase
      .from("fund_transactions")
      .select("type, amount, occurred_at, description")
      .order("occurred_at", { ascending: false });
    if (!data) return;
    let balance = 0, income = 0, expense = 0;
    for (const t of data) {
      const amt = Number(t.amount) || 0;
      if (t.type === "contribution") { balance += amt; income += amt; }
      else { balance -= amt; expense += amt; }
    }
    setFundBalance(balance);
    setFundIncome(income);
    setFundExpense(expense);
    setFundTxs(data as FundTx[]);
  }, []);

  const loadMeeting = useCallback(async () => {
    const nowIso = new Date().toISOString();
    const [{ data }, { count }] = await Promise.all([
      supabase.from("meetings")
        .select("id, title, scheduled_at, location")
        .gte("scheduled_at", nowIso).eq("status", "scheduled")
        .order("scheduled_at", { ascending: true }).limit(1).maybeSingle(),
      supabase.from("meetings")
        .select("*", { count: "exact", head: true })
        .gte("scheduled_at", nowIso).eq("status", "scheduled"),
    ]);
    setNextMeeting(data ?? null);
    setMeetingsCount(count ?? 0);
    if (data?.id) {
      const { count: a } = await supabase
        .from("meeting_attendees")
        .select("*", { count: "exact", head: true })
        .eq("meeting_id", data.id).eq("rsvp", "going");
      setAttendeeCount(a ?? 0);
    } else setAttendeeCount(0);
  }, []);

  const loadMessages = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: parts } = await supabase
      .from("conversation_participants").select("conversation_id").eq("user_id", u.user.id);
    const convIds = (parts ?? []).map((p) => p.conversation_id);
    if (convIds.length === 0) { setRecentMsgs([]); return; }
    const { data: msgs } = await supabase.from("messages")
      .select("id, body, created_at, sender_id, conversation_id")
      .in("conversation_id", convIds).is("deleted_at", null)
      .order("created_at", { ascending: false }).limit(4);
    if (!msgs?.length) { setRecentMsgs([]); return; }
    const senderIds = Array.from(new Set(msgs.map((m) => m.sender_id)));
    const convQuery = Array.from(new Set(msgs.map((m) => m.conversation_id)));
    const [{ data: profiles }, { data: convs }] = await Promise.all([
      supabase.from("profiles").select("id, arabic_name, full_name").in("id", senderIds),
      supabase.from("conversations").select("id, title, kind").in("id", convQuery),
    ]);
    const profMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const convMap = new Map((convs ?? []).map((c: any) => [c.id, c]));
    setRecentMsgs(msgs.map((m) => {
      const p: any = profMap.get(m.sender_id);
      const c: any = convMap.get(m.conversation_id);
      return {
        id: m.id, body: m.body, created_at: m.created_at,
        sender_id: m.sender_id, conversation_id: m.conversation_id,
        sender_name: p?.arabic_name || p?.full_name || "عضو",
        conv_title: c?.title ?? null, conv_kind: c?.kind ?? "direct",
      };
    }));
  }, []);

  const loadTrip = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data }, { count }] = await Promise.all([
      supabase.from("trips")
        .select("id, title, badge, location, description, image_url, start_date, end_date")
        .or(`start_date.gte.${today},status.eq.upcoming`)
        .order("start_date", { ascending: true, nullsFirst: false })
        .limit(1).maybeSingle(),
      supabase.from("trips")
        .select("*", { count: "exact", head: true })
        .or(`start_date.gte.${today},status.eq.upcoming`),
    ]);
    setFeaturedTrip(data ?? null);
    setTripsCount(count ?? 0);
    if (data?.id) {
      const { count: a } = await supabase
        .from("trip_attendees").select("*", { count: "exact", head: true }).eq("trip_id", data.id);
      setTripParticipants(a ?? 0);
    } else setTripParticipants(0);
  }, []);

  const loadPinned = useCallback(async () => {
    const { data } = await supabase
      .from("majlis_posts")
      .select("id, title, body, created_at, pinned, kind")
      .eq("pinned", true).eq("kind", "announcement")
      .order("created_at", { ascending: false }).limit(5);
    setPinned((data ?? []).map((p: any) => ({
      id: p.id, title: p.title, body: p.body, created_at: p.created_at,
    })));
    setPinnedIdx(0);
  }, []);

  const loadTasks = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data }, { count }] = await Promise.all([
      supabase.from("tasks")
        .select("id, title, status, assignee_id, created_by, created_at")
        .or(`assignee_id.eq.${u.user.id},created_by.eq.${u.user.id}`)
        .neq("status", "done").order("created_at", { ascending: false }).limit(4),
      supabase.from("tasks")
        .select("*", { count: "exact", head: true })
        .or(`assignee_id.eq.${u.user.id},created_by.eq.${u.user.id}`)
        .neq("status", "done"),
    ]);
    setTasks((data ?? []).map((t: any) => ({
      id: t.id, title: t.title, status: t.status,
      pct: t.status === "in_progress" ? 60 : t.status === "done" ? 100 : 15,
    })));
    setTasksOpenCount(count ?? 0);
  }, []);

  const loadMembers = useCallback(async () => {
    const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    setMembersCount(count ?? 0);
  }, []);

  useEffect(() => {
    loadProfile(); loadFund(); loadMeeting(); loadMessages();
    loadTrip(); loadPinned(); loadTasks(); loadMembers();

    const channel = supabase.channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_transactions" }, () => loadFund())
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => loadMeeting())
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_attendees" }, () => loadMeeting())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => loadMessages())
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => loadTrip())
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_attendees" }, () => loadTrip())
      .on("postgres_changes", { event: "*", schema: "public", table: "majlis_posts" }, () => loadPinned())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => loadTasks())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadMembers())
      .subscribe();

    const onVis = () => {
      if (document.visibilityState === "visible") {
        loadFund(); loadMeeting(); loadMessages(); loadTrip();
        loadPinned(); loadTasks(); loadMembers();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadProfile, loadFund, loadMeeting, loadMessages, loadTrip, loadPinned, loadTasks, loadMembers]);

  const meetingDate = nextMeeting ? new Date(nextMeeting.scheduled_at) : null;
  const meetingCountdown = nextMeeting ? countdownAr(nextMeeting.scheduled_at) : null;
  // intentional reference so the 30s tick re-runs the countdown
  void meetingNow;

  const activity: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];
    for (const t of fundTxs.slice(0, 3)) {
      const amt = Number(t.amount) || 0;
      items.push({
        id: `f-${t.occurred_at}-${t.description ?? ""}`,
        icon: Wallet,
        color: t.type === "contribution" ? "text-gold-primary" : "text-destructive",
        title: t.type === "contribution" ? `مساهمة جديدة +${amt.toLocaleString("en-US")} ر.س` : `صرف -${amt.toLocaleString("en-US")} ر.س`,
        meta: t.description?.slice(0, 60) || "صندوق العائلة",
        iso: t.occurred_at,
      });
    }
    for (const m of recentMsgs.slice(0, 2)) {
      items.push({
        id: `m-${m.id}`,
        icon: MessageCircle,
        color: "text-ivory",
        title: `رسالة من ${m.sender_name}`,
        meta: (m.body || "—").slice(0, 60),
        iso: m.created_at,
      });
    }
    for (const p of pinned.slice(0, 2)) {
      items.push({
        id: `p-${p.id}`,
        icon: Megaphone,
        color: "text-gold-primary",
        title: `إعلان: ${p.title}`,
        meta: p.body.slice(0, 60),
        iso: p.created_at,
      });
    }
    return items
      .sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime())
      .slice(0, 6);
  }, [fundTxs, recentMsgs, pinned]);

  const quickActions = [
    { to: "/chat", label: "محادثة", icon: MessageCircle },
    { to: "/meetings", label: "اجتماع", icon: CalendarDays },
    { to: "/trips", label: "رحلة", icon: Plane },
    { to: "/tasks", label: "مهمة", icon: ListChecks },
    { to: "/majlis", label: "إعلان", icon: Megaphone },
    { to: "/finance", label: "مالية", icon: Wallet },
  ] as const;

  const stats = [
    {
      to: "/finance", label: "رصيد الصندوق", icon: Wallet,
      value: fundBalance, suffix: "ر.س",
      hint: fundIncome !== null && fundExpense !== null
        ? `${fundIncome.toLocaleString("en-US")} وارد · ${fundExpense.toLocaleString("en-US")} صادر`
        : "—",
      accent: "from-gold-primary/30 to-gold-primary/0",
    },
    {
      to: "/members", label: "أفراد العائلة", icon: Users,
      value: membersCount, suffix: "عضو", hint: "إجمالي الحسابات النشطة",
      accent: "from-emerald-500/20 to-transparent",
    },
    {
      to: "/meetings", label: "اجتماعات قادمة", icon: CalendarDays,
      value: meetingsCount, suffix: meetingsCount === 1 ? "اجتماع" : "اجتماعات",
      hint: nextMeeting ? `${nextMeeting.title}` : "لا توجد اجتماعات",
      accent: "from-blue-500/20 to-transparent",
    },
    {
      to: "/tasks", label: "مهام نشطة", icon: ListChecks,
      value: tasksOpenCount, suffix: "مهمة",
      hint: tasksOpenCount && tasksOpenCount > 0 ? "تحتاج إلى متابعة" : "لا توجد مهام معلقة",
      accent: "from-purple-500/20 to-transparent",
    },
  ];

  return (
    <AppShell title="لوحة العائلة" user={profile}>
      <div className="space-y-6 sm:space-y-8">
        {/* Hero greeting with live clock */}
        <section className="relative py-8 sm:py-12 px-6 sm:px-8 lg:px-12 rounded-2xl overflow-hidden animate-fade-up">
          <div className="absolute inset-0 bg-gradient-to-l from-gold-primary/20 via-gold-primary/5 to-transparent" />
          <div className="absolute inset-0 bg-card ring-1 ring-gold-primary/20 rounded-2xl" />
          <div className="absolute -top-10 -left-10 size-40 rounded-full bg-gold-primary/10 blur-3xl" />
          <div className="absolute -bottom-12 left-1/3 size-32 rounded-full bg-gold-primary/5 blur-3xl" />
          <div className="relative z-10 space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="eyebrow">{arabicGreeting()}،</p>
              <LiveClock />
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-medium text-ivory leading-tight tracking-tight">
              {profile.name}
            </h2>
            <p className="text-sm sm:text-base lg:text-lg text-gold-primary/80 max-w-[48ch] leading-relaxed">
              نصل العائلة، نحفظ الإرث، نبني المجتمع.
            </p>
            {nextMeeting && meetingCountdown && (
              <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full bg-gold-primary/10 ring-1 ring-gold-primary/30 text-xs text-gold-primary">
                <Sparkles className="size-3.5" strokeWidth={1.5} />
                <span>الاجتماع القادم {meetingCountdown}</span>
              </div>
            )}
          </div>
        </section>

        {/* Quick Access Shortcuts */}
        <ShortcutsGrid
          badges={{
            meetings: meetingsCount,
            trips: tripsCount,
            tasks: tasksOpenCount,
            majlis: pinned.length,
            chat: recentMsgs.length,
          }}
          stats={{
            finance: fundBalance !== null ? `${fundBalance.toLocaleString("en-US")} ر.س` : null,
            meetings: nextMeeting ? nextMeeting.title : null,
            trips: featuredTrip ? featuredTrip.title : null,
            tasks: tasksOpenCount ? `${tasksOpenCount} مهمة نشطة` : null,
            "family-tree": membersCount ? `${membersCount} عضو` : null,
          }}
        />

        {/* Stat tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((s, i) => (
            <Link
              key={s.label}
              to={s.to}
              className={cn(
                "group relative overflow-hidden rounded-2xl bg-card ring-1 ring-border p-4 sm:p-5",
                "transition-all duration-300 hover:-translate-y-1 hover:ring-gold-primary/40 hover:shadow-gold",
                "animate-fade-up",
              )}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity group-hover:opacity-90", s.accent)} />
              <div className="relative space-y-3">
                <div className="flex items-center justify-between">
                  <span className="eyebrow text-[10px]">{s.label}</span>
                  <span className="size-8 grid place-items-center rounded-lg bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20 transition-transform group-hover:scale-110">
                    <s.icon className="size-4" strokeWidth={1.5} />
                  </span>
                </div>
                <div className="text-xl sm:text-2xl lg:text-3xl font-semibold text-ivory tabular-nums leading-tight">
                  <AnimatedCounter value={s.value} suffix={s.suffix} />
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{s.hint}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Bento */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Pinned Announcement */}
          <article className="lg:col-span-8 card-surface p-5 sm:p-6 space-y-4 animate-fade-up transition-all duration-300 hover:ring-gold-primary/30 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="size-4 text-gold-primary" strokeWidth={1.5} />
                <h3 className="eyebrow">
                  {pinned.length > 1 ? `إعلانات مثبتة (${pinnedIdx + 1}/${pinned.length})` : "إعلان مثبت"}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                {pinned[pinnedIdx] && (
                  <span className="text-[11px] text-muted-foreground">{relativeAr(pinned[pinnedIdx].created_at)}</span>
                )}
                {pinned.length > 1 && (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setPinnedIdx((i) => (i - 1 + pinned.length) % pinned.length)}
                      className="size-6 grid place-items-center rounded-md text-muted-foreground hover:text-gold-primary hover:bg-secondary/40 transition" aria-label="السابق">
                      <ChevronLeft className="size-3 rotate-180" strokeWidth={1.5} />
                    </button>
                    <button type="button" onClick={() => setPinnedIdx((i) => (i + 1) % pinned.length)}
                      className="size-6 grid place-items-center rounded-md text-muted-foreground hover:text-gold-primary hover:bg-secondary/40 transition" aria-label="التالي">
                      <ChevronLeft className="size-3" strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            {pinned[pinnedIdx] ? (
              <Link to="/majlis" className="block group">
                <h4 className="text-lg sm:text-xl font-medium text-ivory group-hover:text-gold-primary transition">
                  {pinned[pinnedIdx].title}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[60ch] mt-2 whitespace-pre-wrap line-clamp-4">
                  {pinned[pinnedIdx].body}
                </p>
              </Link>
            ) : (
              <>
                <h4 className="text-lg sm:text-xl font-medium text-ivory">لا توجد إعلانات مثبتة حالياً</h4>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[60ch]">
                  ستظهر هنا الإعلانات الرسمية المثبتة من <Link to="/majlis" className="text-gold-primary hover:underline">المجلس</Link>.
                </p>
              </>
            )}
          </article>

          {/* Quick actions */}
          <article className="lg:col-span-4 card-surface p-5 sm:p-6 animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="eyebrow">اختصارات سريعة</h3>
              <Sparkles className="size-4 text-gold-primary" strokeWidth={1.5} />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {quickActions.map((a) => (
                <Link key={a.to} to={a.to}
                  className="group flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-secondary/30 ring-1 ring-border hover:ring-gold-primary/40 hover:bg-gold-primary/5 transition-all hover:-translate-y-0.5">
                  <span className="size-9 grid place-items-center rounded-lg bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20 transition-transform group-hover:scale-110">
                    <a.icon className="size-4" strokeWidth={1.5} />
                  </span>
                  <span className="text-[11px] text-ivory/80 group-hover:text-gold-primary transition">{a.label}</span>
                </Link>
              ))}
            </div>
          </article>

          {/* Fund balance + chart */}
          <article className="lg:col-span-8 card-surface p-5 sm:p-6 animate-fade-up transition-all duration-300 hover:ring-gold-primary/30">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-gold-primary" strokeWidth={1.5} />
                  <h3 className="eyebrow">حركة الصندوق · آخر 6 أشهر</h3>
                </div>
                <div className="mt-3 text-2xl sm:text-3xl font-semibold text-ivory">
                  <AnimatedCounter value={fundBalance} suffix="ر.س" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gold-primary/10 text-gold-primary ring-1 ring-gold-primary/20">
                  <span className="size-1.5 rounded-full bg-gold-primary" /> الوارد {fundIncome?.toLocaleString("en-US") ?? "—"}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10 text-destructive ring-1 ring-destructive/20">
                  <span className="size-1.5 rounded-full bg-destructive" /> الصادر {fundExpense?.toLocaleString("en-US") ?? "—"}
                </span>
              </div>
            </div>
            <FinanceChart transactions={fundTxs} />
          </article>

          {/* Activity timeline */}
          <article className="lg:col-span-4 card-surface p-5 sm:p-6 animate-fade-up transition-all duration-300 hover:ring-gold-primary/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="eyebrow">آخر النشاط</h3>
              <span className="size-2 rounded-full bg-gold-primary animate-pulse" />
            </div>
            {activity.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">لا يوجد نشاط حديث.</p>
            ) : (
              <ol className="space-y-4 relative before:absolute before:right-[15px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-gold-primary/30 before:via-border before:to-transparent">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-3 relative">
                    <span className={cn("size-8 shrink-0 grid place-items-center rounded-full bg-card ring-1 ring-gold-primary/20 z-10", a.color)}>
                      <a.icon className="size-3.5" strokeWidth={1.5} />
                    </span>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-xs font-medium text-ivory truncate">{a.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{a.meta}</p>
                      <span className="text-[10px] text-muted-foreground/70">{relativeAr(a.iso)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </article>

          {/* Next meeting */}
          <article className="lg:col-span-6 card-surface p-5 sm:p-6 space-y-5 animate-fade-up transition-all duration-300 hover:ring-gold-primary/30 hover:-translate-y-0.5">
            <div className="flex justify-between items-start gap-3">
              <div className="space-y-1 min-w-0">
                <h3 className="eyebrow">الاجتماع القادم</h3>
                <h4 className="text-base sm:text-lg font-medium text-ivory truncate">
                  {nextMeeting?.title ?? "لا توجد اجتماعات قادمة"}
                </h4>
                {meetingCountdown && (
                  <span className="inline-block mt-1 text-[11px] text-gold-primary">{meetingCountdown}</span>
                )}
              </div>
              {meetingDate && (
                <div className="text-left shrink-0">
                  <div className="text-2xl font-medium text-ivory">{meetingDate.getDate()}</div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
                    {AR_MONTHS[meetingDate.getMonth()]} {meetingDate.getFullYear()}
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 py-4 border-y border-border">
              <div className="flex items-center gap-3 min-w-0">
                <Clock className="size-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <span className="text-xs text-muted-foreground truncate">
                  {meetingDate ? timeAr(nextMeeting!.scheduled_at) : "—"}
                </span>
              </div>
              <div className="flex items-center gap-3 min-w-0">
                <MapPin className="size-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <span className="text-xs text-muted-foreground truncate">{nextMeeting?.location || "—"}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex -space-x-2 space-x-reverse">
                <div className="size-7 rounded-full bg-gold-primary ring-2 ring-card" />
                <div className="size-7 rounded-full bg-ivory/10 ring-2 ring-card" />
                <div className="size-7 rounded-full bg-gold-soft ring-2 ring-card" />
                <div className="size-7 rounded-full bg-navy-base ring-2 ring-card grid place-items-center text-[10px] text-muted-foreground">
                  {attendeeCount > 0 ? `+${attendeeCount}` : "—"}
                </div>
              </div>
              <Link to="/meetings" className="text-xs text-gold-primary hover:underline">عرض الكل</Link>
            </div>
          </article>

          {/* Recent messages */}
          <article className="lg:col-span-6 card-surface p-5 sm:p-6 space-y-5 animate-fade-up transition-all duration-300 hover:ring-gold-primary/30 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <h3 className="eyebrow">أحدث الرسائل</h3>
              <Link to="/chat" className="text-xs text-gold-primary hover:underline">المحادثات</Link>
            </div>
            <ul className="space-y-4">
              {recentMsgs.length === 0 && <li className="text-xs text-muted-foreground">لا توجد رسائل حديثة.</li>}
              {recentMsgs.map((m, idx, arr) => {
                const displayName = m.conv_kind === "group" && m.conv_title ? `${m.conv_title} (قروب)` : m.sender_name;
                const preview = m.conv_kind === "group" ? `${m.sender_name}: ${m.body ?? ""}` : (m.body ?? "");
                return (
                  <li key={m.id} className="flex items-center gap-3 sm:gap-4">
                    <div className="size-10 shrink-0 rounded-full bg-gold-primary/10 grid place-items-center text-xs font-medium text-gold-primary ring-1 ring-gold-primary/20">
                      {(displayName[0] ?? "؟").toUpperCase()}
                    </div>
                    <div className={`flex-1 min-w-0 ${idx < arr.length - 1 ? "border-b border-border pb-4" : ""}`}>
                      <div className="flex justify-between gap-2">
                        <span className="text-sm font-medium text-ivory truncate">{displayName}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{relativeAr(m.created_at)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{preview}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>

          {/* Trip */}
          <article className="lg:col-span-12 card-surface overflow-hidden flex flex-col lg:flex-row animate-fade-up group transition-all duration-300 hover:ring-gold-primary/30">
            <div className="lg:w-1/3 h-48 sm:h-56 lg:h-auto relative overflow-hidden">
              <img src={featuredTrip?.image_url || tripImage}
                alt={featuredTrip?.title || "مخيم العلا"}
                width={1280} height={800} loading="lazy"
                className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-l from-card via-card/30 to-transparent" />
              {featuredTrip?.start_date && (
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-navy-base/80 backdrop-blur text-[10px] text-gold-primary ring-1 ring-gold-primary/30">
                  {countdownAr(featuredTrip.start_date) || "قريباً"}
                </div>
              )}
            </div>
            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 bg-gold-primary/10 text-gold-primary text-[10px] rounded uppercase tracking-wider ring-1 ring-gold-primary/20">
                    {featuredTrip?.badge || "الرحلة القادمة"}
                  </span>
                  <span className="text-muted-foreground text-xs">{featuredTrip?.location || "—"}</span>
                </div>
                <h4 className="text-xl sm:text-2xl font-medium text-ivory">
                  {featuredTrip?.title || "لا توجد رحلات قادمة"}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[52ch] line-clamp-3">
                  {featuredTrip?.description || "أضف رحلة جديدة من قسم الرحلات لتظهر هنا."}
                </p>
              </div>
              <div className="mt-6 sm:mt-8 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4 sm:gap-6">
                  <div>
                    <div className="eyebrow mb-1">التاريخ</div>
                    <div className="text-sm text-ivory">
                      {featuredTrip ? formatTripRange(featuredTrip.start_date, featuredTrip.end_date) : "—"}
                    </div>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div>
                    <div className="eyebrow mb-1">المشاركين</div>
                    <div className="text-sm text-ivory">{tripParticipants} عضواً</div>
                  </div>
                </div>
                <Link to="/trips"
                  className="inline-flex items-center gap-2 px-5 py-2 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 hover:shadow-gold transition-all">
                  عرض التفاصيل
                  <ChevronLeft className="size-4" />
                </Link>
              </div>
            </div>
          </article>

          {/* Tasks */}
          <article className="lg:col-span-12 card-surface p-5 sm:p-6 animate-fade-up transition-all duration-300 hover:ring-gold-primary/30">
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div className="flex items-center gap-2">
                <ListChecks className="size-4 text-gold-primary" strokeWidth={1.5} />
                <h3 className="eyebrow">المهام والمسؤوليات</h3>
              </div>
              <Link to="/tasks" className="text-xs text-gold-primary border-b border-gold-primary/20 pb-0.5 hover:border-gold-primary transition">
                عرض الكل
              </Link>
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد مهام نشطة حالياً.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
                {tasks.map((t) => (
                  <Link to="/tasks" key={t.id} className="group space-y-3 hover:opacity-90 transition">
                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-ivory/80 truncate">{t.title}</span>
                      <span className="text-gold-primary shrink-0 tabular-nums">{t.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-ivory/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-l from-gold-primary to-gold-soft rounded-full transition-all duration-700 group-hover:brightness-125"
                        style={{
                          width: `${t.pct}%`,
                          boxShadow: t.pct > 50 ? "0 0 10px rgba(191,161,93,0.5)" : undefined,
                        }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {t.status === "in_progress" ? "قيد التنفيذ" : t.status === "done" ? "مكتملة" : "جديدة"}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </article>
        </div>
      </div>

      {/* Floating quick-add FAB */}
      <Link to="/majlis"
        className="fixed bottom-6 left-6 z-30 size-14 rounded-full bg-gold-primary text-navy-base grid place-items-center shadow-gold hover:scale-110 hover:brightness-110 transition-all animate-fade-up"
        aria-label="إضافة سريعة">
        <Plus className="size-6" strokeWidth={2} />
      </Link>
    </AppShell>
  );
}
