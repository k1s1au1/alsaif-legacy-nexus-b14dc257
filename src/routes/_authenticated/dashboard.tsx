import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MobileShell } from "@/components/mobile-shell";
import { Card, PrimaryButton } from "@/components/ui/mobile-primitives";
import { Skyline } from "@/components/skyline";
import { SaduPattern } from "@/components/sadu-pattern";
import { Wallet, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "لوحة العائلة — السيف" },
      { name: "description", content: "ملخص نشاط العائلة: الإعلانات، الاجتماعات، الصندوق." },
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

type Meeting = {
  id: string;
  title: string;
  scheduled_at: string;
  location: string | null;
};

type RecentMsg = {
  id: string;
  body: string | null;
  created_at: string;
  sender_id: string;
  conversation_id: string;
  sender_name: string;
  conv_title: string | null;
  conv_kind: string;
};

type TripLite = {
  id: string;
  title: string;
  badge: string | null;
  location: string | null;
  description: string | null;
  image_url: string | null;
  start_date: string | null;
  end_date: string | null;
};

type PinnedAnnouncement = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

function Dashboard() {
  const [profile, setProfile] = useState<{ name: string; role: string; initial: string }>({
    name: "عضو العائلة",
    role: "عضو",
    initial: "ص",
  });

  const [fundBalance, setFundBalance] = useState<number | null>(null);
  const [lastContribution, setLastContribution] = useState<number | null>(null);
  const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [recentMsgs, setRecentMsgs] = useState<RecentMsg[]>([]);
  const [featuredTrip, setFeaturedTrip] = useState<TripLite | null>(null);
  const [tripParticipants, setTripParticipants] = useState(0);
  const [pinned, setPinned] = useState<PinnedAnnouncement[]>([]);
  const [pinnedIdx, setPinnedIdx] = useState(0);
  const [tasks, setTasks] = useState<{ id: string; title: string; pct: number }[]>([]);

  const loadProfile = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("arabic_name, full_name").eq("id", u.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", u.user.id).order("role").limit(1).maybeSingle(),
    ]);
    const name =
      p?.arabic_name?.trim() ||
      p?.full_name?.trim() ||
      u.user.email?.split("@")[0] ||
      "عضو العائلة";
    setProfile({
      name,
      role: roleLabel(r?.role ?? null),
      initial: (name[0] ?? "س").toUpperCase(),
    });
  }, []);

  const loadFund = useCallback(async () => {
    const { data } = await supabase
      .from("fund_transactions")
      .select("type, amount, occurred_at")
      .order("occurred_at", { ascending: false });
    if (!data) return;
    let balance = 0;
    for (const t of data) {
      const amt = Number(t.amount) || 0;
      balance += t.type === "contribution" ? amt : -amt;
    }
    setFundBalance(balance);
    const lastC = data.find((t) => t.type === "contribution");
    setLastContribution(lastC ? Number(lastC.amount) : null);
  }, []);

  const loadMeeting = useCallback(async () => {
    const { data } = await supabase
      .from("meetings")
      .select("id, title, scheduled_at, location")
      .gte("scheduled_at", new Date().toISOString())
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    setNextMeeting(data ?? null);
    if (data?.id) {
      const { count } = await supabase
        .from("meeting_attendees")
        .select("*", { count: "exact", head: true })
        .eq("meeting_id", data.id)
        .eq("rsvp", "going");
      setAttendeeCount(count ?? 0);
    } else {
      setAttendeeCount(0);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", u.user.id);
    const convIds = (parts ?? []).map((p) => p.conversation_id);
    if (convIds.length === 0) {
      setRecentMsgs([]);
      return;
    }
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, body, created_at, sender_id, conversation_id")
      .in("conversation_id", convIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(3);
    if (!msgs || msgs.length === 0) {
      setRecentMsgs([]);
      return;
    }
    const senderIds = Array.from(new Set(msgs.map((m) => m.sender_id)));
    const convQuery = Array.from(new Set(msgs.map((m) => m.conversation_id)));
    const [{ data: profiles }, { data: convs }] = await Promise.all([
      supabase.from("profiles").select("id, arabic_name, full_name").in("id", senderIds),
      supabase.from("conversations").select("id, title, kind").in("id", convQuery),
    ]);
    const profMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const convMap = new Map((convs ?? []).map((c: any) => [c.id, c]));
    setRecentMsgs(
      msgs.map((m) => {
        const p: any = profMap.get(m.sender_id);
        const c: any = convMap.get(m.conversation_id);
        return {
          id: m.id,
          body: m.body,
          created_at: m.created_at,
          sender_id: m.sender_id,
          conversation_id: m.conversation_id,
          sender_name: p?.arabic_name || p?.full_name || "عضو",
          conv_title: c?.title ?? null,
          conv_kind: c?.kind ?? "direct",
        };
      }),
    );
  }, []);

  const loadTrip = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("trips")
      .select("id, title, badge, location, description, image_url, start_date, end_date")
      .or(`start_date.gte.${today},status.eq.upcoming`)
      .order("start_date", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    setFeaturedTrip(data ?? null);
    if (data?.id) {
      const { count } = await supabase
        .from("trip_attendees")
        .select("*", { count: "exact", head: true })
        .eq("trip_id", data.id);
      setTripParticipants(count ?? 0);
    } else {
      setTripParticipants(0);
    }
  }, []);

  const loadPinned = useCallback(async () => {
    const { data } = await supabase
      .from("majlis_posts")
      .select("id, title, body, created_at, pinned, kind")
      .eq("pinned", true)
      .eq("kind", "announcement")
      .order("created_at", { ascending: false })
      .limit(5);
    setPinned((data ?? []).map((p: any) => ({
      id: p.id, title: p.title, body: p.body, created_at: p.created_at,
    })));
    setPinnedIdx(0);
  }, []);

  const loadTasks = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status, assignee_id, created_by, created_at")
      .or(`assignee_id.eq.${u.user.id},created_by.eq.${u.user.id}`)
      .neq("status", "done")
      .order("created_at", { ascending: false })
      .limit(3);
    setTasks(
      (data ?? []).map((t: any) => ({
        id: t.id,
        title: t.title,
        pct: t.status === "in_progress" ? 50 : t.status === "done" ? 100 : 10,
      })),
    );
  }, []);

  useEffect(() => {
    loadProfile();
    loadFund();
    loadMeeting();
    loadMessages();
    loadTrip();
    loadPinned();
    loadTasks();

    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_transactions" }, () => loadFund())
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => loadMeeting())
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_attendees" }, () => loadMeeting())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => loadMessages())
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => loadTrip())
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_attendees" }, () => loadTrip())
      .on("postgres_changes", { event: "*", schema: "public", table: "majlis_posts" }, () => loadPinned())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => loadTasks())
      .subscribe();

    const onVis = () => {
      if (document.visibilityState === "visible") {
        loadFund();
        loadMeeting();
        loadMessages();
        loadTrip();
        loadPinned();
        loadTasks();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadProfile, loadFund, loadMeeting, loadMessages, loadTrip, loadPinned, loadTasks]);

  const meetingDate = nextMeeting ? new Date(nextMeeting.scheduled_at) : null;

  return (
    <MobileShell title="لوحة العائلة" user={profile} unreadCount={pinned.length}>
      <div className="pt-2 space-y-4">
        {/* Welcome card with skyline - full width */}
        <Card className="relative overflow-hidden">
          <p className="text-xs text-[#666666] mb-1">أهلاً بك</p>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
            {profile.name}
          </h2>
          <p className="text-xs sm:text-sm text-[#666666] mt-1 leading-relaxed">
            نصل العائلة، نحفظ الإرث، نبني المجتمع
          </p>
          <div className="relative h-16 sm:h-20 lg:h-24 -mx-2 -mb-2 mt-3">
            <Skyline className="absolute inset-x-0 bottom-0 w-full h-full" opacity={0.22} />
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-all">


        {/* Announcement */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-foreground">إعلان مهم</span>
            <span className="size-5 grid place-items-center rounded bg-[var(--saudi-red)]/10 text-[var(--saudi-red)] text-[10px] font-bold">!</span>
          </div>
          <h3 className="text-[15px] font-bold text-foreground leading-snug">
            {pinned[0]?.title ?? "دعوة لحضور اجتماع العائلة السنوي"}
          </h3>
          <p className="text-xs text-[#666666] mt-1">
            {nextMeeting
              ? `يوم ${new Intl.DateTimeFormat("ar-SA-u-ca-gregory",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(nextMeeting.scheduled_at))}`
              : "الجمعة 25 مايو 2024"}
          </p>
          <Link to="/majlis" className="inline-block mt-3 text-xs font-semibold text-[var(--saudi-red)]">
            عرض الإعلان
          </Link>
        </Card>

        {/* Family Fund */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="size-11 rounded-xl bg-[var(--primary)] grid place-items-center shrink-0">
              <Wallet className="size-5 text-white" strokeWidth={1.8} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">صندوق العائلة</span>
                <span className="text-[11px] text-[#666666]">الرصيد الحالي</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <Link to="/finance" className="text-[11px] text-[var(--primary)] font-semibold">
                  عرض التفاصيل
                </Link>
                <div className="text-left">
                  <div className="text-2xl font-bold text-foreground leading-none">
                    {(fundBalance ?? 12450).toLocaleString("en-US")}
                  </div>
                  <div className="text-[11px] text-[#666666] mt-1">ريال سعودي</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Upcoming meeting */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="size-11 rounded-xl bg-[var(--primary)]/10 grid place-items-center shrink-0">
              <Calendar className="size-5 text-[var(--primary)]" strokeWidth={1.8} />
            </div>
            <div className="flex-1">
              <span className="text-[11px] text-[#666666]">الاجتماع القادم</span>
              <h3 className="text-[15px] font-bold text-foreground mt-0.5">
                {nextMeeting?.title ?? "اجتماع العائلة السنوي"}
              </h3>
              <p className="text-xs text-[#666666] mt-1">
                {nextMeeting
                  ? `${new Intl.DateTimeFormat("ar-SA-u-ca-gregory",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(nextMeeting.scheduled_at))} • ${timeAr(nextMeeting.scheduled_at)}`
                  : "الجمعة 25 مايو 2024 • 8:00 مساءً"}
              </p>
              <Link to="/meetings" className="inline-block mt-3 text-xs font-semibold text-[var(--primary)]">
                عرض التفاصيل
              </Link>
            </div>
          </div>
        </Card>
        </div>

        <Link to="/meetings" className="block">
          <PrimaryButton className="mt-2">اقتراح اجتماع جديد</PrimaryButton>
        </Link>

        <div className="pt-2">
          <SaduPattern height={18} />
        </div>
      </div>

    </MobileShell>
  );
}
