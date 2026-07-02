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
import { showIsland } from "@/components/dynamic-island";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  component: Dashboard,
});

function Dashboard() {
  const { userId: meId, isLoading: authLoading } = useUserRole();
  const [profile, setProfile] = useState<any>(null);
  const [counts, setCounts] = useState({ members: 0, balance: 0, tasks: 0, trips: 0 });
  const [heritageSnippet, setHeritageSnippet] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [annIndex, setAnnIndex] = useState(0);
  const dynamicLogo = useSiteLogo();
  const hasGreeted = useRef(false);

  const loadData = useCallback(async () => {
    if (!meId) return;
    try {
      const [{ data: p }, { data: mCount }, { data: tx }, { data: tCount }, { data: tData }, { data: news }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", meId).maybeSingle(),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("fund_transactions").select("amount, type"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
        supabase.from("trips").select("id", { count: "exact", head: true }),
        supabase.from("majlis_posts").select("*").eq("kind", "announcement").order("created_at", { ascending: false }).limit(5)
      ]);

      if (p) setProfile(p);

      const bal = (tx || []).reduce((acc, t) => t.type === "contribution" ? acc + Number(t.amount) : acc - Number(t.amount), 0);
      setCounts({ members: mCount.count || 0, balance: bal, tasks: tCount.count || 0, trips: tData.count || 0 });
      setAnnouncements(news || []);

      // Check for pending polls
      const { data: pollPosts } = await supabase.from("majlis_posts").select("id").like("body", "%---poll:%");
      if (pollPosts && pollPosts.length > 0) {
        const { data: myVotes } = await supabase.from("majlis_comments").select("post_id").eq("author_id", meId).in("post_id", pollPosts.map(p => p.id)).like("body", "[VOTE]:%");
        const votedIds = new Set((myVotes || []).map(v => v.post_id));
        const pending = pollPosts.filter(p => !votedIds.has(p.id)).length;

        if (!hasGreeted.current) {
          if (pending > 0) {
            showIsland(`لديك ${pending} اقتراح بانتظار تصويتك`, "info", 8000, () => window.dispatchEvent(new CustomEvent("polls:open")));
          } else {
            showIsland(`طاب يومك يا ${p?.arabic_name?.split(' ')[0] || "عضو السيف"}`, "info", 3000);
          }
          hasGreeted.current = true;
        }
      }

      // Heritage
      const { data: heritage } = await supabase.from("majlis_posts").select("*").ilike("title", "[إرث]%").limit(1).maybeSingle();
      if (heritage) {
        setHeritageSnippet({
          title: heritage.title.replace("[إرث]", "").trim(),
          body: heritage.body.replace(/---kind:.*\n/, "").replace(/---image:.*\n/, "").trim()
        });
      }
    } catch (e) { console.error(e); }
  }, [meId]);

  useEffect(() => { loadData(); }, [loadData]);

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

        <PollsPopup userId={meId ?? null} />

        <IntegratedHub upcomingMeetings={[]} upcomingTrips={[]} tasksCount={counts.tasks} />

        {/* Stats Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
           <StatCard label="رصيد الصندوق" value={counts.balance} suffix="ر.س" color="from-emerald-600 to-emerald-900" icon={<Wallet />} link="/finance" />
           <StatCard label="أفراد العائلة" value={counts.members} suffix="عضو" color="from-primary to-emerald-950" icon={<Users />} link="/members" />
           <StatCard label="ترفيه عائلي" value={counts.trips} suffix="وجهة" color="from-[#8E7745] to-[#453a22]" icon={<Plane />} link="/trips" />
           <StatCard label="مهام معلقة" value={counts.tasks} suffix="مهمة" color="from-rose-700 to-rose-950" icon={<ListChecks />} link="/tasks" />
        </section>

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
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, suffix, color, icon, link }: any) {
  return (
    <Link to={link} className="block group">
       <div className={cn("relative overflow-hidden rounded-[32px] p-6 md:p-8 text-white shadow-xl transition-all duration-500 hover:scale-[1.03] bg-gradient-to-br", color)}>
          <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-all">{icon}</div>
          <div className="relative z-10 space-y-4">
             <p className="text-xs font-black uppercase tracking-widest opacity-70">{label}</p>
             <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-black tabular-nums">{new Intl.NumberFormat("ar-SA").format(value)}</span>
                <span className="text-[10px] font-bold opacity-60">{suffix}</span>
             </div>
          </div>
       </div>
    </Link>
  );
}
