import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, useRef, useMemo } from "react";
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
import { useUserRole, roleLabel } from "@/hooks/use-user-role";
import { TripImage } from "@/components/trip-image";
import { IntegratedHub } from "@/components/dashboard/integrated-hub";
import { PollsPopup } from "@/components/dashboard/polls-popup";
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xl p-0 md:p-10" dir="rtl">
      <motion.div initial={{ y: "100%", opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: "100%", opacity: 0, scale: 0.9 }} transition={{ type: "spring", damping: 30, stiffness: 200 }} className="bg-[#051410] w-full max-w-6xl h-full md:h-[90vh] rounded-t-[40px] md:rounded-[60px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.6)] flex flex-col relative border border-white/10">
        <button onClick={onClose} className="absolute top-6 left-6 z-30 size-12 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-red-500 transition-all border border-white/10 group">
          <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
        <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
           <div className="relative h-[300px] md:h-[450px] shrink-0">
              {type === 'trip' ? <TripImage path={data.image_url} alt={data.title} className="size-full object-cover" /> : <div className="size-full bg-gradient-to-br from-[#064E3B] via-[#051410] to-black flex items-center justify-center">{type === 'meeting' ? <CalendarDays className="size-32 text-gold-primary opacity-10" /> : <Newspaper className="size-32 text-gold-primary opacity-10" />}</div>}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                 <div className="flex items-center gap-5 bg-white/5 p-6 rounded-[28px] border border-white/5">
                    <div className="size-14 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary border border-gold-primary/20 shadow-xl"><Clock size={28} /></div>
                    <div>
                       <p className="text-[10px] font-black uppercase opacity-40 mb-1">الموعد والتاريخ</p>
                       <p className="text-base md:text-xl font-black text-white">{new Date(data.start_date || data.scheduled_at || data.created_at).toLocaleDateString("ar-SA", { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    </div>
                 </div>
                 {data.location && <div className="flex items-center gap-4 bg-white/5 p-4 rounded-[20px] border border-white/5"><div className="size-10 rounded-xl bg-gold-primary/10 flex items-center justify-center text-gold-primary border border-gold-primary/20 shadow-xl"><MapPin size={20} /></div><div><p className="text-[8px] font-black uppercase opacity-60 mb-0.5">الموقع / المكان</p><p className="text-sm md:text-base font-black text-white">{data.location}</p></div></div>}
              </div>
              <div className="space-y-6"><div className="flex items-center gap-3"><div className="h-px flex-1 bg-white/10" /><h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">تفاصيل الحدث</h4><div className="h-px flex-1 bg-white/10" /></div><p className="text-lg md:text-2xl font-bold text-white/70 leading-relaxed text-right md:text-justify whitespace-pre-wrap">{data.description || data.cleanBody || data.body || "لا توجد تفاصيل إضافية لهذا الحدث حالياً."}</p></div>
              <div className="pt-10 flex flex-col md:flex-row gap-4">
                 {type === 'trip' && <Link to="/trips/$tripId" params={{ tripId: data.id }} className="btn-gold py-6 px-12 rounded-full font-black text-xl text-center flex-1 shadow-[0_15px_40px_-5px_rgba(139,107,35,0.4)] hover:scale-[1.02] transition-transform">فتح صفحة الترفيه</Link>}
                 {type === 'meeting' && <Link to="/meetings" className="btn-gold py-6 px-12 rounded-full font-black text-xl text-center flex-1 shadow-[0_15px_40px_-5px_rgba(139,107,35,0.4)] hover:scale-[1.02] transition-transform">تأكيد الحضور</Link>}
                 {type === 'news' && <Link to="/majlis" className="btn-gold py-6 px-12 rounded-full font-black text-xl text-center flex-1 shadow-[0_15px_40px_-5px_rgba(139,107,35,0.4)] hover:scale-[1.02] transition-transform">فتح في الأخبار</Link>}
                 <button onClick={onClose} className="py-6 px-12 rounded-full bg-white/5 text-white font-black text-xl hover:bg-white/10 transition-all border border-white/10">إغلاق العرض</button>
              </div>
           </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Dashboard() {
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

      const now = new Date().toISOString();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [{ data: p }, { data: r }, { count: mCount }, { count: tCount }, { count: myTCount }, { count: newsCount }, { data: meetings }, { data: trips }, { data: posts }, { data: tx }] = await Promise.all([
        supabase.from("profiles").select("arabic_name, full_name, avatar_url").eq("id", u.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.id),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assignee_id", u.id).neq("status", "done"),
        supabase.from("majlis_posts").select("id", { count: "exact", head: true }).gt("created_at", yesterday),
        supabase.from("meetings").select("*").gte("scheduled_at", now).order("scheduled_at").limit(5),
        supabase.from("trips").select("*").gte("start_date", now).order("start_date").limit(5),
        supabase.from("majlis_posts").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("fund_transactions").select("amount, type")
      ]);

      const name = p?.arabic_name || p?.full_name || u.email?.split("@")[0] || "عضو العائلة";
      const rs = (r ?? []).map(x => x.role);
      setProfile({ name, role: rs.includes("admin") ? "مسؤول تقني" : rs.includes("chairman") ? "رئيس المجلس" : "عضو الأخبار", initial: (name[0] || "ع").toUpperCase(), avatarPath: p?.avatar_url ?? null, userId: u.id });
      setCounts({ trips: trips?.length || 0, members: mCount || 0, tasks: tCount || 0, myTasks: myTCount || 0, newNews: newsCount || 0 });
      setUpcomingMeetings(meetings || []);
      setUpcomingTrips(trips || []);

      if (tx) setFundBalance(tx.reduce((acc, t) => t.type === "contribution" ? acc + Number(t.amount) : acc - Number(t.amount), 0));

      // Shura Integration
      const pollPosts = posts?.filter(p => p.body?.includes("---poll:"));
      if (pollPosts?.length && !hasGreeted.current) {
        const { data: myVotes } = await supabase.from("majlis_comments").select("post_id").eq("author_id", u.id).in("post_id", pollPosts.map(p => p.id)).like("body", "[VOTE]:%");
        const pendingCount = pollPosts.filter(p => !(myVotes || []).some(v => v.post_id === p.id)).length;
        if (pendingCount > 0) showIsland(`لديك ${pendingCount} اقتراح بانتظار تصويتك`, "info", 8000, () => window.dispatchEvent(new CustomEvent("polls:open")));
        else showIsland(`طاب يومك يا ${name.split(' ')[0]}`, "info", 3000);
        hasGreeted.current = true;
      } else if (!hasGreeted.current) {
        showIsland(`طاب يومك يا ${name.split(' ')[0]}`, "info", 3000);
        hasGreeted.current = true;
      }

      if (posts) {
        const annList = posts.filter(p => (p.kind === 'announcement' || p.body?.includes('---kind:announcement')) && !p.body?.includes('---poll:')).slice(0, 5);
        const processedAnns = await Promise.all(annList.map(async (a) => {
          const imgMatch = a.body.match(/^---image:(.*)\n/);
          let url = null;
          if (imgMatch) {
            const { data } = await supabase.storage.from("trip-images").createSignedUrl(imgMatch[1].trim(), 3600);
            url = data?.signedUrl;
          }
          return { ...a, imageUrl: url, cleanBody: a.body.replace(/^---image:.*\n/, "").replace(/^---kind:.*\n/, "").trim(), _label: a.kind === 'announcement' ? "إعلان المجلس" : "أخبار السيف" };
        }));
        setAnnouncements(processedAnns);

        const heritage = posts.find(p => p.title?.includes("[إرث]"));
        if (heritage) setHeritageSnippet({ ...heritage, title: heritage.title.replace("[إرث]", "").trim(), cleanBody: heritage.body.replace(/---kind:.*\n/, "").replace(/---image:.*\n/, "").trim() });
      }

      supabase.from("family_projects").select("*").eq("status", "approved").order("created_at", { ascending: false }).limit(5).then(async r => {
        const pj = r.data || [];
        if (!pj.length) return setActiveProjects([]);
        const { data: cs } = await supabase.from("family_project_contributions").select("project_id, amount").in("project_id", pj.map(p => p.id));
        const sums: Record<string, number> = {};
        (cs || []).forEach(c => sums[c.project_id] = (sums[c.project_id] || 0) + Number(c.amount));
        setActiveProjects(pj.map(p => {
          const raised = Number(p.fund_allocation) + (sums[p.id] || 0);
          return { ...p, raised, remaining: Math.max(0, Number(p.goal_amount) - raised), pct: Math.min(100, Math.round((raised / Number(p.goal_amount)) * 100)) };
        }));
      });
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (announcements.length < 2) return;
    const t = setInterval(() => setAnnIndex(p => (p + 1) % announcements.length), 7000);
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
    const t = setInterval(() => setStatusIndex(p => (p + 1) % statusMessages.length), 6000);
    return () => clearInterval(t);
  }, [statusMessages.length]);

  const stats = [
    { label: "رصيد الصندوق", value: fundBalance, suffix: "ر.س", color: "bg-gradient-to-br from-emerald-600 to-teal-900", icon: <Wallet className="size-16" />, link: "/finance" },
    { label: "أفراد العائلة", value: counts.members, suffix: "عضو", color: "bg-gradient-to-br from-primary to-emerald-950", icon: <Users className="size-16" />, link: "/members" },
    { label: "ترفيه عائلي", value: counts.trips, suffix: "وجهة", color: "bg-gradient-to-br from-[#8E7745] to-[#453a22]", icon: <Plane className="size-16" />, link: "/trips" },
    { label: "مهام قيد التنفيذ", value: counts.tasks, suffix: "مهمة", color: "bg-gradient-to-br from-rose-700 to-rose-950", icon: <ListChecks className="size-16" />, link: "/tasks" },
  ];

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) return "صباح الخير";
    if (hr >= 12 && hr < 17) return "مساء النور";
    if (hr >= 17 && hr < 21) return "مساء الخير";
    return "طاب مساؤك";
  };

  const getStatusSummary = () => {
    if (counts.myTasks > 0) return `لديك ${counts.myTasks} مسؤوليات بانتظار إنجازك.`;
    if (counts.newNews > 0) return `هناك ${counts.newNews} أخبار جديدة في مركز الأخبار.`;
    return "نصل العائلة، نحفظ الإرث، ونبني المستقبل.";
  };

  const sendBugReport = async () => {
    if (!bugBody.trim()) return;
    setBugSending(true);
    showIsland("جاري إرسال البلاغ...", "loading");
    try {
      let url = null;
      if (bugImage) {
        const path = `bugs/${profile.userId}/${crypto.randomUUID()}.${bugImage.name.split(".").pop()}`;
        await supabase.storage.from("trip-images").upload(path, bugImage);
        url = (await supabase.storage.from("trip-images").createSignedUrl(path, 31536000)).data?.signedUrl;
      }
      await supabase.from("bug_reports" as any).insert({ reporter_id: profile.userId, body: bugBody.trim(), image_url: url });
      showIsland("تم إرسال البلاغ بنجاح", "success");
      setShowBugReport(false); setBugBody(""); setBugImage(null); setBugImagePreview(null);
    } catch { showIsland("فشل الإرسال", "error"); }
    finally { setBugSending(false); }
  };

  return (
    <AppShell title="لوحة العائلة" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-20 px-4 md:px-0">

        {/* DECORATED ROYAL HERO SECTION */}
        <section className="animate-fade-up">
          <div className="relative overflow-hidden rounded-[40px] bg-[#064E3B] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] border border-white/10 group">

            {/* 1. Full-Background Islamic Geometric Pattern Overlay */}
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none mix-blend-overlay"
                 style={{
                   backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l15 30H15zM30 60L15 30h30zM0 30l30-15v30zM60 30L30 45V15z' fill='%23D4AF37' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
                   backgroundSize: '30px 30px'
                 }}
            />

            {/* 2. Traditional Corner Ornaments (Top-Right & Bottom-Left) */}
            <div className="absolute top-0 right-0 size-32 md:size-48 opacity-[0.15] pointer-events-none">
               <svg viewBox="0 0 100 100" className="size-full fill-gold-primary">
                  <path d="M100,0 L100,25 Q100,0 75,0 L100,0 Z M100,45 L100,50 Q100,40 95,40 L90,40 Q100,40 100,30 L100,45 Z" />
                  <circle cx="96" cy="4" r="1.5" />
               </svg>
            </div>
            <div className="absolute bottom-0 left-0 size-32 md:size-48 opacity-[0.15] pointer-events-none rotate-180">
               <svg viewBox="0 0 100 100" className="size-full fill-gold-primary">
                  <path d="M100,0 L100,25 Q100,0 75,0 L100,0 Z M100,45 L100,50 Q100,40 95,40 L90,40 Q100,40 100,30 L100,45 Z" />
               </svg>
            </div>

            {/* 3. Premium Inner Embossed Frame */}
            <div className="absolute inset-[6px] rounded-[34px] border-2 border-gold-primary/20 pointer-events-none shadow-[inset_0_0_30px_rgba(212,175,55,0.05)]" />

            {/* Background Texture/Pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #D4AF37 1px, transparent 0)', backgroundSize: '24px 20px' }} />

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-14 p-8 md:p-14">
              {/* Left Side: Logo in Gold Circle */}
              <div className="shrink-0 flex items-center justify-center">
                 <div className="relative group/avatar">
                    <div className="absolute inset-0 rounded-full bg-gold-primary/10 blur-3xl animate-pulse group-hover/avatar:bg-gold-primary/20 transition-all duration-700" />
                    <div className="relative size-32 md:size-52 rounded-full border-[3px] border-gold-primary/40 p-2 bg-gradient-to-br from-gold-primary/20 to-transparent shadow-2xl transition-transform duration-700 group-hover/avatar:scale-[1.02]">
                       <div className="size-full rounded-full bg-[#fdfcf7] p-4 flex items-center justify-center shadow-inner overflow-hidden">
                          <div
                            className="size-full bg-contain bg-no-repeat bg-center"
                            style={{ backgroundImage: dynamicLogo ? `url(${dynamicLogo})` : "none" }}
                          />
                       </div>
                    </div>
                 </div>
              </div>

              {/* Middle/Center: Large Elegant Name */}
              <div className="flex-1 text-center md:text-right space-y-6">
                 <div className="space-y-3">
                    <div className="flex items-center justify-center md:justify-start gap-2">
                       <div className="size-1 w-6 bg-gold-primary rounded-full opacity-60" />
                       <p className="text-gold-primary font-black uppercase tracking-[0.4em] text-[9px] md:text-xs">
                          {getGreeting()}،
                       </p>
                    </div>
                    <h2 className="text-4xl sm:text-5xl md:text-8xl font-black tracking-tighter text-white drop-shadow-2xl">
                       {profile.name}
                    </h2>
                    <div className="flex items-center justify-center md:justify-start gap-3 text-white/50 font-bold text-sm md:text-xl">
                       <div className="h-px w-8 bg-gold-primary/30 hidden md:block" />
                       <div className="h-8 overflow-hidden relative w-full md:w-auto">
                          <AnimatePresence mode="wait">
                            <motion.p
                              key={statusIndex}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="leading-relaxed italic"
                            >
                               {statusMessages[statusIndex]}
                            </motion.p>
                          </AnimatePresence>
                       </div>
                    </div>
                 </div>

                 {/* New Unified Royal Date/Time Widget */}
                 <div className="flex items-center justify-center md:justify-start pt-8">
                    <div className="inline-flex items-center bg-black/40 backdrop-blur-2xl rounded-[28px] border border-white/10 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all hover:bg-black/50">
                       <div className="flex items-center gap-3 px-6 py-2.5 bg-gold-primary/10 rounded-[22px] border border-gold-primary/20">
                          <Clock className="size-4 text-gold-primary animate-pulse" />
                          <span className="text-xl md:text-3xl font-black tabular-nums tracking-tighter text-white drop-shadow-md">
                             <LiveClock variant="time" />
                          </span>
                       </div>
                       <div className="h-8 w-px bg-white/10 mx-2" />
                       <div className="flex items-center gap-3 px-6 py-2.5">
                          <Calendar className="size-4 text-white/30" />
                          <span className="text-[10px] md:text-sm font-black text-white/50 uppercase tracking-[0.2em] leading-none">
                             <LiveClock variant="date" />
                          </span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
          </div>
        </section>

        <QuickActionsBanner />
        <PollsPopup userId={profile.userId ?? null} />
        <IntegratedHub upcomingMeetings={upcomingMeetings} upcomingTrips={upcomingTrips} tasksCount={counts.tasks} onViewTrip={t => setImmersiveItem({ type: 'trip', data: t })} onViewMeeting={m => setImmersiveItem({ type: 'meeting', data: m })} />

        {heritageSnippet && (
          <section className="animate-fade-up px-4 md:px-0">
             <Link to="/heritage" className="block group card-surface p-8 transition-all hover:scale-[1.01]">
                <div className="flex items-center gap-6">
                   <div className="size-16 rounded-[22px] bg-gold-primary/10 flex items-center justify-center shrink-0 border border-gold-primary/20"><Scroll className="size-8 text-gold-primary" /></div>
                   <div className="min-w-0 flex-1 space-y-1">
                      <span className="text-[10px] font-black uppercase text-gold-primary/80">قبس من تاريخ السيف</span>
                      <h3 className="text-xl md:text-2xl font-black text-primary truncate">{heritageSnippet.title}</h3>
                      <p className="text-sm md:text-lg font-bold text-muted-foreground line-clamp-1 italic opacity-90 leading-relaxed">"{heritageSnippet.cleanBody}"</p>
                   </div>
                   <ChevronLeft className="size-6 text-gold-primary opacity-30 group-hover:opacity-100 group-hover:-translate-x-2 transition-all" />
                </div>
             </Link>
          </section>
        )}

        {announcements.length > 0 && (() => {
            const a = announcements[annIndex % announcements.length];
            return (
              <section className="animate-fade-up px-4 md:px-0">
                <Link to="/majlis" className="block group relative overflow-hidden rounded-[40px] border border-gold-primary/30 bg-gradient-to-br from-primary via-[#0d2620] to-black shadow-2xl min-h-[160px] flex items-center p-8 md:p-12">
                   {a.imageUrl && (
                      <div className="absolute inset-0 z-0">
                         <img src={a.imageUrl} className="size-full object-cover opacity-20 group-hover:scale-110 transition-transform" alt="" />
                         <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-transparent to-transparent" />
                      </div>
                   )}
                   <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8 w-full">
                      <div className="flex items-center gap-6">
                         <div className="size-16 md:size-24 rounded-3xl bg-gold-primary/20 backdrop-blur-xl border border-gold-primary/30 flex items-center justify-center text-gold-primary shrink-0 shadow-2xl group-hover:rotate-12 transition-transform duration-500">
                            <Newspaper size={40} />
                         </div>
                         <div className="text-center md:text-right space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary">{a._label}</span>
                            <h3 className="text-2xl md:text-4xl font-black text-white tracking-tight drop-shadow-lg">{a.title}</h3>
                            <p className="text-white/70 font-bold text-sm md:text-lg line-clamp-2 max-w-2xl">{a.cleanBody}</p>
                         </div>
                      </div>
                      <ChevronLeft className="size-10 text-gold-primary/40 group-hover:text-gold-primary group-hover:-translate-x-3 transition-all duration-500" />
                   </div>
                </Link>
              </section>
            );
        })()}

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-4 md:px-0">
           {stats.map((s, i) => (
             <Link key={i} to={s.link} className="block group">
                <div className={cn("relative overflow-hidden rounded-[32px] p-8 text-white shadow-xl transition-all duration-500 hover:scale-[1.02]", s.color)}>
                   <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">{s.icon}</div>
                   <div className="relative z-10 space-y-4"><p className="text-sm font-black uppercase tracking-widest opacity-80">{s.label}</p><div className="flex items-baseline gap-2"><span className="text-4xl font-black tracking-tighter"><AnimatedCounter value={s.value} /></span><span className="text-sm font-bold opacity-60">{s.suffix}</span></div></div>
                </div>
             </Link>
           ))}
        </section>

        <section className="pb-20 px-4 md:px-0 animate-fade-up">
           <div className="glass-surface p-10 md:p-16 border-dashed border-2 border-primary/20 rounded-[44px] flex flex-col md:flex-row items-center justify-between gap-10 text-center md:text-right relative overflow-hidden group">
              <div className="space-y-4 relative z-10">
                 <div className="flex items-center justify-center md:justify-start gap-3 text-rose-500"><ShieldAlert className="size-6" /><span className="text-[10px] font-black uppercase tracking-[0.3em]">الدعم الفني والتقني</span></div>
                 <h3 className="text-3xl font-black text-primary tracking-tight">هل واجهت عائقاً في النظام?</h3>
                 <p className="text-base md:text-lg font-bold text-muted-foreground opacity-80 max-w-xl">أبلغ فريق الإشراف عن أي ملاحظة برمجية لمساعدتنا في تطوير تجربة تليق بعائلة السيف.</p>
              </div>
              <button onClick={() => setShowBugReport(true)} className="px-12 py-5 rounded-[22px] bg-rose-500/10 text-rose-600 font-black text-sm border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all shadow-xl flex items-center gap-3 relative z-10"><ShieldAlert size={20} /> إرسال بلاغ فوري</button>
           </div>
        </section>
      </div>

      <AnimatePresence>
        {immersiveItem && <ImmersiveView item={immersiveItem} onClose={() => setImmersiveItem(null)} />}
        {showBugReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card border border-border rounded-[32px] w-full max-w-lg p-8 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between"><h3 className="text-xl font-black text-primary">بلاغ فني</h3><button onClick={() => setShowBugReport(false)} className="size-10 rounded-full bg-muted flex items-center justify-center"><X size={20} /></button></div>
              <div className="space-y-4">
                <textarea value={bugBody} onChange={e => setBugBody(e.target.value)} placeholder="صف المشكلة هنا..." rows={5} className="w-full p-6 rounded-2xl bg-muted/40 border border-border font-bold text-sm focus:outline-none focus:border-primary transition-all resize-none shadow-inner text-foreground" />
                <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border/60 rounded-3xl cursor-pointer hover:bg-primary/5 transition-all bg-muted/20">
                  {bugImagePreview ? <img src={bugImagePreview} className="h-32 object-contain rounded-xl" alt="" /> : <><ImageIcon className="size-8 text-muted-foreground opacity-30" /><span className="text-xs font-bold text-muted-foreground">لقطة شاشة</span></>}
                  <input type="file" hidden accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setBugImage(f); setBugImagePreview(URL.createObjectURL(f)); } }} />
                </label>
              </div>
              <div className="flex gap-3"><button onClick={() => setShowBugReport(false)} className="flex-1 py-4 rounded-2xl font-black text-muted-foreground hover:bg-muted transition-all">إلغاء</button><button onClick={sendBugReport} disabled={bugSending || !bugBody.trim()} className="flex-[2] btn-gold py-4 rounded-2xl font-black flex items-center justify-center gap-2">{bugSending ? <Loader2 className="animate-spin size-4" /> : <Send size={16} />} إرسال</button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
