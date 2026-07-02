import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
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
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import palmWatermark from "@/assets/palm-watermark.png";
import { useSiteLogo } from "@/hooks/use-site-logo";
import { LiveClock } from "@/components/dashboard/live-clock";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useUserRole } from "@/hooks/use-user-role";
import { IntegratedHub } from "@/components/dashboard/integrated-hub";
import { PollsPopup } from "@/components/dashboard/polls-popup";
import { showIsland, hideIsland } from "@/components/dynamic-island";
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
        supabase.from("majlis_posts").select("*").eq("kind", "announcement").order("created_at", { ascending: false }).limit(5)
      ]);

      if (p) setProfile(p);

      const bal = (tx || []).reduce((acc, t) => t.type === "contribution" ? acc + Number(t.amount) : acc - Number(t.amount), 0);
      setCounts({ members: mCount.count || 0, balance: bal, tasks: tCount.count || 0, trips: trips?.length || 0 });
      setUpcomingMeetings(meetings || []);
      setUpcomingTrips(trips || []);

      if (news) {
        const withImages = await Promise.all(
          news.map(async (a: any) => {
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
              cleanBody: a.body.replace(/^---image:.*\n/, "").replace(/^---kind:.*\n/, ""),
            };
          }),
        );
        setAnnouncements(withImages);
      }

      // Dynamic Island Greeting and Polls Check
      const { data: pollPosts } = await supabase.from("majlis_posts").select("id").like("body", "%---poll:%");
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
      const { data: heritage } = await supabase.from("majlis_posts").select("*").ilike("title", "[إرث]%").limit(1).maybeSingle();
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
    const ch = supabase.channel('dash-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'majlis_comments' }, () => {
        // If a vote happens, we might want to hide the island or update count
        // But we don't want to show greeting again if already greeted.
        // For now, let's just refresh counts silently.
        loadData();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadData]);

  useEffect(() => {
    if (announcements.length < 2) return;
    const t = setInterval(() => setAnnIndex((p) => (p + 1) % announcements.length), 8000);
    return () => clearInterval(t);
  }, [announcements.length]);

  const sendBugReport = async () => {
    if (!bugBody.trim() || !meId) return;
    setBugSending(true);
    showIsland("جاري إرسال البلاغ...", "loading");
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
      showIsland("تم إرسال البلاغ بنجاح", "success");
      setBugBody(""); setBugImage(null); setBugImagePreview(null); setShowBugReport(false);
    } catch { showIsland("تعذر الإرسال", "error"); }
    finally { setBugSending(false); }
  };

  if (authLoading && !profile) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <AppShell title="لوحة العائلة" user={{ name: profile?.arabic_name || "عضو", role: "عضو المجلس", initial: "ع" } as any}>
      <div className="max-w-6xl mx-auto space-y-12 pb-24 px-4 md:px-0" dir="rtl">

        {/* Main Hero Card */}
        <section className="animate-fade-up">
           <div className="relative overflow-hidden rounded-[44px] glass-surface p-8 md:p-14 shadow-2xl border border-white/10">
              <div className="absolute left-0 top-0 bottom-0 w-1/4 opacity-[0.05] pointer-events-none overflow-hidden">
                <img src={palmWatermark} alt="" className="h-full object-contain object-left-bottom" />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                 <div className="size-32 md:size-48 rounded-full bg-white/5 backdrop-blur-3xl border-2 border-gold-primary/20 flex items-center justify-center p-6 shadow-2xl">
                    <div className="size-full logo-alsaif" style={{ "--logo-url": dynamicLogo ? `url(${dynamicLogo})` : "none" } as any} />
                 </div>
                 <div className="flex-1 text-center md:text-right space-y-6">
                    <div className="space-y-2">
                       <p className="text-gold-primary font-black uppercase tracking-[0.4em] text-[10px] md:text-xs">طاب مساؤك،</p>
                       <h2 className="text-4xl md:text-7xl font-black tracking-tighter text-primary">{profile?.arabic_name || "عضو عائلة السيف"}</h2>
                       <p className="text-muted-foreground font-bold text-base md:text-xl opacity-70">نصل العائلة، نحفظ الإرث، ونبني المجتمع.</p>
                    </div>
                    <div className="inline-flex items-center gap-6 rounded-3xl bg-white/5 border border-white/10 px-8 py-4 shadow-xl backdrop-blur-xl">
                       <div className="flex items-center gap-3 text-gold-primary"><Calendar className="size-5" /> <span className="font-black text-foreground"><LiveClock variant="date" /></span></div>
                       <div className="w-px h-6 bg-white/10" />
                       <div className="flex items-center gap-3 text-gold-primary"><Clock className="size-5" /> <span className="font-black text-foreground"><LiveClock variant="time" /></span></div>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        <QuickActionsBanner />
        <PollsPopup userId={meId ?? null} />

        <IntegratedHub upcomingMeetings={upcomingMeetings} upcomingTrips={upcomingTrips} tasksCount={counts.tasks} />

        {heritageSnippet && (
          <Link to="/heritage" className="block group animate-fade-up">
             <div className="card-surface p-8 flex items-center justify-between hover:scale-[1.01] transition-all">
                <div className="flex items-center gap-6">
                   <div className="size-14 rounded-2xl bg-gold-primary/10 flex items-center justify-center text-gold-primary shadow-lg"><Scroll size={28} /></div>
                   <div>
                      <span className="text-[10px] font-black text-gold-primary uppercase tracking-[0.3em]">قبس من التاريخ</span>
                      <h3 className="text-xl font-black text-primary mt-1">{heritageSnippet.title}</h3>
                      <p className="text-sm font-bold text-muted-foreground line-clamp-1 opacity-70 italic">"{heritageSnippet.body}"</p>
                   </div>
                </div>
                <ChevronLeft className="text-gold-primary opacity-30 group-hover:opacity-100 group-hover:-translate-x-2 transition-all" />
             </div>
          </Link>
        )}

        {announcements.length > 0 && (
          <section className="animate-fade-up">
             <Link to="/majlis" className="block group">
                <div className="relative overflow-hidden rounded-[44px] border border-gold-primary/30 bg-gradient-to-br from-primary to-emerald-950 shadow-2xl min-h-[160px] flex items-center p-8 md:p-12">
                   <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 w-full">
                      <div className="size-16 md:size-24 rounded-3xl bg-gold-primary/20 backdrop-blur-xl border border-gold-primary/30 flex items-center justify-center text-gold-primary shrink-0"><Newspaper size={40} /></div>
                      <div className="flex-1 text-center md:text-right">
                         <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold-primary/80">إعلان المجلس</span>
                         <h3 className="text-2xl md:text-4xl font-black text-white mt-1">{announcements[annIndex].title}</h3>
                         <p className="text-sm md:text-lg text-white/70 font-bold line-clamp-2 mt-2">{announcements[annIndex].cleanBody}</p>
                      </div>
                      <ChevronLeft className="size-10 text-gold-primary group-hover:-translate-x-2 transition-transform" />
                   </div>
                </div>
             </Link>
          </section>
        )}

        {/* Stats Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
           <StatCard label="رصيد الصندوق" value={counts.balance} suffix="ر.س" color="from-emerald-600 to-emerald-900" icon={<Wallet className="size-16" />} link="/finance" />
           <StatCard label="أفراد العائلة" value={counts.members} suffix="عضو" color="from-primary to-emerald-950" icon={<Users className="size-16" />} link="/members" />
           <StatCard label="ترفيه عائلي" value={counts.trips} suffix="وجهة" color="from-[#8E7745] to-[#453a22]" icon={<Plane className="size-16" />} link="/trips" />
           <StatCard label="مهام معلقة" value={counts.tasks} suffix="مهمة" color="from-rose-700 to-rose-950" icon={<ListChecks className="size-16" />} link="/tasks" />
        </section>

        {/* Bug Report Section */}
        <section className="pb-20 animate-fade-up">
           <div className="glass-surface p-10 md:p-16 border-dashed border-2 border-primary/20 rounded-[44px] flex flex-col md:flex-row items-center justify-between gap-10 text-center md:text-right">
              <div className="space-y-4">
                 <div className="flex items-center justify-center md:justify-start gap-3 text-rose-500">
                    <ShieldAlert className="size-6" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">الدعم التقني</span>
                 </div>
                 <h3 className="text-3xl font-black text-primary tracking-tight">واجهت مشكلة في النظام؟</h3>
                 <p className="text-lg font-bold text-muted-foreground opacity-70 max-w-xl">أبلغ فريق الإشراف فوراً عن أي عائق برمجي لمساعدتنا في تحسين تجربتك.</p>
              </div>
              <button onClick={() => setShowBugReport(true)} className="px-10 py-5 rounded-3xl bg-rose-500/10 text-rose-600 font-black text-sm border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all shadow-xl flex items-center gap-3">
                 <ShieldAlert size={20} /> إرسال بلاغ فوري
              </button>
           </div>
        </section>
      </div>

      <AnimatePresence>
        {showBugReport && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card border border-border rounded-[40px] w-full max-w-lg p-8 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between"><h3 className="text-xl font-black text-primary">بلاغ عن خطأ تقني</h3><button onClick={() => setShowBugReport(false)} className="size-10 rounded-full bg-muted flex items-center justify-center"><X size={20} /></button></div>
              <div className="space-y-4">
                <textarea value={bugBody} onChange={(e) => setBugBody(e.target.value)} placeholder="صف المشكلة هنا..." rows={5} className="w-full p-6 rounded-3xl bg-muted/40 border border-border font-bold text-sm focus:outline-none focus:border-primary transition-all resize-none shadow-inner" />
                <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-border/60 rounded-3xl cursor-pointer hover:bg-primary/5 transition-all bg-muted/20">
                  {bugImagePreview ? <img src={bugImagePreview} className="h-32 object-contain" alt="Preview" /> : <><ImageIcon className="size-8 text-muted-foreground opacity-30" /><span className="text-xs font-bold text-muted-foreground">إرفاق لقطة شاشة</span></>}
                  <input type="file" hidden accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setBugImage(f); setBugImagePreview(URL.createObjectURL(f)); } }} />
                </label>
              </div>
              <div className="flex gap-3"><button onClick={() => setShowBugReport(false)} className="flex-1 py-4 rounded-2xl font-black text-muted-foreground hover:bg-muted transition-all">تراجع</button><button onClick={sendBugReport} disabled={bugSending || !bugBody.trim()} className="flex-[2] btn-gold py-4 rounded-2xl font-black flex items-center justify-center gap-2">{bugSending ? <Loader2 className="animate-spin size-4" /> : <Send size={16} />} إرسال البلاغ</button></div>
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
       <div className={cn("relative overflow-hidden rounded-[32px] p-6 md:p-8 text-white shadow-xl transition-all duration-500 hover:scale-[1.03] bg-gradient-to-br", color)}>
          <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-all">{icon}</div>
          <div className="relative z-10 space-y-4">
             <p className="text-[10px] md:text-xs font-black uppercase tracking-widest opacity-70">{label}</p>
             <div className="flex items-baseline gap-2">
                <span className="text-2xl md:text-4xl font-black tabular-nums">{new Intl.NumberFormat("ar-SA").format(value)}</span>
                <span className="text-[9px] md:text-[10px] font-bold opacity-60">{suffix}</span>
             </div>
          </div>
       </div>
    </Link>
  );
}
