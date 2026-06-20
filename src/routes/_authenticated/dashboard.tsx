import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
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
  MessageCircle,
  Plane,
  Sparkles,
  Plus,
  History,
  Timer,
  ArrowUpRight,
  ChevronRight
} from "lucide-react";
import alsaifMark from "@/assets/alsaif-mark.png.asset.json";
import { AnimatedCounter } from "@/components/dashboard/animated-counter";
import { LiveClock } from "@/components/dashboard/live-clock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "لوحة العائلة — السيف" },
      { name: "description", content: "مركز إدارة عائلة آل سيف." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [profile, setProfile] = useState<{ name: string; role: string; initial: string }>({
    name: "تحميل...", role: "عضو", initial: "س",
  });

  const [fundBalance, setFundBalance] = useState<number>(0);
  const [nextMeeting, setNextMeeting] = useState<any>(null);
  const [tripsCount, setTripsCount] = useState(0);
  const [membersCount, setMembersCount] = useState(0);
  const [tasksCount, setTasksCount] = useState(0);
  const [statIndex, setStatIndex] = useState(0);

  const loadData = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    const { data: p } = await supabase.from("profiles").select("arabic_name, full_name").eq("id", u.user.id).maybeSingle();
    const name = p?.arabic_name || p?.full_name || "عضو العائلة";
    setProfile({ name, role: "مسؤول النظام", initial: name[0] || "س" });

    const [ { count: tc }, { count: mc }, { count: tskc } ] = await Promise.all([
      supabase.from("trips").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("tasks").select("*", { count: "exact", head: true }).neq("status", "done"),
    ]);
    setTripsCount(tc || 0);
    setMembersCount(mc || 0);
    setTasksCount(tskc || 0);

    const { data: meet } = await supabase.from("meetings").select("*").gte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(1).maybeSingle();
    setNextMeeting(meet);

    const { data: txs } = await supabase.from("fund_transactions").select("amount, type");
    const bal = txs?.reduce((acc, t) => Number(t.type === "contribution" ? acc + Number(t.amount) : acc - Number(t.amount)), 0) || 0;
    setFundBalance(bal);
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(() => setStatIndex(prev => (prev + 1) % 4), 6000);
    return () => clearInterval(timer);
  }, [loadData]);

  const stats = [
    { label: "رصيد الصندوق", value: fundBalance, suffix: "ر.س", color: "bg-emerald-600", icon: <Wallet className="size-16" />, link: "/finance" },
    { label: "أفراد العائلة", value: membersCount, suffix: "عضو", color: "bg-primary", icon: <Users className="size-16" />, link: "/members" },
    { label: "الرحلات المجدولة", value: tripsCount, suffix: "رحلة", color: "bg-[#8E7745]", icon: <Plane className="size-16" />, link: "/trips" },
    { label: "مهام قيد التنفيذ", value: tasksCount, suffix: "مهمة", color: "bg-rose-700", icon: <ListChecks className="size-16" />, link: "/tasks" },
  ];

  return (
    <AppShell title="لوحة العائلة" user={profile}>
      <div className="max-w-6xl mx-auto space-y-12 pb-20">

        {/* Centered Hero Greeting */}
        <section className="text-center space-y-6 animate-fade-up">
           <div className="inline-block px-6 py-2 bg-primary/5 rounded-full border border-primary/10 backdrop-blur-sm">
             <LiveClock />
           </div>
           <div className="relative inline-block group">
             <div className="absolute inset-0 bg-gold-primary/20 blur-[100px] rounded-full group-hover:bg-gold-primary/30 transition-all duration-1000" />
             <img src={alsaifMark.url} alt="Logo" className="size-40 md:size-56 object-contain relative z-10 transition-all duration-700 dark:invert" />
           </div>
           <div className="space-y-2">
             <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-tight">
               خالد عبد العزيز
             </h2>
             <p className="text-xl text-muted-foreground font-bold opacity-60">نصل العائلة، نحفظ الإرث، ونبني المستقبل.</p>
           </div>
        </section>

        {/* Quick Actions Grid (Centered) */}
        <section className="animate-fade-up" style={{ animationDelay: "100ms" }}>
           <div className="flex items-center justify-center gap-4 mb-8">
             <div className="h-px w-12 bg-border" />
             <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em]">إجراءات سريعة</h3>
             <div className="h-px w-12 bg-border" />
           </div>
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 px-4">
              <QuickAction to="/chat" label="محادثة" icon={<MessageCircle />} color="bg-blue-500" />
              <QuickAction to="/trips" label="رحلات" icon={<Plane />} color="bg-indigo-500" />
              <QuickAction to="/meetings" label="اجتماعات" icon={<CalendarDays />} color="bg-amber-500" />
              <QuickAction to="/tasks" label="مهام" icon={<ListChecks />} color="bg-rose-500" />
              <QuickAction to="/majlis" label="إعلان" icon={<Megaphone />} color="bg-emerald-500" />
              <QuickAction to="/family-tree" label="الشجرة" icon={<Users />} color="bg-teal-500" />
              <QuickAction to="/finance" label="الصندوق" icon={<Wallet />} color="bg-green-600" />
              <QuickAction to="/profile" label="ملفي" icon={<User />} color="bg-slate-500" />
           </div>
        </section>

        {/* Animated Stats Banner (Banner Style) */}
        <section className="px-4 animate-fade-up" style={{ animationDelay: "200ms" }}>
           <div className="relative overflow-hidden rounded-[48px] h-[280px] shadow-2xl group border-4 border-white dark:border-border">
              {stats.map((stat, i) => (
                <div key={i} className={cn(
                  "absolute inset-0 w-full h-full transition-all duration-1000 ease-in-out flex items-center p-12 md:p-20",
                  stat.color,
                  statIndex === i ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
                )}>
                   <div className="absolute inset-0 opacity-10 pointer-events-none scale-150 rotate-12">
                      <img src={alsaifMark.url} className="size-full object-contain brightness-0 invert" />
                   </div>
                   <div className="relative z-10 flex items-center justify-between w-full text-white">
                      <div className="space-y-6">
                         <div className="flex items-center gap-3 font-black uppercase tracking-[0.4em] text-xs opacity-70">
                            <Sparkles className="size-5" /> {stat.label}
                         </div>
                         <div className="text-6xl md:text-8xl font-black tracking-tighter leading-none flex items-baseline gap-4">
                            <AnimatedCounter value={stat.value} />
                            <span className="text-2xl opacity-50">{stat.suffix}</span>
                         </div>
                         <Link to={stat.link} className="inline-flex items-center gap-3 bg-white/20 hover:bg-white/30 backdrop-blur-xl px-8 py-3 rounded-full text-sm font-black transition-all">
                            التفاصيل <ChevronLeft size={20} />
                         </Link>
                      </div>
                      <div className="hidden lg:flex size-44 rounded-[50px] bg-white/10 backdrop-blur-md items-center justify-center border border-white/20 shadow-inner">
                         {stat.icon}
                      </div>
                   </div>
                </div>
              ))}
              {/* Slider Dots */}
              <div className="absolute bottom-10 right-14 flex gap-3 z-20">
                 {stats.map((_, i) => (
                    <button key={i} onClick={() => setStatIndex(i)} className={cn("h-2 rounded-full transition-all duration-500", statIndex === i ? "w-12 bg-white" : "w-2 bg-white/30")} />
                 ))}
              </div>
           </div>
        </section>

        {/* Event Card */}
        <article className="mx-4 card-surface overflow-hidden flex flex-col md:flex-row border-none shadow-2xl animate-fade-up" style={{ animationDelay: "300ms" }}>
           <div className="flex-1 p-12 space-y-8">
              <div className="space-y-3">
                <span className="text-xs font-black text-gold-primary uppercase tracking-[0.3em] opacity-60">الحدث القادم</span>
                <h3 className="text-4xl font-black text-foreground">{nextMeeting?.title || "لا توجد اجتماعات حالياً"}</h3>
              </div>
              <div className="flex flex-wrap gap-12">
                 <div className="flex items-center gap-4">
                    <div className="size-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-inner"><CalendarDays size={28} /></div>
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-widest opacity-40">الموعد</p>
                       <p className="text-lg font-black">{nextMeeting ? new Date(nextMeeting.scheduled_at).toLocaleDateString("ar-SA", { weekday: 'long', day: 'numeric', month: 'long' }) : "—"}</p>
                    </div>
                 </div>
              </div>
              <Link to="/meetings" className="btn-gold px-12 py-4 text-base shadow-2xl shadow-gold-primary/20 inline-block">تأكيد الحضور</Link>
           </div>
           <div className="md:w-1/3 bg-primary p-12 flex flex-col items-center justify-center text-center text-primary-foreground relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 scale-150 rotate-12"><img src={alsaifMark.url} className="size-full object-contain brightness-0 invert" /></div>
              <div className="relative z-10 space-y-6">
                <div className="size-20 rounded-full bg-white/10 flex items-center justify-center mx-auto border border-white/20"><Timer className="size-10 animate-pulse" /></div>
                <div>
                  <p className="text-[13px] font-black uppercase tracking-widest opacity-60 mb-2">الوقت المتبقي</p>
                  <div className="text-7xl font-black tracking-tighter">4</div>
                  <p className="text-2xl font-black opacity-80">أيام</p>
                </div>
              </div>
           </div>
        </article>

      </div>
      <Link to="/majlis" className="fixed bottom-10 left-10 size-20 rounded-[32px] bg-primary text-primary-foreground flex items-center justify-center shadow-2xl z-50 border-4 border-white/10"><Plus size={36} strokeWidth={3} /></Link>
    </AppShell>
  );
}

function QuickAction({ to, label, icon, color }: any) {
  return (
    <Link to={to} className="group flex flex-col items-center gap-3">
       <div className={cn("size-14 md:size-16 rounded-[22px] flex items-center justify-center text-white shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-1", color)}>
          {icon}
       </div>
       <span className="text-[11px] font-black text-foreground/70 group-hover:text-primary transition-colors">{label}</span>
    </Link>
  );
}
