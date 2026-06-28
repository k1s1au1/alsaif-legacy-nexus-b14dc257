import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  Heart,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import palmWatermark from "@/assets/palm-watermark.png";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { AnimatedCounter } from "@/components/dashboard/animated-counter";
import { LiveClock } from "@/components/dashboard/live-clock";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { QuickActionsBanner } from "@/components/quick-actions-banner";
import Autoplay from "embla-carousel-autoplay";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { TripImage } from "@/components/trip-image";
import { IntegratedHub } from "@/components/dashboard/integrated-hub";
import { sendFcmNotification } from "@/lib/fcm";
import { showIsland, hideIsland } from "@/components/dynamic-island";

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

function ImmersiveView({ item, onClose }: { item: { type: 'trip' | 'meeting' | 'news', data: any }, onClose: () => void }) {
  const { type, data } = item;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="fixed inset-0 z-[110] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xl p-0 md:p-10"
      dir="rtl"
    >
      <motion.div
        layoutId={`immersive-${type}-${data.id}`}
        initial={{ y: "100%", opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: "100%", opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", damping: 30, stiffness: 200 }}
        className="bg-[#051410] w-full max-w-6xl h-full md:h-[90vh] rounded-t-[40px] md:rounded-[60px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.6)] flex flex-col relative border border-white/10"
      >
        <button
          onClick={onClose}
          className="absolute top-6 left-6 z-30 size-12 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-red-500 transition-all border border-white/10 group"
        >
          <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
           {/* Header Section */}
           <div className="relative h-[300px] md:h-[450px] shrink-0">
              {type === 'trip' ? (
                <TripImage path={data.image_url} alt={data.title} className="size-full object-cover" />
              ) : (
                <div className="size-full bg-gradient-to-br from-[#064E3B] via-[#051410] to-black flex items-center justify-center">
                   {type === 'meeting' ? <CalendarDays className="size-32 text-gold-primary opacity-10" /> : <Newspaper className="size-32 text-gold-primary opacity-10" />}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#051410] via-[#051410]/20 to-transparent" />

              <div className="absolute bottom-8 right-8 left-8 space-y-3">
                 <div className="flex items-center gap-2 text-gold-primary bg-black/40 backdrop-blur-md w-fit px-4 py-1.5 rounded-full border border-white/10">
                    {type === 'trip' ? <Plane size={16} /> : type === 'meeting' ? <CalendarDays size={16} /> : <Newspaper size={16} />}
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">{type === 'trip' ? 'ترفيه عائلي' : type === 'meeting' ? 'اجتماع مرتقب' : 'أخبار السيف'}</span>
                 </div>
                 <h2 className="text-4xl md:text-7xl font-black text-white leading-tight tracking-tighter drop-shadow-2xl">{data.title}</h2>
              </div>
           </div>

           <div className="p-8 md:p-16 space-y-10">
              {/* Meta Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                 <div className="flex items-center gap-5 bg-white/5 p-6 rounded-[28px] border border-white/5">
                    <div className="size-14 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary border border-gold-primary/20 shadow-xl"><Clock size={28} /></div>
                    <div>
                       <p className="text-[10px] font-black uppercase opacity-40 mb-1">الموعد والتاريخ</p>
                       <p className="text-base md:text-xl font-black text-white">{new Date(data.start_date || data.scheduled_at || data.created_at).toLocaleDateString("ar-SA", { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    </div>
                 </div>
                 {data.location && (
                   <div className="flex items-center gap-4 bg-white/5 p-4 rounded-[20px] border border-white/5">
                      <div className="size-10 rounded-xl bg-gold-primary/10 flex items-center justify-center text-gold-primary border border-gold-primary/20 shadow-xl"><MapPin size={20} /></div>
                      <div>
                         <p className="text-[8px] font-black uppercase opacity-60 mb-0.5">الموقع / المكان</p>
                         <p className="text-sm md:text-base font-black text-white">{data.location}</p>
                      </div>
                   </div>
                 )}
              </div>

              {/* Description Section */}
              <div className="space-y-6">
                 <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">تفاصيل الحدث</h4>
                    <div className="h-px flex-1 bg-white/10" />
                 </div>
                 <p className="text-lg md:text-2xl font-bold text-white/70 leading-relaxed text-right md:text-justify whitespace-pre-wrap">
                    {data.description || data.cleanBody || data.body || "لا توجد تفاصيل إضافية لهذا الحدث حالياً."}
                 </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-10 flex flex-col md:flex-row gap-4">
                 {type === 'trip' && (
                    <Link
                      to="/trips/$tripId"
                      params={{ tripId: data.id }}
                      className="btn-gold py-6 px-12 rounded-full font-black text-xl text-center flex-1 shadow-[0_15px_40px_-5px_rgba(139,107,35,0.4)] hover:scale-[1.02] transition-transform"
                    >
                      فتح صفحة الترفيه
                    </Link>
                 )}
                 {type === 'meeting' && (
                    <Link to="/meetings" className="btn-gold py-6 px-12 rounded-full font-black text-xl text-center flex-1 shadow-[0_15px_40px_-5px_rgba(139,107,35,0.4)] hover:scale-[1.02] transition-transform">تأكيد الحضور</Link>
                 )}
                 {type === 'news' && (
                    <Link to="/majlis" className="btn-gold py-6 px-12 rounded-full font-black text-xl text-center flex-1 shadow-[0_15px_40px_-5px_rgba(139,107,35,0.4)] hover:scale-[1.02] transition-transform">فتح في المجلس</Link>
                 )}
                 <button
                   onClick={onClose}
                   className="py-6 px-12 rounded-full bg-white/5 text-white font-black text-xl hover:bg-white/10 transition-all border border-white/10"
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

function Dashboard() {
  const [profile, setProfile] = useState<{
    name: string;
    role: string;
    initial: string;
    avatarPath?: string | null;
    userId?: string;
  }>({
    name: "تحميل...",
    role: "عضو",
    initial: "س",
  });

  const [fundBalance, setFundBalance] = useState<number>(0);
  const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [annIndex, setAnnIndex] = useState(0);
  const [tripsCount, setTripsCount] = useState(0);
  const [membersCount, setMembersCount] = useState(0);
  const [tasksCount, setTasksCount] = useState(0);
  const [myTasksCount, setMyTasksCount] = useState(0);
  const [newNewsCount, setNewNewsCount] = useState(0);
  const [heritageSnippet, setHeritageSnippet] = useState<any>(null);
  const [initiatives, setInitiatives] = useState<any[]>([]);
  const [activeProjects, setActiveProjects] = useState<any[]>([]);
  const [showBugReport, setShowBugReport] = useState(false);
  const [immersiveItem, setImmersiveItem] = useState<{ type: 'trip' | 'meeting' | 'news', data: any } | null>(null);
  const [bugBody, setBugBody] = useState("");
  const [bugImage, setBugImage] = useState<File | null>(null);
  const [bugImagePreview, setBugImagePreview] = useState<string | null>(null);
  const [bugSending, setBugSending] = useState(false);
  const hasGreeted = useRef(false);
  const dynamicLogo = useSiteLogo();

  const loadData = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const u = authData.user;

      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("arabic_name, full_name, avatar_url").eq("id", u.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.id)
      ]);

      const rs = (r ?? []).map(x => x.role);
      const name = p?.arabic_name || p?.full_name || u.email?.split("@")[0] || "عضو العائلة";

      setProfile({
        name,
        role: rs.includes("admin") ? "مسؤول النظام" : rs.includes("chairman") ? "رئيس المجلس" : "عضو المجلس",
        initial: (name ? name[0] : "ع").toUpperCase(),
        avatarPath: p?.avatar_url ?? null,
        userId: u.id,
      });

      if (!hasGreeted.current) {
        showIsland(`طاب يومك يا ${name.split(' ')[0]}`, "info", 3000);
        hasGreeted.current = true;
      }

      // Check Notification Permission
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          setTimeout(() => {
            Notification.requestPermission();
          }, 5000);
        }
      }

      const now = new Date().toISOString();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Consolidated fetching with individual error handling to prevent total blackout
      const fetchCounts = async () => {
        supabase.from("trips").select("*", { count: "exact", head: true }).then(r => setTripsCount(r.count || 0));
        supabase.from("profiles").select("*", { count: "exact", head: true }).then(r => setMembersCount(r.count || 0));
        supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "done").then(r => setTasksCount(r.count || 0));
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assignee_id", u.id).neq("status", "done").then(r => setMyTasksCount(r.count || 0));
        supabase.from("majlis_posts").select("*", { count: "exact", head: true }).gt("created_at", yesterday).then(r => setNewNewsCount(r.count || 0));
      };

      const fetchData = async () => {
        const [{ data: meetings }, { data: tData }, { data: annData }, { data: transactions }] = await Promise.all([
          supabase.from("meetings").select("*").gte("scheduled_at", now).order("scheduled_at").limit(5),
          supabase.from("trips").select("*").gte("start_date", now).order("start_date").limit(5),
          supabase.from("majlis_posts").select("id, title, body, created_at, pinned").eq("kind", "announcement").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(5),
          supabase.from("fund_transactions").select("amount, type")
        ]);

        setUpcomingMeetings(meetings || []);
        setUpcomingTrips(tData || []);

        if (transactions) {
          const bal = transactions.reduce((acc, t) => {
            const val = Number(t.amount) || 0;
            return t.type === "contribution" ? acc + val : acc - val;
          }, 0);
          setFundBalance(bal);
        }

        if (annData) {
          const withImages = await Promise.all(
            annData.map(async (a: any) => {
              const imgMatch = a.body.match(/^---image:(.*)\n/);
              let url = null;
              if (imgMatch) {
                const path = imgMatch[1].trim();
                const { data } = await supabase.storage.from("trip-images").createSignedUrl(path, 60 * 60);
                url = data?.signedUrl;
              }
              return {
                ...a,
                imageUrl: url,
                cleanBody: imgMatch ? a.body.replace(/^---image:.*\n/, "") : a.body,
              };
            }),
          );
          setAnnouncements(withImages);
        }
      };

      fetchCounts();
      fetchData();

      // Load Heritage Snippet
      supabase
        .from("majlis_posts")
        .select("*")
        .eq("kind", "discussion")
        .ilike("title", "[إرث]%")
        .limit(20)
        .then((r) => {
          if (r.data && r.data.length > 0) {
            const random = r.data[Math.floor(Math.random() * r.data.length)];
            const kindMatch = random.body.match(/^---kind:(.*)\n/);
            setHeritageSnippet({
              ...random,
              title: random.title.replace("[إرث]", "").trim(),
              cleanBody: random.body.replace(/---kind:.*\n/, "").replace(/---image:.*\n/, "").trim()
            });
          }
        });
      // Load Initiatives
      supabase
        .from("majlis_posts")
        .select("*, author:profiles(arabic_name, full_name)")
        .eq("kind", "discussion")
        .ilike("title", "[مبادرة]%")
        .order("created_at", { ascending: false })
        .limit(3)
        .then((r) => setInitiatives(r.data || []));

      // Load active family projects with contributions
      supabase
        .from("family_projects")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(5)
        .then(async (r) => {
          const pj = r.data || [];
          if (pj.length === 0) {
            setActiveProjects([]);
            return;
          }
          const ids = pj.map((p: any) => p.id);
          const { data: cs } = await supabase
            .from("family_project_contributions")
            .select("project_id, amount")
            .in("project_id", ids);
          const sums: Record<string, number> = {};
          (cs || []).forEach((c: any) => {
            sums[c.project_id] = (sums[c.project_id] || 0) + Number(c.amount);
          });
          setActiveProjects(
            pj.map((p: any) => {
              const raised = Number(p.fund_allocation) + (sums[p.id] || 0);
              const remaining = Math.max(0, Number(p.goal_amount) - raised);
              const pct = Math.min(100, Math.round((raised / Number(p.goal_amount)) * 100));
              return { ...p, raised, remaining, pct };
            }),
          );
        });
    } catch (err) {
      console.error("Dashboard error:", err);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleVisibility = () => {
      if (!document.hidden) {
        loadData();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [loadData]);

  useEffect(() => {
    if (announcements.length < 2) return;
    const t = setInterval(() => setAnnIndex((p) => (p + 1) % announcements.length), 7000);
    return () => clearInterval(t);
  }, [announcements.length]);

  const stats = [
    { label: "رصيد الصندوق", value: fundBalance, suffix: "ر.س", color: "bg-gradient-to-br from-emerald-600 to-teal-900", icon: <Wallet className="size-16" />, link: "/finance" },
    { label: "أفراد العائلة", value: membersCount, suffix: "عضو", color: "bg-gradient-to-br from-primary to-emerald-950", icon: <Users className="size-16" />, link: "/members" },
    { label: "ترفيه عائلي", value: tripsCount, suffix: "وجهة", color: "bg-gradient-to-br from-[#8E7745] to-[#453a22]", icon: <Plane className="size-16" />, link: "/trips" },
    { label: "مهام قيد التنفيذ", value: tasksCount, suffix: "مهمة", color: "bg-gradient-to-br from-rose-700 to-rose-950", icon: <ListChecks className="size-16" />, link: "/tasks" },
  ];

  const tripsPlugin = useRef(Autoplay({ delay: 5000, stopOnInteraction: true }));
  const meetingsPlugin = useRef(Autoplay({ delay: 6000, stopOnInteraction: true }));

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) return "صباح الخير";
    if (hr >= 12 && hr < 17) return "مساء النور";
    if (hr >= 17 && hr < 21) return "مساء الخير";
    return "طاب مساؤك";
  };

  const getStatusSummary = () => {
    const now = new Date();
    const greetings = [
      "نصل العائلة، نحفظ الإرث، ونبني المستقبل.",
      "يوم سعيد ومثمر نتمناه لك في رحاب عائلة السيف.",
      "حضورك وتفاعلك هو ما يجعل مجلسنا عامراً.",
      "فخورون بمبادراتك وعطائك المستمر للعائلة."
    ];

    const parts = [];

    // Check Tasks
    if (myTasksCount > 0) {
      parts.push(`لديك ${myTasksCount} ${myTasksCount === 1 ? 'مسؤولية تحتاج لمتابعتك' : 'مسؤوليات بانتظار إنجازك'}`);
    }

    // Check News
    if (newNewsCount > 0) {
      parts.push(`هناك ${newNewsCount} ${newNewsCount === 1 ? 'تحديث جديد' : 'تحديثات جديدة'} في المجلس`);
    }

    // Check Upcoming Trips (within 3 days)
    const upcomingTrip = upcomingTrips[0];
    if (upcomingTrip && upcomingTrip.start_date) {
      const tripDate = new Date(upcomingTrip.start_date);
      const diffDays = Math.ceil((tripDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 0 && diffDays <= 3) {
        parts.push(`بقي ${diffDays === 1 ? 'يوم واحد' : diffDays === 2 ? 'يومان' : diffDays + ' أيام'} على ${upcomingTrip.title}.. هل أنت مستعد؟`);
      }
    }

    // Check Upcoming Meetings (within 24 hours)
    const upcomingMeeting = upcomingMeetings[0];
    if (upcomingMeeting && upcomingMeeting.scheduled_at) {
      const meetDate = new Date(upcomingMeeting.scheduled_at);
      const diffHours = (meetDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (diffHours > 0 && diffHours <= 24) {
        parts.push(`اجتماع "${upcomingMeeting.title}" يقترب، ننتظر تشريفك`);
      }
    }

    if (parts.length === 0) return greetings[Math.floor(Math.random() * greetings.length)];

    // Pick two random parts or just join them if few
    const selected = parts.sort(() => 0.5 - Math.random()).slice(0, 2);
    return selected.join(" و ") + ".";
  };

  const sendBugReport = async () => {
    if (!bugBody.trim()) return;
    setBugSending(true);
    showIsland("جاري إرسال البلاغ...", "loading");

    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      hideIsland();
      return;
    }

    let imageUrl = "";
    try {
      if (bugImage) {
        const ext = bugImage.name.split(".").pop();
        const path = `bugs/${u.user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("trip-images").upload(path, bugImage);
        if (!upErr) {
          const { data: sign } = await supabase.storage.from("trip-images").createSignedUrl(path, 60 * 60 * 24 * 365);
          imageUrl = sign?.signedUrl || "";
        }
      }
      const { error } = await supabase.from("majlis_posts").insert({
        author_id: u.user.id,
        kind: "complaint",
        title: "تقرير خطأ في النظام",
        body: `تم إرسال بلاغ عن خطأ:\n\n${bugBody.trim()}${imageUrl ? `\n\n[رابط الصورة المصاحبة]: ${imageUrl}` : ""}`,
      } as any);

      if (!error) {
        // Notify supervisors via FCM
        sendFcmNotification({
          data: {
            title: "🚨 بلاغ عن خطأ جديد",
            body: `قام ${profile.name} بإرسال تقرير عن مشكلة تقنية.`,
          }
        }).catch(err => console.warn("Bug notification error:", err));

        showIsland("تم إرسال البلاغ للمشرفين بنجاح", "success");
        setBugBody(""); setBugImage(null); setBugImagePreview(null); setShowBugReport(false);
      } else {
        showIsland("تعذر إرسال البلاغ", "error");
      }
    } catch (e) {
      showIsland("حدث خطأ غير متوقع", "error");
    } finally {
      setBugSending(false);
    }
  };

  return (
    <AppShell title="لوحة العائلة" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-20">
        <section className="animate-fade-up">
          <div className="relative overflow-hidden rounded-[44px] glass-surface glass-reflection shadow-[0_32px_120px_-20px_rgba(0,0,0,0.3)]">
            <div className="absolute left-0 top-0 bottom-0 w-1/3 md:w-1/4 pointer-events-none overflow-hidden opacity-[0.06] dark:opacity-[0.03]">
              <img src={palmWatermark} alt="" className="absolute -left-4 -bottom-4 h-[120%] md:h-[140%] w-auto max-w-none object-contain object-bottom saturate-[0.7] opacity-80" loading="lazy" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row items-center md:items-stretch gap-6 md:gap-10 p-8 md:p-14">
              <div className="shrink-0 order-1 flex items-center justify-center">
                <div className="relative group">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gold-primary/30 via-gold-primary/5 to-transparent blur-3xl group-hover:blur-4xl transition-all duration-1000" />
                  <div className="relative size-32 md:size-52 rounded-full bg-white/5 backdrop-blur-3xl border-[3px] border-gold-primary/30 shadow-[0_32px_60px_-15px_rgba(0,0,0,0.3)] flex items-center justify-center p-4 md:p-6">
                    <div className="size-full logo-alsaif" style={{ "--logo-url": `url(${dynamicLogo || alsaifMark.url})` } as any} />
                  </div>
                </div>
              </div>

              <div className="hidden md:flex flex-col items-center justify-center gap-3 self-stretch py-8 order-1 opacity-20">
                <div className="w-px flex-1 bg-gradient-to-b from-transparent via-gold-primary to-transparent" />
                <div className="size-2 rounded-full bg-gold-primary shadow-[0_0_12px_rgba(212,175,55,0.6)]" />
                <div className="w-px flex-1 bg-gradient-to-b from-transparent via-gold-primary to-transparent" />
              </div>

              <div className="flex-1 text-center md:text-right space-y-6 order-2">
                <div className="space-y-3">
                  <p className="text-gold-primary font-black uppercase tracking-[0.4em] text-[10px] md:text-xs opacity-90 drop-shadow-sm">{getGreeting()}،</p>
                  <h2 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter leading-tight text-foreground drop-shadow-2xl">{profile.name}</h2>
                  <motion.div
                    key={getStatusSummary()}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center md:justify-start gap-2 text-base md:text-xl text-muted-foreground font-bold opacity-80 leading-relaxed max-w-2xl md:mr-0 mx-auto"
                  >
                    <div className="size-2 rounded-full bg-gold-primary animate-pulse shrink-0" />
                    <p>{getStatusSummary()}</p>
                  </motion.div>
                </div>

                <div className="inline-flex items-center gap-4 md:gap-6 rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-2xl px-6 md:px-8 py-3 md:py-4 shadow-2xl mx-auto md:mx-0">
                  <div className="flex items-center gap-3 text-gold-primary">
                    <Calendar className="size-5 md:size-6" />
                    <span className="text-xs md:text-lg font-black text-foreground tracking-wide tabular-nums"><LiveClock variant="date" /></span>
                  </div>
                  <div className="h-6 md:h-8 w-px bg-white/10" />
                  <div className="flex items-center gap-3 text-gold-primary">
                    <Clock className="size-5 md:size-6" />
                    <span className="text-xs md:text-lg font-black tabular-nums tracking-widest text-foreground"><LiveClock variant="time" /></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <QuickActionsBanner />

        <IntegratedHub
          upcomingMeetings={upcomingMeetings}
          upcomingTrips={upcomingTrips}
          tasksCount={tasksCount}
          onViewTrip={(trip) => setImmersiveItem({ type: 'trip', data: trip })}
          onViewMeeting={(meeting) => setImmersiveItem({ type: 'meeting', data: meeting })}
        />

        {heritageSnippet && (
          <section className="px-4 animate-fade-up" style={{ animationDelay: "180ms" }}>
             <Link to="/heritage" className="block group">
                <div className="relative overflow-hidden rounded-[32px] glass-gold-surface p-8 transition-all duration-500 hover:scale-[1.01] hover:shadow-2xl">
                   <div className="flex items-center gap-6">
                      <div className="size-16 rounded-[22px] bg-gold-primary/10 flex items-center justify-center shrink-0 border border-gold-primary/20 shadow-xl">
                         <Scroll className="size-8 text-gold-primary" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                         <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold-primary/80">قبس من تاريخ السيف</span>
                            <div className="h-px w-12 bg-gold-primary/20" />
                         </div>
                         <h3 className="text-xl md:text-2xl font-black text-primary truncate">{heritageSnippet.title}</h3>
                         <p className="text-sm md:text-lg font-bold text-muted-foreground line-clamp-1 italic opacity-90 leading-relaxed">"{heritageSnippet.cleanBody}"</p>
                      </div>
                      <ChevronLeft className="size-6 text-gold-primary opacity-30 group-hover:opacity-100 group-hover:-translate-x-2 transition-all shrink-0" />
                   </div>
                </div>
             </Link>
          </section>
        )}

        {announcements.length > 0 && (() => {
            const a = announcements[annIndex % announcements.length];
            return (
              <section className="px-4 animate-fade-up" style={{ animationDelay: "150ms" }}>
                <Link to="/majlis" className="block group">
                  <div className="relative overflow-hidden rounded-[32px] md:rounded-[48px] border border-gold-primary/30 bg-gradient-to-br from-primary via-[#0d2620] to-black shadow-2xl min-h-[140px] md:min-h-[180px] flex items-center">
                    {a.imageUrl && (
                      <div className="absolute inset-0 z-0">
                        <img src={a.imageUrl} className="size-full object-cover transition-transform duration-1000 group-hover:scale-110" alt="" />
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
                        <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-transparent to-transparent" />
                      </div>
                    )}
                    <div className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none z-1 transition-transform duration-700 group-hover:scale-110 group-hover:opacity-40">
                      <div className="size-24 md:size-40 logo-alsaif-banner" style={{ "--logo-url": `url(${dynamicLogo || alsaifMark.url})` } as any} />
                    </div>
                    <div className="absolute top-0 right-0 size-72 bg-gold-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 z-1" />
                    <div className="relative z-10 p-6 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-5 md:gap-10 w-full">
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="size-12 md:size-20 rounded-2xl md:rounded-[24px] bg-gold-primary/20 backdrop-blur-md border border-gold-primary/30 flex items-center justify-center text-gold-primary shrink-0 shadow-xl">
                          <Newspaper className="size-6 md:size-10" />
                        </div>
                        <div className="md:hidden flex flex-col"><span className="text-[9px] font-black uppercase tracking-[0.2em] text-gold-primary/80">أخبار العائلة</span></div>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1 md:space-y-2">
                        <div className="hidden md:flex items-center gap-3">
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold-primary">أخبار السيف</span>
                          <div className="h-px w-12 bg-gold-primary/30" />
                        </div>
                        <div
                          className="cursor-pointer"
                          onClick={(e) => { e.preventDefault(); setImmersiveItem({ type: 'news', data: a }); }}
                        >
                          <AnimatePresence mode="wait">
                            <motion.div key={a.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                              <h3 className="text-lg md:text-4xl font-black text-white tracking-tight leading-tight line-clamp-1 drop-shadow-lg">{a.title}</h3>
                              <p className="text-[11px] md:text-base text-white/70 font-bold line-clamp-2 mt-1 drop-shadow-md">{a.cleanBody}</p>
                            </motion.div>
                          </AnimatePresence>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 self-end md:self-center">
                        {announcements.length > 1 && (
                          <div className="flex flex-col gap-1.5">
                            {announcements.map((_, i) => (
                              <div key={i} className={cn("size-1 rounded-full transition-all duration-500", i === annIndex % announcements.length ? "h-4 bg-gold-primary shadow-[0_0_8px_rgba(212,175,55,0.6)]" : "bg-white/20")} />
                            ))}
                          </div>
                        )}
                        <div className="size-10 md:size-14 rounded-full bg-gold-primary text-black flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xl"><ChevronLeft className="size-5 md:size-7" /></div>
                      </div>
                    </div>
                  </div>
                </Link>
              </section>
            );
          })()}

        <section className="px-4 animate-fade-up" style={{ animationDelay: "300ms" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <Link key={i} to={s.link} className="block group">
                <div className={cn("relative overflow-hidden rounded-[32px] p-8 text-white shadow-xl transition-all duration-500 hover:scale-[1.02]", s.color)}>
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">{s.icon}</div>
                  <div className="relative z-10 space-y-4"><p className="text-sm font-black uppercase tracking-widest opacity-80">{s.label}</p><div className="flex items-baseline gap-2"><span className="text-4xl font-black tracking-tighter"><AnimatedCounter value={s.value} /></span><span className="text-sm font-bold opacity-60">{s.suffix}</span></div></div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="px-4 pb-20 animate-fade-up" style={{ animationDelay: "400ms" }}>
          <div className="glass-surface p-10 md:p-16 border-dashed border-2 border-primary/20 rounded-[44px] flex flex-col md:flex-row items-center justify-between gap-10 text-center md:text-right relative overflow-hidden group">
            <div className="absolute inset-0 bg-rose-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-center md:justify-start gap-3 text-rose-500">
                <ShieldAlert className="size-6" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">الدعم الفني والتقني</span>
              </div>
              <h3 className="text-3xl font-black text-primary tracking-tight">هل واجهت عائقاً في النظام؟</h3>
              <p className="text-base md:text-lg font-bold text-muted-foreground opacity-80 max-w-xl">أبلغ فريق الإشراف عن أي ملاحظة برمجية لمساعدتنا في تطوير تجربة تليق بعائلة السيف.</p>
            </div>
            <button
              onClick={() => setShowBugReport(true)}
              className="px-12 py-5 rounded-[22px] bg-rose-500/10 text-rose-600 font-black text-sm border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all shadow-xl flex items-center gap-3 relative z-10 active:scale-95"
            >
              <ShieldAlert size={20} /> إرسال بلاغ فوري
            </button>
          </div>
        </section>

        {/* Initiatives Section */}
        <section className="px-4 space-y-8 animate-fade-up" style={{ animationDelay: "500ms" }}>
           <div className="flex items-center justify-between px-4">
              <div className="flex items-center gap-3 text-primary font-black uppercase tracking-widest text-xs">
                 <Lightbulb className="size-4 text-gold-primary" /> مبادرات السيف
              </div>
              <Link to="/majlis" className="text-[10px] font-black text-gold-primary uppercase tracking-widest hover:underline">+ قدم مبادرة جديدة</Link>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {initiatives.length > 0 ? initiatives.map((ini) => (
                <div key={ini.id} className="card-surface p-8 flex flex-col justify-between group hover:border-gold-primary/30 transition-all">
                   <div className="space-y-4">
                      <h4 className="text-lg font-black text-primary line-clamp-2">{ini.title.replace("[مبادرة]", "").trim()}</h4>
                      <p className="text-xs font-bold text-muted-foreground line-clamp-3 leading-relaxed">{ini.body}</p>
                   </div>
                   <div className="mt-8 pt-4 border-t border-border/40 flex items-center justify-between">
                      <span className="text-[9px] font-black text-primary/40 uppercase">{ini.author?.arabic_name || "عضو"}</span>
                      <button className="flex items-center gap-1.5 text-rose-500 bg-rose-500/5 px-3 py-1.5 rounded-full hover:bg-rose-500 hover:text-white transition-all">
                         <Heart size={12} fill="currentColor" />
                         <span className="text-[10px] font-black">أدعم الفكرة</span>
                      </button>
                   </div>
                </div>
              )) : (
                <div className="col-span-full py-16 text-center bg-muted/20 rounded-[40px] border-2 border-dashed text-muted-foreground italic text-sm">
                   لا توجد مبادرات نشطة حالياً. كن أول من يقترح!
                </div>
              )}
           </div>
        </section>
      </div>

      <AnimatePresence>
        {immersiveItem && (
          <ImmersiveView
            item={immersiveItem}
            onClose={() => setImmersiveItem(null)}
          />
        )}

        {showBugReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-card border border-border rounded-[32px] w-full max-w-lg p-8 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between"><h3 className="text-xl font-black text-primary">بلاغ عن خطأ بالنظام</h3><button onClick={() => setShowBugReport(false)} className="size-10 rounded-full bg-muted flex items-center justify-center"><X size={20} /></button></div>
              <div className="space-y-4">
                <textarea value={bugBody} onChange={(e) => setBugBody(e.target.value)} placeholder="صف الخطأ هنا..." rows={5} className="w-full p-6 rounded-2xl bg-muted/40 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all resize-none shadow-inner text-foreground" />
                <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border/60 rounded-3xl cursor-pointer hover:bg-primary/5 transition-all group/upload bg-muted/20">
                  {bugImagePreview ? <img src={bugImagePreview} className="h-32 w-full object-contain rounded-xl" alt="Preview" /> : <><ImageIcon className="size-8 text-muted-foreground opacity-30" /><span className="text-xs font-bold text-muted-foreground">لقطة شاشة</span></>}
                  <input type="file" hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setBugImage(f); setBugImagePreview(URL.createObjectURL(f)); } }} />
                </label>
              </div>
              <div className="flex gap-3"><button onClick={() => setShowBugReport(false)} className="flex-1 py-4 rounded-2xl font-black text-sm text-muted-foreground hover:bg-muted transition-all">إلغاء</button><button onClick={sendBugReport} disabled={bugSending || !bugBody.trim()} className="flex-[2] btn-gold py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50">{bugSending ? <Loader2 className="size-4 animate-spin" /> : <Send size={16} />} إرسال</button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
