import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { getSupabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import {
  Megaphone,
  Clock,
  MapPin,
  ChevronLeft,
  Wallet,
  Users,
  CalendarDays,
  ListChecks,
  Plane,
  Timer,
  Compass,
  ShieldAlert,
  Send,
  X,
  Image as ImageIcon,
  Loader2,
  Calendar,
  Newspaper,
  Scroll,
  Lightbulb,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import palmWatermark from "@/assets/palm-watermark.png";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { AnimatedCounter } from "@/components/dashboard/animated-counter";
import { LiveClock } from "@/components/dashboard/live-clock";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { useUserRole, roleLabel } from "@/hooks/use-user-role";
import { TripImage } from "@/components/trip-image";
import { IntegratedHub } from "@/components/dashboard/integrated-hub";
import { PollsPopup } from "@/components/dashboard/polls-popup";
import { showIsland, hideIsland } from "@/components/dynamic-island";
import { useWidgetUpdater } from "@/hooks/use-widget-updater";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "لوحة العائلة — السيف" },
      { name: "description", content: "مركز إدارة عائلة السيف." },
    ],
  }),
  component: Dashboard,
});

function ImmersiveView({
  item,
  onClose,
}: {
  item: { type: "trip" | "meeting" | "news"; data: any };
  onClose: () => void;
}) {
  const { type, data } = item;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-2xl p-0 md:p-10 overscroll-none"
      dir="rtl"
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 200 }}
        className="bg-[var(--nav-bg)] w-full max-w-6xl h-[100dvh] md:h-[90vh] rounded-t-[32px] md:rounded-[60px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col relative border-t border-white/20 md:border border-white/10"
      >
        <button
          onClick={onClose}
          className="absolute top-8 left-6 md:top-6 md:left-6 z-40 size-11 md:size-12 rounded-full bg-black/50 backdrop-blur-xl text-white flex items-center justify-center hover:bg-red-500 transition-all border border-white/20 group shadow-2xl"
        >
          <X size={22} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
        <div className="flex-1 overflow-y-auto no-scrollbar pb-32 md:pb-16">
          <div className="relative h-[280px] md:h-[480px] shrink-0">
            {type === "trip" ? (
              <TripImage
                path={data.image_url}
                alt={data.title}
                className="size-full object-cover"
              />
            ) : (
              <div className="size-full bg-gradient-to-br from-primary via-[var(--nav-bg)] to-black flex items-center justify-center">
                {type === "meeting" ? (
                  <CalendarDays className="size-32 text-gold-primary opacity-10" />
                ) : (
                  <Newspaper className="size-32 text-gold-primary opacity-10" />
                )}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--nav-bg)] via-[var(--nav-bg)]/40 to-transparent" />
            <div className="absolute bottom-6 right-6 left-6 md:bottom-12 md:right-12 md:left-12 space-y-2 md:space-y-4">
              <div className="flex items-center gap-2 text-gold-primary bg-black/50 backdrop-blur-xl w-fit px-3 py-1 rounded-full border border-white/10 shadow-lg">
                {type === "trip" ? (
                  <Plane size={14} />
                ) : type === "meeting" ? (
                  <CalendarDays size={14} />
                ) : (
                  <Newspaper size={14} />
                )}
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em]">
                  {type === "trip"
                    ? "ترفيه عائلي"
                    : type === "meeting"
                      ? "اجتماع مرتقب"
                      : "أخبار السيف"}
                </span>
              </div>
              <h2 className="text-3xl md:text-7xl font-black text-white leading-[1.1] tracking-tighter drop-shadow-2xl">
                {data.title}
              </h2>
            </div>
          </div>
          <div className="p-6 md:p-16 space-y-8 md:space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-10">
              <div className="flex items-center gap-4 bg-white/[0.03] p-5 rounded-[24px] border border-white/5 shadow-inner">
                <div className="size-12 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary border border-gold-primary/20 shadow-xl">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase opacity-40 mb-0.5">
                    الموعد والتاريخ
                  </p>
                  <p className="text-sm md:text-xl font-black text-white">
                    {new Date(
                      data.start_date || data.scheduled_at || data.created_at,
                    ).toLocaleDateString("ar-SA", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                </div>
              </div>
              {data.location && (
                <div className="flex items-center gap-4 bg-white/[0.03] p-5 rounded-[24px] border border-white/5 shadow-inner">
                  <div className="size-12 rounded-xl bg-gold-primary/10 flex items-center justify-center text-gold-primary border border-gold-primary/20 shadow-xl">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase opacity-40 mb-0.5">
                      الموقع / المكان
                    </p>
                    <p className="text-sm md:text-xl font-black text-white">{data.location}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <h4 className="text-[9px] font-black uppercase tracking-[0.35em] text-gold-primary/60">
                  تفاصيل الحدث
                </h4>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <p className="text-base md:text-2xl font-bold text-white/80 leading-relaxed text-right md:text-justify whitespace-pre-wrap">
                {data.description ||
                  data.cleanBody ||
                  data.body ||
                  "لا توجد تفاصيل إضافية لهذا الحدث حالياً."}
              </p>
            </div>
            <div className="pt-6 flex flex-col md:flex-row gap-3 md:gap-4">
              {type === "trip" && (
                <Link
                  to="/trips/$tripId"
                  params={{ tripId: data.id }}
                  className="btn-gold py-5 md:py-6 px-12 rounded-full font-black text-lg md:text-xl text-center flex-1 shadow-[0_15px_40px_-5px_rgba(139,107,35,0.4)] hover:scale-[1.02] active:scale-95 transition-all"
                >
                  فتح صفحة الترفيه
                </Link>
              )}
              {type === "meeting" && (
                <Link
                  to="/meetings"
                  className="btn-gold py-5 md:py-6 px-12 rounded-full font-black text-lg md:text-xl text-center flex-1 shadow-[0_15px_40px_-5px_rgba(139,107,35,0.4)] hover:scale-[1.02] active:scale-95 transition-all"
                >
                  تأكيد الحضور
                </Link>
              )}
              {type === "news" && (
                <Link
                  to="/majlis"
                  className="btn-gold py-5 md:py-6 px-12 rounded-full font-black text-lg md:text-xl text-center flex-1 shadow-[0_15px_40px_-5px_rgba(139,107,35,0.4)] hover:scale-[1.02] active:scale-95 transition-all"
                >
                  فتح في الأخبار
                </Link>
              )}
              <button
                onClick={onClose}
                className="py-5 md:py-6 px-12 rounded-full bg-white/5 text-white font-black text-lg md:text-xl hover:bg-white/10 active:scale-95 transition-all border border-white/10"
              >
                إغلاق العرض
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const SPIRITUAL_QUOTES = [
  // Friday Special
  {
    text: "يَا أَيُّهَا الَّذِينَ آمَنُوا إِذَا نُودِيَ لِلصَّلَاةِ مِن يَوْمِ الْجُمُعَةِ فَاسْعَوْا إِلَىٰ ذِكْرِ اللَّهِ",
    source: "سورة الجمعة",
    type: "quran",
    category: "friday",
  },
  {
    text: "إِنَّ مِنْ أَفْضَلِ أَيَّامِكُمْ يَوْمَ الْجُمُعَةِ ، فَأَكْثِرُوا عَلَيَّ مِنَ الصَّلَاةِ فِيهِ",
    source: "حديث شريف (رواه أبو داود)",
    type: "hadith",
    category: "friday",
  },

  // Monday & Thursday
  {
    text: "تُعْرَضُ الأَعْمَالُ يَوْمَ الاثْنَيْنِ وَالْخَمِيسِ ، فَأُحِبُّ أَنْ يُعْرَضَ عَمَلِي وَأَنَا صَائِمٌ",
    source: "حديث شريف (رواه الترمذي)",
    type: "hadith",
    category: "mon_thu",
  },

  // White Days (13, 14, 15 Hijri)
  {
    text: "صِيَامُ ثَلاثَةِ أَيَّامٍ مِنْ كُلِّ شَهْرٍ صِيَامُ الدَّهْرِ ، وَهِيَ أَيَّامُ الْبِيضِ",
    source: "حديث شريف (رواه النسائي)",
    type: "hadith",
    category: "white_days",
  },

  // General Quotes
  {
    text: "وَاعْتَصِمُوا بِحَبْلِ اللَّهِ جَمِيعًا وَلَا تَفَرَّقُوا",
    source: "سورة آل عمران",
    type: "quran",
    category: "general",
  },
  {
    text: "وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ",
    source: "سورة المائدة",
    type: "quran",
    category: "general",
  },
  {
    text: "إِنَّمَا الْمُؤْمِنُونَ إِخْوَةٌ",
    source: "سورة الحجرات",
    type: "quran",
    category: "general",
  },
  {
    text: "خَيْرُكُمْ خَيْرُكُمْ لِأَهْلِهِ",
    source: "حديث شريف",
    type: "hadith",
    category: "general",
  },
  {
    text: "الْبَرَكَةُ مَعَ أَكَابِرِكُمْ",
    source: "أثر مأثور",
    type: "wisdom",
    category: "general",
  },
  {
    text: "أَحَبُّ النَّاسِ إِلَى اللَّهِ أَنْفَعُهُمْ لِلنَّاسِ",
    source: "حديث شريف",
    type: "hadith",
    category: "general",
  },
];

function Dashboard() {
  // Logic to select the quote based on date
  const spiritualQuote = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri, 6=Sat

    // Detect Hijri Day (Roughly for 13, 14, 15)
    let hijriDay = 1;
    try {
      hijriDay = parseInt(
        new Intl.DateTimeFormat("en-u-ca-islamic-uma-nu-latn", { day: "numeric" }).format(now),
      );
    } catch (e) {
      /* fallback */
    }

    // 1. Check for White Days
    if ([13, 14, 15].includes(hijriDay)) {
      return SPIRITUAL_QUOTES.find((q) => q.category === "white_days") || SPIRITUAL_QUOTES[0];
    }

    // 2. Check for Friday
    if (dayOfWeek === 5) {
      const fridayQuotes = SPIRITUAL_QUOTES.filter((q) => q.category === "friday");
      return fridayQuotes[now.getDate() % fridayQuotes.length];
    }

    // 3. Check for Monday or Thursday
    if (dayOfWeek === 1 || dayOfWeek === 4) {
      return SPIRITUAL_QUOTES.find((q) => q.category === "mon_thu") || SPIRITUAL_QUOTES[0];
    }

    // 4. Default to general quotes
    const generalQuotes = SPIRITUAL_QUOTES.filter((q) => q.category === "general");
    return generalQuotes[now.getDate() % generalQuotes.length];
  }, []);
  const [profile, setProfile] = useState<any>({ name: "تحميل...", role: "عضو", initial: "س" });
  const [fundBalance, setFundBalance] = useState<number>(0);
  const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [annIndex, setAnnIndex] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [counts, setCounts] = useState({ trips: 0, members: 0, tasks: 0, myTasks: 0, newNews: 0 });
  const [heritageSnippet, setHeritageSnippet] = useState<any>(null);
  const [activeProjects, setActiveProjects] = useState<any[]>([]);
  const [showBugReport, setShowBugReport] = useState(false);
  const [immersiveItem, setImmersiveItem] = useState<{
    type: "trip" | "meeting" | "news";
    data: any;
  } | null>(null);
  const [bugBody, setBugBody] = useState("");
  const [bugImage, setBugImage] = useState<File | null>(null);
  const [bugImagePreview, setBugImagePreview] = useState<string | null>(null);
  const [bugSending, setBugSending] = useState(false);
  const hasGreeted = useRef(false);
  const dynamicLogo = useSiteLogo();

  // Register widget updater
  useWidgetUpdater(upcomingMeetings, upcomingTrips);

  // Memoize carousel plugins to prevent recreation on every render (causes Embla crash)
  const announcementsAutoplay = useRef(Autoplay({ delay: 7000, stopOnInteraction: true }));
  const announcementsPlugins = useMemo(() => [announcementsAutoplay.current], []);
  const announcementsOpts = useMemo(() => ({ loop: true, direction: "rtl" as const }), []);

  const loadData = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const u = authData.user;

      const now = new Date().toISOString();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [
        { data: p },
        { data: r },
        { count: mCount },
        { count: tCount },
        { count: myTCount },
        { count: newsCount },
        { data: meetings },
        { data: trips },
        { data: posts },
        { data: tx },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("arabic_name, full_name, avatar_url")
          .eq("id", u.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.id),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("assignee_id", u.id)
          .neq("status", "done"),
        supabase
          .from("majlis_posts")
          .select("id", { count: "exact", head: true })
          .gt("created_at", yesterday),
        supabase
          .from("meetings")
          .select("*")
          .gte("scheduled_at", now)
          .order("scheduled_at")
          .limit(5),
        supabase.from("trips").select("*").gte("start_date", now).order("start_date").limit(5),
        supabase
          .from("majlis_posts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase.from("fund_transactions").select("amount, type"),
      ]);

      const name = p?.arabic_name || p?.full_name || u.email?.split("@")[0] || "عضو العائلة";
      const rs = (r ?? []).map((x) => x.role);
      setProfile({
        name,
        role: rs.includes("admin")
          ? "مسؤول تقني"
          : rs.includes("chairman")
            ? "رئيس المجلس"
            : "عضو الأخبار",
        initial: (name[0] || "ع").toUpperCase(),
        avatarPath: p?.avatar_url ?? null,
        userId: u.id,
      });
      setCounts({
        trips: trips?.length || 0,
        members: mCount || 0,
        tasks: tCount || 0,
        myTasks: myTCount || 0,
        newNews: newsCount || 0,
      });
      setUpcomingMeetings(meetings || []);
      setUpcomingTrips(trips || []);

      if (tx)
        setFundBalance(
          tx.reduce(
            (acc, t) =>
              t.type === "contribution" ? acc + Number(t.amount) : acc - Number(t.amount),
            0,
          ),
        );

      // Shura Integration
      const pollPosts = (posts ?? []).filter((p) => p.body?.includes("---poll:"));
      if (pollPosts.length && !hasGreeted.current) {
        const { data: myVotes } = await supabase
          .from("majlis_comments")
          .select("post_id")
          .eq("author_id", u.id)
          .in(
            "post_id",
            pollPosts.map((p) => p.id),
          )
          .like("body", "[VOTE]:%");
        const pendingCount = pollPosts.filter(
          (p) => !(myVotes || []).some((v) => v.post_id === p.id),
        ).length;
        if (pendingCount > 0)
          showIsland(`لديك ${pendingCount} اقتراح بانتظار تصويتك`, "info", 8000, () =>
            window.dispatchEvent(new CustomEvent("polls:open")),
          );
        else showIsland(`طاب يومك يا ${name.split(" ")[0]}`, "info", 3000);
        hasGreeted.current = true;
      } else if (!hasGreeted.current) {
        showIsland(`طاب يومك يا ${name.split(" ")[0]}`, "info", 3000);
        hasGreeted.current = true;
      }

      if (posts) {
        const annList = (posts ?? [])
          .filter(
            (p) =>
              (p.kind === "announcement" || p.body?.includes("---kind:announcement")) &&
              !p.body?.includes("---poll:"),
          )
          .slice(0, 5);
        const processedAnns = await Promise.all(
          annList.map(async (a) => {
            const imgMatch = (a.body || "").match(/^---image:(.*)\n/);
            let url = null;
            if (imgMatch) {
              const { data } = await supabase.storage
                .from("trip-images")
                .createSignedUrl(imgMatch[1].trim(), 3600);
              url = data?.signedUrl;
            }
            return {
              ...a,
              imageUrl: url,
              cleanBody: (a.body || "")
                .replace(/^---image:.*\n/, "")
                .replace(/^---kind:.*\n/, "")
                .trim(),
              _label: a.kind === "announcement" ? "إعلان المجلس" : "أخبار السيف",
            };
          }),
        );
        setAnnouncements(processedAnns);

        const heritage = (posts ?? []).find((p) => p.title?.includes("[إرث]"));
        if (heritage)
          setHeritageSnippet({
            ...heritage,
            title: heritage.title.replace("[إرث]", "").trim(),
            cleanBody: (heritage.body || "")
              .replace(/---kind:.*\n/, "")
              .replace(/---image:.*\n/, "")
              .trim(),
          });
      }

      supabase
        .from("family_projects")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(5)
        .then(async (r) => {
          const pj = r.data || [];
          if (!pj.length) return setActiveProjects([]);
          const { data: cs } = await supabase
            .from("family_project_contributions")
            .select("project_id, amount")
            .in(
              "project_id",
              pj.map((p) => p.id),
            );
          const sums: Record<string, number> = {};
          (cs || []).forEach(
            (c) => (sums[c.project_id] = (sums[c.project_id] || 0) + Number(c.amount)),
          );
          setActiveProjects(
            pj.map((p) => {
              const raised = Number(p.fund_allocation) + (sums[p.id] || 0);
              return {
                ...p,
                raised,
                remaining: Math.max(0, Number(p.goal_amount) - raised),
                pct: Math.min(100, Math.round((raised / Number(p.goal_amount)) * 100)),
              };
            }),
          );
        });
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (announcements.length < 2) return;
    const t = setInterval(() => setAnnIndex((p) => (p + 1) % announcements.length), 7000);
    return () => clearInterval(t);
  }, [announcements.length]);

  const statusMessages = useMemo(() => {
    const msgs = ["نصل العائلة، نحفظ الإرث، ونبني المستقبل."];
    if (counts.myTasks > 0) msgs.push(`لديك ${counts.myTasks} مسؤوليات بانتظار إنجازك.`);
    if (counts.newNews > 0) msgs.push(`هناك ${counts.newNews} أخبار جديدة في مركز الأخبار.`);
    msgs.push("المجلس يرحب بكم دائماً يا أهل الوفاء.");
    msgs.push("كل خطوة تخطونها تبني مجداً لعائلة السيف.");
    return msgs;
  }, [counts]);

  useEffect(() => {
    const t = setInterval(() => setStatusIndex((p) => (p + 1) % statusMessages.length), 6000);
    return () => clearInterval(t);
  }, [statusMessages.length]);

  const stats: Array<{
    label: string;
    value: number;
    suffix: string;
    color: string;
    icon: React.ElementType<{ className?: string }>;
    link: "/finance" | "/members" | "/trips" | "/tasks";
  }> = [
    {
      label: "رصيد الصندوق",
      value: fundBalance,
      suffix: "ر.س",
      color: "bg-gradient-to-br from-emerald-600 to-teal-900",
      icon: Wallet,
      link: "/finance",
    },
    {
      label: "أفراد العائلة",
      value: counts.members,
      suffix: "عضو",
      color: "bg-gradient-to-br from-primary to-emerald-950",
      icon: Users,
      link: "/members",
    },
    {
      label: "ترفيه عائلي",
      value: counts.trips,
      suffix: "وجهة",
      color: "bg-gradient-to-br from-[#8E7745] to-[#453a22]",
      icon: Plane,
      link: "/trips",
    },
    {
      label: "مهام قيد التنفيذ",
      value: counts.tasks,
      suffix: "مهمة",
      color: "bg-gradient-to-br from-rose-700 to-rose-950",
      icon: ListChecks,
      link: "/tasks",
    },
  ];

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) return "صباح الخير";
    if (hr >= 12 && hr < 17) return "مساء النور";
    if (hr >= 17 && hr < 21) return "مساء الخير";
    return "طاب مساؤك";
  };

  const sendBugReport = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    if (!bugBody.trim()) return;
    setBugSending(true);
    showIsland("جاري إرسال البلاغ...", "loading");
    try {
      let url = null;
      if (bugImage) {
        const path = `bugs/${profile.userId}/${crypto.randomUUID()}.${bugImage.name.split(".").pop()}`;
        await supabase.storage.from("trip-images").upload(path, bugImage);
        url = (await supabase.storage.from("trip-images").createSignedUrl(path, 31536000)).data
          ?.signedUrl;
      }
      await supabase
        .from("bug_reports" as any)
        .insert({ reporter_id: profile.userId, body: bugBody.trim(), image_url: url });
      showIsland("تم إرسال البلاغ بنجاح", "success");
      setShowBugReport(false);
      setBugBody("");
      setBugImage(null);
      setBugImagePreview(null);
    } catch {
      showIsland("فشل الإرسال", "error");
    } finally {
      setBugSending(false);
    }
  };

  return (
    <AppShell title="لوحة العائلة" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-20 px-4 md:px-0">
        {/* 1. SPIRITUAL REMINDER - Linked to Theme Colors */}
        <section className="animate-fade-up px-2 md:px-0">
          <div className="flex items-center justify-center gap-3 py-1 opacity-100 transition-all duration-700">
            <Scroll className="size-3 text-primary shrink-0" />
            <p
              className="text-[11px] md:text-sm font-black text-primary italic drop-shadow-sm"
              style={{ fontFamily: "'Amiri', serif" }}
            >
              "{spiritualQuote.text}"
            </p>
            <div className="h-2 w-px bg-primary/20 mx-1" />
            <span className="text-[9px] font-bold text-primary/60">
              {spiritualQuote.source}
            </span>
          </div>
        </section>

        {/* 2. RESPONSIVE HERO CARD */}
        <section className="animate-fade-up px-2 md:px-0">
          <div className="relative overflow-hidden rounded-[40px] md:rounded-[48px] bg-[var(--nav-bg)] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)] border border-white/5 group">
            {/* Background Texture */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 0l20 40H20zM40 80L20 40h40zM0 40l40-20v40zM80 40L40 60V20z' fill='%23D4AF37' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
                backgroundSize: "80px 80px",
              }}
            />

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-16 p-10 md:p-12">
              {/* Profile/Logo Medallion */}
              <div className="shrink-0 flex items-center justify-center">
                <div className="relative group/avatar">
                  <div className="absolute inset-0 rounded-full bg-gold-primary/20 blur-2xl animate-pulse" />
                  <div className="relative size-32 md:size-48 rounded-full p-1.5 bg-gradient-to-br from-gold-primary via-transparent to-gold-primary shadow-2xl transition-transform duration-700 group-hover/avatar:scale-[1.03]">
                    <div className="size-full rounded-full bg-[#fdfcf7] p-4 flex items-center justify-center shadow-inner overflow-hidden border-[3px] border-[var(--nav-bg)]/5">
                      {dynamicLogo ? (
                        <div
                          className="size-full bg-contain bg-no-repeat bg-center transition-transform duration-1000 group-hover/avatar:rotate-[360deg]"
                          style={{ backgroundImage: `url(${dynamicLogo})` }}
                        />
                      ) : (
                        <Sparkles className="size-16 text-gold-primary animate-pulse" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Identity Section */}
              <div className="flex-1 text-center md:text-right space-y-6 min-w-0">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                    <Sparkles className="size-3 text-gold-primary animate-bounce" />
                    <p className="text-gold-primary font-black uppercase tracking-[0.4em] text-[9px] md:text-xs">
                      {getGreeting()}، يا أهل الوفاء
                    </p>
                  </div>

                  <h2 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                    {profile.name}
                  </h2>

                  <div className="flex items-center justify-center md:justify-start gap-4 mt-6 md:mt-8">
                    <div className="hidden md:block w-1 h-10 bg-gradient-to-b from-gold-primary/70 via-gold-primary/30 to-transparent rounded-full" />
                    <div className="h-8 overflow-hidden relative w-full md:w-auto">
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={statusIndex}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="text-white/60 font-bold text-lg md:text-xl italic leading-none"
                        >
                          {statusMessages[statusIndex]}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Corner Ornaments */}
            <div className="absolute top-0 right-0 size-40 md:size-64 opacity-[0.1] pointer-events-none">
              <svg viewBox="0 0 100 100" className="size-full fill-gold-primary">
                <path d="M100,0 L100,30 Q100,0 70,0 L100,0 Z" />
              </svg>
            </div>
          </div>
        </section>

        {/* 3. QUICK ACTIONS BANNER - ONLY ONE INSTANCE */}
        <QuickActionsBanner />

        {/* 4. CONTENT HUB & POLLS */}
        <PollsPopup userId={profile.userId ?? null} />
        <IntegratedHub
          upcomingMeetings={upcomingMeetings}
          upcomingTrips={upcomingTrips}
          tasksCount={counts.tasks}
          onViewTrip={(t) => setImmersiveItem({ type: "trip", data: t })}
          onViewMeeting={(m) => setImmersiveItem({ type: "meeting", data: m })}
        />

        {/* 5. HERITAGE SNIPPET */}
        {heritageSnippet && (
          <section className="animate-fade-up px-4 md:px-0">
            <Link
              to="/heritage"
              className="block group card-surface p-8 transition-all hover:scale-[1.01]"
            >
              <div className="flex items-center gap-6">
                <div className="size-16 rounded-[22px] bg-gold-primary/10 flex items-center justify-center shrink-0 border border-gold-primary/20">
                  <Scroll className="size-8 text-gold-primary" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="text-[10px] font-black uppercase text-gold-primary/80">
                    قبس من تاريخ السيف
                  </span>
                  <h3 className="text-xl md:text-2xl font-black text-primary truncate">
                    {heritageSnippet.title}
                  </h3>
                  <p className="text-sm md:text-lg font-bold text-muted-foreground line-clamp-1 italic opacity-90 leading-relaxed">
                    "{heritageSnippet.cleanBody}"
                  </p>
                </div>
                <ChevronLeft className="size-6 text-gold-primary opacity-30 group-hover:opacity-100 group-hover:-translate-x-2 transition-all" />
              </div>
            </Link>
          </section>
        )}

        {/* 6. ANNOUNCEMENTS - Refined with stable plugin */}
        {announcements.length > 0 && (
          <section className="animate-fade-up px-2 md:px-0">
            <Carousel
              opts={announcementsOpts}
              plugins={announcementsPlugins}
              className="w-full group"
            >
              <CarouselContent>
                {announcements.map((a, i) => (
                  <CarouselItem key={i}>
                    <Link
                      to="/majlis"
                      className="block relative overflow-hidden rounded-[32px] md:rounded-[40px] border border-gold-primary/30 bg-gradient-to-br from-primary via-[#0d2620] to-black shadow-2xl min-h-[240px] md:min-h-[200px] flex items-stretch"
                    >
                      {a.imageUrl && (
                        <div className="absolute inset-0 z-0 overflow-hidden">
                          <img
                            src={a.imageUrl}
                            className="size-full object-cover object-left md:object-center transition-all duration-1000 group-hover:scale-105"
                            alt=""
                          />
                          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-l from-black via-black/40 to-transparent" />
                        </div>
                      )}
                      <div className="relative z-10 flex flex-col md:flex-row items-end md:items-center justify-between gap-6 w-full p-6 md:p-12">
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-8 text-center md:text-right w-full">
                          <div className="size-14 md:size-24 rounded-2xl md:rounded-3xl bg-gold-primary/20 backdrop-blur-xl border border-gold-primary/30 flex items-center justify-center text-gold-primary shrink-0 shadow-2xl group-hover:rotate-6 transition-transform duration-500">
                            <Newspaper size={28} className="md:size-[40px]" />
                          </div>
                          <div className="space-y-2 md:space-y-1 w-full">
                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary opacity-80">
                              {a._label}
                            </span>
                            <h3 className="text-2xl md:text-4xl font-black text-white tracking-tight drop-shadow-lg">
                              {a.title}
                            </h3>
                            <p className="text-white/90 font-bold text-sm md:text-lg leading-relaxed max-w-2xl">
                              {a.cleanBody}
                            </p>
                          </div>
                        </div>
                        <div className="hidden md:flex shrink-0">
                          <ChevronLeft className="size-10 text-gold-primary/40 group-hover:text-gold-primary group-hover:-translate-x-3 transition-all duration-500" />
                        </div>
                      </div>
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>

              {/* Desktop Arrows */}
              <div className="hidden md:block">
                <CarouselPrevious className="right-4 bg-white/10 border-white/20 text-white hover:bg-gold-primary hover:text-black transition-all" />
                <CarouselNext className="left-4 bg-white/10 border-white/20 text-white hover:bg-gold-primary hover:text-black transition-all" />
              </div>
            </Carousel>
          </section>
        )}

        {/* 7. STATS GRID */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 px-2 md:px-0">
          {stats.map((s, i) => (
            <Link key={i} to={s.link} className="block group">
              <div
                className={cn(
                  "relative overflow-hidden rounded-[24px] md:rounded-[32px] p-5 md:p-8 text-white shadow-lg transition-all duration-500 hover:scale-[1.02]",
                  s.color,
                )}
              >
                <div className="absolute top-0 right-0 p-3 md:p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  {React.createElement(s.icon, { className: "size-10 md:size-16" })}
                </div>
                <div className="relative z-10 space-y-2 md:space-y-4">
                  <p className="text-[10px] md:text-sm font-black uppercase tracking-widest opacity-80">
                    {s.label}
                  </p>
                  <div className="flex items-baseline gap-1 md:gap-2">
                    <span className="text-xl md:text-4xl font-black tracking-tighter">
                      <AnimatedCounter value={s.value} />
                    </span>
                    <span className="text-[10px] md:text-sm font-bold opacity-60">{s.suffix}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </section>

        {/* 8. SUPPORT SECTION */}
        <section className="pb-20 px-4 md:px-0 animate-fade-up">
          <div className="glass-surface p-10 md:p-16 border-dashed border-2 border-primary/20 rounded-[44px] flex flex-col md:flex-row items-center justify-between gap-10 text-center md:text-right relative overflow-hidden group">
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-center md:justify-start gap-3 text-rose-500">
                <ShieldAlert className="size-6" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                  الدعم الفني والتقني
                </span>
              </div>
              <h3 className="text-3xl font-black text-primary tracking-tight">
                هل واجهت عائقاً في النظام?
              </h3>
              <p className="text-base md:text-lg font-bold text-muted-foreground opacity-80 max-w-xl">
                أبلغ فريق الإشراف عن أي ملاحظة برمجية لمساعدتنا في تطوير تجربة تليق بعائلة السيف.
              </p>
            </div>
            <button
              onClick={() => setShowBugReport(true)}
              className="px-12 py-5 rounded-[22px] bg-rose-500/10 text-rose-600 font-black text-sm border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all shadow-xl flex items-center gap-3 relative z-10"
            >
              <ShieldAlert size={20} /> إرسال بلاغ فوري
            </button>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {immersiveItem && (
          <ImmersiveView item={immersiveItem} onClose={() => setImmersiveItem(null)} />
        )}
        {showBugReport && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            dir="rtl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card border border-border rounded-[32px] w-full max-w-lg p-8 space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-primary">بلاغ فني</h3>
                <button
                  onClick={() => setShowBugReport(false)}
                  className="size-10 rounded-full bg-muted flex items-center justify-center"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <textarea
                  value={bugBody}
                  onChange={(e) => setBugBody(e.target.value)}
                  placeholder="صف المشكلة هنا..."
                  rows={5}
                  className="w-full p-6 rounded-2xl bg-muted/40 border border-border font-bold text-sm focus:outline-none focus:border-primary transition-all resize-none shadow-inner text-foreground"
                />
                <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border/60 rounded-3xl cursor-pointer hover:bg-primary/5 transition-all bg-muted/20">
                  {bugImagePreview ? (
                    <img src={bugImagePreview} className="h-32 object-contain rounded-xl" alt="" />
                  ) : (
                    <>
                      <ImageIcon className="size-8 text-muted-foreground opacity-30" />
                      <span className="text-xs font-bold text-muted-foreground">لقطة شاشة</span>
                    </>
                  )}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setBugImage(f);
                        setBugImagePreview(URL.createObjectURL(f));
                      }
                    }}
                  />
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBugReport(false)}
                  className="flex-1 py-4 rounded-2xl font-black text-muted-foreground hover:bg-muted transition-all"
                >
                  إلغاء
                </button>
                <button
                  onClick={sendBugReport}
                  disabled={bugSending || !bugBody.trim()}
                  className="flex-[2] btn-gold py-4 rounded-2xl font-black flex items-center justify-center gap-2"
                >
                  {bugSending ? <Loader2 className="animate-spin size-4" /> : <Send size={16} />}{" "}
                  إرسال
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
