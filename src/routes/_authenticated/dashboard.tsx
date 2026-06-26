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
  const [showBugReport, setShowBugReport] = useState(false);
  const [bugBody, setBugBody] = useState("");
  const [bugImage, setBugImage] = useState<File | null>(null);
  const [bugImagePreview, setBugImagePreview] = useState<string | null>(null);
  const [bugSending, setBugSending] = useState(false);
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

      supabase.from("trips").select("*", { count: "exact", head: true }).then((r) => setTripsCount(r.count || 0));
      supabase.from("profiles").select("*", { count: "exact", head: true }).then((r) => setMembersCount(r.count || 0));
      supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "done").then((r) => setTasksCount(r.count || 0));
      supabase.from("tasks").select("*", { count: "exact", head: true }).eq("assignee_id", u.id).neq("status", "done").then((r) => setMyTasksCount(r.count || 0));

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      supabase.from("majlis_posts").select("*", { count: "exact", head: true }).gt("created_at", yesterday).then((r) => setNewNewsCount(r.count || 0));

      const now = new Date().toISOString();
      supabase.from("meetings").select("*").gte("scheduled_at", now).order("scheduled_at").limit(2).then((r) => setUpcomingMeetings(r.data || []));
      supabase.from("trips").select("*").gte("start_date", now).order("start_date").limit(2).then((r) => setUpcomingTrips(r.data || []));

      const { data: annData } = await supabase
        .from("majlis_posts")
        .select("id, title, body, created_at, pinned")
        .eq("kind", "announcement")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);

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

      supabase.from("fund_transactions").select("amount, type").then((r) => {
        const bal = (r.data || []).reduce((acc, t) => {
          const val = Number(t.amount) || 0;
          return t.type === "contribution" ? acc + val : acc - val;
        }, 0);
        setFundBalance(bal);
      });

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
    } catch (err) {
      console.error("Dashboard error:", err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
    const parts = [];
    if (myTasksCount > 0) parts.push(`لديك ${myTasksCount} ${myTasksCount === 1 ? 'مهمة' : 'مهام'} بانتظارك`);
    if (newNewsCount > 0) parts.push(`هناك ${newNewsCount} ${newNewsCount === 1 ? 'خبر جديد' : 'أخبار جديدة'}`);

    if (parts.length === 0) return "نصل العائلة، نحفظ الإرث، ونبني المستقبل.";
    return parts.join(" و ") + ".";
  };

  const sendBugReport = async () => {
    if (!bugBody.trim()) return;
    setBugSending(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    let imageUrl = "";
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
    if (error) toast.error("تعذر إرسال البلاغ");
    else {
      toast.success("تم إرسال البلاغ للمشرفين بنجاح");
      setBugBody(""); setBugImage(null); setBugImagePreview(null); setShowBugReport(false);
    }
    setBugSending(false);
  };

  return (
    <AppShell title="لوحة العائلة" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-20">
        <section className="animate-fade-up">
          <div className="relative overflow-hidden rounded-[28px] md:rounded-[36px] border border-[var(--hero-pill-border)] bg-[var(--hero-card)] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.06)]">
            <div className="absolute left-0 top-0 bottom-0 w-1/3 md:w-1/4 pointer-events-none overflow-hidden opacity-[0.06] dark:opacity-[0.03]">
              <img src={palmWatermark} alt="" className="absolute -left-4 -bottom-4 h-[120%] md:h-[140%] w-auto max-w-none object-contain object-bottom saturate-[0.7] opacity-80" loading="lazy" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row items-center md:items-stretch gap-6 md:gap-10 p-6 md:p-10">
              <div className="shrink-0 order-1 flex items-center justify-center">
                <div className="relative group">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gold-primary/30 via-gold-primary/5 to-transparent blur-2xl group-hover:blur-3xl transition-all duration-700" />
                  <div className="relative size-28 md:size-40 rounded-full bg-[var(--hero-logo-badge)] border-[2px] border-gold-primary/25 dark:border-gold-primary/40 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.15)] flex items-center justify-center p-3 md:p-4">
                    <UserAvatar userId={profile.userId} path={profile.avatarPath} name={profile.name} className="size-full rounded-full" showBadges />
                    <div className="absolute inset-0 size-full logo-alsaif opacity-10 pointer-events-none" style={{ "--logo-url": `url(${dynamicLogo || alsaifMark.url})` } as any} />
                  </div>
                </div>
              </div>
              <div className="hidden md:flex flex-col items-center justify-center gap-2 self-stretch py-6 order-1">
                <div className="w-px flex-1 bg-[var(--hero-divider)]" />
                <div className="size-1.5 rounded-full bg-gold-primary shadow-[0_0_6px_rgba(142,119,69,0.4)]" />
                <div className="w-px flex-1 bg-[var(--hero-divider)]" />
              </div>
              <div className="flex-1 text-center md:text-right space-y-5 order-2">
                <div className="space-y-2">
                  <p className="text-gold-primary font-black uppercase tracking-[0.2em] text-[10px] md:text-xs opacity-80">{getGreeting()}،</p>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight text-foreground">{profile.name}</h2>
                  <p className="text-sm md:text-base text-muted-foreground font-bold opacity-70">{getStatusSummary()}</p>
                </div>
                <div className="inline-flex items-center gap-3 md:gap-4 rounded-full border border-[var(--hero-pill-border)] bg-[var(--hero-pill)] backdrop-blur-md px-4 md:px-6 py-2.5 md:py-3 shadow-sm mx-auto md:mx-0">
                  <div className="flex items-center gap-2 text-[#8E7745] dark:text-gold-primary">
                    <Calendar className="size-4 md:size-5" />
                    <span className="text-[11px] md:text-sm font-black text-foreground/80 tracking-wide"><LiveClock variant="date" /></span>
                  </div>
                  <div className="h-4 md:h-5 w-px bg-[var(--hero-divider)]" />
                  <div className="flex items-center gap-2 text-[#8E7745] dark:text-gold-primary">
                    <Clock className="size-4 md:size-5" />
                    <span className="text-[11px] md:text-sm font-black tabular-nums tracking-wider text-foreground/80"><LiveClock variant="time" /></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <QuickActionsBanner />

        {/* PREVIEW: Integrated Hub Idea #1 */}
        <IntegratedHub
          upcomingMeeting={upcomingMeetings[0]}
          upcomingTrip={upcomingTrips[0]}
          tasksCount={tasksCount}
        />

        {heritageSnippet && (
          <section className="px-4 animate-fade-up" style={{ animationDelay: "180ms" }}>
             <Link to="/heritage" className="block group">
                <div className="relative overflow-hidden rounded-[24px] bg-gold-primary/[0.03] border border-gold-primary/20 p-6 transition-all hover:bg-gold-primary/[0.06] hover:border-gold-primary/40">
                   <div className="flex items-center gap-4">
                      <div className="size-12 rounded-2xl bg-gold-primary/10 flex items-center justify-center shrink-0">
                         <Scroll className="size-6 text-gold-primary" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                         <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gold-primary/60">قبس من التاريخ</span>
                            <div className="h-px w-8 bg-gold-primary/20" />
                         </div>
                         <h3 className="text-base md:text-lg font-black text-primary truncate">{heritageSnippet.title}</h3>
                         <p className="text-xs md:text-sm font-bold text-muted-foreground line-clamp-1 italic opacity-80">"{heritageSnippet.cleanBody}"</p>
                      </div>
                      <ChevronLeft className="size-5 text-gold-primary opacity-40 group-hover:opacity-100 group-hover:-translate-x-1 transition-all shrink-0" />
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
                        <AnimatePresence mode="wait">
                          <motion.div key={a.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                            <h3 className="text-lg md:text-4xl font-black text-white tracking-tight leading-tight line-clamp-1 drop-shadow-lg">{a.title}</h3>
                            <p className="text-[11px] md:text-base text-white/70 font-bold line-clamp-2 mt-1 drop-shadow-md">{a.cleanBody}</p>
                          </motion.div>
                        </AnimatePresence>
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

        <section className="px-4 space-y-8 animate-fade-up" style={{ animationDelay: "200ms" }}>
          {upcomingTrips.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-[#8E7745] font-black uppercase tracking-widest text-xs px-6"><Plane className="size-4" /> الترفيه القادم</div>
              <Carousel plugins={[tripsPlugin.current]} className="w-full" orientation="vertical" onMouseEnter={tripsPlugin.current.stop} onMouseLeave={tripsPlugin.current.reset} opts={{ loop: true }}>
                <CarouselContent className="h-[350px] md:h-[450px]">
                  {upcomingTrips.map((trip) => {
                    const daysLeft = trip.start_date ? Math.ceil((new Date(trip.start_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;
                    return (
                      <CarouselItem key={trip.id} className="h-full">
                        <div className="flex items-center gap-0 h-full w-full group/container">
                          <article className="flex-1 relative overflow-hidden rounded-[32px] md:rounded-[48px] rounded-l-none md:rounded-l-none shadow-2xl border-2 border-gold-primary/20 border-l-0 text-white p-6 md:p-12 flex flex-col items-center justify-between h-full group">
                            <div className="absolute inset-0 z-0">
                              <TripImage path={trip.image_url} alt={trip.title} className="size-full object-cover object-center transition-transform duration-1000 group-hover:scale-110" />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#1a0f0a] via-[#1a0f0a]/70 to-transparent" />
                              <div className="absolute inset-0 bg-black/30" />
                            </div>
                            <div className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none z-1 transition-transform duration-1000 group-hover:scale-110 group-hover:opacity-40">
                              <div className="size-24 md:size-40 logo-alsaif-banner" style={{ "--logo-url": `url(${dynamicLogo || alsaifMark.url})` } as any} />
                            </div>
                            <div className="relative z-10 w-full flex justify-between items-start">
                              <div className="px-4 py-1.5 md:px-6 md:py-2.5 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md text-gold-primary text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em]">رحلة مرتقبة</div>
                              <div className="size-11 md:size-16 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-md flex items-center justify-center text-gold-primary animate-pulse"><Plane className="size-5 md:size-8" /></div>
                            </div>
                            <div className="relative z-10 space-y-3 md:space-y-5 text-center">
                              <h3 className="text-2xl md:text-6xl font-black bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent leading-tight drop-shadow-2xl px-4">{trip.title}</h3>
                              <div className="flex items-center justify-center gap-3 md:gap-5 text-xs md:text-base font-medium text-gold-primary"><span className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-1.5 md:px-6 md:py-2 rounded-full border border-white/5"><MapPin className="size-3.5 md:size-4" /> {trip.location || "وجهة عائلية"}</span></div>
                            </div>
                            <div className="relative z-10 w-full space-y-6 md:space-y-10 flex flex-col items-center">
                              <div className="flex items-center gap-6 md:gap-10">
                                <div className="text-center"><p className="text-[9px] md:text-[11px] uppercase tracking-widest opacity-60 mb-1">التاريخ</p><p className="text-lg md:text-2xl font-black">{trip.start_date ? new Date(trip.start_date).toLocaleDateString("ar-SA", { day: "numeric", month: "short" }) : "—"}</p></div>
                                <div className="h-8 md:h-12 w-px bg-white/20" /><div className="text-center"><p className="text-[9px] md:text-[11px] uppercase tracking-widest opacity-60 mb-1">اليوم</p><p className="text-lg md:text-2xl font-black">{trip.start_date ? new Date(trip.start_date).toLocaleDateString("ar-SA", { weekday: "long" }) : "—"}</p></div>
                              </div>
                              <Link to="/trips" className="group/btn relative px-8 py-3.5 md:px-12 md:py-5 overflow-hidden rounded-full font-black text-xs md:text-lg text-black transition-all hover:scale-105 active:scale-95 shadow-xl"><div className="absolute inset-0 bg-gold-primary" /><span className="relative flex items-center gap-3">تفاصيل الرحلة <Compass className="size-4 md:size-5" /></span></Link>
                            </div>
                          </article>
                          <div className="flex flex-col items-center justify-center w-20 md:w-36 h-full rounded-[32px] md:rounded-[48px] rounded-r-none md:rounded-r-none bg-gradient-to-b from-[#2C1810] to-[#1a0f0a] border-2 border-gold-primary/30 shadow-2xl p-4 md:p-8 text-center space-y-2 md:space-y-4 shrink-0 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gold-primary/5 animate-pulse" /><Timer className="size-5 md:size-8 text-gold-primary relative z-10" />
                            <div className="space-y-0 relative z-10"><span className="text-3xl md:text-6xl font-black text-gold-primary block tracking-tighter">{daysLeft > 0 ? daysLeft : 0}</span><span className="text-[7px] md:text-[11px] font-black text-gold-primary/50 uppercase tracking-[0.2em]">أيام متبقية</span></div>
                            <div className="w-8 md:w-16 h-0.5 md:h-1 bg-gold-primary/20 rounded-full relative z-10" /><p className="text-[7px] md:text-[11px] font-bold text-white/40 leading-relaxed relative z-10 line-clamp-2">تجهّز للمغامرة</p>
                          </div>
                        </div>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
              </Carousel>
            </div>
          )}

          {upcomingMeetings.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-primary font-black uppercase tracking-widest text-xs px-6"><CalendarDays className="size-4" /> الاجتماعات المرتقبة</div>
              <Carousel plugins={[meetingsPlugin.current]} className="w-full" onMouseEnter={meetingsPlugin.current.stop} onMouseLeave={meetingsPlugin.current.reset} opts={{ direction: "rtl", loop: true }}>
                <CarouselContent>
                  {upcomingMeetings.map((meeting) => {
                    const daysLeft = Math.ceil((new Date(meeting.scheduled_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <CarouselItem key={meeting.id}>
                        <div className="flex items-center gap-0 h-full w-full group/container">
                          <article className="flex-1 relative overflow-hidden rounded-[32px] md:rounded-[60px] rounded-l-none md:rounded-l-none shadow-2xl border-4 border-white/5 border-l-0 bg-gradient-to-br from-primary via-[#1a2b3c] to-black text-white p-6 md:p-16 flex flex-col justify-center h-full group">
                            <div className="absolute left-4 md:left-10 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none z-1 transition-transform duration-1000 group-hover:scale-110 group-hover:opacity-40">
                              <div className="size-28 md:size-64 logo-alsaif-banner" style={{ "--logo-url": `url(${dynamicLogo || alsaifMark.url})` } as any} />
                            </div>
                            <div className="absolute top-0 right-0 size-64 bg-gold-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
                            <div className="space-y-4 md:space-y-8 relative z-10 w-full">
                              <div className="flex items-center gap-3"><div className="h-0.5 w-6 md:w-12 bg-gold-primary shadow-[0_0_10px_rgba(212,175,55,0.6)]" /><span className="text-[9px] md:text-xs font-black uppercase tracking-[0.3em] text-gold-primary">حدث عائلي قريب</span></div>
                              <h3 className="text-2xl md:text-7xl font-black tracking-tighter leading-tight drop-shadow-2xl">{meeting.title}</h3>
                              <div className="flex items-center gap-3 md:gap-5 text-white/60 font-bold text-xs md:text-lg"><Clock className="size-4 md:size-6 text-gold-primary" /><span>{new Date(meeting.scheduled_at).toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long" })}</span></div>
                              <Link to="/meetings" className="btn-gold px-8 py-3.5 md:px-14 md:py-6 rounded-full font-black inline-flex items-center justify-center gap-3 shadow-2xl shadow-gold-primary/20 hover:scale-105 active:scale-95 transition-all text-xs md:text-xl w-full md:w-fit">تأكيد الحضور <ChevronLeft className="size-4 md:size-6" /></Link>
                            </div>
                          </article>
                          <div className="flex flex-col items-center justify-center w-20 md:w-48 h-full rounded-[32px] md:rounded-[60px] rounded-r-none md:rounded-r-none bg-gradient-to-b from-[#1a2b3c] to-black border-4 border-white/5 border-r-0 shadow-2xl p-4 md:p-12 text-center space-y-2 md:space-y-4 shrink-0 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gold-primary/5 animate-pulse" /><Timer className="size-5 md:size-12 text-gold-primary relative z-10" />
                            <div className="space-y-0 relative z-10"><p className="text-3xl md:text-8xl font-black tracking-tighter text-white block">{daysLeft > 0 ? daysLeft : 0}</p><p className="text-[7px] md:text-xs font-black uppercase tracking-widest text-white/40">أيام متبقية</p></div>
                            <div className="w-8 md:w-16 h-0.5 md:h-1 bg-gold-primary/20 rounded-full relative z-10" />
                          </div>
                        </div>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
              </Carousel>
            </div>
          )}
        </section>

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
          <div className="card-surface p-8 md:p-12 border-dashed border-2 border-primary/20 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-right">
            <div className="space-y-2"><div className="flex items-center justify-center md:justify-start gap-2 text-rose-500"><ShieldAlert className="size-5" /><span className="text-xs font-black uppercase tracking-widest">الدعم الفني</span></div><h3 className="text-2xl font-black text-primary">هل واجهت مشكلة في النظام؟</h3><p className="text-sm font-bold text-muted-foreground opacity-70">أبلغ المشرفين عن أي أخطاء برمجية لمساعدتنا في تحسين تجربتك.</p></div>
            <button onClick={() => setShowBugReport(true)} className="px-10 py-4 rounded-2xl bg-rose-500/10 text-rose-600 font-black text-sm border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all shadow-sm flex items-center gap-2"><ShieldAlert size={18} /> إرسال بلاغ عن خطأ</button>
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
        {showBugReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white dark:bg-card border border-border rounded-[32px] w-full max-w-lg p-8 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between"><h3 className="text-xl font-black text-primary">بلاغ عن خطأ بالنظام</h3><button onClick={() => setShowBugReport(false)} className="size-10 rounded-full bg-muted flex items-center justify-center"><X size={20} /></button></div>
              <div className="space-y-4">
                <textarea value={bugBody} onChange={(e) => setBugBody(e.target.value)} placeholder="صف الخطأ هنا..." rows={5} className="w-full p-6 rounded-2xl bg-muted/40 border border-border font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all resize-none shadow-inner" />
                <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border/60 rounded-3xl cursor-pointer hover:bg-primary/5 transition-all group/upload">
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
