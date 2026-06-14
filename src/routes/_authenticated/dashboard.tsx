import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Megaphone, Clock, MapPin, ChevronLeft } from "lucide-react";
import tripImage from "@/assets/trip-alula.jpg";

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

  useEffect(() => {
    loadProfile();
    loadFund();
    loadMeeting();
    loadMessages();
    loadTrip();
    loadPinned();

    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_transactions" }, () => loadFund())
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => loadMeeting())
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_attendees" }, () => loadMeeting())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => loadMessages())
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => loadTrip())
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_attendees" }, () => loadTrip())
      .on("postgres_changes", { event: "*", schema: "public", table: "majlis_posts" }, () => loadPinned())
      .subscribe();

    const onVis = () => {
      if (document.visibilityState === "visible") {
        loadFund();
        loadMeeting();
        loadMessages();
        loadTrip();
        loadPinned();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadProfile, loadFund, loadMeeting, loadMessages, loadTrip, loadPinned]);

  const meetingDate = nextMeeting ? new Date(nextMeeting.scheduled_at) : null;

  return (
    <AppShell title="لوحة العائلة" user={profile}>
      <div className="space-y-8">
        {/* Hero greeting */}
        <section className="relative py-12 px-8 lg:px-12 rounded-2xl overflow-hidden animate-fade-up">
          <div className="absolute inset-0 bg-gradient-to-l from-gold-primary/20 to-transparent" />
          <div className="absolute inset-0 bg-card ring-1 ring-gold-primary/20 rounded-2xl" />
          <div className="relative z-10 space-y-3">
            <p className="eyebrow">أهلاً بعودتك</p>
            <h2 className="text-3xl lg:text-5xl font-medium text-ivory leading-tight tracking-tight">
              {profile.name}
            </h2>
            <p className="text-base lg:text-lg text-gold-primary/80 max-w-[48ch] leading-relaxed">
              نصل العائلة، نحفظ الإرث، نبني المجتمع.
            </p>
          </div>
        </section>

        {/* Bento */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Pinned Announcement */}
          <article className="lg:col-span-8 card-surface p-6 space-y-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="size-4 text-gold-primary" strokeWidth={1.5} />
                <h3 className="eyebrow">
                  {pinned.length > 1 ? `إعلانات مثبتة (${pinnedIdx + 1}/${pinned.length})` : "إعلان مثبت"}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                {pinned[pinnedIdx] && (
                  <span className="text-[11px] text-muted-foreground">
                    {relativeAr(pinned[pinnedIdx].created_at)}
                  </span>
                )}
                {pinned.length > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPinnedIdx((i) => (i - 1 + pinned.length) % pinned.length)}
                      className="size-6 grid place-items-center rounded-md text-muted-foreground hover:text-gold-primary hover:bg-secondary/40 transition"
                      aria-label="السابق"
                    >
                      <ChevronLeft className="size-3 rotate-180" strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPinnedIdx((i) => (i + 1) % pinned.length)}
                      className="size-6 grid place-items-center rounded-md text-muted-foreground hover:text-gold-primary hover:bg-secondary/40 transition"
                      aria-label="التالي"
                    >
                      <ChevronLeft className="size-3" strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            {pinned[pinnedIdx] ? (
              <Link to="/majlis" className="block group">
                <h4 className="text-xl font-medium text-ivory group-hover:text-gold-primary transition">
                  {pinned[pinnedIdx].title}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[60ch] mt-2 whitespace-pre-wrap line-clamp-4">
                  {pinned[pinnedIdx].body}
                </p>
              </Link>
            ) : (
              <>
                <h4 className="text-xl font-medium text-ivory">لا توجد إعلانات مثبتة حالياً</h4>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[60ch]">
                  ستظهر هنا الإعلانات الرسمية المثبتة من <Link to="/majlis" className="text-gold-primary hover:underline">المجلس</Link>.
                </p>
              </>
            )}
          </article>


          {/* Fund */}
          <article className="lg:col-span-4 bg-card ring-1 ring-gold-primary/20 rounded-2xl p-6 flex flex-col justify-between animate-fade-up">
            <h3 className="eyebrow">صندوق العائلة</h3>
            <div className="mt-4">
              <span className="text-[11px] text-muted-foreground">الرصيد المتاح</span>
              <div className="text-3xl font-medium text-ivory mt-1">
                {fundBalance === null
                  ? "—"
                  : fundBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })}{" "}
                <span className="text-sm text-gold-primary">ر.س</span>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">آخر مساهمة</span>
                <span className="text-gold-primary">
                  {lastContribution !== null
                    ? `+${lastContribution.toLocaleString("en-US", { maximumFractionDigits: 0 })} ر.س`
                    : "—"}
                </span>
              </div>
            </div>
          </article>

          {/* Next meeting */}
          <article className="lg:col-span-6 card-surface p-6 space-y-6 animate-fade-up">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="eyebrow">الاجتماع القادم</h3>
                <h4 className="text-lg font-medium text-ivory">
                  {nextMeeting?.title ?? "لا توجد اجتماعات قادمة"}
                </h4>
              </div>
              {meetingDate && (
                <div className="text-left">
                  <div className="text-xl font-medium text-ivory">{meetingDate.getDate()}</div>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
                    {AR_MONTHS[meetingDate.getMonth()]} {meetingDate.getFullYear()}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 py-4 border-y border-border">
              <div className="flex items-center gap-3">
                <Clock className="size-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <span className="text-xs text-muted-foreground">
                  {meetingDate ? timeAr(nextMeeting!.scheduled_at) : "—"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="size-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <span className="text-xs text-muted-foreground">
                  {nextMeeting?.location || "—"}
                </span>
              </div>
            </div>

            <div className="flex -space-x-2 space-x-reverse">
              <div className="size-7 rounded-full bg-gold-primary ring-2 ring-card" />
              <div className="size-7 rounded-full bg-ivory/10 ring-2 ring-card" />
              <div className="size-7 rounded-full bg-gold-soft ring-2 ring-card" />
              <div className="size-7 rounded-full bg-navy-base ring-2 ring-card grid place-items-center text-[10px] text-muted-foreground">
                {attendeeCount > 0 ? `+${attendeeCount}` : "—"}
              </div>
            </div>
          </article>

          {/* Recent messages */}
          <article className="lg:col-span-6 card-surface p-6 space-y-6 animate-fade-up">
            <h3 className="eyebrow">أحدث الرسائل</h3>
            <ul className="space-y-4">
              {recentMsgs.length === 0 && (
                <li className="text-xs text-muted-foreground">لا توجد رسائل حديثة.</li>
              )}
              {recentMsgs.map((m, idx, arr) => {
                const displayName = m.conv_kind === "group" && m.conv_title
                  ? `${m.conv_title} (قروب)`
                  : m.sender_name;
                const preview = m.conv_kind === "group"
                  ? `${m.sender_name}: ${m.body ?? ""}`
                  : (m.body ?? "");
                return (
                  <li key={m.id} className="flex items-center gap-4">
                    <div className="size-10 rounded-full bg-gold-primary/10 grid place-items-center text-xs font-medium text-gold-primary">
                      {(displayName[0] ?? "؟").toUpperCase()}
                    </div>
                    <div className={`flex-1 ${idx < arr.length - 1 ? "border-b border-border pb-4" : ""}`}>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-ivory">{displayName}</span>
                        <span className="text-[10px] text-muted-foreground">{relativeAr(m.created_at)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{preview}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>

          {/* Trip */}
          <article className="lg:col-span-12 card-surface overflow-hidden flex flex-col lg:flex-row animate-fade-up">
            <div className="lg:w-1/3 h-56 lg:h-auto relative">
              <img
                src={featuredTrip?.image_url || tripImage}
                alt={featuredTrip?.title || "مخيم العلا في المملكة العربية السعودية عند الغروب"}
                width={1280}
                height={800}
                loading="lazy"
                className="absolute inset-0 size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-card via-card/30 to-transparent" />
            </div>
            <div className="p-8 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 bg-gold-primary/10 text-gold-primary text-[10px] rounded uppercase tracking-wider ring-1 ring-gold-primary/20">
                    {featuredTrip?.badge || "الرحلة القادمة"}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {featuredTrip?.location || "—"}
                  </span>
                </div>
                <h4 className="text-2xl font-medium text-ivory">
                  {featuredTrip?.title || "لا توجد رحلات قادمة"}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[52ch]">
                  {featuredTrip?.description ||
                    "أضف رحلة جديدة من قسم الرحلات لتظهر هنا."}
                </p>
              </div>
              <div className="mt-8 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <div className="eyebrow mb-1">التاريخ</div>
                    <div className="text-sm text-ivory">
                      {featuredTrip
                        ? formatTripRange(featuredTrip.start_date, featuredTrip.end_date)
                        : "—"}
                    </div>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div>
                    <div className="eyebrow mb-1">المشاركين</div>
                    <div className="text-sm text-ivory">{tripParticipants} عضواً</div>
                  </div>
                </div>
                <Link
                  to="/trips"
                  className="inline-flex items-center gap-2 px-5 py-2 bg-gold-primary text-navy-base text-sm font-semibold rounded-lg hover:brightness-110 transition"
                >
                  عرض التفاصيل
                  <ChevronLeft className="size-4" />
                </Link>
              </div>
            </div>
          </article>

          {/* Tasks */}
          <article className="lg:col-span-12 card-surface p-6 animate-fade-up">
            <div className="flex items-center justify-between mb-8">
              <h3 className="eyebrow">المهام والمسؤوليات</h3>
              <button className="text-xs text-gold-primary border-b border-gold-primary/20 pb-0.5">
                عرض الكل
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { label: "تجديد وثائق الوقف", pct: 80 },
                { label: "تنظيم صور الأرشيف (1980)", pct: 45 },
                { label: "تجهيز قائمة مشتريات الرحلة", pct: 100 },
              ].map((t) => (
                <div key={t.label} className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-ivory/80">{t.label}</span>
                    <span className="text-gold-primary">{t.pct}%</span>
                  </div>
                  <div className="h-1 bg-ivory/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold-primary rounded-full"
                      style={{
                        width: `${t.pct}%`,
                        boxShadow: t.pct > 60 ? "0 0 8px rgba(191,161,93,0.4)" : undefined,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        {/* Placeholder modules notice */}
        <p className="text-center text-xs text-muted-foreground pt-4 leading-relaxed">
          المرحلة الأولى: الأساس، المصادقة، ولوحة التحكم. الوحدات الأخرى (الرسائل، الاجتماعات،
          الرحلات، المالية، المهام، المناسبات، المجلس، الأرشيف، الإدارة) قادمة في المراحل القادمة.
        </p>
      </div>
    </AppShell>
  );
}
