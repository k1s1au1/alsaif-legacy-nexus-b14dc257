import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import {
  Clock,
  MapPin,
  ChevronLeft,
  Wallet,
  Users,
  CalendarDays,
  ListChecks,
  Plane,
  Loader2,
  Calendar,
  Newspaper,
  Scroll,
  ShieldAlert,
  Send,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import palmWatermark from "@/assets/palm-watermark.png";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { LiveClock } from "@/components/dashboard/live-clock";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useUserRole } from "@/hooks/use-user-role";
import { IntegratedHub } from "@/components/dashboard/integrated-hub";
import { PollsPopup } from "@/components/dashboard/polls-popup";
import { ActivePolls } from "@/components/dashboard/active-polls";
import { showIsland } from "@/components/dynamic-island";
import { QuickActionsBanner } from "@/components/quick-actions-banner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  component: Dashboard,
});

function Dashboard() {
  const { userId: meId, isLoading: authLoading } = useUserRole();
  const [profile, setProfile] = useState<any>(null);
  const [counts, setCounts] = useState({ members: 0, balance: 0, tasks: 0, trips: 0 });
  const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);
  const [upcomingTrips, setUpcomingTrips] = useState<any[]>([]);
  const [heritageSnippet, setHeritageSnippet] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [annIndex, setAnnIndex] = useState(0);
  const [showBugReport, setShowBugReport] = useState(false);
  const [bugBody, setBugBody] = useState("");
  const [bugImage, setBugImage] = useState<File | null>(null);
  const [bugImagePreview, setBugImagePreview] = useState<string | null>(null);
  const [bugSending, setBugSending] = useState(false);

  const dynamicLogo = useSiteLogo();
  const hasGreeted = useRef(false);

  const loadData = useCallback(async () => {
    if (!meId) return;
    try {
      const now = new Date().toISOString();
      const [{ data: p }, { data: mCount }, { data: tx }, { data: tCount }, { data: meetings }, { data: trips }, { data: news }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", meId).maybeSingle(),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("fund_transactions").select("amount, type"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
        supabase.from("meetings").select("*").gte("scheduled_at", now).order("scheduled_at").limit(5),
        supabase.from("trips").select("*").gte("start_date", now).order("start_date").limit(5),
        supabase.from("majlis_posts").select("*").order("created_at", { ascending: false }).limit(20)
      ]);

      if (p) setProfile(p);

      const bal = (tx || []).reduce((acc, t) => t.type === "contribution" ? acc + Number(t.amount) : acc - Number(t.amount), 0);
      setCounts({ members: mCount.count || 0, balance: bal, tasks: tCount.count || 0, trips: trips?.length || 0 });
      setUpcomingMeetings(meetings || []);
      setUpcomingTrips(trips || []);

      // Filter and process announcements
      if (news) {
        const filtered = news.filter((n: any) =>
          n.kind === 'announcement' || n.body?.includes('---kind:announcement')
        );

        const withImages = await Promise.all(
          filtered.map(async (a: any) => {
            const imgMatch = a.body.match(/^---image:(.*)\n/);
            let url = null;
            if (imgMatch) {
              try {
                const path = imgMatch[1].trim();
                const { data } = await supabase.storage.from("trip-images").createSignedUrl(path, 60 * 60);
                url = data?.signedUrl;
              } catch {}
            }
            return {
              ...a,
              imageUrl: url,
              cleanBody: (a.body || "").replace(/^---image:.*\n/, "").replace(/^---kind:.*\n/, "").replace(/---poll:.*?---/s, "").trim(),
            };
          }),
        );
        setAnnouncements(withImages.filter(a => a.cleanBody));
      }

      // Dynamic Island Greeting and Polls Check
      const pollPosts = news?.filter((p: any) => p.body?.includes("---poll:"));
      let pendingPolls = 0;
      if (pollPosts && pollPosts.length > 0) {
        const { data: myVotes } = await supabase.from("majlis_comments").select("post_id").eq("author_id", meId).in("post_id", pollPosts.map(p => p.id)).like("body", "[VOTE]:%");
        const votedIds = new Set((myVotes || []).map(v => v.post_id));
        pendingPolls = pollPosts.filter(p => !votedIds.has(p.id)).length;
      }

      if (!hasGreeted.current) {
        if (pendingPolls > 0) {
          showIsland(`لديك ${pendingPolls} اقتراح بانتظار تصويتك`, "info", 8000, () => window.dispatchEvent(new CustomEvent("polls:open")));
        } else {
          showIsland(`طاب يومك يا ${p?.arabic_name?.split(' ')[0] || "عضو السيف"}`, "info", 3000);
        }
        hasGreeted.current = true;
      }

      // Heritage Snippet
      const heritage = news?.find((p: any) => p.title?.includes("[إرث]"));
      if (heritage) {
        setHeritageSnippet({
          title: heritage.title.replace("[إرث]", "").trim(),
          body: heritage.body.replace(/---kind:.*\n/, "").replace(/---image:.*\n/, "").trim()
        });
      }
    } catch (e) { console.error(e); }
  }, [meId]);

  useEffect(() => {
    loadData();
    const ch = supabase.channel('dash-rt-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'majlis_comments' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'majlis_posts' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadData]);

  useEffect(() => {
    if (announcements.length < 2) return;
    const t = setInterval(() => setAnnIndex((p) => (p + 1) % announcements.length), 10000);
    return () => clearInterval(t);
  }, [announcements.length]);

  const sendBugReport = async () => {
    if (!bugBody.trim() || !meId) return;
    setBugSending(true);
    try {
      let imageUrl = null;
      if (bugImage) {
        const ext = bugImage.name.split(".").pop();
        const path = `bugs/${meId}/${crypto.randomUUID()}.${ext}`;
        await supabase.storage.from("trip-images").upload(path, bugImage);
        const { data: sign } = await supabase.storage.from("trip-images").createSignedUrl(path, 60 * 60 * 24 * 365);
        imageUrl = sign?.signedUrl;
      }
      await supabase.from("bug_reports" as any).insert({ reporter_id: meId, body: bugBody.trim(), image_url: imageUrl });
      toast.success("تم إرسال البلاغ بنجاح");
      setBugBody(""); setBugImage(null); setBugImagePreview(null); setShowBugReport(false);
    } catch { toast.error("تعذر الإرسال"); }
    finally { setBugSending(false); }
  };

  if (authLoading && !profile) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <AppShell title="لوحة العائلة" user={{ name: profile?.arabic_name || "عضو", role: "عضو المجلس", initial: "ع" } as any}>
      <div className="max-w-6xl mx-auto space-y-10 pb-24 px-4 md:px-0" dir="rtl">

        {/* Personalized Hero Section */}
        <section className="animate-fade-up">
           <div className="relative overflow-hidden rounded-[44px] glass-surface p-8 md:p-14 shadow-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="absolute left-0 top-0 bottom-0 w-1/3 opacity-[0.03] pointer-events-none overflow-hidden">
                <img src={palmWatermark} alt="" className="h-full object-contain object-left-bottom" />
              </div>

              <div className="relative z-10 flex-1 text-center md:text-right space-y-8">
                 <div className="space-y-3">
                    <p className="text-gold-primary font-black uppercase tracking-[0.4em] text-[10px] md:text-xs">طاب يومك،</p>
                    <h2 className="text-5xl md:text-8xl font-black tracking-tighter text-primary leading-tight">
                       {profile?.arabic_name?.split(' ').slice(0, 3).join(' ') || "عضو عائلة السيف"}
                    </h2>
                    <p className="text-muted-foreground font-bold text-lg md:text-2xl opacity-60">نصل العائلة، نحفظ الإرث، ونبني المجتمع.</p>
                 </div>

                 <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                    <div className="inline-flex items-center gap-4 rounded-full bg-white/5 border border-white/10 pl-6 pr-4 py-3 shadow-xl backdrop-blur-xl">
                       <Calendar className="size-5 text-gold-primary" />
                       <span className="font-black text-sm text-foreground"><LiveClock variant="date" /></span>
                    </div>
                    <div className="inline-flex items-center gap-4 rounded-full bg-white/5 border border-white/10 pl-6 pr-4 py-3 shadow-xl backdrop-blur-xl">
                       <Clock className="size-5 text-gold-primary" />
                       <span className="font-black text-sm text-foreground"><LiveClock variant="time" /></span>
                    </div>
                 </div>
              </div>

              <div className="relative shrink-0 group">
                 <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-1000" />
                 <div className="size-48 md:size-72 rounded-full p-2 bg-gradient-to-br from-gold-primary/30 via-transparent to-primary/30 relative z-10">
                    <div className="size-full rounded-full bg-card p-1 shadow-2xl ring-4 ring-white/5 overflow-hidden">
                       <UserAvatar
                          path={profile?.avatar_url}
                          name={profile?.arabic_name}
                          className="size-full object-cover scale-110 group-hover:scale-125 transition-transform duration-1000"
                          userId={meId}
                       />
                    </div>
                 </div>
              </div>
           </div>
        </section>

        <QuickActionsBanner />
        <PollsPopup userId={meId ?? null} />
        <ActivePolls userId={meId ?? null} />

        {/* Announcements Banner Section */}
        {announcements.length > 0 && (
          <section className="animate-fade-up px-2">
             <Link to="/majlis" className="block group">
                <div className="relative overflow-hidden rounded-[40px] border border-gold-primary/30 bg-gradient-to-br from-primary via-emerald-950 to-black shadow-2xl min-h-[140px] md:min-h-[180px] flex items-center p-8 md:p-14">
                   {announcements[annIndex].imageUrl && (
                      <div className="absolute inset-0 z-0">
                         <img src={announcements[annIndex].imageUrl} className="size-full object-cover opacity-20 group-hover:scale-105 transition-transform duration-[2000ms]" alt="" />
                         <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-transparent" />
                      </div>
                   )}
                   <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8 w-full">
                      <div className="flex flex-col md:flex-row items-center gap-8">
                         <div className="size-16 md:size-24 rounded-3xl bg-gold-primary/20 backdrop-blur-xl border border-gold-primary/30 flex items-center justify-center text-gold-primary shrink-0 shadow-2xl group-hover:rotate-12 transition-transform duration-500">
                            <Newspaper size={40} />
                         </div>
                         <div className="text-center md:text-right space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gold-primary shadow-sm">إعلان المجلس</span>
                            <h3 className="text-2xl md:text-5xl font-black text-white leading-tight drop-shadow-lg">{announcements[annIndex].title}</h3>
                            <p className="text-white/70 font-bold text-sm md:text-xl line-clamp-2 max-w-3xl">{announcements[annIndex].cleanBody}</p>
                         </div>
                      </div>
                      <ChevronLeft className="size-10 text-gold-primary/40 group-hover:text-gold-primary group-hover:-translate-x-3 transition-all duration-500" />
                   </div>
                </div>
             </Link>
          </section>
        )}

        <IntegratedHub upcomingMeetings={upcomingMeetings} upcomingTrips={upcomingTrips} tasksCount={counts.tasks} />

        {/* Stats Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
           <StatCard label="رصيد الصندوق" value={counts.balance} suffix="ر.س" color="from-emerald-700 to-emerald-950" icon={<Wallet className="size-16" />} link="/finance" />
           <StatCard label="أفراد العائلة" value={counts.members} suffix="عضو" color="from-primary to-[#032d22]" icon={<Users className="size-16" />} link="/members" />
           <StatCard label="ترفيه عائلي" value={counts.trips} suffix="وجهة" color="from-[#8E7745] to-[#453a22]" icon={<Plane className="size-16" />} link="/trips" />
           <StatCard label="مهام معلقة" value={counts.tasks} suffix="مهمة" color="from-rose-800 to-rose-950" icon={<ListChecks className="size-16" />} link="/tasks" />
        </section>

        {heritageSnippet && (
          <Link to="/heritage" className="block group animate-fade-up">
             <div className="card-surface p-10 flex flex-col md:flex-row md:items-center justify-between gap-10 hover:scale-[1.01] transition-all duration-500">
                <div className="flex items-center gap-8">
                   <div className="size-20 rounded-3xl bg-gold-primary/10 flex items-center justify-center text-gold-primary shadow-2xl ring-1 ring-gold-primary/20"><Scroll size={40} /></div>
                   <div className="space-y-1">
                      <span className="text-[10px] font-black text-gold-primary uppercase tracking-[0.4em]">قبس من التاريخ</span>
                      <h3 className="text-2xl md:text-3xl font-black text-primary">{heritageSnippet.title}</h3>
                      <p className="text-base md:text-xl font-bold text-muted-foreground line-clamp-1 opacity-70 italic leading-relaxed">"{heritageSnippet.body}"</p>
                   </div>
                </div>
                <ChevronLeft className="text-gold-primary opacity-20 group-hover:opacity-100 group-hover:-translate-x-4 transition-all duration-500 size-8" />
             </div>
          </Link>
        )}

        {/* Technical Support Section */}
        <section className="pb-24 animate-fade-up">
           <div className="glass-surface p-12 md:p-20 border-dashed border-2 border-primary/20 rounded-[50px] flex flex-col md:flex-row items-center justify-between gap-12 text-center md:text-right">
              <div className="space-y-4">
                 <div className="flex items-center justify-center md:justify-start gap-4 text-rose-500">
                    <ShieldAlert className="size-8" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em]">فريق الدعم التقني</span>
                 </div>
                 <h3 className="text-3xl md:text-5xl font-black text-primary tracking-tighter">واجهت مشكلة في النظام؟</h3>
                 <p className="text-lg md:text-2xl font-bold text-muted-foreground opacity-60 max-w-2xl">نحن هنا لخدمتكم. أبلغ عن أي عائق برمجي لمساعدتنا في تحسين تجربتكم الرقمية.</p>
              </div>
              <button onClick={() => setShowBugReport(true)} className="px-14 py-6 rounded-[30px] bg-rose-500/10 text-rose-600 font-black text-lg border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all shadow-2xl flex items-center gap-4 hover:scale-105 active:scale-95">
                 <ShieldAlert size={28} /> إرسال بلاغ فوري
              </button>
           </div>
        </section>
      </div>

      <AnimatePresence>
        {showBugReport && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl" dir="rtl">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card border border-white/10 rounded-[50px] w-full max-w-2xl p-10 md:p-14 space-y-8 shadow-[0_0_100px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between"><h3 className="text-3xl font-black text-primary">بلاغ فني</h3><button onClick={() => setShowBugReport(false)} className="size-14 rounded-full bg-muted flex items-center justify-center hover:rotate-90 transition-transform"><X size={28} /></button></div>
              <div className="space-y-6">
                <textarea value={bugBody} onChange={(e) => setBugBody(e.target.value)} placeholder="صف المشكلة هنا..." rows={6} className="w-full p-8 rounded-[35px] bg-muted/40 border border-border/60 font-bold text-lg focus:outline-none focus:border-primary transition-all resize-none shadow-inner" />
                <label className="flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed border-border/60 rounded-[35px] cursor-pointer hover:bg-primary/5 transition-all bg-muted/20">
                  {bugImagePreview ? <img src={bugImagePreview} className="h-48 object-contain rounded-2xl" alt="Preview" /> : <><ImageIcon className="size-12 text-muted-foreground opacity-30" /><span className="text-sm font-bold text-muted-foreground">إرفاق لقطة شاشة للخطأ</span></>}
                  <input type="file" hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setBugImage(f); setBugImagePreview(URL.createObjectURL(f)); } }} />
                </label>
              </div>
              <div className="flex gap-4"><button onClick={() => setShowBugReport(false)} className="flex-1 py-5 rounded-[25px] font-black text-muted-foreground hover:bg-muted transition-all">تراجع</button><button onClick={sendBugReport} disabled={bugSending || !bugBody.trim()} className="flex-[2] btn-gold py-5 rounded-[25px] font-black flex items-center justify-center gap-4 text-lg">{bugSending ? <Loader2 className="animate-spin size-6" /> : <Send size={24} />} إرسال البلاغ</button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function StatCard({ label, value, suffix, color, icon, link }: any) {
  return (
    <Link to={link} className="block group">
       <div className={cn("relative overflow-hidden rounded-[36px] p-8 md:p-10 text-white shadow-2xl transition-all duration-700 hover:scale-[1.04] bg-gradient-to-br", color)}>
          <div className="absolute -top-4 -right-4 opacity-10 group-hover:opacity-20 group-hover:rotate-12 transition-all duration-700">{icon}</div>
          <div className="relative z-10 space-y-5">
             <p className="text-xs md:text-sm font-black uppercase tracking-[0.2em] opacity-70">{label}</p>
             <div className="flex items-baseline gap-3">
                <span className="text-4xl md:text-6xl font-black tabular-nums tracking-tighter">{new Intl.NumberFormat("ar-SA").format(value)}</span>
                <span className="text-[10px] md:text-xs font-black opacity-50 uppercase">{suffix}</span>
             </div>
          </div>
       </div>
    </Link>
  );
}
